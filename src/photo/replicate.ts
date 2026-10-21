/**
 * Replicate image models as the same editor the OpenAI path implements.
 *
 * The key stays in the caller. Nothing here logs the photo or the key.
 * `Idempotency-Key` is sent on the create call. `Prefer: wait` holds the
 * connection, then this polls, and an abort cancels the prediction.
 */

import { bytesToBase64, type ImageEditor, type ImageEditRequest, type ImageEditResult } from './openai';
import { replicatePrompt } from './prompts';

export const DEFAULT_REPLICATE_MODEL = 'black-forest-labs/flux-kontext-pro';

/** Official models this spike knows how to call. Other owner/name ids are allowed for a comparison run. */
export const REPLICATE_MODELS = [
  DEFAULT_REPLICATE_MODEL,
  'black-forest-labs/flux-1.1-pro',
] as const;

const PREDICT_URL = 'https://api.replicate.com/v1/models';

export function replicateModelFor(configured: string | undefined): string {
  const trimmed = configured?.trim();
  if (trimmed && /^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed;
  return DEFAULT_REPLICATE_MODEL;
}

/**
 * flux-1.1-pro is unsuitable for this spike: it returns near-photos.
 * An explicit model id can still call it. Compare runs do not.
 * Kontext edits the photo. flux-1.1-pro is text-to-image and only uses the photo as guidance.
 */
export function replicateUsesImagePrompt(model: string): boolean {
  return model === 'black-forest-labs/flux-1.1-pro' || model.endsWith('/flux-1.1-pro');
}

export function replicateAspect(width: number, height: number): string {
  const ratio = width / Math.max(1, height);
  const choices: ReadonlyArray<readonly [string, number]> = [
    ['1:1', 1],
    ['16:9', 16 / 9],
    ['9:16', 9 / 16],
    ['4:3', 4 / 3],
    ['3:4', 3 / 4],
    ['3:2', 3 / 2],
    ['2:3', 2 / 3],
  ];
  let best = '1:1';
  let gap = Number.POSITIVE_INFINITY;
  for (const [label, value] of choices) {
    const distance = Math.abs(Math.log(ratio / value));
    if (distance < gap) {
      gap = distance;
      best = label;
    }
  }
  return best;
}

let replicateTail: Promise<void> = Promise.resolve();

/** One Replicate prediction at a time. The account bursts at one request. */
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = replicateTail.then(work, work);
  replicateTail = run.then(() => undefined, () => undefined);
  return run;
}

export function replicateEditor(apiKey: string): ImageEditor {
  return {
    edit(input) {
      return enqueue(() => runPrediction(apiKey, input));
    },
  };
}

async function runPrediction(apiKey: string, input: ImageEditRequest): Promise<ImageEditResult> {
  const model = replicateModelFor(input.model);
  const created = await createPrediction(apiKey, model, input);
  let current = created;
  const deadline = Date.now() + 110_000;
  while (current.status === 'starting' || current.status === 'processing') {
    if (input.signal.aborted || Date.now() > deadline) {
      await cancelPrediction(apiKey, current.id);
      throw new Error(input.signal.aborted ? 'Replicate prediction cancelled' : 'Replicate prediction timed out');
    }
    try {
      await sleep(1000, input.signal);
    } catch (error) {
      await cancelPrediction(apiKey, current.id);
      throw new Error('Replicate prediction cancelled', { cause: error });
    }
    if (Date.now() > deadline) {
      await cancelPrediction(apiKey, current.id);
      throw new Error('Replicate prediction timed out');
    }
    try {
      current = await getPrediction(apiKey, current.id, input.signal);
    } catch (error) {
      if (input.signal.aborted) {
        await cancelPrediction(apiKey, current.id);
        throw new Error('Replicate prediction cancelled', { cause: error });
      }
      throw error;
    }
  }
  if (current.status !== 'succeeded') {
    throw new Error(current.error || `Replicate prediction ${current.status || 'failed'}`);
  }
  const png = await readOutput(current.output, input.signal);
  return { png, usage: null };
}

interface Prediction {
  readonly id: string;
  readonly status: string;
  readonly output: unknown;
  readonly error: string;
}

async function createPrediction(apiKey: string, model: string, input: ImageEditRequest): Promise<Prediction> {
  const dataUrl = `data:image/png;base64,${bytesToBase64(input.png)}`;
  const prompt = replicatePrompt(input.reinforceSilhouette === true, input.reinforceSubject === true);
  const body = replicateUsesImagePrompt(model)
    ? {
      input: {
        prompt,
        image_prompt: dataUrl,
        aspect_ratio: replicateAspect(input.width, input.height),
        output_format: 'png',
      },
    }
    : {
      input: {
        prompt,
        input_image: dataUrl,
        aspect_ratio: 'match_input_image',
        output_format: 'png',
      },
    };
  const response = await fetchWithBackoff(`${PREDICT_URL}/${model}/predictions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      prefer: 'wait=60',
      'idempotency-key': input.idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: input.signal,
  }, input.signal);
  const payload = await readJson(response);
  if (!response.ok) throw new Error(replicateMessage(payload, response.status));
  return asPrediction(payload);
}

async function fetchWithBackoff(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt === 3) return response;
    last = response;
    await sleep(retryDelay(response, attempt), signal);
  }
  if (last) return last;
  throw new Error('Replicate request failed');
}

function retryDelay(response: Response, attempt: number): number {
  const header = Number(response.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return Math.min(20_000, header * 1000);
  return Math.min(8_000, 400 * 2 ** attempt);
}

async function getPrediction(apiKey: string, id: string, signal: AbortSignal): Promise<Prediction> {
  const response = await fetchWithBackoff(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal,
  }, signal);
  const payload = await readJson(response);
  if (!response.ok) throw new Error(replicateMessage(payload, response.status));
  return asPrediction(payload);
}

async function cancelPrediction(apiKey: string, id: string): Promise<void> {
  if (!id) return;
  try {
    await fetch(`https://api.replicate.com/v1/predictions/${id}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // The caller is already aborting or timing out.
  }
}

async function readOutput(output: unknown, signal: AbortSignal): Promise<Uint8Array> {
  const url = typeof output === 'string'
    ? output
    : Array.isArray(output) && typeof output[0] === 'string'
      ? output[0]
      : '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Replicate did not return an image');
  }
  const host = parsed.hostname;
  if (parsed.protocol !== 'https:' || (host !== 'replicate.delivery' && !host.endsWith('.replicate.delivery'))) {
    throw new Error('Replicate image URL was not accepted');
  }
  const response = await fetch(parsed, { signal });
  if (!response.ok) throw new Error('Replicate image download failed');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 137) throw new Error('Replicate did not return a PNG');
  return bytes;
}

function asPrediction(value: unknown): Prediction {
  const record = asRecord(value);
  return {
    id: typeof record.id === 'string' ? record.id : '',
    status: typeof record.status === 'string' ? record.status : '',
    output: record.output,
    error: typeof record.error === 'string' ? record.error.slice(0, 180) : '',
  };
}

function replicateMessage(payload: unknown, status: number): string {
  const record = asRecord(payload);
  const detail = typeof record.detail === 'string' ? record.detail.slice(0, 180) : '';
  const title = typeof record.title === 'string' ? record.title.slice(0, 180) : '';
  return detail || title || `Replicate request failed (${status})`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Replicate prediction cancelled'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Replicate prediction cancelled'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
