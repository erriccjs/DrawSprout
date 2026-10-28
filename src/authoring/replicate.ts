/**
 * Asks Replicate's openai/gpt-4.1-mini for a draft lesson.
 * The key is an argument. Callers keep it in the environment and never send
 * it to the browser.
 */

import { replicateMatchModel } from '../categories/provider';
import { parseDraft, type DraftLesson } from './model';
import { draftPrompt } from './prompt';

const PREDICT_URL = 'https://api.replicate.com/v1/models';

export async function draftLessonWithReplicate(input: {
  readonly apiKey: string;
  readonly name: string;
  readonly signal?: AbortSignal;
  readonly fetch?: typeof fetch;
  readonly model?: string;
}): Promise<DraftLesson> {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error('Name the thing to draw.');
  const model = replicateMatchModel(input.model);
  const [owner, modelName] = model.split('/');
  const words = draftPrompt(name);
  const call = input.fetch ?? fetch;
  const response = await call(`${PREDICT_URL}/${encodeURIComponent(owner ?? '')}/${encodeURIComponent(modelName ?? '')}/predictions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
      prefer: 'wait=60',
    },
    body: JSON.stringify({
      input: {
        prompt: words.prompt,
        system_prompt: words.system,
        temperature: 0.4,
        max_completion_tokens: 4000,
      },
    }),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(redact(messageOf(payload, response.status), input.apiKey));
  }
  const output = isRecord(payload) ? payload.output : null;
  const text = textOf(output);
  if (!text.trim()) throw new Error('The model returned an empty lesson.');
  return parseDraft(parseJson(text));
}

function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('The model did not return a lesson.');
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

function textOf(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.filter((item): item is string => typeof item === 'string').join('');
  return '';
}

function messageOf(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.detail === 'string') return payload.detail;
  if (isRecord(payload) && typeof payload.error === 'string') return payload.error;
  return `The model call failed (${status}).`;
}

function redact(text: string, key: string): string {
  return key ? text.split(key).join('[key]') : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
