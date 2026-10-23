/**
 * Idempotency cache key. The header alone is chosen by the client, so two
 * callers can send the same one. The key also names the client and the body.
 */

export async function scopedCacheKey(
  client: string,
  idempotencyKey: string,
  body: Uint8Array,
  extra = '',
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytesCopy(body));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${client}\n${idempotencyKey}\n${extra}\n${hex}`;
}

function bytesCopy(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
