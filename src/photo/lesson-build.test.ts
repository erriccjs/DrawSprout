import { describe, expect, it } from 'vitest';
import { findLessonProblems } from '../lesson-data/validate';
import { compareLessonToInk, renderCumulativeStep, renderLessonPreview, REVIEW_DICE_BELOW } from './compare';
import { buildPhotoLesson, OUTLINE_COVERAGE_MIN, shouldRedraw } from './lesson-build';
import type { DetectedPart } from './parts';
import { decodePng, encodePng, type RgbaImage } from './png';
import { traceInk, type Contour, type Point } from './trace';

function picture(width: number, height: number, ink: (x: number, y: number) => boolean): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = ink(x, y);
      const index = (y * width + x) * 4;
      data[index] = on ? 0 : 255;
      data[index + 1] = on ? 0 : 255;
      data[index + 2] = on ? 0 : 255;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

function painted(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => readonly [number, number, number],
): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colorAt(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('vectoriser to lesson', () => {
  const art = picture(64, 48, (x, y) => x >= 8 && x < 56 && y >= 8 && y < 40);

  it('traces a rectangle into the real outline when no parts are named', () => {
    const contours = traceInk(art);
    expect(contours.length).toBeGreaterThan(0);
    expect(contours.some((contour) => contour.closed && contour.points.length >= 4)).toBe(true);

    const built = buildPhotoLesson({
      id: 'photo-rectangle',
      title: 'Kotak',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: art.width,
      sourceHeight: art.height,
      photo: art,
      palette: ['#222222'],
    });
    expect(findLessonProblems(built.lesson)).toEqual([]);
    expect(built.builder).toBe('traced');
    expect(built.lesson.coordinateSpace).toEqual({ width: 1000, height: 750 });
    expect(built.lesson.subtitle).toBe('Dari foto');
    expect(built.lesson.contentVersion).toBe('photo-abcdef123456');
    const first = built.lesson.steps[0];
    expect(first?.instruction).toBe('Gambar bentuk yang paling besar.');
    expect(first?.guidePaths[0]?.d).toMatch(/\b[LC]\b/);
    expect(first?.guidePaths[0]?.role).toBe('final-outline');
    expect(built.lesson.steps.some((step) => /bagian berikutnya|bentuk utamanya/.test(step.instruction))).toBe(false);
    const colour = built.lesson.steps.find((step) => step.phase === 'color');
    expect(colour?.instruction).toMatch(/^Warnai dengan /);
    expect(colour?.instruction).not.toMatch(/latar/);
  });

  it('sends a blank comparison back to review', () => {
    const contours = traceInk(art);
    const built = buildPhotoLesson({
      id: 'photo-rectangle',
      title: 'Kotak',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: art.width,
      sourceHeight: art.height,
      photo: art,
      palette: ['#222222'],
    });
    const blank = picture(art.width, art.height, () => false);
    const comparison = compareLessonToInk(built.lesson, blank);
    expect(comparison.dice).toBeLessThan(REVIEW_DICE_BELOW);
    expect(comparison.needsReview).toBe(true);
    expect(comparison.reviewReason).toContain('Cek dulu');
  });

  it('round-trips the rectangle through PNG before tracing', async () => {
    const decoded = await decodePng(await encodePng(art));
    expect(traceInk(decoded).length).toBeGreaterThan(0);
  });

  it('drops a tiny speck and keeps the large outline', () => {
    const traced = traceInk(picture(80, 60, (x, y) => (x >= 8 && x < 70 && y >= 8 && y < 50) || (x >= 2 && x < 4 && y >= 2 && y < 4)));
    expect(traced.length).toBe(1);
  });
});

describe('named traced parts', () => {
  const photo = painted(8, 8, () => [220, 90, 20]);

  it('keeps the real outline and adds a circle only as construction', () => {
    const built = buildPhotoLesson({
      id: 'photo-circle',
      title: 'Kepala',
      targetHash: 'abcdef1234567890',
      contours: [circle(500, 375, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [part('kepala', false, 'oranye')],
    });
    expect(built.builder).toBe('parts');
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    expect(drawing[0]?.instruction).toBe('Gambar lingkaran sebagai bentuk dasar untuk kepala.');
    expect(drawing[0]?.guidePaths[0]?.role).toBe('construction');
    expect(drawing[0]?.guidePaths[0]?.d).toMatch(/\bA\b/);
    expect(drawing[1]?.instruction).toBe('Gambar garis luar kepala.');
    expect(drawing[1]?.guidePaths[0]?.role).toBe('final-outline');
    expect(drawing[1]?.guidePaths[0]?.d).toMatch(/\bC\b/);
    const colour = built.lesson.steps.find((step) => step.phase === 'color');
    expect(colour?.instruction).toBe('Warnai kepala dengan oranye.');
    expect(colour?.toolPreset.color).toMatch(/^#[0-9a-f]{6}$/i);
    const filled = renderCumulativeStep(built.lesson, built.lesson.steps.length, 80);
    expect(hasOrange(filled)).toBe(true);
    const image = renderLessonPreview(built.lesson, 200);
    expect(nearInk(image, 100, 40, 8)).toBe(true);
    expect(nearInk(image, 100, 100, 3)).toBe(false);
  });

  it('does not replace a triangle with a primitive', () => {
    const built = buildPhotoLesson({
      id: 'photo-ear',
      title: 'Telinga',
      targetHash: 'abcdef1234567890',
      contours: [triangle(200, 80, 220, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [part('telinga', false, 'oranye')],
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    expect(drawing).toHaveLength(1);
    expect(drawing[0]?.instruction).toBe('Gambar garis luar telinga.');
    expect(drawing[0]?.guidePaths[0]?.role).toBe('final-outline');
    expect(drawing[0]?.guidePaths[0]?.d).toMatch(/\bL\b/);
    expect(drawing[0]?.guidePaths[0]?.d).not.toMatch(/\bA\b/);
  });

  it('draws a symmetric pair in one step and names the colour', () => {
    const built = buildPhotoLesson({
      id: 'photo-ears',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [circle(500, 360, 150), triangle(120, 40, 90, 80), triangle(760, 40, 90, 80)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        { ...part('kepala', false, 'oranye'), ...cover(300, 180, 400, 360) },
        { ...part('telinga', true, 'oranye'), ...cover(80, 20, 820, 140) },
      ],
    });
    const ears = built.lesson.steps.find((step) => step.instruction.includes('telinga'));
    expect(ears?.guidePaths).toHaveLength(2);
    expect(ears?.instruction).toBe('Tambahkan dua telinga.');
    const colour = built.lesson.steps.find((step) => step.phase === 'color');
    expect(colour?.instruction).toMatch(/Warnai .+ dengan oranye\./);
    expect(built.lesson.steps.some((step) => /bagian berikutnya|bentuk utamanya|persegi/.test(step.instruction))).toBe(false);
  });

  it('drops a banned or generic name and falls back to the traced outline', () => {
    const built = buildPhotoLesson({
      id: 'photo-words',
      title: 'Kotak',
      targetHash: 'abcdef1234567890',
      contours: [square(10, 10, 700)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: picture(8, 8, () => false),
      palette: ['#336699'],
      parts: [part('bagian berikutnya', false, 'biru'), part('wajah anak', false, 'biru')],
    });
    expect(built.builder).toBe('traced');
    expect(built.lesson.steps[0]?.instruction).toBe('Gambar bentuk yang paling besar.');
    expect(built.lesson.steps.some((step) => /bagian berikutnya|wajah anak/.test(step.instruction))).toBe(false);
    expect(built.lesson.steps.some((step) => step.phase === 'color')).toBe(false);
  });

  it('keeps every named part when there are more than eight', () => {
    const contours = [square(10, 10, 280)];
    const parts = [{ ...part('badan', false, 'merah'), ...cover(10, 10, 280, 280) }];
    for (let index = 0; index < 8; index += 1) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 40 + column * 220;
      const y = 360 + row * 180;
      contours.push(square(x, y, 70));
      parts.push({ ...part(`kaki ${index + 1}`, false, row === 0 ? 'merah' : 'biru'), ...cover(x, y, 70, 70) });
    }
    const built = buildPhotoLesson({
      id: 'photo-many',
      title: 'Banyak',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: painted(20, 10, (_x, y) => (y < 5 ? [200, 40, 40] : [40, 80, 200])),
      palette: ['#cc3333', '#2850c8'],
      parts,
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    const colors = built.lesson.steps.filter((step) => step.phase === 'color');
    expect(built.builder).toBe('parts');
    expect(drawing.length).toBeGreaterThan(6);
    expect(built.lesson.steps.length).toBeGreaterThan(8);
    expect(new Set(drawing.map((step) => step.instruction)).size).toBe(drawing.length);
    expect(colors.length).toBeGreaterThanOrEqual(2);
    expect(colors.every((step) => /dengan (merah|biru|oranye)/.test(step.instruction))).toBe(true);
    expect(built.lesson.steps.some((step) => /bagian berikutnya/.test(step.instruction))).toBe(false);
  });

  it('asks for another drawing when the closed outline covers little of the subject', () => {
    const built = buildPhotoLesson({
      id: 'photo-split',
      title: 'Terpisah',
      targetHash: 'abcdef1234567890',
      contours: [
        square(20, 20, 70),
        { closed: false, points: [{ x: 0, y: 400 }, { x: 500, y: 420 }, { x: 980, y: 400 }] },
      ],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
    });
    expect(built.coverage).toBeLessThan(OUTLINE_COVERAGE_MIN);
    expect(built.needsReview).toBe(true);
    expect(shouldRedraw(built.coverage)).toBe(true);
    expect(shouldRedraw(0.9)).toBe(false);
    expect(built.lesson.steps[0]?.guidePaths[0]?.d).not.toMatch(/\bA\b/);
  });
});

function part(name: string, pair: boolean, colorName: string, x = 0, y = 0, width = 1000, height = 750): DetectedPart {
  return { name, pair, x, y, width, height, points: [], colorName };
}

function cover(x: number, y: number, w: number, h: number): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(904 / 1000, 654 / 750);
  const ox = (1000 - 1000 * scale) / 2;
  const oy = (750 - 750 * scale) / 2;
  return { x: ox + x * scale - 16, y: oy + y * scale - 16, width: w * scale + 32, height: h * scale + 32 };
}

function hasOrange(image: RgbaImage): boolean {
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index] ?? 0;
    const green = image.data[index + 1] ?? 0;
    const blue = image.data[index + 2] ?? 0;
    if (red > 140 && red > green + 40 && red > blue + 40 && green > 40) return true;
  }
  return false;
}

function nearInk(image: RgbaImage, x: number, y: number, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const sx = x + dx;
      const sy = y + dy;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      const index = (sy * image.width + sx) * 4;
      if ((image.data[index] ?? 255) < 80) return true;
    }
  }
  return false;
}

function square(x: number, y: number, size: number): Contour {
  return {
    closed: true,
    points: [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
      { x, y },
    ],
  };
}

function triangle(x: number, y: number, width: number, height: number): Contour {
  return {
    closed: true,
    points: [
      { x: x + width / 2, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
      { x: x + width / 2, y },
    ],
  };
}

function circle(cx: number, cy: number, radius: number): Contour {
  const points: Point[] = [];
  const count = 24;
  for (let index = 0; index <= count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return { closed: true, points };
}
