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
  const key = env.REPLICATE_API_KEY?.trim();
  if (key) return key;
  const legacy = env.REPLICATE_API_TOKEN?.trim();
  return legacy || undefined;
}
