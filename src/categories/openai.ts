/**
 * One cheap vision call. The key stays with the caller. Nothing here logs
 * the photo, the key, or the request body.
 */

import { CATEGORY_CATALOGUE } from './library';
import { MATCH_MODEL } from './pricing';
import { isDone } from './types';

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly imageInputTokens?: number;
}

export interface ClassifyResult {
  readonly raw: unknown;
  readonly usage: TokenUsage | null;
  readonly model: string;
}

const TEXT_URL = 'https://api.openai.com/v1/chat/completions';

export function matchPrompt(): string {
  const lines = CATEGORY_CATALOGUE.map((entry) => {
    if (!isDone(entry)) return `${entry.id}: ${entry.hint}. No lesson drawn yet.`;
    const parts = entry.parts.map((part) => part.id).join(', ');
    return `${entry.id}: ${entry.hint}. Parts: ${parts}. The drawing faces ${entry.facing}.`;
  });
  return [
    'Match this photo to one drawing-lesson category.',
    'Use a category id from the list, or "none" when the subject is not in the list.',
    'A standing person, man, woman, boy, girl, child, statue of a person, figure, or people standing is person-standing.',
    'An anime character, cartoon character, face, portrait, doll, action figure, or superhero is character.',
    'confidence is a fraction from 0 to 1, not a percent.',
    'facing is left, right, front, or unknown. It is the way the head, the front of a vehicle, or a cup handle points. Use front for a flower or a face-on subject.',
    'pose is a short English word such as sitting or standing, or an empty string.',
    'colours has one #rrggbb per part id, sampled from that part of the subject. Ignore the background. Use an empty array when there are no parts.',
    ...lines,
  ].join('\n');
}

export function matchRequestBody(model: string, mediaType: string, imageBase64: string): Record<string, unknown> {
  const ids = [...CATEGORY_CATALOGUE.map((entry) => entry.id), 'none'];
  return {
    model,
    temperature: 0,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: matchPrompt() },
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}`, detail: 'low' } },
      ],
    }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'photo_match',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'confidence', 'facing', 'pose', 'colours'],
          properties: {
            category: { type: 'string', enum: ids },
            confidence: { type: 'number' },
            facing: { type: 'string', enum: ['left', 'right', 'front', 'unknown'] },
            pose: { type: 'string' },
            colours: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['part', 'color'],
                properties: {
                  part: { type: 'string' },
                  color: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  };
}

export async function classifyPhoto(input: {
  readonly apiKey: string;
  readonly model?: string;
  readonly image: Uint8Array;
  readonly mediaType: string;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
}): Promise<ClassifyResult> {
  const model = input.model?.trim() || MATCH_MODEL;
  const body = matchRequestBody(model, input.mediaType, bytesToBase64(input.image));
  const response = await fetchWithRetry(TEXT_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': input.idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: input.signal,
  });
  const payload = await response.json() as unknown;
  if (!response.ok) throw new Error('OpenAI match failed');
  const record = asRecord(payload);
  const choice = Array.isArray(record?.choices) ? asRecord(record.choices[0]) : null;
  const message = choice ? asRecord(choice.message) : null;
  const content = typeof message?.content === 'string' ? message.content : '';
  if (!content) throw new Error('OpenAI match was empty');
  return { raw: JSON.parse(content) as unknown, usage: usageFrom(record?.usage), model };
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x4000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, init);
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return fetch(url, init);
    }
    return response;
  } catch (error) {
    if (isTransient(error)) return fetch(url, init);
    throw error;
  }
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error) || error.name === 'AbortError') return false;
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|socket/i.test(error.message);
}

function usageFrom(value: unknown): TokenUsage | null {
  const record = asRecord(value);
  if (!record) return null;
  const inputTokens = numberOrNull(record.prompt_tokens);
  const outputTokens = numberOrNull(record.completion_tokens);
  if (inputTokens === null || outputTokens === null) return null;
  const details = asRecord(record.prompt_tokens_details);
  const imageInputTokens = details ? numberOrNull(details.image_tokens) : null;
  return {
    inputTokens,
    outputTokens,
    totalTokens: numberOrNull(record.total_tokens) ?? inputTokens + outputTokens,
    ...(imageInputTokens !== null ? { imageInputTokens } : {}),
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}
