/**
 * Which service answers POST /api/photo-match.
 * `replicate` is the default. `openai` remains available.
 */

export type MatchProvider = 'openai' | 'replicate';

export const DEFAULT_MATCH_REPLICATE_MODEL = 'openai/gpt-4.1-mini';

export function matchProvider(value: string | undefined): MatchProvider {
  return value?.trim() === 'openai' ? 'openai' : 'replicate';
}

/** Owner/name only. Anything else falls back to the official mini model. */
export function replicateMatchModel(configured: string | undefined): string {
  const match = /^([A-Za-z0-9][\w.-]*)\/([A-Za-z0-9][\w.-]*)$/.exec(configured?.trim() ?? '');
  const owner = match?.[1];
  const name = match?.[2];
  if (!owner || !name || owner.includes('..') || name.includes('..')) return DEFAULT_MATCH_REPLICATE_MODEL;
  return `${owner}/${name}`;
}
