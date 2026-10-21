/**
 * OpenAI image edit and a short instruction call.
 *
 * The key stays in the caller. Nothing here logs the photo or the key.
 * `Idempotency-Key` is forwarded so a retry of the same job is not a second
 * billed request on OpenAI's side.
 */

import { imagePrompt, imageSize, type ImageQuality, type PhotoVariant } from './prompts';

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly textInputTokens?: number;
  readonly imageInputTokens?: number;
}

export interface ImageEditRequest {
  readonly png: Uint8Array;
  readonly variant: PhotoVariant;
  readonly model: string;
  readonly quality: ImageQuality;
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
  readonly steps: readonly { id: string; phase: string; label: string; position: string }[];
  readonly illustrationPng: Uint8Array;
  readonly signal: AbortSignal;
  readonly idempotencyKey: string;
}

export interface InstructionResult {
  readonly subject: string;
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
        form.set('quality', input.quality);
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
                {
                  type: 'text',
                  text: [
                    'Gambar garis ini adalah panduan menggambar untuk anak.',
                    'Sebutkan subjek dari gambar garis (kata benda bahasa Indonesia, misalnya kucing, cangkir, bunga).',
                    'Judul pendek, 2 sampai 4 kata, menyebut subjek itu.',
                    'Untuk setiap id di daftar, tulis SATU kalimat instruksi bahasa Indonesia yang menyebut subjek dan bagian pada langkah itu.',
                    'Langkah outline pertama adalah garis besar bentuk utama subjek, bukan wajah anak dan bukan latar.',
                    'Langkah warna hanya menamai wilayah besar pada subjek. Jangan menulis "latar belakang".',
                    'Jangan menambah benda, orang, atau bagian yang tidak terlihat pada gambar.',
                    'Jangan menilai gambar anak.',
                    JSON.stringify(input.steps.map((step) => ({
                      id: step.id,
                      phase: step.phase,
                      label: step.label,
                      position: step.position,
                    }))),
                  ].join('\n'),
                },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${bytesToBase64(input.illustrationPng)}` } },
              ],
            }],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'step_instructions',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['subject', 'title', 'steps'],
                  properties: {
                    subject: { type: 'string' },
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
        const subject = typeof parsed.subject === 'string' ? parsed.subject : '';
        const title = typeof parsed.title === 'string' ? parsed.title : '';
        const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
        const instructions = new Map<string, string>();
        for (const step of steps) {
          const row = asRecord(step);
          if (typeof row.id === 'string' && typeof row.instruction === 'string') {
            instructions.set(row.id, row.instruction);
          }
        }
        return { subject, title, instructions, usage: usageFrom(record.usage) };
      },
    },
  };
}

function usageFrom(value: unknown): TokenUsage | null {
  const usage = asRecord(value);
  const input = firstNumber(usage.input_tokens, usage.prompt_tokens);
  const output = firstNumber(usage.output_tokens, usage.completion_tokens);
  const total = typeof usage.total_tokens === 'number' ? usage.total_tokens : null;
  if (input === null && output === null && total === null) return null;
  const details = asRecord(usage.input_tokens_details);
  const textInputTokens = typeof details.text_tokens === 'number' ? details.text_tokens : undefined;
  const imageInputTokens = typeof details.image_tokens === 'number' ? details.image_tokens : undefined;
  return {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    totalTokens: total ?? (input ?? 0) + (output ?? 0),
    ...(textInputTokens !== undefined ? { textInputTokens } : {}),
    ...(imageInputTokens !== undefined ? { imageInputTokens } : {}),
  };
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
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
