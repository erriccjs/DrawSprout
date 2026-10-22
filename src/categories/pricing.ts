/**
 * List price for the photo-match call.
 *
 * gpt-4.1-mini, read from OpenAI's standard rates in October 2026: $0.40 per
 * 1M input tokens and $1.60 per 1M output tokens. The photo is input tokens.
 * There is no image-generation charge on this path.
 */

export const MATCH_MODEL = 'gpt-4.1-mini';

export const MATCH_USD_PER_MILLION = {
  input: 0.4,
  output: 1.6,
} as const;

export function matchCostUsd(usage: { readonly inputTokens: number; readonly outputTokens: number }): number {
  const usd = (usage.inputTokens * MATCH_USD_PER_MILLION.input
    + usage.outputTokens * MATCH_USD_PER_MILLION.output) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
