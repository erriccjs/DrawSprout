/**
 * The phone shrinks the photo before it leaves the device.
 * A 768 px JPEG is what the doodle route accepts.
 */

export const DOODLE_EDGE = 768;

export interface PreparedDoodlePhoto {
  readonly jpeg: Uint8Array;
  readonly photo: {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
  };
}

export async function prepareDoodlePhoto(file: File): Promise<PreparedDoodlePhoto> {
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
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > DOODLE_EDGE ? DOODLE_EDGE / longest : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Foto tidak dapat dibaca. Pilih gambar lain.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
