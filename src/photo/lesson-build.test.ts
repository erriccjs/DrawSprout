import { describe, expect, it } from 'vitest';
import { findLessonProblems } from '../lesson-data/validate';
import { compareLessonToInk, REVIEW_DICE_BELOW } from './compare';
import { buildPhotoLesson, LOW_SUBJECT_COVERAGE, MAX_COLOR_STEPS, MAX_DRAWING_STEPS, MAX_PATHS_PER_STEP } from './lesson-build';
import { decodePng, encodePng, type RgbaImage } from './png';
import { traceInk, type Contour } from './trace';

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

describe('vectoriser to lesson', () => {
  const art = picture(64, 48, (x, y) => x >= 8 && x < 56 && y >= 8 && y < 40);

  it('traces a rectangle into a lesson the validator accepts', () => {
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
    expect(built.lesson.coordinateSpace).toEqual({ width: 1000, height: 750 });
    expect(built.lesson.subtitle).toBe('Dari foto');
    expect(built.lesson.contentVersion).toBe('photo-abcdef123456');
    expect(built.lesson.steps[0]?.instruction).toBe('Gambar bentuk yang paling besar.');
    expect(built.lesson.steps.some((step) => step.phase === 'color')).toBe(true);
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

describe('step sequencing', () => {
  const photo = picture(8, 8, () => false);

  it('puts the largest shape first, drops duplicates and specks, and caps colour steps', () => {
    const contours = [
      square(10, 10, 700),
      square(30, 30, 220),
      square(400, 30, 220),
      square(30, 400, 220),
      square(400, 400, 220),
      square(120, 120, 80),
      square(122, 122, 80),
      square(124, 124, 80),
      square(900, 700, 6),
    ];
    const built = buildPhotoLesson({
      id: 'photo-parts',
      title: 'Subjek',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#336699'],
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    const colors = built.lesson.steps.filter((step) => step.phase === 'color');
    expect(built.lesson.steps[0]?.id).toBe('outline-1');
    expect(built.lesson.steps[0]?.guidePaths).toHaveLength(1);
    expect(pathSpan(built.lesson.steps[0]?.guidePaths[0]?.d ?? '')).toBeGreaterThan(400);
    expect(drawing.length).toBeLessThanOrEqual(MAX_DRAWING_STEPS);
    expect(drawing.every((step) => step.guidePaths.length <= MAX_PATHS_PER_STEP)).toBe(true);
    expect(colors.length).toBe(MAX_COLOR_STEPS);
    expect(built.briefs[0]?.label).toBe('garis besar subjek');
    expect(built.coverage).toBeGreaterThan(LOW_SUBJECT_COVERAGE);
    expect(built.needsReview).toBe(false);
    expect(drawing.flatMap((step) => step.guidePaths)).toHaveLength(6);
  });

  it('spreads many distinct parts across drawing steps', () => {
    const contours = [square(10, 10, 700)];
    for (let index = 0; index < 12; index += 1) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      contours.push(square(40 + column * 150, 40 + row * 150, 40));
    }
    const built = buildPhotoLesson({
      id: 'photo-many',
      title: 'Banyak',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#336699'],
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    expect(drawing.length).toBe(MAX_DRAWING_STEPS);
    expect(drawing[0]?.guidePaths).toHaveLength(1);
    expect(drawing.slice(1).every((step) => step.guidePaths.length <= MAX_PATHS_PER_STEP)).toBe(true);
    expect(drawing.slice(1).length).toBeGreaterThan(2);
  });

  it('flags a lesson whose largest shape covers little of the subject', () => {
    const built = buildPhotoLesson({
      id: 'photo-split',
      title: 'Terpisah',
      targetHash: 'abcdef1234567890',
      contours: [square(0, 0, 80), square(800, 0, 80)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#336699'],
    });
    expect(built.coverage).toBeLessThan(LOW_SUBJECT_COVERAGE);
    expect(built.needsReview).toBe(true);
    expect(built.reviewReason).toContain('sebagian kecil subjek');
  });

  it('discards an instruction that invents a child or a background', () => {
    const built = buildPhotoLesson({
      id: 'photo-words',
      title: 'Kotak',
      targetHash: 'abcdef1234567890',
      contours: [square(10, 10, 700)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#336699'],
      instructions: new Map([
        ['outline-1', 'Buat garis besar wajah anak.'],
        ['color-1', 'Warnai latar belakang.'],
      ]),
    });
    expect(built.lesson.steps[0]?.instruction).toBe('Gambar bentuk yang paling besar.');
    expect(built.lesson.steps.find((step) => step.phase === 'color')?.instruction).toBe('Warnai bagian ini.');
  });
});

function pathSpan(d: string): number {
  const values = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const xs = values.filter((_, index) => index % 2 === 0);
  if (xs.length === 0) return 0;
  return Math.max(...xs) - Math.min(...xs);
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
