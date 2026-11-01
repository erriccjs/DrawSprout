/** Asks this site's worker for a line doodle. The photo is not kept by the server. */

import { decodePng, type RgbaImage } from '../photo/png';

export async function requestDoodle(jpeg: Uint8Array, signal: AbortSignal): Promise<RgbaImage> {
  const response = await fetch('/api/doodle', {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg' },
    body: jpeg as unknown as BodyInit,
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.';
    throw new Error(message);
  }
  const png = isRecord(payload) && typeof payload.png === 'string' ? payload.png : '';
  if (!png) throw new Error('Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.');
  return decodePng(base64ToBytes(png));
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
