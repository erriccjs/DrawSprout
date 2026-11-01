/** Enough of a JPEG to know it is a photo and how big it is. The bytes are not kept. */

export interface JpegSize {
  readonly width: number;
  readonly height: number;
}

export function jpegSize(bytes: Uint8Array): JpegSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    const isSize = marker >= 0xc0 && marker <= 0xc2;
    if (isSize) {
      const height = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      const width = ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0);
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}
