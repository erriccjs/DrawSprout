/**
 * OpenAI image edit and a short instruction call.
 *
 * The key stays in the caller. Nothing here logs the photo or the key.
 * `Idempotency-Key` is forwarded so a retry of the same job is not a second
 * billed request on OpenAI's side.
 */

import { imagePrompt, imageSize, type PhotoVariant } from './prompts';

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface ImageEditRequest {
  readonly png: Uint8Array;
  readonly variant: PhotoVariant;
  readonly model: string;
  readonly width: number;
  readonly height: number;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
}

export interface ImageEditResult {
  readonly png: Uint8Array;
  readonly usage: TokenUsage | null;
}

export interface ImageEditor {
  edit(input: ImageEditRequest): Promise<ImageEditResult>;
}

export interface InstructionRequest {
  readonly model: string;
  readonly steps: readonly { id: string; phase: string }[];
  readonly signal: AbortSignal;
  readonly idempotencyKey: string;
}

export interface InstructionResult {
  readonly title: string;
  readonly instructions: ReadonlyMap<string, string>;
  readonly usage: TokenUsage | null;
}

export interface InstructionWriter {
  write(input: InstructionRequest): Promise<InstructionResult>;
}

const IMAGE_URL = 'https://api.openai.com/v1/images/edits';
const TEXT_URL = 'https://api.openai.com/v1/chat/completions';

export function openAiClients(apiKey: string): { images: ImageEditor; instructions: InstructionWriter } {
  return {
    images: {
      async edit(input) {
        const form = new FormData();
        form.set('model', input.model);
        form.set('prompt', imagePrompt(input.variant));
        form.set('size', imageSize(input.width, input.height));
        form.set('n', '1');
        form.set('output_format', 'png');
        form.set('image', new File([toBlobPart(input.png)], 'photo.png', { type: 'image/png' }));
        const response = await fetch(IMAGE_URL, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'idempotency-key': input.idempotencyKey,
          },
          body: form,
          signal: input.signal,
        });
        const payload = await readJson(response);
        if (!response.ok) throw new Error(openAiMessage(payload, response.status));
        const record = asRecord(payload);
        const data = Array.isArray(record.data) ? asRecord(record.data[0]) : null;
        const b64 = typeof data?.b64_json === 'string' ? data.b64_json : '';
        if (!b64) throw new Error('OpenAI did not return a PNG');
        return { png: base64ToBytes(b64), usage: usageFrom(record.usage) };
      },
    },
    instructions: {
      async write(input) {
        const response = await fetch(TEXT_URL, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            'idempotency-key': `${input.idempotencyKey}-text`,
          },
          body: JSON.stringify({
            model: input.model,
            messages: [{
              role: 'user',
              content: [
                'Tulis judul pendek dan satu kalimat instruksi bahasa Indonesia untuk setiap langkah.',
                'Satu tujuan yang mudah diucapkan. Jangan menilai gambar anak. Jangan menambah bagian yang tidak ada.',
                JSON.stringify(input.steps),
              ].join('\n'),
            }],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'step_instructions',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title', 'steps'],
                  properties: {
                    title: { type: 'string' },
                    steps: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['id', 'instruction'],
                        properties: {
                          id: { type: 'string' },
                          instruction: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          signal: input.signal,
        });
        const payload = await readJson(response);
        if (!response.ok) throw new Error(openAiMessage(payload, response.status));
        const record = asRecord(payload);
        const choice = Array.isArray(record.choices) ? asRecord(record.choices[0]) : null;
        const message = choice ? asRecord(choice.message) : null;
        const content = typeof message?.content === 'string' ? message.content : '';
        const parsed = asRecord(JSON.parse(content) as unknown);
        const title = typeof parsed.title === 'string' ? parsed.title : '';
        const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
        const instructions = new Map<string, string>();
        for (const step of steps) {
          const row = asRecord(step);
          if (typeof row.id === 'string' && typeof row.instruction === 'string') {
            instructions.set(row.id, row.instruction);
          }
        }
        return { title, instructions, usage: usageFrom(record.usage) };
      },
    },
  };
}

function usageFrom(value: unknown): TokenUsage | null {
  const usage = asRecord(value);
  if (typeof usage.total_tokens !== 'number') return null;
  return {
    inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : 0,
    outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
    totalTokens: usage.total_tokens,
  };
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

function openAiMessage(payload: unknown, status: number): string {
  const error = asRecord(asRecord(payload).error);
  const message = typeof error.message === 'string' ? error.message.slice(0, 180) : '';
  return message || `OpenAI request failed (${status})`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
