import { describe, expect, it } from 'vitest';
import { findLessonProblems } from '../lesson-data/validate';
import { compareLessonToInk, renderLessonPreview, REVIEW_DICE_BELOW } from './compare';
import { buildPhotoLesson, LOW_SUBJECT_COVERAGE, MAX_PATHS_PER_STEP, shouldRedraw } from './lesson-build';
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

  it('traces a rectangle into one primitive the validator accepts', () => {
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
    const first = built.lesson.steps[0];
    expect(first?.instruction).toMatch(/Gambar (persegi panjang|oval|lingkaran) besar untuk bentuk utamanya\./);
    expect(first?.guidePaths[0]?.d).toMatch(/\bA\b/);
    expect(first?.guidePaths[0]?.d).not.toMatch(/(?: L ){8,}/);
    expect(first?.guidePaths[0]?.role).toBe('final-outline');
    const colour = built.lesson.steps.find((step) => step.phase === 'color');
    expect(colour?.instruction).toMatch(/^Warnai /);
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

describe('shape steps', () => {
  const photo = painted(8, 8, () => [180, 40, 40]);

  it('draws a clean circle and rasters the arc, not a diameter', () => {
    const built = buildPhotoLesson({
      id: 'photo-circle',
      title: 'Bola',
      targetHash: 'abcdef1234567890',
      contours: [circle(500, 375, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
    });
    const first = built.lesson.steps[0];
    expect(first?.instruction).toBe('Gambar lingkaran besar untuk bentuk utamanya.');
    expect(first?.guidePaths[0]?.d).toMatch(/\bA\b/);
    const image = renderLessonPreview(built.lesson, 200);
    expect(nearInk(image, 100, 40, 6)).toBe(true);
    expect(nearInk(image, 100, 75, 3)).toBe(false);
  });

  it('puts a symmetric pair of triangles in one step', () => {
    const built = buildPhotoLesson({
      id: 'photo-ears',
      title: 'Telinga',
      targetHash: 'abcdef1234567890',
      contours: [triangle(80, 40, 90, 80), triangle(700, 40, 90, 80)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    expect(drawing).toHaveLength(1);
    expect(drawing[0]?.guidePaths).toHaveLength(2);
    expect(drawing[0]?.instruction).toBe('Tambahkan dua segitiga untuk bentuk utamanya.');
    expect(drawing[0]?.guidePaths.every((guide) => guide.d.startsWith('M ') && guide.d.includes(' Z'))).toBe(true);
  });

  it('names a snapped part and drops a proposal that misses the ink', () => {
    const built = buildPhotoLesson({
      id: 'photo-named',
      title: 'Kepala',
      targetHash: 'abcdef1234567890',
      contours: [square(10, 10, 700)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      proposals: [
        { primitive: 'circle', name: 'Kepala', pair: false, x: 0, y: 0, width: 900, height: 800, rotation: 0 },
        { primitive: 'triangle', name: 'ekor', pair: false, x: 2000, y: 2000, width: 40, height: 40, rotation: 0 },
      ],
    });
    expect(built.lesson.steps[0]?.instruction).toBe('Gambar lingkaran besar untuk kepala.');
    expect(built.lesson.steps[0]?.instruction).not.toMatch(/ekor/);
  });

  it('rejects a banned part name and never colours a white background', () => {
    const built = buildPhotoLesson({
      id: 'photo-words',
      title: 'Kotak',
      targetHash: 'abcdef1234567890',
      contours: [square(10, 10, 700)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: picture(8, 8, () => false),
      palette: ['#336699'],
      proposals: [
        { primitive: 'rounded-rect', name: 'wajah anak', pair: false, x: 0, y: 0, width: 900, height: 800, rotation: 0 },
      ],
    });
    expect(built.lesson.steps[0]?.instruction).toMatch(/bentuk utamanya/);
    expect(built.lesson.steps[0]?.instruction).not.toMatch(/wajah anak/);
    expect(built.lesson.steps.some((step) => step.phase === 'color')).toBe(false);
  });

  it('keeps every real part, including more than eight steps when the colours differ', () => {
    const contours = [square(10, 10, 700)];
    for (let index = 0; index < 12; index += 1) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      contours.push(square(40 + column * 160, 40 + row * 180, 70));
    }
    const built = buildPhotoLesson({
      id: 'photo-many',
      title: 'Banyak',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: painted(20, 10, (x) => (x < 10 ? [200, 40, 40] : [40, 80, 200])),
      palette: ['#cc3333', '#2850c8'],
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    const colors = built.lesson.steps.filter((step) => step.phase === 'color');
    expect(drawing.length).toBeGreaterThan(6);
    expect(built.lesson.steps.length).toBeGreaterThan(8);
    expect(drawing[0]?.guidePaths).toHaveLength(1);
    expect(drawing.every((step) => step.guidePaths.length <= MAX_PATHS_PER_STEP)).toBe(true);
    expect(new Set(drawing.map((step) => step.instruction)).size).toBe(drawing.length);
    expect(colors.length).toBeGreaterThanOrEqual(2);
    expect(colors.every((step) => step.instruction.startsWith('Warnai '))).toBe(true);
  });

  it('uses one colour step for near-identical colours and drops a tiny different speck of colour', () => {
    const built = buildPhotoLesson({
      id: 'photo-colours',
      title: 'Warna',
      targetHash: 'abcdef1234567890',
      contours: [square(40, 40, 220), square(620, 40, 220), square(420, 680, 24)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: painted(10, 10, (x, y) => {
        if (y > 7) return [20, 170, 60];
        return x < 5 ? [204, 32, 32] : [208, 40, 40];
      }),
      palette: ['#cc2020'],
    });
    const colors = built.lesson.steps.filter((step) => step.phase === 'color');
    expect(colors).toHaveLength(1);
    expect(colors[0]?.colorRegionIds.length).toBe(2);
    expect(colors[0]?.instruction).not.toMatch(/latar|ventilasi|barcode/);
  });

  it('reports a small largest piece when two separated parts together cover the subject', () => {
    const built = buildPhotoLesson({
      id: 'photo-split',
      title: 'Terpisah',
      targetHash: 'abcdef1234567890',
      contours: [square(0, 0, 80), square(800, 0, 80)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
    });
    expect(built.coverage).toBeLessThan(LOW_SUBJECT_COVERAGE);
    expect(built.subjectFit).toBeGreaterThan(0.8);
    expect(built.needsReview).toBe(false);
    expect(shouldRedraw(built.subjectFit)).toBe(false);
    expect(shouldRedraw(0.2)).toBe(true);
  });
});

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
