import { describe, expect, it } from 'vitest';
import { renderCumulativeStep } from './compare';
import { buildPhotoLesson, buildTutorialLesson, TUTORIAL_DRAWING_MAX } from './lesson-build';
import type { DetectedPart, PlanShape } from './parts';
import type { RgbaImage } from './png';
import { subtractInk } from './reverse';
import type { Contour, Point } from './trace';

const photo = painted(24, 18, () => [180, 180, 180]);

describe('how-to-draw construction', () => {
  it('starts with one simple mass and adds cat parts before colour', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-cat',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [
        circle(400, 280, 180),
        circle(250, 140, 50),
        circle(550, 140, 50),
        circle(340, 270, 22),
        circle(460, 270, 22),
        circle(400, 330, 16),
        { closed: false, points: [{ x: 180, y: 300 }, { x: 280, y: 320 }, { x: 360, y: 300 }] },
      ],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [
        planned('kepala', 1, 'circle', cover(220, 100, 360, 360)),
        planned('telinga', 2, 'oval', cover(200, 90, 100, 100), { pair: true, count: 2 }),
        planned('telinga', 2, 'oval', cover(500, 90, 100, 100), { pair: true, count: 2 }),
        planned('mata', 3, '', cover(318, 248, 44, 44), { pair: true, count: 2 }),
        planned('mata', 3, '', cover(438, 248, 44, 44), { pair: true, count: 2 }),
        planned('hidung', 4, '', cover(384, 314, 32, 32), { dependsOn: 'kepala' }),
        planned('kumis', 5, 'line', cover(160, 280, 220, 60), { dependsOn: 'kepala' }),
      ],
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    const text = drawing.map((step) => step.instruction).join(' ');
    expect(drawing[0]?.instruction).toMatch(/lingkaran besar untuk kepala/);
    expect(drawing[0]?.guidePaths).toHaveLength(1);
    expect(text).toMatch(/telinga/);
    expect(text).toMatch(/mata/);
    expect(text).toMatch(/hidung/);
    expect(text).toMatch(/kumis/);
    expect(text.indexOf('kepala')).toBeLessThan(text.indexOf('mata'));
    expect(text.indexOf('mata')).toBeLessThan(text.indexOf('hidung'));
    const firstColour = built.lesson.steps.findIndex((step) => step.phase === 'color');
    expect(firstColour).toBe(drawing.length);
    const seen = new Set<string>();
    for (const step of drawing) {
      for (const path of step.guidePaths) {
        expect(seen.has(path.d)).toBe(false);
        seen.add(path.d);
        if (path.role === 'final-outline') {
          expect(built.lesson.targetPreview.paths.some((preview) => preview.id === path.id)).toBe(true);
        }
      }
    }
    const highlighted = renderCumulativeStep(built.lesson, 2, 140, { r: 255, g: 255, b: 255 }, true);
    expect(countTone(highlighted, (red, green, blue) => red > 180 && green < 100 && blue < 100)).toBeGreaterThan(4);
  });

  it('draws a centre cross as a guide and leaves it out of the finished ink', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-guide',
      title: 'Wajah',
      targetHash: 'abcdef1234567890',
      contours: [circle(420, 300, 160), circle(360, 280, 18), circle(480, 280, 18)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [
        planned('tengah', 1, 'line', cover(300, 180, 240, 240), { guide: true }),
        planned('wajah', 2, 'circle', cover(260, 140, 320, 320)),
        planned('mata', 3, '', cover(342, 262, 36, 36), { pair: true, count: 2, dependsOn: 'wajah' }),
        planned('mata', 3, '', cover(462, 262, 36, 36), { pair: true, count: 2, dependsOn: 'wajah' }),
      ],
    });
    expect(built.lesson.steps[0]?.instruction).toMatch(/lingkaran besar untuk wajah/);
    const cross = built.lesson.steps[0]?.guidePaths.filter((path) => path.role === 'construction') ?? [];
    expect(cross.length).toBeGreaterThanOrEqual(2);
    expect(built.lesson.targetPreview.paths.some((path) => path.role === 'construction')).toBe(false);
    expect(built.lesson.targetPreview.paths.some((path) => cross.some((guide) => guide.d === path.d))).toBe(false);
    expect(built.reviewReason ?? '').not.toContain('Bentuk bantu ikut gambar akhir');
  });

  it('keeps a dark coffee fill, a red collar, one brown seat, and petal lines', () => {
    const cupPhoto = painted(48, 36, (x, y) => {
      if (x >= 16 && x < 32 && y >= 14 && y < 26) return [72, 42, 24];
      return [255, 255, 255];
    });
    const cup = buildTutorialLesson({
      id: 'tutorial-cup',
      title: 'Cangkir',
      targetHash: 'abcdef1234567890',
      contours: [square(180, 160, 560), square(340, 280, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: cupPhoto,
      palette: ['#ffffff'],
      parts: [
        planned('cangkir', 1, 'oval', cover(180, 160, 560, 560)),
        planned('kopi', 2, '', cover(340, 280, 180, 180), { dependsOn: 'cangkir' }),
      ],
    });
    const cupColours = cup.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction);
    expect(cup.lesson.steps.some((step) => step.instruction.includes('kopi'))).toBe(true);
    expect(cupColours.some((text) => text.includes('cokelat tua'))).toBe(true);
    expect(cupColours.some((text) => text.includes('putih'))).toBe(false);
    expect(cup.lesson.steps.findIndex((step) => step.phase === 'color')).toBeGreaterThan(0);

    const collar = buildTutorialLesson({
      id: 'tutorial-collar',
      title: 'Anjing',
      targetHash: 'abcdef1234567890',
      contours: [square(120, 80, 700), square(200, 500, 140)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: painted(24, 18, () => [20, 20, 20]),
      palette: ['#111111'],
      flatRegions: [
        { name: 'putih', hex: '#ffffff', points: square(400, 200, 80).points, pixels: 400, cx: 440, cy: 240 },
        { name: 'merah', hex: '#c62828', points: square(200, 500, 140).points, pixels: 900, cx: 270, cy: 570 },
        { name: 'hitam', hex: '#1a1a1a', points: square(120, 80, 700).points, pixels: 4000, cx: 470, cy: 400, mixed: true },
      ],
      parts: [
        planned('badan', 1, 'oval', cover(120, 80, 700, 560)),
        planned('kalung', 2, '', cover(200, 500, 140, 140), { dependsOn: 'badan' }),
      ],
    });
    const collarColours = collar.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction);
    expect(collarColours.some((text) => text.includes('kalung') && text.includes('merah'))).toBe(true);
    expect(collarColours.join(' ')).not.toMatch(/putih|mata/);
    const collarFrame = renderCumulativeStep(collar.lesson, collar.lesson.steps.length, 180);
    expect(countTone(collarFrame, (red, green, blue) => red > 140 && green < 80 && blue < 80)).toBeGreaterThan(8);

    const car = buildTutorialLesson({
      id: 'tutorial-car',
      title: 'Mobil mainan',
      targetHash: 'abcdef1234567890',
      contours: [square(80, 160, 640), square(120, 520, 90), square(560, 500, 100), square(400, 240, 120)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: painted(24, 18, () => [140, 140, 140]),
      palette: ['#888888'],
      flatRegions: [
        { name: 'abu-abu', hex: '#808080', points: square(80, 160, 640).points, pixels: 5000, cx: 400, cy: 480 },
        { name: 'cokelat', hex: '#806040', points: square(400, 240, 120).points, pixels: 800, cx: 460, cy: 300 },
      ],
      parts: [
        planned('mobil', 1, '', cover(80, 160, 640, 520)),
        planned('roda', 2, 'circle', cover(120, 520, 90, 90), { pair: true, count: 2 }),
        planned('roda', 2, 'circle', cover(560, 500, 100, 100), { pair: true, count: 2 }),
        planned('kursi', 3, '', cover(400, 240, 120, 120), { dependsOn: 'mobil' }),
      ],
    });
    const brown = car.lesson.steps.filter((step) => step.phase === 'color' && step.instruction.includes('cokelat'));
    expect(car.lesson.steps.some((step) => step.instruction.includes('kursi'))).toBe(true);
    expect(brown).toHaveLength(1);
    expect(brown[0]?.colorRegionIds).toHaveLength(1);
    expect(car.needsReview).toBe(false);

    const petalContours = [square(80, 80, 520)];
    for (let index = 0; index < 5; index += 1) {
      petalContours.push(square(160 + (index % 3) * 110, 160 + Math.floor(index / 3) * 110, 46));
    }
    const flower = buildTutorialLesson({
      id: 'tutorial-petals',
      title: 'Bunga',
      targetHash: 'abcdef1234567890',
      contours: petalContours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        planned('bunga', 1, 'circle', cover(80, 80, 520, 520)),
        planned('kelopak', 2, 'oval', cover(150, 150, 340, 280), { count: 5, dependsOn: 'bunga' }),
      ],
    });
    const petals = flower.lesson.steps.find((step) => step.instruction.includes('kelopak'));
    expect(petals?.instruction).toBe('Gambar kelopak.');
    expect(petals?.guidePaths).toHaveLength(5);
    expect(flower.lesson.steps.filter((step) => step.phase !== 'color').length).toBeLessThanOrEqual(TUTORIAL_DRAWING_MAX);
  });

  it('still builds the traced fallback when the plan has no usable part', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-fallback',
      title: 'Kotak',
      targetHash: 'abcdef1234567890',
      contours: [square(80, 60, 420)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [planned('wajah anak', 1, '', { x: 0, y: 0, width: 40, height: 40 })],
    });
    expect(built.builder).toBe('traced');
    expect(built.lesson.steps[0]?.instruction).toBe('Gambar garis luar kotak.');
    expect(buildPhotoLesson({
      id: 'same',
      title: 'Kotak',
      targetHash: 'abcdef1234567890',
      contours: [square(80, 60, 420)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
    }).lesson.steps[0]?.instruction).toBe('Gambar garis luar kotak.');
  });

  it('subtracts only the ink that the later drawing added', () => {
    const earlier = painted(20, 16, (x, y) => (x >= 2 && x < 14 && y >= 2 && y < 12 ? [0, 0, 0] : [255, 255, 255]));
    const later = painted(20, 16, (x, y) => {
      const body = x >= 2 && x < 14 && y >= 2 && y < 12;
      const mark = x >= 15 && x < 19 && y >= 4 && y < 10;
      return body || mark ? [0, 0, 0] : [255, 255, 255];
    });
    const added = subtractInk(earlier, later);
    expect(added).not.toBeNull();
    expect(countTone(added!, (red) => red < 20)).toBeGreaterThan(8);
    expect(countTone(added!, (red, _green, _blue, x) => red < 20 && x < 14)).toBe(0);
    expect(subtractInk(earlier, { ...later, width: 10 })).toBeNull();
  });

  it('draws the fitted primitive first and the real outline after it', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-primitive',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [circle(400, 280, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [planned('kepala', 1, 'circle', cover(220, 100, 360, 360))],
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    expect(drawing[0]?.instruction).toMatch(/lingkaran besar untuk kepala/);
    expect(drawing[0]?.guidePaths[0]?.d).toMatch(/\bA\b/);
    expect(drawing[1]?.instruction).toBe('Gambar garis luar kepala.');
    expect(drawing[0]?.guidePaths[0]?.d).not.toBe(drawing[1]?.guidePaths[0]?.d);
  });

  it('gives each planned animal detail its own step', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-dog-details',
      title: 'Anjing',
      targetHash: 'abcdef1234567890',
      contours: [square(120, 80, 700)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [
        planned('badan', 1, 'oval', cover(120, 80, 700, 560)),
        planned('telinga', 2, 'oval', cover(180, 90, 80, 70)),
        planned('mata', 3, 'circle', cover(300, 180, 40, 40)),
        planned('hidung', 4, 'circle', cover(360, 240, 36, 30)),
        planned('lidah', 5, '', cover(350, 280, 40, 36)),
        planned('kaki', 6, 'line', cover(200, 480, 80, 120)),
      ],
    });
    const text = built.lesson.steps.filter((step) => step.phase !== 'color').map((step) => step.instruction).join(' ');
    for (const name of ['telinga', 'mata', 'hidung', 'lidah', 'kaki']) {
      expect(text).toContain(name);
    }
    expect(built.reviewReason ?? '').not.toContain('Detail hewan terlalu sedikit');
  });

  it('highlights every wheel in the one wheel step', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-wheels',
      title: 'Mobil mainan',
      targetHash: 'abcdef1234567890',
      contours: [square(80, 160, 640), square(90, 520, 90), square(620, 500, 100)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [
        planned('mobil', 1, 'oval', cover(80, 160, 640, 520)),
        planned('roda kiri', 2, 'circle', cover(90, 520, 90, 90), { pair: true, count: 2 }),
        planned('roda kanan', 2, 'circle', cover(620, 500, 100, 100), { pair: true, count: 2 }),
      ],
    });
    const wheelAt = built.lesson.steps.findIndex((step) => step.instruction.includes('roda'));
    const wheel = built.lesson.steps[wheelAt];
    expect(wheel?.guidePaths.filter((path) => path.role === 'final-outline')).toHaveLength(2);
    const highlighted = renderCumulativeStep(built.lesson, wheelAt + 1, 180, { r: 255, g: 255, b: 255 }, true);
    const isRed = (r: number, g: number, b: number) => r > 180 && g < 100 && b < 100;
    expect(countTone(highlighted, (r, g, b, x) => isRed(r, g, b) && x < highlighted.width * 0.45)).toBeGreaterThan(2);
    expect(countTone(highlighted, (r, g, b, x) => isRed(r, g, b) && x > highlighted.width * 0.55)).toBeGreaterThan(2);
    expect(built.needsReview).toBe(false);
  });

  it('keeps a small pink ear and names a small tongue by the tighter box', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-small-colour',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [circle(400, 280, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      flatRegions: [
        { name: 'abu-abu', hex: '#888888', points: square(200, 160, 400).points, pixels: 8000, cx: 400, cy: 360 },
        { name: 'merah muda', hex: '#f4a4b0', points: square(230, 120, 36).points, pixels: 120, cx: 248, cy: 138 },
        { name: 'merah', hex: '#c62828', points: square(360, 340, 28).points, pixels: 140, cx: 374, cy: 354 },
      ],
      parts: [
        planned('kepala', 1, 'circle', cover(200, 80, 400, 400)),
        planned('telinga', 2, 'oval', cover(210, 100, 80, 80)),
        planned('lidah', 3, '', cover(350, 320, 50, 50)),
        planned('leher', 4, '', cover(280, 280, 220, 180)),
      ],
    });
    const colours = built.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction);
    expect(colours.some((text) => text.includes('telinga') && text.includes('merah muda'))).toBe(true);
    expect(colours.some((text) => text.includes('lidah') && text.includes('merah'))).toBe(true);
    expect(colours.join(' ')).not.toMatch(/leher/);
  });

  it('does not treat a shifted copy of the same lines as new ink', () => {
    const earlier = painted(32, 24, (x, y) => (x >= 4 && x < 16 && y >= 4 && y < 16 ? [0, 0, 0] : [255, 255, 255]));
    const later = painted(32, 24, (x, y) => {
      const body = x >= 7 && x < 19 && y >= 6 && y < 18;
      const mark = x >= 24 && x < 30 && y >= 4 && y < 10;
      return body || mark ? [0, 0, 0] : [255, 255, 255];
    });
    const added = subtractInk(earlier, later);
    expect(added).not.toBeNull();
    const dark = countTone(added!, (red) => red < 20);
    expect(dark).toBeGreaterThan(8);
    expect(dark).toBeLessThan(80);
  });
});

function planned(
  name: string,
  order: number,
  shape: PlanShape | '',
  box: { x: number; y: number; width: number; height: number },
  extra: { pair?: boolean; count?: number; guide?: boolean; dependsOn?: string } = {},
): DetectedPart {
  return {
    name,
    pair: extra.pair === true,
    ...box,
    points: [],
    colorName: 'abu-abu',
    pieceIds: [],
    count: extra.count ?? 0,
    order,
    ...(shape ? { shape } : {}),
    ...(extra.guide ? { guide: true } : {}),
    ...(extra.dependsOn ? { dependsOn: extra.dependsOn } : {}),
  };
}

function cover(x: number, y: number, w: number, h: number): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(904 / 1000, 654 / 750);
  const ox = (1000 - 1000 * scale) / 2;
  const oy = (750 - 750 * scale) / 2;
  return { x: ox + x * scale - 16, y: oy + y * scale - 16, width: w * scale + 32, height: h * scale + 32 };
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

function countTone(
  image: RgbaImage,
  match: (red: number, green: number, blue: number, x: number, y: number) => boolean,
): number {
  let count = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const pixel = index / 4;
    const x = pixel % image.width;
    const y = Math.floor(pixel / image.width);
    if (match(image.data[index] ?? 0, image.data[index + 1] ?? 0, image.data[index + 2] ?? 0, x, y)) count += 1;
  }
  return count;
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

function circle(cx: number, cy: number, radius: number): Contour {
  const points: Point[] = [];
  for (let index = 0; index <= 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return { closed: true, points };
}
