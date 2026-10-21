/**
 * OpenAI image edit and a short instruction call.
 *
 * The key stays in the caller. Nothing here logs the photo or the key.
 * `Idempotency-Key` is forwarded so a retry of the same job is not a second
 * billed request on OpenAI's side.
 */

import { detectedPartFrom, type DetectedPart } from './parts';
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
  readonly reinforceSubject?: boolean;
}

export interface ImageEditResult {
  readonly png: Uint8Array;
  readonly usage: TokenUsage | null;
}

export interface ImageEditor {
  edit(input: ImageEditRequest): Promise<ImageEditResult>;
}

export interface InstructionPiece {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface InstructionRequest {
  readonly model: string;
  readonly photoPng: Uint8Array;
  readonly illustrationPng: Uint8Array;
  readonly signal: AbortSignal;
  readonly idempotencyKey: string;
  /** Numbered traced pieces, in the same order as the lesson builder. */
  readonly pieces?: readonly InstructionPiece[];
  /** A second text call after the first left interior pieces unnamed. */
  readonly relabel?: boolean;
}

export interface InstructionResult {
  readonly sameSubject: boolean;
  readonly subject: string;
  readonly title: string;
  readonly parts: readonly DetectedPart[];
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
        form.set('prompt', imagePrompt(input.variant, input.reinforceSilhouette === true, input.reinforceSubject === true));
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
                    'Gambar pertama adalah foto. Gambar kedua adalah halaman mewarnai: garis hitam tebal dan warna datar.',
                    'sameSubject true hanya bila gambar itu adalah benda yang sama dengan foto. Kucing yang digambar menjadi mobil adalah false.',
                    'subject adalah satu kata benda bahasa Indonesia untuk benda di foto (kucing, cangkir, bunga), tanpa kata sifat.',
                    'title pendek, 2 sampai 4 kata, tanpa kata sifat.',
                    'parts adalah bagian yang benar-benar terlihat, dari yang terbesar. name adalah satu kata benda saja, tanpa kata sifat dan tanpa warna: "anjing", bukan "anjing hitam lucu"; "bunga", bukan "bunga putih merah". Bukan nama bentuk, bukan kalimat, tanpa kata "dua".',
                    'Jangan memakai "bagian berikutnya", "bentuk utama", "buih", "latar belakang", "wajah anak", "barcode", atau "ventilasi".',
                    'Jangan memasukkan setiap potongan ke dalam satu kotak.',
                    'Sebut bagian yang terlihat: garis luar, telinga, mata, hidung, kumis, kaki, ekor, roda, gagang, kelopak, tengah bunga, kopi, kalung, lidah, kursi.',
                    'Kalung, lidah, kursi, gagang, kopi, dan tengah bunga masing-masing bagian sendiri bila terlihat. Jangan menggabungkan kalung ke badan.',
                    'pieceIds adalah nomor potongan yang termasuk bagian itu. Bagian garis luar hanya berisi potongan siluet, bukan detail di dalamnya.',
                    'pair true bila satu langkah menggambar sepasang simetris (dua telinga, dua mata, dua roda). pair true boleh berisi dua pieceIds.',
                    'count adalah jumlah yang digambar dalam satu langkah: 1 untuk gagang, permukaan kopi, kalung, atau lidah; 2 hanya untuk sepasang yang memang dua (dua telinga, dua mata, dua roda). Kelopak yang banyak bukan 2.',
                    'x, y, width, height adalah kotak dalam ruang 1000 kali 750. points adalah polygon bagian itu dalam ruang yang sama, paling banyak 8 titik. Kotak harus ketat di bagian itu, bukan seluruh gambar.',
                    'colorName adalah warna bagian itu pada gambar: merah, oranye, kuning, hijau, biru, ungu, merah muda, cokelat, cokelat tua, hitam, abu-abu, atau putih. Putih untuk benda yang putih, bukan abu-abu. Cokelat tua untuk kopi yang gelap.',
                    'Jangan menambah bagian yang tidak ada.',
                    input.relabel === true
                      ? 'Beberapa potongan dalam belum punya nama sendiri. Beri tiap potongan dalam sebuah bagian yang lebih kecil dari garis luar.'
                      : '',
                    (input.pieces ?? []).length > 0
                      ? `Potongan garis yang sudah dinomori:\n${(input.pieces ?? []).map((piece) => `${piece.id}. x=${Math.round(piece.x)} y=${Math.round(piece.y)} width=${Math.round(piece.width)} height=${Math.round(piece.height)}`).join('\n')}`
                      : '',
                  ].filter((line) => line.length > 0).join('\n'),
                },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${bytesToBase64(input.photoPng)}` } },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${bytesToBase64(input.illustrationPng)}` } },
              ],
            }],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'part_plan',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['sameSubject', 'subject', 'title', 'parts'],
                  properties: {
                    sameSubject: { type: 'boolean' },
                    subject: { type: 'string' },
                    title: { type: 'string' },
                    parts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['name', 'pair', 'x', 'y', 'width', 'height', 'colorName', 'points', 'pieceIds', 'count'],
                        properties: {
                          name: { type: 'string' },
                          pair: { type: 'boolean' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                          colorName: { type: 'string' },
                          pieceIds: { type: 'array', items: { type: 'number' } },
                          count: { type: 'number' },
                          points: {
                            type: 'array',
                            items: {
                              type: 'object',
                              additionalProperties: false,
                              required: ['x', 'y'],
                              properties: {
                                x: { type: 'number' },
                                y: { type: 'number' },
                              },
                            },
                          },
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
        const sameSubject = parsed.sameSubject !== false;
        const rows = Array.isArray(parsed.parts) ? parsed.parts : [];
        const parts: DetectedPart[] = [];
        for (const row of rows) {
          const part = detectedPartFrom(row);
          if (part) parts.push(part);
        }
        return { sameSubject, subject, title, parts, usage: usageFrom(record.usage) };
      },
    },
  };
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
