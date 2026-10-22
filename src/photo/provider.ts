/** Which image service draws the line art. Text names still come from OpenAI when that key is set. */

export type ImageProvider = 'openai' | 'replicate';

export function imageProvider(value: string | undefined): ImageProvider {
  return value === 'replicate' ? 'replicate' : 'openai';
}

/**
 * Worker secret name is `REPLICATE_API_KEY`. `REPLICATE_API_TOKEN` is only a
 * fallback for a local `.dev.vars` or the eval harness.
 */
export function replicateApiKey(env: {
  readonly REPLICATE_API_KEY?: string;
  readonly REPLICATE_API_TOKEN?: string;
}): string | undefined {
  const key = normalizeReplicateKey(env.REPLICATE_API_KEY);
  if (key) return key;
  return normalizeReplicateKey(env.REPLICATE_API_TOKEN);
}

/**
 * A Worker secret is often pasted from an `Authorization` header or a quoted
 * env line. Replicate then answers 401 ("not a valid authentication token")
 * in a few dozen milliseconds, and the photo match becomes a bare 502.
 */
function normalizeReplicateKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/^Bearer\s+/i, '').trim();
  return key || undefined;
}
