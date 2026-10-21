/**
 * Browser side of FR-15: orientation, crop, downscale, and a PNG re-encode.
 *
 * `createImageBitmap` applies the camera orientation once. Drawing that bitmap
 * into a canvas and encoding PNG drops EXIF. The pure transforms covered by
 * tests live in `image-ops.ts`; this file is the canvas path those tests describe.
 */

import { PHOTO_LONG_EDGE } from './image-ops';

export interface NormalizedCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const DEFAULT_CROP: NormalizedCrop = { x: 0.08, y: 0.08, width: 0.84, height: 0.84 };

export function clampCrop(crop: NormalizedCrop): NormalizedCrop {
  const width = Math.min(1, Math.max(0.12, crop.width));
  const height = Math.min(1, Math.max(0.12, crop.height));
  return {
    x: Math.min(1 - width, Math.max(0, crop.x)),
    y: Math.min(1 - height, Math.max(0, crop.y)),
    width,
    height,
  };
}

export async function preparePhotoFile(file: File, crop: NormalizedCrop): Promise<Uint8Array> {
  if (file.type !== '' && !file.type.startsWith('image/')) {
    throw new Error('Pilih sebuah foto.');
  }
  const bounded = clampCrop(crop);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Foto tidak dapat dibaca. Pilih gambar lain.');
  }
  try {
    const sx = clamp(Math.round(bounded.x * bitmap.width), 0, bitmap.width - 1);
    const sy = clamp(Math.round(bounded.y * bitmap.height), 0, bitmap.height - 1);
    const sw = clamp(Math.round(bounded.width * bitmap.width), 1, bitmap.width - sx);
    const sh = clamp(Math.round(bounded.height * bitmap.height), 1, bitmap.height - sy);
    const longest = Math.max(sw, sh);
    const scale = longest > PHOTO_LONG_EDGE ? PHOTO_LONG_EDGE / longest : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Foto tidak dapat dibaca. Pilih gambar lain.');
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error('Foto tidak dapat dibaca. Pilih gambar lain.'));
      }, 'image/png');
    });
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
