import { describe, expect, it } from 'vitest';
import { findLessonProblems } from '../lesson-data/validate';
import { compareLessonToInk, renderCumulativeStep, renderLessonPreview, REVIEW_DICE_BELOW } from './compare';
import { colourHex, indonesianColourName } from './colors';
import { flatColourRegions } from './flat-colour';
import { buildPhotoLesson, isGenericInstruction, lessonPieces, OUTLINE_COVERAGE_MIN, shouldRedraw, uniquifyInstructions } from './lesson-build';
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
    expect(first?.instruction).toBe('Gambar garis luar kotak.');
    expect(first?.guidePaths[0]?.d).toMatch(/\b[LC]\b/);
    expect(first?.guidePaths[0]?.role).toBe('final-outline');
    expect(built.lesson.steps.some((step) => isGenericInstruction(step.instruction))).toBe(false);
    const colour = built.lesson.steps.find((step) => step.phase === 'color');
    expect(colour?.instruction).toBe('Warnai kotak dengan hitam.');
    expect(colour?.instruction).not.toMatch(/latar/);
    expect(built.needsReview).toBe(true);
    expect(built.reviewReason).toContain('Terlalu sedikit langkah menggambar');
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
    const guideOnly = renderCumulativeStep(built.lesson, 1, 160);
    expect(countTone(guideOnly, (red, green, blue) => red < 80 && green < 80 && blue < 80)).toBe(0);
    expect(countTone(guideOnly, (red, green, blue) => red > 150 && red < 210 && Math.abs(red - green) < 12 && Math.abs(green - blue) < 12)).toBeGreaterThan(8);
    expect(built.lesson.targetPreview.paths.every((path) => path.role === 'final-outline')).toBe(true);
    expect(built.reviewReason ?? '').not.toContain('Bentuk bantu ikut gambar akhir');
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
    expect(built.lesson.steps[0]?.instruction).toBe('Gambar garis luar kotak.');
    expect(built.lesson.steps.some((step) => /bagian berikutnya|wajah anak|bagian kecil|paling besar/.test(step.instruction))).toBe(false);
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
    expect(drawing.length).toBeGreaterThanOrEqual(3);
    expect(drawing.length).toBeLessThanOrEqual(7);
    expect(built.reviewReason ?? '').not.toContain('Terlalu banyak langkah menggambar');
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

  it('numbers a third copy of the same instruction instead of hanging', () => {
    const lines = uniquifyInstructions([
      'Tambahkan roda.',
      'Tambahkan roda.',
      'Tambahkan roda.',
      'Tambahkan roda.',
    ]);
    expect(lines).toEqual([
      'Tambahkan roda.',
      'Tambahkan roda yang lain.',
      'Tambahkan roda lagi (2).',
      'Tambahkan roda lagi (3).',
    ]);
    expect(new Set(lines.map((line) => line.toLowerCase())).size).toBe(4);
  });

  it('keeps interior lines off the outline when one part covers the whole subject', () => {
    const built = buildPhotoLesson({
      id: 'photo-head',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [circle(500, 360, 200), circle(420, 300, 28), circle(580, 300, 28)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [part('kepala', false, 'oranye')],
    });
    const outline = built.lesson.steps.find((step) => step.instruction.startsWith('Gambar garis luar'));
    expect(outline?.guidePaths).toHaveLength(1);
    expect(built.lesson.steps.some((step) => /mata|bagian kecil|paling besar/.test(step.instruction))).toBe(false);
    expect(built.unnamedInteriors).toBeGreaterThanOrEqual(2);
    expect(built.needsReview).toBe(true);
    expect(built.reviewReason).toContain('Terlalu sedikit langkah menggambar');
  });

  it('ignores a piece id when the ink sits outside that part', () => {
    const contours = [square(80, 60, 420), square(160, 140, 70)];
    const pieces = lessonPieces(contours, 1000, 750);
    const eye = pieces[1];
    if (!eye) throw new Error('expected an interior piece');
    const missed = buildPhotoLesson({
      id: 'photo-eye',
      title: 'Wajah',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        { ...part('wajah', false, 'oranye'), ...cover(80, 60, 420, 420), pieceIds: [0] },
        { ...part('mata', false, 'hitam', 10, 10, 40, 40), pieceIds: [eye.id] },
      ],
    });
    const outline = missed.lesson.steps.find((step) => step.id === 'outline-1');
    expect(outline?.guidePaths).toHaveLength(1);
    expect(outline?.instruction).toBe('Gambar garis luar wajah.');
    expect(missed.lesson.steps.some((step) => step.instruction === 'Gambar mata.')).toBe(false);
    expect(missed.unnamedInteriors).toBeGreaterThan(0);
    const placed = buildPhotoLesson({
      id: 'photo-eye-placed',
      title: 'Wajah',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        { ...part('wajah', false, 'oranye'), ...cover(80, 60, 420, 420), pieceIds: [0] },
        { ...part('mata', false, 'hitam'), ...cover(160, 140, 70, 70), pieceIds: [eye.id] },
      ],
    });
    expect(placed.lesson.steps.some((step) => step.instruction === 'Gambar mata.')).toBe(true);
    expect(placed.unnamedInteriors).toBe(0);
  });

  it('names white and dark brown from the flat illustration', () => {
    const cup = painted(48, 36, (x, y) => {
      const outline = x >= 6 && x < 42 && y >= 4 && y < 32 && (x < 8 || x >= 40 || y < 6 || y >= 30);
      if (outline) return [0, 0, 0];
      if (x >= 16 && x < 32 && y >= 14 && y < 26) return [72, 42, 24];
      return [255, 255, 255];
    });
    const built = buildPhotoLesson({
      id: 'photo-cup',
      title: 'Cangkir',
      targetHash: 'abcdef1234567890',
      contours: [square(180, 160, 560), square(340, 280, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: cup,
      palette: ['#ffffff'],
      parts: [
        { ...part('cangkir', false, 'abu-abu'), ...cover(180, 160, 560, 560) },
        { ...part('kopi', false, 'merah muda'), ...cover(340, 280, 180, 180) },
      ],
    });
    const colours = built.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction);
    const illustrated = new Set(flatColourRegions(cup).map((region) => region.name));
    expect(illustrated.has('putih')).toBe(true);
    expect(illustrated.has('cokelat tua')).toBe(true);
    expect(colours.some((text) => text.includes('putih'))).toBe(true);
    expect(colours.some((text) => text.includes('cokelat tua'))).toBe(true);
    expect(colours.join(' ')).not.toMatch(/abu-abu|merah muda/);
    for (const text of colours) {
      const word = text.match(/dengan (.+)\.$/)?.[1] ?? '';
      expect(illustrated.has(word)).toBe(true);
    }
    expect(built.lesson.steps.some((step) => isGenericInstruction(step.instruction))).toBe(false);
    expect(built.lesson.steps.find((step) => step.id === 'outline-1')?.guidePaths).toHaveLength(1);
    expect(built.lesson.steps.some((step) => step.instruction === 'Gambar kopi.')).toBe(true);
    const white = built.lesson.steps.find((step) => step.instruction.includes('putih'));
    expect(white?.toolPreset.color).toBe('#ffffff');
    const grey = { r: 200, g: 200, b: 200 };
    const drawingCount = built.lesson.steps.findIndex((step) => step.phase === 'color');
    let previous = renderCumulativeStep(built.lesson, drawingCount, 180, grey);
    for (let index = drawingCount; index < built.lesson.steps.length; index += 1) {
      const next = renderCumulativeStep(built.lesson, index + 1, 180, grey);
      expect(changedPixels(previous, next)).toBeGreaterThanOrEqual(20);
      previous = next;
    }
    expect(countTone(previous, (red, green, blue) => red > 245 && green > 245 && blue > 245)).toBeGreaterThan(20);
    expect(countTone(previous, (red, green, blue) => red > 50 && red < 110 && green < 70 && blue < 50)).toBeGreaterThan(10);
    expect(countTone(previous, (red, green, blue) => red < 80 && green < 80 && blue < 80)).toBeGreaterThan(8);
  });

  it('fills each part and keeps the earlier colour', () => {
    const body = square(150, 120, 640);
    const eye = square(430, 250, 90);
    const photo = painted(40, 30, (x, y) => {
      const nx = x / 39;
      const ny = y / 29;
      if (nx < 0.08 || nx > 0.92 || ny < 0.08 || ny > 0.92) return [40, 150, 50];
      if (nx > 0.4 && nx < 0.56 && ny > 0.3 && ny < 0.5) return [200, 40, 40];
      return [150, 150, 150];
    });
    const built = buildPhotoLesson({
      id: 'photo-eye-colour',
      title: 'Wajah',
      targetHash: 'abcdef1234567890',
      contours: [body, eye],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [
        { ...part('wajah', false, 'hijau'), ...cover(150, 120, 640, 640) },
        { ...part('mata', false, 'kuning'), ...cover(430, 250, 90, 90) },
      ],
    });
    const colours = built.lesson.steps.filter((step) => step.phase === 'color');
    expect(colours.map((step) => step.instruction).join(' ')).not.toMatch(/hijau|kuning/);
    expect(colours.some((step) => step.instruction.includes('abu-abu'))).toBe(true);
    expect(colours.some((step) => step.instruction.includes('merah'))).toBe(true);
    const frame = renderCumulativeStep(built.lesson, built.lesson.steps.length, 180);
    expect(countTone(frame, (red, green, _blue) => Math.abs(red - green) < 18 && red > 90 && red < 190)).toBeGreaterThan(20);
    expect(countTone(frame, (red, green, blue) => red > 150 && green < 80 && blue < 80)).toBeGreaterThan(10);
  });

  it('does not double garis luar and does not say dua for one part or five petals', () => {
    const cup = buildPhotoLesson({
      id: 'photo-label',
      title: 'Cangkir',
      targetHash: 'abcdef1234567890',
      contours: [square(180, 160, 500)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [part('garis luar cangkir', false, 'oranye')],
    });
    expect(cup.lesson.steps.find((step) => step.id === 'outline-1')?.instruction).toBe('Gambar garis luar cangkir.');
    const flower = buildPhotoLesson({
      id: 'photo-flower-name',
      title: 'Bunga',
      targetHash: 'abcdef1234567890',
      contours: [square(120, 120, 400)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [part('garis luar', false, 'oranye')],
    });
    expect(flower.lesson.steps[0]?.instruction).toBe('Gambar garis luar bunga.');
    const handle = buildPhotoLesson({
      id: 'photo-handle',
      title: 'Cangkir',
      targetHash: 'abcdef1234567890',
      contours: [square(120, 120, 420), square(500, 220, 70)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        { ...part('cangkir', false, 'oranye'), ...cover(120, 120, 420, 420), pieceIds: [0] },
        { ...part('pegangan', true, 'oranye'), ...cover(500, 220, 70, 70), pieceIds: [1] },
      ],
    });
    expect(handle.lesson.steps.some((step) => step.instruction === 'Gambar pegangan.')).toBe(true);
    expect(handle.lesson.steps.some((step) => /dua pegangan/.test(step.instruction))).toBe(false);
    const petalContours = [square(80, 80, 520)];
    for (let index = 0; index < 5; index += 1) {
      petalContours.push(square(160 + (index % 3) * 110, 160 + Math.floor(index / 3) * 110, 46));
    }
    const petals = buildPhotoLesson({
      id: 'photo-petals',
      title: 'Bunga',
      targetHash: 'abcdef1234567890',
      contours: petalContours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        { ...part('bunga', false, 'oranye'), ...cover(80, 80, 520, 520), pieceIds: [0], count: 1 },
        { ...part('kelopak', true, 'oranye'), ...cover(150, 150, 340, 280), pieceIds: [1, 2, 3, 4, 5], count: 5 },
      ],
    });
    const petalStep = petals.lesson.steps.find((step) => step.instruction.includes('kelopak'));
    expect(petalStep?.instruction).toBe('Gambar kelopak.');
    expect(petalStep?.guidePaths.length).toBe(5);
    expect(petals.reviewReason ?? '').not.toContain('Jumlah bagian tidak sesuai');
  });

  it('flags repeated words, too many colours, and leaves grass out', () => {
    const repeated = buildPhotoLesson({
      id: 'photo-repeat',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [square(80, 80, 500)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [part('kepala kepala', false, 'oranye')],
    });
    expect(repeated.needsReview).toBe(true);
    expect(repeated.reviewReason).toContain('Ada instruksi yang mengulang kata');
    const swatches: ReadonlyArray<readonly [number, number, number]> = [
      [200, 40, 40],
      [40, 80, 200],
      [40, 160, 60],
      [220, 190, 40],
      [140, 50, 180],
    ];
    const bands = painted(50, 40, (x, y) => {
      const nx = x / 49;
      const ny = y / 39;
      if (nx < 0.08 || nx > 0.92 || ny < 0.08 || ny > 0.92) return [248, 248, 248];
      const hit = swatches.findIndex((_, index) => nx > 0.16 + index * 0.14 && nx < 0.26 + index * 0.14 && ny > 0.35 && ny < 0.6);
      const swatch = swatches[hit];
      return swatch ?? [150, 150, 150];
    });
    const bandNames = ['kiri', 'tengah kiri', 'tengah', 'tengah kanan', 'kanan'];
    const bandContours = [square(80, 80, 820)];
    const bandParts = [{ ...part('badan', false, 'abu-abu'), ...cover(80, 80, 820, 820), pieceIds: [0] }];
    bandNames.forEach((name, index) => {
      const x = 160 + index * 140;
      bandContours.push(square(x, 260, 80));
      bandParts.push({ ...part(name, false, 'abu-abu'), ...cover(x, 260, 80, 80), pieceIds: [index + 1] });
    });
    const manyColours = buildPhotoLesson({
      id: 'photo-many-colours',
      title: 'Balok',
      targetHash: 'abcdef1234567890',
      contours: bandContours,
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: bands,
      palette: ['#cc3333'],
      parts: bandParts,
    });
    expect(manyColours.lesson.steps.filter((step) => step.phase === 'color').length).toBeGreaterThan(4);
    expect(manyColours.needsReview).toBe(true);
    expect(manyColours.reviewReason).toContain('Terlalu banyak langkah warna');
    const grass = painted(40, 40, (x, y) => {
      const nx = x / 39;
      const ny = y / 39;
      if (nx < 0.1 || nx > 0.9 || ny < 0.1 || ny > 0.9) return [40, 160, 50];
      return [150, 150, 150];
    });
    const cat = buildPhotoLesson({
      id: 'photo-grass',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [square(200, 150, 500)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: grass,
      palette: ['#888888'],
      parts: [{ ...part('badan', false, 'hijau'), ...cover(200, 150, 500, 500) }],
    });
    const grassText = cat.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction).join(' ');
    expect(grassText).not.toMatch(/hijau/);
    expect(grassText).toMatch(/abu-abu/);
    const foreign = buildPhotoLesson({
      id: 'photo-foreign',
      title: 'Kepala',
      targetHash: 'abcdef1234567890',
      contours: [square(200, 160, 400)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        { ...part('kepala', false, 'oranye'), ...cover(200, 160, 400, 400), pieceIds: [0] },
        { ...part('kalung', false, 'ungu'), ...cover(20, 20, 40, 40), pieceIds: [] },
      ],
    });
    expect(foreign.lesson.steps.some((step) => step.instruction.includes('ungu'))).toBe(false);
    expect(foreign.reviewReason ?? '').not.toContain('tidak ada pada gambar');
  });

  it('keeps both colours when the illustration is split red and blue', () => {
    const split = painted(20, 10, (x) => (x < 10 ? [200, 30, 30] : [30, 40, 200]));
    const built = buildPhotoLesson({
      id: 'photo-split-colour',
      title: 'Balok',
      targetHash: 'abcdef1234567890',
      contours: [square(40, 80, 900)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo: split,
      palette: ['#cc3333'],
      parts: [{ ...part('badan', false, 'merah'), ...cover(40, 80, 200, 200) }],
    });
    const colours = built.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction);
    expect(colours).toHaveLength(2);
    expect(colours.join(' ')).toMatch(/merah/);
    expect(colours.join(' ')).toMatch(/biru/);
    expect(built.reviewReason ?? '').not.toContain('Warna subjek lebih dari satu');
  });

  it('uses the subject noun without adjectives and merges one part', () => {
    const dog = buildPhotoLesson({
      id: 'photo-dog-name',
      title: 'Anjing',
      targetHash: 'abcdef1234567890',
      contours: [square(80, 80, 500)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [part('anjing hitam lucu', false, 'hitam')],
    });
    expect(dog.lesson.steps.find((step) => step.id === 'outline-1')?.instruction).toBe('Gambar garis luar anjing.');
    const flower = buildPhotoLesson({
      id: 'photo-flower-plain',
      title: 'Bunga',
      targetHash: 'abcdef1234567890',
      contours: [square(80, 80, 400)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [part('bunga putih merah', false, 'putih')],
    });
    expect(flower.lesson.steps.find((step) => step.id === 'outline-1')?.instruction).toBe('Gambar garis luar bunga.');
    const wheels = buildPhotoLesson({
      id: 'photo-wheels',
      title: 'Mobil',
      targetHash: 'abcdef1234567890',
      contours: [square(40, 40, 700), square(80, 400, 80), square(600, 400, 80)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        { ...part('mobil', false, 'abu-abu'), ...cover(40, 40, 700, 500), pieceIds: [0] },
        { ...part('roda', true, 'hitam'), ...cover(80, 400, 80, 80), pieceIds: [1], count: 2 },
        { ...part('roda', true, 'hitam'), ...cover(600, 400, 80, 80), pieceIds: [2], count: 2 },
      ],
    });
    const wheelSteps = wheels.lesson.steps.filter((step) => step.instruction.includes('roda'));
    expect(wheelSteps).toHaveLength(1);
    expect(wheelSteps[0]?.instruction).toBe('Tambahkan dua roda.');
    expect(wheelSteps[0]?.guidePaths).toHaveLength(2);
  });

  it('drops a step that retraces ink already drawn', () => {
    const built = buildPhotoLesson({
      id: 'photo-retrace',
      title: 'Wajah',
      targetHash: 'abcdef1234567890',
      contours: [
        square(80, 60, 420),
        { closed: false, points: [{ x: 80, y: 60 }, { x: 290, y: 60 }, { x: 500, y: 60 }] },
      ],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        { ...part('wajah', false, 'oranye'), ...cover(80, 60, 420, 420), pieceIds: [0] },
        { ...part('kumis', false, 'oranye'), ...cover(80, 40, 420, 80), pieceIds: [1] },
      ],
    });
    expect(built.lesson.steps.some((step) => step.instruction.includes('kumis'))).toBe(false);
    expect(built.needsReview).toBe(true);
    expect(built.reviewReason).toContain('tidak menambah garis');
  });
});

describe('colour names', () => {
  it('keeps orange, white, dark brown, and dark red distinct', () => {
    expect(indonesianColourName({ r: 220, g: 90, b: 20 })).toBe('oranye');
    expect(indonesianColourName({ r: 236, g: 234, b: 230 })).toBe('putih');
    expect(indonesianColourName({ r: 180, g: 180, b: 180 })).toBe('putih');
    expect(indonesianColourName({ r: 140, g: 140, b: 140 })).toBe('abu-abu');
    expect(indonesianColourName({ r: 72, g: 42, b: 24 })).toBe('cokelat');
    expect(indonesianColourName({ r: 120, g: 20, b: 30 })).toBe('merah');
    expect(colourHex('putih')).toBe('#ffffff');
  });
});

describe('traced ink cleanup', () => {
  it('drops short parallel bars that touch the main shape', () => {
    const art = picture(90, 70, (x, y) => {
      if (x >= 8 && x < 48 && y >= 8 && y < 58) return true;
      if (y === 30 && x >= 47 && x < 62) return true;
      if (y >= 24 && y < 36 && x >= 62 && x < 84 && (x - 62) % 4 < 2) return true;
      return false;
    });
    const traced = traceInk(art);
    const barcode = traced.filter((contour) => contour.points.every((point) => point.x > 55));
    expect(barcode).toHaveLength(0);
  });

  it('thins a thick ring to one midline and keeps the filled silhouette', () => {
    const traced = traceInk(picture(80, 80, (x, y) => {
      const distance = Math.hypot(x - 40, y - 40);
      return distance < 30 && distance > 18;
    }));
    const silhouette = traced.find((contour) => contour.silhouette);
    expect(silhouette?.closed).toBe(true);
    expect(traced.filter((contour) => !contour.silhouette).length).toBeLessThanOrEqual(1);
  });

  it('merges a doubled stroke and keeps two separated rings', () => {
    const doubled = traceInk(picture(200, 120, (x, y) => {
      if (x < 30 || x > 170) return false;
      const wave = Math.sin(x / 12);
      return Math.abs(y - (52 + wave)) < 1.4 || Math.abs(y - (56 + wave)) < 1.4;
    }));
    expect(doubled.filter((contour) => !contour.silhouette).length).toBeLessThanOrEqual(1);
    const apart = traceInk(picture(160, 100, (x, y) => {
      const left = Math.hypot(x - 40, y - 50);
      const right = Math.hypot(x - 120, y - 50);
      return (left > 12 && left < 16) || (right > 12 && right < 16);
    }));
    expect(apart.length).toBeGreaterThanOrEqual(2);
  });
});

function part(name: string, pair: boolean, colorName: string, x = 0, y = 0, width = 1000, height = 750): DetectedPart {
  return { name, pair, x, y, width, height, points: [], colorName, pieceIds: [], count: 0 };
}

function changedPixels(left: RgbaImage, right: RgbaImage): number {
  let count = 0;
  const length = Math.min(left.data.length, right.data.length);
  for (let index = 0; index < length; index += 4) {
    if ((left.data[index] ?? 0) !== (right.data[index] ?? 0)) count += 1;
    else if ((left.data[index + 1] ?? 0) !== (right.data[index + 1] ?? 0)) count += 1;
    else if ((left.data[index + 2] ?? 0) !== (right.data[index + 2] ?? 0)) count += 1;
  }
  return count;
}

function countTone(image: RgbaImage, match: (red: number, green: number, blue: number) => boolean): number {
  let count = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    if (match(image.data[index] ?? 0, image.data[index + 1] ?? 0, image.data[index + 2] ?? 0)) count += 1;
  }
  return count;
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
