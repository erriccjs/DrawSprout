import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderCumulativeStep } from './compare';
import { buildPhotoLesson, buildTutorialLesson, lessonPieces, TUTORIAL_DRAWING_MAX } from './lesson-build';
import type { DetectedPart, PlanShape } from './parts';
import { decodePng, type RgbaImage } from './png';
import { eraseDetailNames, inkAdded, partErasedCleanly, registerToFinal, subtractInk } from './reverse';
import { traceInk, type Contour, type Point } from './trace';

/** Real v12 flower line, when the eval sheet is on disk. The synthetic stands in for the same failure. */
const FLOWER_LINE = '/workspace/m4/v12-openai/illustrations/flower-line.png';

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

  it('drops a guide step that is not the opening cross', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-empty-guide',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [circle(400, 280, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [
        planned('kepala', 1, 'circle', cover(220, 100, 360, 360)),
        planned('leher', 2, 'line', cover(300, 400, 160, 40), { guide: true }),
      ],
    });
    const text = built.lesson.steps.map((step) => step.instruction).join(' ');
    expect(text).not.toMatch(/garis bantu|leher/);
  });

  it('erases the centre after the petals, and rejects ink outside the part', () => {
    const plan = eraseDetailNames([
      { name: 'bunga', order: 1, width: 400, height: 400 },
      { name: 'kelopak', order: 2, width: 220, height: 180 },
      { name: 'tengah', order: 3, width: 48, height: 48 },
      { name: 'tali', order: 4, width: 30, height: 80 },
    ]);
    expect(plan.mass).toBe('bunga');
    expect(plan.details).toEqual(['kelopak', 'tengah']);
    const before = painted(40, 32, (x, y) => {
      const body = x >= 4 && x < 28 && y >= 4 && y < 24 && (x < 7 || x >= 25 || y < 7 || y >= 21);
      const mark = x >= 14 && x < 22 && y >= 10 && y < 18;
      return body || mark ? [0, 0, 0] : [255, 255, 255];
    });
    const clean = painted(40, 32, (x, y) => (
      x >= 4 && x < 28 && y >= 4 && y < 24 && (x < 7 || x >= 25 || y < 7 || y >= 21) ? [0, 0, 0] : [255, 255, 255]
    ));
    const spilled = painted(40, 32, (x, y) => {
      const body = x >= 4 && x < 28 && y >= 4 && y < 24 && (x < 7 || x >= 25 || y < 7 || y >= 21);
      const blob = x >= 30 && x < 38 && y >= 2 && y < 12;
      return body || blob ? [0, 0, 0] : [255, 255, 255];
    });
    const region = { x: 12, y: 8, width: 12, height: 12 };
    expect(partErasedCleanly(before, clean, region)).toBe(true);
    expect(partErasedCleanly(before, spilled, region)).toBe(false);
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

  it('draws step 1 as a dashed circle or oval inside the mass, then drops it', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-dome',
      title: 'Bunga',
      targetHash: 'abcdef1234567890',
      contours: [circle(400, 220, 150)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [planned('bunga', 1, 'dome', cover(220, 40, 360, 500))],
    });
    const drawing = built.lesson.steps.filter((step) => step.phase !== 'color');
    const guide = drawing[0]?.guidePaths[0];
    expect(drawing[0]?.instruction).toMatch(/lingkaran besar untuk bunga|oval besar untuk bunga/);
    expect(drawing[0]?.instruction).not.toMatch(/kubah/);
    expect(guide?.role).toBe('construction');
    expect(guide?.d).toMatch(/0 1 1/);
    expect(guide?.d).not.toMatch(/0 0 1/);
    const box = cover(220, 40, 360, 500);
    const arc = /A ([0-9.]+) ([0-9.]+)/.exec(guide?.d ?? '');
    const move = /M ([0-9.]+) ([0-9.]+)/.exec(guide?.d ?? '');
    const rx = Number(arc?.[1]);
    const ry = Number(arc?.[2]);
    const left = Number(move?.[1]);
    const cy = Number(move?.[2]);
    expect(rx).toBeCloseTo(box.width / 2 * 0.9, 0);
    expect(ry).toBeCloseTo(box.height / 2 * 0.9, 0);
    expect(left + rx).toBeCloseTo(box.x + box.width / 2, 0);
    expect(cy).toBeCloseTo(box.y + box.height / 2, 0);
    expect(built.lesson.targetPreview.paths.some((path) => path.role === 'construction' || path.d === guide?.d)).toBe(false);
    expect(drawing[1]?.instruction).toBe('Gambar garis luar bunga.');
    const first = renderCumulativeStep(built.lesson, 1, 140);
    const finished = renderCumulativeStep(built.lesson, drawing.length, 140);
    const grey = (red: number, green: number, blue: number) => red > 150 && red < 200 && Math.abs(red - green) < 12 && Math.abs(green - blue) < 12;
    expect(countTone(first, grey)).toBeGreaterThan(4);
    expect(countTone(finished, grey)).toBe(0);
    expect(built.reviewReason ?? '').not.toContain('Bentuk bantu ikut gambar akhir');
  });

  it('splits the cup from the saucer and does not draw the beans', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-saucer',
      title: 'Cangkir',
      targetHash: 'abcdef1234567890',
      contours: [tallCup(), square(40, 500, 70), square(860, 520, 60)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#ffffff'],
      parts: [
        planned('cangkir', 1, 'dome', cover(180, 40, 480, 280)),
        planned('piring', 2, 'oval', cover(80, 360, 680, 180)),
        planned('biji kopi', 3, '', cover(120, 420, 160, 160), { count: 2 }),
        planned('biji kopi', 3, '', cover(560, 440, 140, 140), { count: 2 }),
      ],
    });
    const text = built.lesson.steps.map((step) => step.instruction).join(' ');
    expect(text).toContain('Gambar garis luar cangkir.');
    expect(text).toContain('Gambar garis luar piring.');
    expect(text).not.toMatch(/biji|kopi/);
    expect(built.lesson.steps[0]?.guidePaths[0]?.role).toBe('construction');
    expect(built.lesson.steps[0]?.guidePaths[0]?.d).toMatch(/0 1 1/);
  });

  it('names eyes and a nose by their own part, and keeps a white cup white', () => {
    const cat = buildTutorialLesson({
      id: 'tutorial-mouth',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [circle(400, 280, 180)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      flatRegions: [
        { name: 'abu-abu', hex: '#888888', points: square(220, 120, 360).points, pixels: 8000, cx: 400, cy: 300 },
        { name: 'hijau', hex: '#3a8f4a', points: square(330, 250, 36).points, pixels: 180, cx: 348, cy: 268 },
        { name: 'hitam', hex: '#222222', points: square(450, 250, 32).points, pixels: 160, cx: 466, cy: 266 },
        { name: 'merah muda', hex: '#e0909a', points: square(390, 320, 28).points, pixels: 140, cx: 404, cy: 334 },
      ],
      parts: [
        planned('kepala', 1, 'circle', cover(220, 100, 360, 360)),
        planned('mata', 2, 'circle', cover(318, 238, 60, 56)),
        planned('mata', 2, 'circle', cover(438, 238, 56, 52)),
        planned('hidung', 3, 'circle', cover(384, 308, 40, 36)),
        planned('mulut', 4, '', cover(360, 300, 90, 80)),
      ],
    });
    const colours = cat.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction);
    expect(colours.some((text) => text.includes('mata') && text.includes('hijau'))).toBe(true);
    expect(colours.some((text) => text.includes('hidung'))).toBe(true);
    expect(colours.join(' ')).not.toMatch(/mulut/);

    const cup = buildTutorialLesson({
      id: 'tutorial-white-cup',
      title: 'Cangkir',
      targetHash: 'abcdef1234567890',
      contours: [square(180, 80, 520)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#ffffff'],
      flatRegions: [
        { name: 'cokelat', hex: '#8a5a32', points: square(370, 190, 100).points, pixels: 4000, cx: 420, cy: 240 },
      ],
      parts: [
        planned('cangkir', 1, 'oval', cover(180, 80, 520, 420)),
        planned('kopi', 2, '', cover(330, 160, 180, 160)),
      ],
    });
    const cupColours = cup.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction);
    expect(cupColours.some((text) => text.includes('kopi') && text.includes('cokelat'))).toBe(true);
    expect(cupColours.some((text) => text.includes('cangkir'))).toBe(false);
    expect(cupColours.join(' ')).not.toMatch(/putih/);
  });

  it('does not let a leash name the collar or the tongue', () => {
    const built = buildTutorialLesson({
      id: 'tutorial-leash',
      title: 'Anjing',
      targetHash: 'abcdef1234567890',
      contours: [square(120, 80, 700), square(200, 500, 140), square(360, 300, 40)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#111111'],
      flatRegions: [
        { name: 'hitam', hex: '#1a1a1a', points: square(120, 80, 700).points, pixels: 5000, cx: 470, cy: 400 },
        { name: 'merah', hex: '#c62828', points: square(200, 500, 140).points, pixels: 900, cx: 270, cy: 570 },
        { name: 'merah muda', hex: '#e0909a', points: square(360, 300, 40).points, pixels: 200, cx: 380, cy: 320 },
      ],
      parts: [
        planned('badan', 1, 'oval', cover(120, 80, 700, 560)),
        planned('kalung', 2, '', cover(190, 480, 170, 160)),
        planned('lidah', 3, '', cover(348, 288, 64, 60)),
        planned('tali', 4, '', cover(180, 470, 200, 180)),
        planned('tali', 4, '', cover(340, 280, 80, 90)),
      ],
    });
    const colours = built.lesson.steps.filter((step) => step.phase === 'color').map((step) => step.instruction).join(' ');
    expect(colours).toMatch(/kalung/);
    expect(colours).toMatch(/lidah/);
    expect(colours).not.toMatch(/tali/);
    expect(built.lesson.steps.map((step) => step.instruction).join(' ')).not.toMatch(/tali/);
  });

  it('keeps whiskers and legs that touch the outline', () => {
    const head = circle(400, 280, 180);
    const built = buildTutorialLesson({
      id: 'tutorial-whiskers',
      title: 'Kucing',
      targetHash: 'abcdef1234567890',
      contours: [
        head,
        { closed: false, points: [{ x: 230, y: 300 }, { x: 300, y: 312 }, { x: 390, y: 300 }] },
        { closed: false, points: [{ x: 420, y: 304 }, { x: 520, y: 316 }, { x: 590, y: 300 }] },
      ],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [
        planned('kepala', 1, 'circle', cover(220, 100, 360, 360)),
        planned('kumis', 2, 'line', cover(200, 270, 420, 70)),
      ],
    });
    const whiskers = built.lesson.steps.find((step) => step.instruction.includes('kumis'));
    expect(whiskers?.instruction).toBe('Gambar kumis.');
    expect(whiskers?.guidePaths.length).toBeGreaterThanOrEqual(1);
    expect(whiskers?.guidePaths.every((path) => path.role === 'final-outline')).toBe(true);

    const dog = buildTutorialLesson({
      id: 'tutorial-legs',
      title: 'Anjing',
      targetHash: 'abcdef1234567890',
      contours: [
        square(160, 80, 520),
        { closed: false, points: [{ x: 200, y: 520 }, { x: 230, y: 640 }, { x: 270, y: 660 }] },
        { closed: false, points: [{ x: 520, y: 520 }, { x: 560, y: 640 }, { x: 600, y: 650 }] },
      ],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#888888'],
      parts: [
        planned('badan', 1, 'oval', cover(160, 80, 520, 560)),
        planned('kaki', 2, 'line', cover(180, 480, 460, 200), { count: 2 }),
      ],
    });
    const legs = dog.lesson.steps.find((step) => step.instruction.includes('kaki'));
    expect(legs?.instruction).toMatch(/kaki/);
    expect(legs?.guidePaths.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps petal strokes that touch the outline, and a separate centre', async () => {
    const bloom = circle(400, 300, 180);
    const touching = [0, 1, 2, 3, 4].map((index) => petalArc(400, 300, 180, index));
    const built = buildTutorialLesson({
      id: 'tutorial-flower-line',
      title: 'Bunga',
      targetHash: 'abcdef1234567890',
      contours: [bloom, ...touching, circle(400, 300, 26)],
      sourceWidth: 1000,
      sourceHeight: 750,
      photo,
      palette: ['#cc3333'],
      parts: [
        planned('bunga', 1, 'circle', cover(220, 120, 360, 360)),
        planned('kelopak', 2, 'oval', cover(220, 120, 360, 360), { count: 5, dependsOn: 'bunga' }),
        planned('tengah', 3, 'circle', cover(372, 272, 56, 56), { dependsOn: 'bunga' }),
      ],
    });
    const petals = built.lesson.steps.find((step) => step.instruction === 'Gambar kelopak.');
    const centre = built.lesson.steps.find((step) => /\btengah\b/.test(step.instruction));
    expect(petals?.guidePaths).toHaveLength(5);
    expect(petals?.guidePaths.every((path) => path.role === 'final-outline')).toBe(true);
    expect(centre?.guidePaths.length).toBeGreaterThanOrEqual(1);
    expect(centre?.id).not.toBe(petals?.id);
    if (!existsSync(FLOWER_LINE)) return;
    const image = await decodePng(await readFile(FLOWER_LINE));
    const contours = traceInk(image);
    const pieces = lessonPieces(contours, image.width, image.height);
    const head = pieces.reduce((best, piece) => (piece.width * piece.height > best.width * best.height ? piece : best));
    const traced = buildTutorialLesson({
      id: 'tutorial-v12-flower',
      title: 'Bunga',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: image.width,
      sourceHeight: image.height,
      photo,
      palette: ['#cc3333'],
      parts: [
        planned('bunga', 1, 'circle', head),
        planned('kelopak', 2, 'oval', head, { count: 5, dependsOn: 'bunga' }),
        planned('tengah', 3, 'circle', {
          x: head.x + head.width * 0.38,
          y: head.y + head.height * 0.38,
          width: Math.max(16, head.width * 0.24),
          height: Math.max(16, head.height * 0.24),
        }, { dependsOn: 'bunga' }),
      ],
    });
    expect(traced.lesson.steps.find((step) => step.instruction === 'Gambar kelopak.')?.guidePaths.length).toBeGreaterThanOrEqual(2);
    expect(traced.lesson.steps.some((step) => /\btengah\b/.test(step.instruction))).toBe(true);
  });

  it('registers a shifted stage to the final drawing and ignores ink outside the part', () => {
    const final = painted(40, 28, (x, y) => {
      const body = x >= 4 && x < 18 && y >= 4 && y < 18;
      const mark = x >= 28 && x < 36 && y >= 6 && y < 16;
      return body || mark ? [0, 0, 0] : [255, 255, 255];
    });
    const shifted = painted(40, 28, (x, y) => (x >= 8 && x < 22 && y >= 7 && y < 21 ? [0, 0, 0] : [255, 255, 255]));
    const registered = registerToFinal(final, shifted);
    const added = inkAdded(registered, final, { x: 26, y: 4, width: 12, height: 14 });
    expect(added).not.toBeNull();
    expect(countTone(added!, (red, _green, _blue, x) => red < 20 && x < 24)).toBe(0);
    expect(countTone(added!, (red, _green, _blue, x) => red < 20 && x >= 26)).toBeGreaterThan(8);
  });
});

function petalArc(cx: number, cy: number, radius: number, index: number): Contour {
  const start = -Math.PI / 2 + (index * 2 * Math.PI) / 5 + 0.15;
  const points: Point[] = [];
  for (let step = 0; step <= 6; step += 1) {
    const angle = start + (step / 6) * 0.7;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return { closed: false, points };
}

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

function tallCup(): Contour {
  const points: Point[] = [];
  for (let y = 40; y <= 640; y += 20) points.push({ x: 200, y });
  for (let x = 200; x <= 760; x += 20) points.push({ x, y: 640 });
  for (let y = 640; y >= 40; y -= 20) points.push({ x: 760, y });
  for (let x = 760; x >= 200; x -= 20) points.push({ x, y: 40 });
  return { closed: true, points };
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
