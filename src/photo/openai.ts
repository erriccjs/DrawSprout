/**
 * OpenAI image edit and a short instruction call.
 *
 * The key stays in the caller. Nothing here logs the photo or the key.
 * `Idempotency-Key` is forwarded so a retry of the same job is not a second
 * billed request on OpenAI's side.
 */

import { detectedPartFrom, type DetectedPart } from './parts';
import { colourPrompt, imagePrompt, imageSize, type ImageQuality, type PhotoVariant } from './prompts';

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
  /** When set, `png` is the line drawing and this is the photo to match. */
  readonly referencePng?: Uint8Array;
  /** Replaces the line or colour prompt. Used to erase one part at low quality. */
  readonly instruction?: string;
  /** Part names from this photo only. Omitted from the shared prompt when empty. */
  readonly partHints?: readonly string[];
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
  /** Name this photo's parts before the line drawing. The illustration is not sent. */
  readonly photoOnly?: boolean;
}

export interface InstructionResult {
  readonly sameSubject: boolean;
  readonly subject: string;
  readonly title: string;
  readonly parts: readonly DetectedPart[];
  readonly usage: TokenUsage | null;
  /** False when the drawing's pose or crop does not match the photo. Missing means no objection. */
  readonly samePose?: boolean;
  /** Objects drawn that are not in the photo. Missing or empty means none were reported. */
  readonly extraObjects?: readonly string[];
  readonly photoObjects?: readonly string[];
  readonly drawingObjects?: readonly string[];
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
        form.set('prompt', input.instruction
          ? input.instruction
          : input.referencePng
            ? colourPrompt()
            : imagePrompt(input.variant, input.reinforceSilhouette === true, input.reinforceSubject === true, input.partHints ?? []));
        form.set('quality', input.quality);
        form.set('size', imageSize(input.width, input.height));
        form.set('n', '1');
        form.set('background', 'opaque');
        form.set('output_format', 'png');
        if (input.referencePng) {
          form.append('image[]', new File([toBlobPart(input.png)], 'lines.png', { type: 'image/png' }));
          form.append('image[]', new File([toBlobPart(input.referencePng)], 'photo.png', { type: 'image/png' }));
        } else {
          form.set('image', new File([toBlobPart(input.png)], 'photo.png', { type: 'image/png' }));
        }
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
                  text: instructionText(input),
                },
                ...instructionImages(input),
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
                  required: ['sameSubject', 'samePose', 'subject', 'title', 'photoObjects', 'drawingObjects', 'extraObjects', 'parts'],
                  properties: {
                    sameSubject: { type: 'boolean' },
                    samePose: { type: 'boolean' },
                    subject: { type: 'string' },
                    title: { type: 'string' },
                    photoObjects: { type: 'array', items: { type: 'string' } },
                    drawingObjects: { type: 'array', items: { type: 'string' } },
                    extraObjects: { type: 'array', items: { type: 'string' } },
                    parts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['name', 'pair', 'x', 'y', 'width', 'height', 'colorName', 'points', 'pieceIds', 'count', 'shape', 'order', 'dependsOn', 'guide'],
                        properties: {
                          name: { type: 'string' },
                          pair: { type: 'boolean' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                          colorName: { type: 'string' },
                          shape: { type: 'string', enum: ['circle', 'oval', 'dome', 'line', 'triangle', ''] },
                          order: { type: 'number' },
                          dependsOn: { type: 'string' },
                          guide: { type: 'boolean' },
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
        const samePose = parsed.samePose !== false;
        const rows = Array.isArray(parsed.parts) ? parsed.parts : [];
        const parts: DetectedPart[] = [];
        for (const row of rows) {
          const part = detectedPartFrom(row);
          if (part) parts.push(part);
        }
        return {
          sameSubject,
          samePose,
          subject,
          title,
          parts,
          photoObjects: stringList(parsed.photoObjects),
          drawingObjects: stringList(parsed.drawingObjects),
          extraObjects: stringList(parsed.extraObjects),
          usage: usageFrom(record.usage),
        };
      },
    },
  };
}

function instructionText(input: InstructionRequest): string {
  if (input.photoOnly) {
    return [
      'Foto ini satu subjek. Sebut hanya bagian yang benar-benar terlihat pada foto ini.',
      'sameSubject true. samePose true.',
      'photoObjects adalah benda yang terlihat di foto, satu kata benda tiap item. drawingObjects dan extraObjects array kosong.',
      'subject adalah satu kata benda bahasa Indonesia untuk benda di foto, tanpa kata sifat.',
      'title pendek, 2 sampai 4 kata, tanpa kata sifat.',
      'parts hanya bagian foto ini, dari bentuk besar ke detail kecil. Jangan menambah bagian dari subjek lain.',
      'name adalah satu kata benda saja, tanpa kata sifat dan tanpa warna. Bukan kalimat, tanpa kata "dua".',
      'shape adalah circle, oval, dome, line, triangle, atau string kosong. Bagian pertama adalah circle, oval, atau dome untuk massa utama.',
      'order mulai dari 1. dependsOn adalah nama bagian yang sudah digambar, atau string kosong. guide false.',
      'pair true hanya untuk sepasang yang memang dua. count 1 atau 2.',
      'x, y, width, height adalah kotak dalam ruang 1000 kali 750. points paling banyak 8 titik. pieceIds array kosong.',
      'colorName adalah warna bagian itu: merah, oranye, kuning, hijau, biru, ungu, merah muda, cokelat, cokelat tua, hitam, abu-abu, atau putih.',
      'Jangan menambah benda yang tidak ada di foto.',
    ].join('\n');
  }
  return [
    'Gambar pertama adalah foto. Gambar kedua adalah garis hitam saja, tanpa warna.',
    'sameSubject true hanya bila gambar itu adalah benda yang sama dengan foto. Kucing yang digambar menjadi mobil adalah false.',
    'samePose true hanya bila pose dan bingkai gambar sama dengan foto. Subjek yang berbaring menjadi duduk adalah false. Close-up yang menjadi seluruh badan adalah false.',
    'photoObjects adalah benda di foto. drawingObjects adalah benda di gambar garis. extraObjects adalah benda di gambar garis yang tidak ada di foto. Kosong bila tidak ada tambahan.',
    'subject adalah satu kata benda bahasa Indonesia untuk benda di foto (kucing, cangkir, bunga), tanpa kata sifat.',
    'title pendek, 2 sampai 4 kata, tanpa kata sifat.',
    'parts adalah rencana konstruksi, dari bentuk besar ke detail kecil, seperti urutan langkah. name adalah satu kata benda saja, tanpa kata sifat dan tanpa warna: "anjing", bukan "anjing hitam lucu"; "bunga", bukan "bunga putih merah". Bukan nama bentuk, bukan kalimat, tanpa kata "dua".',
    'shape adalah circle, oval, dome, line, atau triangle. Kosongkan bila bukan bentuk dasar. Bagian pertama adalah satu bentuk besar untuk massa utama: circle, oval, atau dome.',
    'order adalah urutan langkah, mulai dari 1. dependsOn adalah nama bagian yang sudah digambar, atau string kosong.',
    'guide true hanya untuk garis bantu yang dihapus nanti, seperti salib tengah wajah, oval panduan kelopak, atau segitiga badan. Garis yang tetap di gambar akhir memakai guide false.',
    'Jangan memakai "bagian berikutnya", "bentuk utama", "buih", "latar belakang", "wajah anak", "barcode", atau "ventilasi".',
    'Jangan memasukkan setiap potongan ke dalam satu kotak.',
    'Contoh nama bila bagian itu memang terlihat: garis luar, telinga, mata, hidung, kumis, kaki, ekor, roda, gagang, kelopak, daun, tengah bunga, kopi, kalung, lidah, kursi. Jangan menyebut contoh yang tidak ada di foto ini.',
    'Kopi bukan cangkir. Piring dan cangkir bagian terpisah. Kalung bukan mata dan bukan badan. Daun bukan kelopak. Roda bukan badan. Setir bukan badan mobil. Mata, hidung, dan kumis masing-masing bagian sendiri. Foto close-up kepala tidak punya kaki atau ekor. Jangan sebut bagian yang tidak ada garisnya.',
    'Kotak sebuah bagian hanya menutupi bagian itu. Kumis tidak menutupi seluruh wajah. Nama daerah warna adalah bagian yang mengelilingi daerah itu.',
    'Kotak harus ketat di garis bagian itu. Jangan menamai bagian yang tidak ada garisnya.',
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
  ].filter((line) => line.length > 0).join('\n');
}

function instructionImages(input: InstructionRequest): { type: string; image_url: { url: string } }[] {
  const photo = { type: 'image_url', image_url: { url: `data:image/png;base64,${bytesToBase64(input.photoPng)}` } };
  if (input.photoOnly) return [photo];
  return [
    photo,
    { type: 'image_url', image_url: { url: `data:image/png;base64,${bytesToBase64(input.illustrationPng)}` } },
  ];
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const name = item.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (name.length < 2 || names.includes(name)) continue;
    names.push(name);
    if (names.length === 8) break;
  }
  return names;
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
