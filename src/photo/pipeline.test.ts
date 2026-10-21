import { describe, expect, it } from 'vitest';
import { lessonPieces } from './lesson-build';
import type { ImageEditor, InstructionRequest, InstructionWriter } from './openai';
import { decodePng, encodePng, type RgbaImage } from './png';
import { runPhotoPipeline } from './pipeline';
import { traceInk } from './trace';

function frame(): RgbaImage {
  const width = 48;
  const height = 36;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = x >= 6 && x < 42 && y >= 6 && y < 30;
      const index = (y * width + x) * 4;
      data[index] = on ? 20 : 255;
      data[index + 1] = on ? 20 : 255;
      data[index + 2] = on ? 20 : 255;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

function ghost(): RgbaImage {
  const width = 24;
  const height = 18;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = x >= 4 && x < 20 && y >= 4 && y < 14;
      const index = (y * width + x) * 4;
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = on ? 255 : 0;
    }
  }
  return { width, height, data };
}

describe('photo pipeline wiring', () => {
  it('asks whether the drawing is the same subject and drops a banned part name', async () => {
    const art = await encodePng(frame());
    const captured: { request: InstructionRequest | null } = { request: null };
    const images: ImageEditor = {
      edit(input) {
        expect(input.quality).toBe('low');
        expect(input.model).toBe('gpt-image-1.5');
        return Promise.resolve({ png: art, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } });
      },
    };
    const instructions: InstructionWriter = {
      write(input) {
        captured.request = input;
        return Promise.resolve({
          sameSubject: true,
          subject: 'Kotak',
          title: 'Wajah anak',
          parts: [{ name: 'wajah anak', pair: false, x: 0, y: 0, width: 40, height: 40, points: [], colorName: 'hitam', pieceIds: [], count: 0 }],
          usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
        });
      },
    };
    const result = await runPhotoPipeline({
      png: art,
      variant: 'simple',
      idempotencyKey: 'pipeline-key',
      signal: AbortSignal.timeout(5_000),
      configuredImageModel: 'gpt-image-1-mini',
      textModel: 'gpt-4.1-mini',
      lessonId: 'photo-pipeline',
    }, { images, instructions });
    expect(result.model).toBe('gpt-image-1.5');
    expect(result.quality).toBe('low');
    expect(result.lesson.title).toBe('Kotak');
    expect(result.lesson.steps[0]?.instruction).toBe('Gambar garis luar kotak.');
    expect(result.lesson.steps[0]?.instruction).not.toMatch(/wajah/);
    expect(result.textUsage).toEqual({ inputTokens: 22, outputTokens: 14, totalTokens: 36 });
    expect(result.reverseCalls).toBe(0);
    expect(result.reverseUsage).toBeNull();
    expect(result.imageCalls).toBe(2);
    expect(result.regenerated).toBe(false);
    expect(result.lineArtPng[0]).toBe(137);
    expect(result.colouredPng?.[0]).toBe(137);
    const request = captured.request;
    if (request === null) throw new Error('instruction writer was not called');
    expect(request.photoPng[0]).toBe(137);
    expect(request.illustrationPng[0]).toBe(137);
  });

  it('flattens a transparent illustration onto white before it is returned', async () => {
    const art = await encodePng(ghost());
    const images: ImageEditor = {
      edit() {
        return Promise.resolve({ png: art, usage: null });
      },
    };
    const result = await runPhotoPipeline({
      png: art,
      variant: 'default',
      idempotencyKey: 'flatten-key1',
      signal: AbortSignal.timeout(5_000),
      textModel: 'gpt-4.1-mini',
      lessonId: 'photo-flatten',
    }, { images });
    const decoded = await decodePng(result.illustrationPng);
    const corner = decoded.data[3];
    expect(corner).toBe(255);
    expect(decoded.data[0]).toBe(255);
    expect(decoded.data[1]).toBe(255);
    expect(decoded.data[2]).toBe(255);
  });

  it('erases one planned part when the harness asks, and does not call that a redraw', async () => {
    const full = marked(true);
    const bare = marked(false);
    const fullPng = await encodePng(full);
    const barePng = await encodePng(bare);
    const pieces = lessonPieces(traceInk(full), full.width, full.height);
    const body = pieces.reduce((best, piece) => (piece.width * piece.height > best.width * best.height ? piece : best));
    const eye = pieces.find((piece) => piece !== body);
    if (!eye) throw new Error('expected a separate eye');
    const keys: string[] = [];
    const images: ImageEditor = {
      edit(input) {
        keys.push(input.idempotencyKey);
        if (input.instruction) {
          expect(input.quality).toBe('low');
          expect(input.instruction).toContain('Erase only');
          return Promise.resolve({ png: barePng, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
        }
        return Promise.resolve({ png: fullPng, usage: null });
      },
    };
    const instructions: InstructionWriter = {
      write() {
        return Promise.resolve({
          sameSubject: true,
          subject: 'Wajah',
          title: 'Wajah',
          parts: [
            { name: 'wajah', pair: false, x: body.x, y: body.y, width: body.width, height: body.height, points: [], colorName: 'abu-abu', pieceIds: [], count: 1, shape: 'oval', order: 1 },
            { name: 'mata', pair: false, x: eye.x - 8, y: eye.y - 8, width: eye.width + 16, height: eye.height + 16, points: [], colorName: 'hitam', pieceIds: [], count: 1, shape: 'circle', order: 2, dependsOn: 'wajah' },
          ],
          usage: null,
        });
      },
    };
    const result = await runPhotoPipeline({
      png: fullPng,
      variant: 'simple',
      idempotencyKey: 'reverse-key',
      signal: AbortSignal.timeout(5_000),
      textModel: 'gpt-4.1-mini',
      lessonId: 'photo-reverse',
      stepMode: 'both',
    }, { images, instructions });
    expect(result.regenerated).toBe(false);
    expect(result.stepMode).toBe('both');
    expect(keys.some((key) => key.endsWith('-erase-1'))).toBe(true);
    expect(result.imageCalls).toBe(3);
    expect(result.reverseStages.length).toBeGreaterThanOrEqual(2);
    expect(result.lesson.steps.some((step) => step.instruction.includes('mata'))).toBe(true);
    expect(result.reverseLesson?.steps.some((step) => step.instruction.includes('mata'))).toBe(true);
    expect(result.reverseCalls).toBeGreaterThan(0);
  });

  it('redraws once when the line drawing adds a subject, then flags the pose if it is still wrong', async () => {
    const art = await encodePng(frame());
    let compared = 0;
    const images: ImageEditor = {
      edit() {
        return Promise.resolve({ png: art, usage: null });
      },
    };
    const instructions: InstructionWriter = {
      write(input) {
        if (input.photoOnly) {
          return Promise.resolve({
            sameSubject: true,
            subject: 'Cangkir',
            title: 'Cangkir',
            parts: [{ name: 'cangkir', pair: false, x: 80, y: 40, width: 200, height: 160, points: [], colorName: 'putih', pieceIds: [], count: 1, shape: 'oval', order: 1 }],
            usage: null,
          });
        }
        compared += 1;
        return Promise.resolve({
          sameSubject: true,
          samePose: compared > 1 ? false : true,
          subject: 'Cangkir',
          title: 'Cangkir',
          extraObjects: compared === 1 ? ['kucing'] : [],
          parts: [{ name: 'cangkir', pair: false, x: 80, y: 40, width: 200, height: 160, points: [], colorName: 'putih', pieceIds: [], count: 1, shape: 'oval', order: 1 }],
          usage: null,
        });
      },
    };
    const result = await runPhotoPipeline({
      png: art,
      variant: 'default',
      idempotencyKey: 'extra-subject',
      signal: AbortSignal.timeout(5_000),
      textModel: 'gpt-4.1-mini',
      lessonId: 'photo-extra',
    }, { images, instructions });
    expect(result.regenerated).toBe(true);
    expect(result.imageCalls).toBe(4);
    expect(result.reviewReason ?? '').toContain('Pose atau bingkai gambar tidak sama dengan foto');
    expect(result.reviewReason ?? '').not.toContain('menambah benda');
    expect(result.needsReview).toBe(true);
  });

  it('redraws once when the plan names a leash, and drops that step', async () => {
    const art = await encodePng(frame());
    const flags: boolean[] = [];
    const images: ImageEditor = {
      edit(input) {
        flags.push(input.reinforceSubject === true);
        return Promise.resolve({ png: art, usage: null });
      },
    };
    const instructions: InstructionWriter = {
      write(input) {
        if (input.photoOnly) {
          return Promise.resolve({
            sameSubject: true,
            subject: 'Anjing',
            title: 'Anjing',
            parts: [
              { name: 'badan', pair: false, x: 40, y: 20, width: 200, height: 160, points: [], colorName: 'hitam', pieceIds: [], count: 1, shape: 'oval', order: 1 },
              { name: 'tali', pair: false, x: 20, y: 80, width: 40, height: 120, points: [], colorName: 'hitam', pieceIds: [], count: 1, order: 2 },
            ],
            usage: null,
          });
        }
        const redraw = input.idempotencyKey.endsWith('-redraw');
        return Promise.resolve({
          sameSubject: true,
          samePose: true,
          subject: 'Anjing',
          title: 'Anjing',
          extraObjects: [],
          parts: redraw
            ? [{ name: 'badan', pair: false, x: 40, y: 20, width: 200, height: 160, points: [], colorName: 'hitam', pieceIds: [], count: 1, shape: 'oval', order: 1 }]
            : [
              { name: 'badan', pair: false, x: 40, y: 20, width: 200, height: 160, points: [], colorName: 'hitam', pieceIds: [], count: 1, shape: 'oval', order: 1 },
              { name: 'tali', pair: false, x: 20, y: 80, width: 40, height: 120, points: [], colorName: 'hitam', pieceIds: [], count: 1, order: 2 },
            ],
          usage: null,
        });
      },
    };
    const result = await runPhotoPipeline({
      png: art,
      variant: 'default',
      idempotencyKey: 'leash-subject',
      signal: AbortSignal.timeout(5_000),
      textModel: 'gpt-4.1-mini',
      lessonId: 'photo-leash',
    }, { images, instructions });
    expect(result.regenerated).toBe(true);
    expect(result.imageCalls).toBe(4);
    expect(flags.filter(Boolean)).toHaveLength(1);
    expect(result.reviewReason ?? '').not.toContain('menambah benda');
    expect(result.lesson.steps.map((step) => step.instruction).join(' ')).not.toMatch(/tali/);
  });
});

function marked(eye: boolean): RgbaImage {
  const width = 80;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const border = x >= 8 && x < 72 && y >= 8 && y < 56 && (x < 12 || x >= 68 || y < 12 || y >= 52);
      const mark = eye && x >= 34 && x < 48 && y >= 26 && y < 40;
      const on = border || mark;
      const index = (y * width + x) * 4;
      data[index] = on ? 0 : 255;
      data[index + 1] = on ? 0 : 255;
      data[index + 2] = on ? 0 : 255;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}
