/**
 * JPEG APP1 Exif orientation (1–8). Missing or unreadable data is 1.
 *
 * The browser path does not use this: `createImageBitmap` applies orientation.
 * The eval harness does, so a camera JPEG is not sent sideways. PNG has no
 * JPEG APP1 segment; `reencodePng` is what drops its text chunks.
 */

export function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return 1;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xda || marker === 0xd9) return 1;
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (length < 2 || offset + 2 + length > bytes.length) return 1;
    if (marker === 0xe1 && ascii(bytes, offset + 4, 6) === 'Exif\u0000\u0000') {
      return orientationFromTiff(bytes.subarray(offset + 10, offset + 2 + length)) ?? 1;
    }
    offset += 2 + length;
  }
  return 1;
}

function orientationFromTiff(tiff: Uint8Array): number | null {
  if (tiff.length < 8) return null;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return null;
  const u16 = (at: number) => little
    ? (tiff[at] ?? 0) | ((tiff[at + 1] ?? 0) << 8)
    : ((tiff[at] ?? 0) << 8) | (tiff[at + 1] ?? 0);
  const u32 = (at: number) => little
    ? (tiff[at] ?? 0) | ((tiff[at + 1] ?? 0) << 8) | ((tiff[at + 2] ?? 0) << 16) | ((tiff[at + 3] ?? 0) << 24)
    : ((tiff[at] ?? 0) << 24) | ((tiff[at + 1] ?? 0) << 16) | ((tiff[at + 2] ?? 0) << 8) | (tiff[at + 3] ?? 0);
  if (u16(2) !== 42) return null;
  let ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  ifd += 2;
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + index * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let index = 0; index < length; index += 1) out += String.fromCharCode(bytes[offset + index] ?? 0);
  return out;
}
