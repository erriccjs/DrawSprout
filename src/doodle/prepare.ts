/**
 * The phone crops to the subject and shrinks the photo before it leaves
 * the device.
 * A 768 px JPEG is what the doodle route accepts.
 */

import { clampCrop, type NormalizedCrop } from '../photo/prepare';

export const DOODLE_EDGE = 768;

export interface PreparedDoodlePhoto {
  readonly jpeg: Uint8Array;
  readonly photo: {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
  };
}

export async function prepareDoodlePhoto(
  file: File,
  crop: NormalizedCrop,
): Promise<PreparedDoodlePhoto> {
  if (file.type !== '' && !file.type.startsWith('image/')) {
    throw new Error('Pilih sebuah foto.');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Foto tidak dapat dibaca. Pilih gambar lain.');
  }
  try {
    // The subject the parent framed is the whole picture from here on, so the
    // doodle and the colour samples share one frame.
    const bounded = clampCrop(crop);
    const sx = clamp(Math.round(bounded.x * bitmap.width), 0, bitmap.width - 1);
    const sy = clamp(Math.round(bounded.y * bitmap.height), 0, bitmap.height - 1);
    const sw = clamp(Math.round(bounded.width * bitmap.width), 1, bitmap.width - sx);
    const sh = clamp(Math.round(bounded.height * bitmap.height), 1, bitmap.height - sy);
    const longest = Math.max(sw, sh);
    const scale = longest > DOODLE_EDGE ? DOODLE_EDGE / longest : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Foto tidak dapat dibaca. Pilih gambar lain.');
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error('Foto tidak dapat dibaca. Pilih gambar lain.'));
      }, 'image/jpeg', 0.85);
    });
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    return {
      jpeg,
      photo: { width: canvas.width, height: canvas.height, data: new Uint8Array(pixels.data) },
    };
  } finally {
    bitmap.close();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
