import { describe, expect, it } from 'vitest';
import type { ImageEditor, InstructionRequest, InstructionWriter } from './openai';
import { decodePng, encodePng, type RgbaImage } from './png';
import { runPhotoPipeline } from './pipeline';

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
          parts: [{ name: 'wajah anak', pair: false, x: 0, y: 0, width: 40, height: 40, points: [], colorName: 'hitam', pieceIds: [] }],
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
    expect(result.textUsage).toEqual({ inputTokens: 11, outputTokens: 7, totalTokens: 18 });
    expect(result.imageCalls).toBe(1);
    expect(result.regenerated).toBe(false);
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
});
