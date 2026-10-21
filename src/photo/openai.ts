/**
 * OpenAI image edit and a short instruction call.
 *
 * The key stays in the caller. Nothing here logs the photo or the key.
 * `Idempotency-Key` is forwarded so a retry of the same job is not a second
 * billed request on OpenAI's side.
 */

import { knownPrimitive, type ShapeProposal } from './shapes';
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
  readonly reinforceSilhouette?: boolean;
}

export interface ImageEditResult {
  readonly png: Uint8Array;
  readonly usage: TokenUsage | null;
}

export interface ImageEditor {
  edit(input: ImageEditRequest): Promise<ImageEditResult>;
}

export interface ShapeTargetInput {
  readonly id: string;
  readonly primitive: string;
  readonly pair: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface InstructionRequest {
  readonly model: string;
  readonly targets: readonly ShapeTargetInput[];
  readonly illustrationPng: Uint8Array;
  readonly signal: AbortSignal;
  readonly idempotencyKey: string;
}

export interface InstructionResult {
  readonly subject: string;
  readonly title: string;
  readonly parts: readonly ShapeProposal[];
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
        form.set('prompt', imagePrompt(input.variant, input.reinforceSilhouette === true));
        form.set('quality', input.quality);
        form.set('size', imageSize(input.width, input.height));
        form.set('n', '1');
        form.set('background', 'opaque');
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
                    'Gambar garis ini adalah panduan menggambar untuk anak, seperti buku how-to-draw.',
                    'Sebutkan subjek dengan kata benda bahasa Indonesia (kucing, cangkir, bunga, mobil).',
                    'Judul pendek, 2 sampai 4 kata, menyebut subjek itu.',
                    'Usulkan bagian-bagian yang akan digambar anak, dari yang terbesar. Setiap bagian SATU bentuk dasar: circle, ellipse, rounded-rect, triangle, atau line.',
                    'name adalah kata benda bahasa Indonesia untuk bagian tubuh itu (kepala, badan, telinga, roda, gagang), bukan kalimat, dan tanpa kata "dua".',
                    'pair true bila bagian itu sepasang yang simetris (dua telinga, dua mata, dua roda) dan digambar dalam satu langkah. Kotak lalu mencakup keduanya.',
                    'x dan y adalah sudut kiri-atas kotak dalam ruang 1000 kali 750. width dan height ukuran kotak. rotation dalam derajat, biasanya 0.',
                    'Jangan menamai latar belakang, wajah anak, huruf, barcode, atau ventilasi.',
                    'Jangan menambah bagian yang tidak ada pada gambar.',
                    'Wilayah yang sudah ditelusuri ini boleh kamu namai atau gabungkan menjadi pasangan:',
                    JSON.stringify(input.targets),
                  ].join('\n'),
                },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${bytesToBase64(input.illustrationPng)}` } },
              ],
            }],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'shape_plan',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['subject', 'title', 'parts'],
                  properties: {
                    subject: { type: 'string' },
                    title: { type: 'string' },
                    parts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['primitive', 'name', 'pair', 'x', 'y', 'width', 'height', 'rotation'],
                        properties: {
                          primitive: { type: 'string', enum: ['circle', 'ellipse', 'rounded-rect', 'triangle', 'line'] },
                          name: { type: 'string' },
                          pair: { type: 'boolean' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                          rotation: { type: 'number' },
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
        const rows = Array.isArray(parsed.parts) ? parsed.parts : [];
        const parts: ShapeProposal[] = [];
        for (const row of rows) {
          const part = proposalFrom(row);
          if (part) parts.push(part);
        }
        return { subject, title, parts, usage: usageFrom(record.usage) };
      },
    },
  };
}

function proposalFrom(value: unknown): ShapeProposal | null {
  const row = asRecord(value);
  const primitive = typeof row.primitive === 'string' ? knownPrimitive(row.primitive) : null;
  if (!primitive || typeof row.name !== 'string' || typeof row.pair !== 'boolean') return null;
  const x = finite(row.x);
  const y = finite(row.y);
  const width = finite(row.width);
  const height = finite(row.height);
  const rotation = finite(row.rotation);
  if (x === null || y === null || width === null || height === null || rotation === null) return null;
  return { primitive, name: row.name, pair: row.pair, x, y, width, height, rotation };
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function sumUsage(left: TokenUsage | null, right: TokenUsage | null): TokenUsage | null {
  if (!left) return right;
  if (!right) return left;
  const text = left.textInputTokens !== undefined || right.textInputTokens !== undefined
    ? { textInputTokens: (left.textInputTokens ?? 0) + (right.textInputTokens ?? 0) }
    : {};
  const image = left.imageInputTokens !== undefined || right.imageInputTokens !== undefined
    ? { imageInputTokens: (left.imageInputTokens ?? 0) + (right.imageInputTokens ?? 0) }
    : {};
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    ...text,
    ...image,
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
