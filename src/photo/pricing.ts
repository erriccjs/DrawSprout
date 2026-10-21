/**
 * OpenAI standard list prices, read October 2026.
 *
 * USD per 1M tokens. Batch and cached rates are not applied. Image output
 * tokens are priced as image output. When an image response does not split
 * input tokens, every input token is priced as image input (the photo is
 * the bulk of the request). See D-67.
 */

import type { TokenUsage } from './openai';
import { IMAGE_MODELS, type ImageModel } from './prompts';

/**
 * Replicate official-model list prices, USD per output image, read from
 * Replicate's pricing page on 20 October 2026. Not a per-second GPU estimate.
 */
export const REPLICATE_IMAGE_USD: Readonly<Record<string, number>> = {
  'black-forest-labs/flux-kontext-pro': 0.04,
  'black-forest-labs/flux-1.1-pro': 0.04,
};

interface ImageListPrice {
  readonly textInput: number;
  readonly imageInput: number;
  readonly imageOutput: number;
}

export const IMAGE_LIST_USD_PER_MILLION: Record<ImageModel, ImageListPrice> = {
  'gpt-image-2': { textInput: 5, imageInput: 8, imageOutput: 30 },
  'gpt-image-1.5': { textInput: 5, imageInput: 8, imageOutput: 32 },
  'gpt-image-1': { textInput: 5, imageInput: 10, imageOutput: 40 },
  'gpt-image-1-mini': { textInput: 2, imageInput: 2.5, imageOutput: 8 },
};

export const TEXT_LIST_USD_PER_MILLION: Readonly<Record<string, { readonly input: number; readonly output: number }>> = {
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export interface ListCost {
  readonly usd: number | null;
  readonly imageUsd: number | null;
  readonly textUsd: number | null;
}

export function imageEditUsd(model: string, usage: TokenUsage): number | null {
  if (!isImageModel(model)) return null;
  const rates = IMAGE_LIST_USD_PER_MILLION[model];
  const split = splitInput(usage);
  const usd = (split.text * rates.textInput + split.image * rates.imageInput + usage.outputTokens * rates.imageOutput) / 1_000_000;
  return money(usd);
}

export function textEditUsd(model: string, usage: TokenUsage): number | null {
  const rates = TEXT_LIST_USD_PER_MILLION[model];
  if (!rates) return null;
  return money((usage.inputTokens * rates.input + usage.outputTokens * rates.output) / 1_000_000);
}

/** Image cost plus text cost. Unpriced text is omitted, not treated as free in `textUsd` (that field stays null). */
export function replicateImageUsd(model: string): number | null {
  return REPLICATE_IMAGE_USD[model] ?? null;
}

export function listCostUsd(input: {
  readonly imageModel: string;
  readonly image: TokenUsage | null;
  readonly textModel: string;
  readonly text: TokenUsage | null;
}): ListCost {
  const flat = replicateImageUsd(input.imageModel);
  const imageUsd = flat !== null ? flat : (input.image ? imageEditUsd(input.imageModel, input.image) : null);
  const textUsd = input.text ? textEditUsd(input.textModel, input.text) : null;
  if (imageUsd === null) return { usd: null, imageUsd: null, textUsd };
  return { usd: money(imageUsd + (textUsd ?? 0)), imageUsd, textUsd };
}

function splitInput(usage: TokenUsage): { text: number; image: number } {
  if (usage.textInputTokens === undefined && usage.imageInputTokens === undefined) {
    return { text: 0, image: usage.inputTokens };
  }
  const text = usage.textInputTokens ?? Math.max(0, usage.inputTokens - (usage.imageInputTokens ?? 0));
  const image = usage.imageInputTokens ?? Math.max(0, usage.inputTokens - text);
  return { text, image };
}

function isImageModel(model: string): model is ImageModel {
  return (IMAGE_MODELS as readonly string[]).includes(model);
}

function money(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
