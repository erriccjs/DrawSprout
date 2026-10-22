/**
 * Photo match through Replicate's official `openai/gpt-4.1-mini`.
 *
 * The photo goes in `image_input` as a data URI. The key stays with the
 * caller. Nothing here logs the photo, the key, or the request body.
 * `Prefer: wait` holds the create call, then this polls until the prediction
 * finishes or the caller's signal aborts.
 */

import { bytesToBase64, matchPrompt, type ClassifyResult, type TokenUsage } from './openai';
import { replicateMatchModel } from './provider';

const PREDICT_URL = 'https://api.replicate.com/v1/models';
const PREFER_WAIT_SECONDS = 20;
const POLL_MS = 1_000;

export function replicateMatchInput(mediaType: string, imageBase64: string): Record<string, unknown> {
  return {
    prompt: `${matchPrompt()}\nReturn one JSON object and nothing else.`,
    system_prompt: 'You match a photo to a drawing lesson. Return only JSON with category, confidence, facing, pose, and colours.',
    image_input: [`data:${mediaType};base64,${imageBase64}`],
    temperature: 0,
    max_completion_tokens: 400,
  };
}

export async function classifyWithReplicate(input: {
  readonly apiKey: string;
  readonly model?: string;
  readonly image: Uint8Array;
  readonly mediaType: string;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
}): Promise<ClassifyResult> {
  const model = replicateMatchModel(input.model);
  const body = {
    input: replicateMatchInput(input.mediaType, bytesToBase64(input.image)),
  };
  const created = await createPrediction(input.apiKey, model, body, input.idempotencyKey, input.signal);
  const finished = await waitForPrediction(input.apiKey, created, input.signal);
  const text = textFromOutput(finished.output);
  if (!text.trim()) throw new Error('Replicate match was empty');
  return { raw: parseModelJson(text), usage: usageFromMetrics(finished.metrics), model };
}

interface Prediction {
  readonly id: string;
  readonly status: string;
  readonly output: unknown;
  readonly error: string;
  readonly metrics: unknown;
}

async function createPrediction(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<Prediction> {
  const [owner, name] = model.split('/');
  const response = await fetchWithRetry(`${PREDICT_URL}/${encodeURIComponent(owner ?? '')}/${encodeURIComponent(name ?? '')}/predictions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      prefer: `wait=${PREFER_WAIT_SECONDS}`,
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(body),
    signal,
  }, signal);
  const payload = await readJson(response);
  if (!response.ok) throw new Error(replicateMessage(payload, response.status));
  return asPrediction(payload);
}

async function waitForPrediction(apiKey: string, created: Prediction, signal: AbortSignal): Promise<Prediction> {
  let current = created;
  while (current.status === 'starting' || current.status === 'processing') {
    if (signal.aborted) {
      await cancelPrediction(apiKey, current.id);
      throw new Error('Replicate match timed out');
    }
    try {
      await sleep(POLL_MS, signal);
    } catch (error) {
      await cancelPrediction(apiKey, current.id);
      throw new Error('Replicate match timed out', { cause: error });
    }
    try {
      current = await getPrediction(apiKey, current.id, signal);
    } catch (error) {
      if (signal.aborted) {
        await cancelPrediction(apiKey, current.id);
        throw new Error('Replicate match timed out', { cause: error });
      }
      throw error;
    }
  }
  if (current.status !== 'succeeded') {
    throw new Error(current.error || `Replicate match ${current.status || 'failed'}`);
  }
  return current;
}

async function getPrediction(apiKey: string, id: string, signal: AbortSignal): Promise<Prediction> {
  if (!/^[\w-]+$/.test(id)) throw new Error('Replicate prediction id was not accepted');
  const response = await fetchWithRetry(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal,
  }, signal);
  const payload = await readJson(response);
  if (!response.ok) throw new Error(replicateMessage(payload, response.status));
  return asPrediction(payload);
}

async function cancelPrediction(apiKey: string, id: string): Promise<void> {
  if (!/^[\w-]+$/.test(id)) return;
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

async function fetchWithRetry(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  try {
    const response = await fetch(url, init);
    if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
      await sleep(400, signal);
      return fetch(url, init);
    }
    return response;
  } catch (error) {
    if (signal.aborted || !isTransient(error)) throw error;
    return fetch(url, init);
  }
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error) || error.name === 'AbortError') return false;
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|socket/i.test(error.message);
}

function textFromOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    return output.filter((item): item is string => typeof item === 'string').join('');
  }
  return '';
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Replicate match was empty');
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

function usageFromMetrics(metrics: unknown): TokenUsage | null {
  const record = asRecord(metrics);
  if (!record) return null;
  const inputTokens = numberOrNull(record.input_token_count) ?? numberOrNull(record.token_input_count);
  const outputTokens = numberOrNull(record.output_token_count) ?? numberOrNull(record.token_output_count);
  if (inputTokens === null || outputTokens === null) return null;
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

function asPrediction(value: unknown): Prediction {
  const record = asRecord(value) ?? {};
  const error = typeof record.error === 'string' ? safeDetail(record.error) : '';
  return {
    id: typeof record.id === 'string' ? record.id : '',
    status: typeof record.status === 'string' ? record.status : '',
    output: record.output,
    error,
    metrics: record.metrics,
  };
}

function replicateMessage(payload: unknown, status: number): string {
  const record = asRecord(payload);
  const detail = typeof record?.detail === 'string' ? safeDetail(record.detail) : '';
  const title = typeof record?.title === 'string' ? safeDetail(record.title) : '';
  return detail || title || `Replicate match failed (${status})`;
}

function safeDetail(value: string): string {
  return value
    .replace(/data:[^\s'"]+/gi, '[image]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9+/]{40,}/g, '[redacted]')
    .slice(0, 180);
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Replicate match timed out'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Replicate match timed out'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
