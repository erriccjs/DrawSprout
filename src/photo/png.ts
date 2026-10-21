/**
 * PNG decode and encode for 8-bit non-interlaced images.
 *
 * The browser re-encodes photos through a canvas. This codec is the same idea
 * for the Worker and the eval harness: pixels in, a new PNG out, so text
 * chunks and camera metadata do not survive. IDAT uses the platform deflate
 * stream (Node, Workers, and browsers).
 */

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export async function decodePng(bytes: Uint8Array): Promise<RgbaImage> {
  for (let i = 0; i < SIGNATURE.length; i += 1) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('Not a PNG');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) throw new Error('PNG chunk is truncated');
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }
  if (width <= 0 || height <= 0) throw new Error('PNG has no image header');
  if (bitDepth !== 8) throw new Error('Only 8-bit PNGs are accepted');
  if (interlace !== 0) throw new Error('Interlaced PNGs are not accepted');
  const channels = channelsFor(colorType);
  const inflated = await inflate(concat(idat));
  const stride = width * channels;
  const expected = height * (stride + 1);
  if (inflated.length < expected) throw new Error('PNG pixel data is short');
  const raw = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[y * (stride + 1)] ?? 0;
    const rowStart = y * (stride + 1) + 1;
    const prev = y === 0 ? null : raw.subarray((y - 1) * stride, y * stride);
    const dest = raw.subarray(y * stride, (y + 1) * stride);
    unfilter(filter, inflated.subarray(rowStart, rowStart + stride), dest, prev, channels);
  }
  return { width, height, data: toRgba(raw, width, height, colorType) };
}

export async function encodePng(image: RgbaImage): Promise<Uint8Array> {
  const { width, height, data } = image;
  if (data.length !== width * height * 4) throw new Error('RGBA buffer does not match the image size');
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    raw[start] = 0;
    raw.set(data.subarray(y * stride, (y + 1) * stride), start + 1);
  }
  const compressed = await deflate(raw);
  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', new Uint8Array()),
  ];
  const body = concat(chunks);
  const out = new Uint8Array(SIGNATURE.length + body.length);
  out.set(SIGNATURE, 0);
  out.set(body, SIGNATURE.length);
  return out;
}

/** Decode then encode. Text chunks and other metadata are not copied. */
export async function reencodePng(bytes: Uint8Array): Promise<Uint8Array> {
  return encodePng(await decodePng(bytes));
}

function channelsFor(colorType: number): number {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error('Indexed or unknown PNG colour type');
}

function toRgba(raw: Uint8Array, width: number, height: number, colorType: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const channels = channelsFor(colorType);
  for (let i = 0, p = 0; i < width * height; i += 1, p += channels) {
    const o = i * 4;
    if (colorType === 0) {
      const v = raw[p] ?? 0;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    } else if (colorType === 2) {
      out[o] = raw[p] ?? 0;
      out[o + 1] = raw[p + 1] ?? 0;
      out[o + 2] = raw[p + 2] ?? 0;
      out[o + 3] = 255;
    } else if (colorType === 4) {
      const v = raw[p] ?? 0;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = raw[p + 1] ?? 255;
    } else {
      out[o] = raw[p] ?? 0;
      out[o + 1] = raw[p + 1] ?? 0;
      out[o + 2] = raw[p + 2] ?? 0;
      out[o + 3] = raw[p + 3] ?? 255;
    }
  }
  return out;
}

function unfilter(
  filter: number,
  src: Uint8Array,
  dest: Uint8Array,
  prev: Uint8Array | null,
  channels: number,
): void {
  for (let i = 0; i < src.length; i += 1) {
    const left = i >= channels ? (dest[i - channels] ?? 0) : 0;
    const up = prev ? (prev[i] ?? 0) : 0;
    const upLeft = prev && i >= channels ? (prev[i - channels] ?? 0) : 0;
    const value = src[i] ?? 0;
    if (filter === 0) dest[i] = value;
    else if (filter === 1) dest[i] = (value + left) & 255;
    else if (filter === 2) dest[i] = (value + up) & 255;
    else if (filter === 3) dest[i] = (value + ((left + up) >> 1)) & 255;
    else if (filter === 4) dest[i] = (value + paeth(left, up, upLeft)) & 255;
    else throw new Error('Unknown PNG filter');
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const dl = Math.abs(estimate - left);
  const du = Math.abs(estimate - up);
  const dlu = Math.abs(estimate - upLeft);
  if (dl <= du && dl <= dlu) return left;
  if (du <= dlu) return up;
  return upLeft;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate');
  const writer = stream.writable.getWriter();
  await writer.write(copied(bytes));
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate');
  const writer = stream.writable.getWriter();
  await writer.write(copied(bytes));
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function copied(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeUint32(out, 0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  writeUint32(out, 8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i] ?? 0);
  return out;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 255]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
