/**
 * One vision call for a photo match. The provider chooses Replicate or OpenAI.
 * A missing key throws `MissingMatchKey`. The photo is not logged.
 */

import { MissingMatchKey } from './http';
import { classifyPhoto, type ClassifyResult } from './openai';
import { matchProvider, type MatchProvider } from './provider';
import { classifyWithReplicate } from './replicate';

export async function classifyMatch(input: {
  readonly provider?: string;
  readonly openaiKey?: string;
  readonly replicateKey?: string;
  readonly openaiModel?: string;
  readonly replicateModel?: string;
  readonly image: Uint8Array;
  readonly mediaType: string;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
}): Promise<ClassifyResult> {
  const provider: MatchProvider = matchProvider(input.provider);
  if (provider === 'openai') {
    if (!input.openaiKey) throw new MissingMatchKey();
    return classifyPhoto({
      apiKey: input.openaiKey,
      ...(input.openaiModel ? { model: input.openaiModel } : {}),
      image: input.image,
      mediaType: input.mediaType,
      idempotencyKey: input.idempotencyKey,
      signal: input.signal,
    });
  }
  if (!input.replicateKey) throw new MissingMatchKey();
  return classifyWithReplicate({
    apiKey: input.replicateKey,
    ...(input.replicateModel ? { model: input.replicateModel } : {}),
    image: input.image,
    mediaType: input.mediaType,
    idempotencyKey: input.idempotencyKey,
    signal: input.signal,
  });
}
