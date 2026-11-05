import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../lesson-data';
import type { RgbaImage } from '../photo/png';
import { localizeSentence } from '../i18n/generated';
import { stepPreview } from '../lesson-data/step-preview';
import { coverByColour } from '../photo/flat-colour';
import { buildDoodleLesson, doodleInteriorCoverage, photoSampler } from './steps';
import { fitPhoto } from '../trace/placement';

describe('doodle step builder', () => {
  it('draws the head, keeps the features on it, and ignores a speck of background', () => {
    // A face: one head, two eyes, a nose -- plus a square of background in the
    // corner that survived the ink mask and belongs to nothing.
    const doodle = blank(240, 240);
    ring(doodle, 120, 120, 80, 6);
    ring(doodle, 92, 100, 14, 4);
    ring(doodle, 148, 100, 14, 4);
    ring(doodle, 120, 146, 18, 5);
    fillRect(doodle, 6, 6, 22, 22);
    const photo = blank(240, 240);
    fillColour(photo, 0, 0, 240, 240, [40, 140, 50]);
    fillColour(photo, 60, 60, 120, 120, [220, 40, 40]);

    const lesson = buildDoodleLesson(doodle, photo);
    expect(() => assertValidLessons([lesson])).not.toThrow();
    const lines = lesson.steps.filter((step) => step.phase !== 'color');
    expect(lines[0]?.instruction).toBe('Gambar kepalanya.');
    expect(lines[0]?.hint).toBe('Gambar kepalanya.');
    expect(localizeSentence(lines[0]?.hint ?? '')).toBe('Draw the head.');
    // The eyes and the nose are part of the head, not steps of their own.
    expect(lines[0]?.guidePaths.length).toBeGreaterThanOrEqual(4);
    expect(lines[0]?.guidePaths.every((path) => path.d.endsWith('Z'))).toBe(true);

    // Every guide the child draws sits on the subject, so the corner square
    // never became a part of its own.
    for (const step of lines) {
      for (const path of step.guidePaths) {
        for (const point of pointsOf(path.d)) {
          expect(point.x).toBeGreaterThan(100);
          expect(point.y).toBeGreaterThan(100);
        }
      }
    }

    expect(lesson.steps.at(-1)?.phase).toBe('color');
    const colours = lesson.steps.filter((step) => step.phase === 'color').map((step) => step.toolPreset.color);
    expect(colours.length).toBeGreaterThan(0);
    expect(colours.length).toBeLessThanOrEqual(11);
    expect(colours[0]).toMatch(/^#[0-9a-f]{6}$/);
    const red = colours.some((colour) => {
      const value = Number.parseInt(colour.slice(1, 3), 16);
      const green = Number.parseInt(colour.slice(3, 5), 16);
      return value > green + 40;
    });
    expect(red).toBe(true);
  });

  it('follows the gap between two legs instead of drawing the convex shadow', () => {
    // A "U": a body with a notch between two legs. The convex hull of this is
    // a plain rectangle -- the shadow the child was asked to draw before.
    const doodle = blank(120, 120);
    strokeLine(doodle, 20, 15, 20, 100);
    strokeLine(doodle, 20, 100, 45, 100);
    strokeLine(doodle, 45, 100, 45, 55);
    strokeLine(doodle, 45, 55, 75, 55);
    strokeLine(doodle, 75, 55, 75, 100);
    strokeLine(doodle, 75, 100, 100, 100);
    strokeLine(doodle, 100, 100, 100, 15);
    strokeLine(doodle, 100, 15, 20, 15);
    const photo = blank(120, 120);
    fillColour(photo, 0, 0, 120, 120, [200, 60, 60]);

    const lesson = buildDoodleLesson(doodle, photo);
    const shape = lesson.steps
      .filter((step) => step.phase !== 'color')
      .flatMap((step) => step.guidePaths.map((path) => path.d))
      .join(' ');
    const points = [...shape.matchAll(/[ML] (\d+) (\d+)/g)]
      .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
    expect(points.length).toBeGreaterThan(5);
    const bottom = Math.max(...points.map((point) => point.y));
    const middle = points.filter((point) => point.x > 300 && point.x < 700);
    // The notch reaches well above the feet, so the outline is not a box.
    expect(Math.min(...middle.map((point) => point.y))).toBeLessThan(bottom * 0.75);
  });

  it('does not ask the child to fill the whole body with a near-black', () => {
    const doodle = blank(80, 80);
    ring(doodle, 40, 40, 24, 2);
    const photo = blank(80, 80);
    fillColour(photo, 0, 0, 80, 80, [28, 28, 32]);

    const lesson = buildDoodleLesson(doodle, photo);
    const outline = lesson.steps[0]?.guidePaths[0]?.d ?? '';
    for (const region of lesson.colorRegions) {
      const luma = Number.parseInt(region.suggestedColor.slice(1, 3), 16) * 0.3
        + Number.parseInt(region.suggestedColor.slice(3, 5), 16) * 0.59
        + Number.parseInt(region.suggestedColor.slice(5, 7), 16) * 0.11;
      if (luma < 80) expect(region.d).not.toBe(outline);
    }
  });

  it('maps a doodle coordinate into the photo\'s shared centre, not its edge', () => {
    // A square doodle against a photo twice as wide. The left and right
    // quarters of the photo are outside the doodle's frame entirely, so the
    // doodle's own left edge must land a quarter of the way into the photo.
    const photo = blank(160, 80);
    fillColour(photo, 0, 0, 40, 80, [40, 70, 210]);
    fillColour(photo, 40, 0, 80, 80, [210, 50, 45]);
    fillColour(photo, 120, 0, 40, 80, [30, 160, 60]);

    const sample = photoSampler(80, 80, photo);
    expect(sample(0, 40)).toMatchObject({ r: 210, g: 50, b: 45 });
    expect(sample(40, 40)).toMatchObject({ r: 210, g: 50, b: 45 });
    expect(sample(79, 40)).toMatchObject({ r: 210, g: 50, b: 45 });
  });

  it('maps a doodle coordinate into the photo\'s shared centre when the photo is taller', () => {
    const photo = blank(80, 160);
    fillColour(photo, 0, 0, 80, 40, [40, 70, 210]);
    fillColour(photo, 0, 40, 80, 80, [210, 50, 45]);
    fillColour(photo, 0, 120, 80, 40, [30, 160, 60]);

    const sample = photoSampler(80, 80, photo);
    expect(sample(40, 0)).toMatchObject({ r: 210, g: 50, b: 45 });
    expect(sample(40, 79)).toMatchObject({ r: 210, g: 50, b: 45 });
  });

  it('leaves the mapping alone when both frames already agree', () => {
    const photo = blank(80, 80);
    fillColour(photo, 0, 0, 40, 80, [40, 70, 210]);
    fillColour(photo, 40, 0, 40, 80, [210, 50, 45]);

    const sample = photoSampler(80, 80, photo);
    expect(sample(4, 40)).toMatchObject({ r: 40, g: 70, b: 210 });
    expect(sample(76, 40)).toMatchObject({ r: 210, g: 50, b: 45 });
  });

  it('reads the subject colour from the middle when the photo frame is wider', () => {
    // A square doodle against a photo that is twice as wide: the sides of the
    // photo are not in the doodle at all. Sampling at raw coordinates lands on
    // them and the subject comes out blue instead of red.
    const doodle = blank(80, 80);
    ring(doodle, 40, 40, 24, 2);
    const photo = blank(160, 80);
    fillColour(photo, 0, 0, 160, 80, [40, 70, 210]);
    fillColour(photo, 40, 0, 80, 80, [210, 50, 45]);

    const lesson = buildDoodleLesson(doodle, photo);
    const colours = lesson.steps
      .filter((step) => step.phase === 'color')
      .map((step) => step.toolPreset.color);
    expect(colours.length).toBeGreaterThan(0);
    const reddest = colours.some((colour) => {
      const red = Number.parseInt(colour.slice(1, 3), 16);
      const blue = Number.parseInt(colour.slice(5, 7), 16);
      return red > blue + 40;
    });
    expect(reddest).toBe(true);
  });

  it('keeps a pale subject\'s own colour beside a darker one', () => {
    // A white plush under a brown head, photographed in a bright shop. The
    // drawing separates the two, so each keeps its own colour: before, pale
    // areas were dropped as paper and the brown stood for the whole animal.
    const doodle = blank(240, 240);
    ring(doodle, 120, 120, 90, 6);
    fillRect(doodle, 32, 118, 176, 6);
    const photo = blank(240, 240);
    fillColour(photo, 0, 0, 240, 240, [238, 236, 230]);
    fillColour(photo, 40, 40, 160, 76, [150, 92, 44]);
    fillColour(photo, 40, 126, 160, 74, [245, 243, 240]);

    const lesson = buildDoodleLesson(doodle, photo);
    expect(lesson.colorRegions.length).toBeGreaterThanOrEqual(2);
    const luma = (hex: string) => Number.parseInt(hex.slice(1, 3), 16) * 0.3
      + Number.parseInt(hex.slice(3, 5), 16) * 0.59
      + Number.parseInt(hex.slice(5, 7), 16) * 0.11;
    const read = lesson.colorRegions.map((region) => ({
      hex: region.suggestedColor,
      top: Math.min(...pointsOf(region.d).map((point) => point.y)),
    })).sort((left, right) => left.top - right.top);
    expect(luma(read[0]?.hex ?? '')).toBeLessThan(160);
    expect(luma(read.at(-1)?.hex ?? '')).toBeGreaterThan(200);
    expect(read.at(-1)?.hex).not.toBe('#ffffff');
  });

  it('fills each enclosed area with the colour the photo has inside it', () => {
    // Two boxes, one above the other. The photo is blue in the top box and
    // red in the bottom one, so each box takes its own colour and neither
    // takes an ellipse floated over the middle of the page.
    const doodle = blank(240, 240);
    rectOutline(doodle, 40, 30, 160, 84);
    rectOutline(doodle, 40, 126, 160, 84);
    const photo = blank(240, 240);
    fillColour(photo, 0, 0, 240, 240, [238, 236, 230]);
    fillColour(photo, 44, 34, 152, 76, [40, 70, 210]);
    fillColour(photo, 44, 130, 152, 76, [210, 60, 50]);

    const lesson = buildDoodleLesson(doodle, photo);
    expect(lesson.colorRegions).toHaveLength(2);
    for (const region of lesson.colorRegions) {
      // A traced area, not an ellipse.
      expect(region.d).not.toMatch(/A /);
      expect(region.d).toMatch(/Z$/);
    }
    const read = lesson.colorRegions.map((region) => {
      const points = pointsOf(region.d);
      return {
        hex: region.suggestedColor,
        top: Math.min(...points.map((point) => point.y)),
      };
    }).sort((left, right) => left.top - right.top);
    const bluer = (hex: string) => Number.parseInt(hex.slice(5, 7), 16) > Number.parseInt(hex.slice(1, 3), 16);
    expect(bluer(read[0]?.hex ?? '')).toBe(true);
    expect(bluer(read[1]?.hex ?? '')).toBe(false);
  });

  it('gives every area the drawing encloses its own colour step', () => {
    // Eight closed shapes, two of them small, over a photo that puts a
    // different colour behind each. Nothing here is capped away and nothing
    // is dismissed for being small: an eye is worth a step.
    const doodle = blank(400, 400);
    ring(doodle, 200, 200, 170, 6);
    const spots: Array<[number, number, number, [number, number, number]]> = [
      [130, 120, 26, [40, 70, 210]],
      [270, 120, 26, [40, 70, 210]],
      [200, 190, 24, [30, 30, 32]],
      [200, 260, 30, [210, 60, 50]],
      [100, 250, 28, [60, 150, 70]],
      [300, 250, 28, [230, 170, 40]],
      [152, 318, 12, [150, 92, 44]],
      [248, 318, 12, [120, 60, 150]],
    ];
    const photo = blank(400, 400);
    fillColour(photo, 0, 0, 400, 400, [238, 236, 230]);
    fillColour(photo, 40, 40, 320, 320, [200, 150, 120]);
    for (const [cx, cy, radius, colour] of spots) {
      ring(doodle, cx, cy, radius, 4);
      fillColour(photo, cx - radius, cy - radius, radius * 2, radius * 2, colour);
    }

    const lesson = buildDoodleLesson(doodle, photo);
    // Eight spots plus the face around them: more than the old cap of six,
    // and the two small spots are above the old minimum area too.
    expect(lesson.colorRegions.length).toBeGreaterThanOrEqual(8);
    for (const region of lesson.colorRegions) expect(region.d).not.toMatch(/A /);
    expect(new Set(lesson.colorRegions.map((region) => region.suggestedColor)).size)
      .toBeGreaterThanOrEqual(5);
    // The small spots are there: some region is much smaller than the face.
    const areas = lesson.colorRegions.map((region) => {
      const points = pointsOf(region.d);
      const w = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
      const h = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
      return w * h;
    });
    expect(Math.min(...areas)).toBeLessThan(Math.max(...areas) * 0.1);
  });

  it('still gives a white subject something to colour', () => {
    // A white plush in a bright shop is most of the picture. Treating white
    // as unpainted paper left the child three things to colour on a photo
    // that was mostly subject.
    const doodle = blank(320, 320);
    ring(doodle, 160, 160, 130, 6);
    ring(doodle, 110, 120, 24, 4);
    ring(doodle, 210, 120, 24, 4);
    ring(doodle, 160, 190, 26, 5);
    const photo = blank(320, 320);
    fillColour(photo, 0, 0, 320, 320, [246, 245, 242]);

    const lesson = buildDoodleLesson(doodle, photo);
    expect(lesson.colorRegions.length).toBeGreaterThanOrEqual(3);
    for (const region of lesson.colorRegions) {
      // Visible once it is down: pure white on white paper shows nothing.
      expect(region.suggestedColor).not.toBe('#ffffff');
      const luma = Number.parseInt(region.suggestedColor.slice(1, 3), 16) * 0.3
        + Number.parseInt(region.suggestedColor.slice(3, 5), 16) * 0.59
        + Number.parseInt(region.suggestedColor.slice(5, 7), 16) * 0.11;
      // Still reads as white, not as a colour invented for it.
      expect(luma).toBeGreaterThan(200);
      expect(luma).toBeLessThan(250);
    }
  });

  it('paints one colour once, however many places it covers', () => {
    // Three separate shapes that are all the same colour in the photo. A
    // child decides to paint that colour once, not three times.
    const doodle = blank(320, 320);
    ring(doodle, 160, 160, 140, 6);
    ring(doodle, 100, 110, 30, 5);
    ring(doodle, 220, 110, 30, 5);
    ring(doodle, 160, 230, 34, 5);
    const photo = blank(320, 320);
    fillColour(photo, 0, 0, 320, 320, [246, 245, 242]);
    for (const [cx, cy] of [[100, 110], [220, 110], [160, 230]]) {
      fillColour(photo, (cx ?? 0) - 30, (cy ?? 0) - 30, 60, 60, [40, 70, 210]);
    }

    const lesson = buildDoodleLesson(doodle, photo);
    const colourSteps = lesson.steps.filter((step) => step.phase === 'color');
    const blue = colourSteps.filter((step) => {
      const hex = step.toolPreset.color;
      return Number.parseInt(hex.slice(5, 7), 16) > Number.parseInt(hex.slice(1, 3), 16) + 40;
    });
    // One step for the blue, holding all three shapes.
    expect(blue).toHaveLength(1);
    expect(blue[0]?.colorRegionIds.length).toBeGreaterThanOrEqual(3);

    // Every step's colour appears in exactly one step.
    const hexes = colourSteps.map((step) => step.toolPreset.color);
    expect(new Set(hexes).size).toBe(hexes.length);

    // Each id still names a region that exists, and they are distinct paths.
    const byId = new Map(lesson.colorRegions.map((region) => [region.id, region]));
    const paths = new Set<string>();
    for (const id of blue[0]?.colorRegionIds ?? []) {
      const region = byId.get(id);
      expect(region).toBeDefined();
      expect(region?.suggestedColor).toBe(blue[0]?.toolPreset.color);
      paths.add(region?.d ?? '');
    }
    expect(paths.size).toBe(blue[0]?.colorRegionIds.length);
  });

  it('earns more steps from a busier drawing', () => {
    // A face with brows, eyes, nose, mouth and two ears. The owner asked for
    // detail: a drawing with this much in it should not collapse into two
    // steps the way the skeleton walk collapsed it.
    const doodle = blank(320, 320);
    ring(doodle, 160, 160, 120, 6);
    ring(doodle, 118, 128, 16, 4);
    ring(doodle, 202, 128, 16, 4);
    ring(doodle, 160, 176, 20, 5);
    ring(doodle, 60, 150, 26, 5);
    ring(doodle, 260, 150, 26, 5);
    ring(doodle, 160, 232, 34, 5);
    const photo = blank(320, 320);
    fillColour(photo, 0, 0, 320, 320, [210, 60, 50]);

    const lesson = buildDoodleLesson(doodle, photo);
    const lines = lesson.steps.filter((step) => step.phase !== 'color');
    // Eyes, nose, mouth and ears belong to the head, and none of them is dropped.
    const paths = lines.reduce((sum, step) => sum + step.guidePaths.length, 0);
    expect(paths).toBeGreaterThanOrEqual(5);
    expect(lines[0]?.instruction).toBe('Gambar kepalanya.');
  });

  it('places the guides where the trace layer places the drawing', () => {
    // The ring sits in the middle of the page with a wide margin round it.
    // The guide must keep that margin: the child traces over the picture, and
    // fitting the ink's box to the paper instead blew the outline up by the
    // drawing's own margin.
    const doodle = blank(240, 240);
    ring(doodle, 120, 120, 60, 6);
    const photo = blank(240, 240);
    fillColour(photo, 0, 0, 240, 240, [210, 60, 50]);

    const lesson = buildDoodleLesson(doodle, photo);
    const { width, height } = lesson.coordinateSpace;
    const place = fitPhoto(width, height, 240, 240);
    const scale = place.width / 240;
    const points = pointsOf(lesson.steps[0]?.guidePaths[0]?.d ?? '');
    const box = {
      left: Math.min(...points.map((point) => point.x)),
      right: Math.max(...points.map((point) => point.x)),
      top: Math.min(...points.map((point) => point.y)),
      bottom: Math.max(...points.map((point) => point.y)),
    };
    // The ring spans roughly 54..186 of the drawing once its stroke is traced.
    expect(box.left).toBeCloseTo(place.x + 57 * scale, -1);
    expect(box.right).toBeCloseTo(place.x + 183 * scale, -1);
    expect(box.top).toBeCloseTo(place.y + 57 * scale, -1);
    expect(box.bottom).toBeCloseTo(place.y + 183 * scale, -1);
    // And it is nowhere near filling the paper, as the old mapping did.
    expect(box.right - box.left).toBeLessThan(width * 0.55);
  });

  it('colours a person and a separate animal instead of one box and two patches', () => {
    const doodle = blank(360, 280);
    const photo = blank(360, 280);
    fillColour(photo, 0, 0, 360, 280, [186, 214, 168]);
    ring(doodle, 92, 58, 26, 3);
    rectOutline(doodle, 68, 88, 48, 78);
    strokeLine(doodle, 74, 166, 70, 236);
    strokeLine(doodle, 86, 166, 88, 236);
    strokeLine(doodle, 104, 166, 104, 236);
    strokeLine(doodle, 116, 166, 120, 236);
    fillColour(photo, 66, 32, 52, 52, [232, 186, 150]);
    fillColour(photo, 68, 90, 48, 78, [50, 92, 186]);
    fillColour(photo, 74, 168, 42, 66, [36, 36, 48]);
    ring(doodle, 268, 78, 32, 3);
    rectOutline(doodle, 230, 112, 78, 64);
    strokeLine(doodle, 246, 176, 246, 236);
    strokeLine(doodle, 286, 176, 290, 238);
    ring(doodle, 256, 74, 8, 2);
    fillColour(photo, 230, 46, 76, 64, [168, 112, 64]);
    fillColour(photo, 230, 114, 78, 62, [186, 132, 78]);
    fillColour(photo, 236, 176, 60, 64, [120, 78, 48]);
    fillColour(photo, 248, 66, 16, 16, [92, 78, 120]);

    const lesson = buildDoodleLesson(doodle, photo);
    expect(() => assertValidLessons([lesson])).not.toThrow();
    const lines = lesson.steps.filter((step) => step.phase !== 'color');
    expect(lines.map((step) => step.instruction)).toEqual([
      'Gambar kepalanya.',
      'Gambar badannya.',
      'Gambar kakinya.',
      'Gambar kepalanya.',
      'Gambar badannya.',
      'Gambar kakinya.',
    ]);
    expect(lesson.steps[lines.length]?.phase).toBe('color');
    const bodyStep = stepPreview(lesson, 1);
    expect(bodyStep.strokes.some((stroke) => stroke.kind === 'new')).toBe(true);
    expect(bodyStep.strokes.some((stroke) => stroke.kind === 'earlier')).toBe(true);
    const centres = lines.map((step) => stepCentroid(step.guidePaths.map((path) => path.d)));
    let reachedTheDog = false;
    for (const centre of centres) {
      if (centre.x > 500) reachedTheDog = true;
      else expect(reachedTheDog).toBe(false);
    }
    expect(centres[0]?.x).toBeLessThan(450);
    expect(centres[3]?.x).toBeGreaterThan(550);
    expect(headLeads(lines.slice(0, 3))).toBe(true);
    expect(headLeads(lines.slice(3))).toBe(true);
    expect(Math.max(...centres.map((centre) => centre.x)) - Math.min(...centres.map((centre) => centre.x))).toBeGreaterThan(180);

    const colours = lesson.steps.filter((step) => step.phase === 'color');
    expect(colours.length).toBeGreaterThanOrEqual(3);
    expect(colours.length).toBeLessThanOrEqual(11);
    expect(new Set(colours.map((step) => step.toolPreset.color)).size).toBe(colours.length);
    expect(colours[0]?.hint).toMatch(/dengan /);
    expect(lesson.colorRegions.length).toBeGreaterThanOrEqual(4);
    expect(doodleInteriorCoverage(doodle, photo)).toBeGreaterThanOrEqual(0.95);
    // The metric is the share of interior pixels that survive as a fill.
    // A body-only colouring used to score well while the legs stayed white,
    // so the lowest fill also has to reach the feet of the outline.
    expect(colourReachesOutline(lesson)).toBe(true);
    for (const region of lesson.colorRegions) {
      expect(region.d).not.toMatch(/A /);
      const luma = Number.parseInt(region.suggestedColor.slice(1, 3), 16) * 0.3
        + Number.parseInt(region.suggestedColor.slice(3, 5), 16) * 0.59
        + Number.parseInt(region.suggestedColor.slice(5, 7), 16) * 0.11;
      expect(luma).toBeLessThan(230);
    }
    const boxes = lesson.colorRegions.map((region) => {
      const points = pointsOf(region.d);
      return {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
      };
    });
    expect(boxes.some((box) => box.right < 500)).toBe(true);
    expect(boxes.some((box) => box.left > 400)).toBe(true);
    expect(lesson.colorRegions.every((region) => !coversPoint(region.d, 16, 16))).toBe(true);
  });

  it('covers a teddy and a cat with one step per crayon', () => {
    for (const scene of [teddyPicture(), catPicture()]) {
      const lesson = buildDoodleLesson(scene.doodle, scene.photo);
      const lines = lesson.steps.filter((step) => step.phase !== 'color');
      expect(lines[0]?.instruction).toBe('Gambar kepalanya.');
      expect(localizeSentence('Gambar bagian atas.')).toBe('Draw the top part.');
      expect(headLeads(lines)).toBe(true);
      const living = ['Gambar kepalanya.', 'Gambar badannya.', 'Gambar tangannya.', 'Gambar kakinya.'];
      let previous = -1;
      for (const step of lines) {
        const index = living.indexOf(step.instruction);
        expect(index).toBeGreaterThan(previous);
        previous = index;
      }
      expect(lesson.steps[lines.length]?.phase).toBe('color');
      const colours = lesson.steps.filter((step) => step.phase === 'color');
      expect(colours.length).toBeGreaterThanOrEqual(2);
      expect(colours.length).toBeLessThanOrEqual(11);
      expect(new Set(colours.map((step) => step.toolPreset.color)).size).toBe(colours.length);
      expect(colours[0]?.hint).toMatch(/dengan /);
      expect(doodleInteriorCoverage(scene.doodle, scene.photo)).toBeGreaterThanOrEqual(0.95);
      expect(colourReachesOutline(lesson)).toBe(true);
    }
  });

  it('draws every separate object, with no cap on the number of steps', () => {
    const doodle = blank(980, 90);
    const photo = blank(980, 90);
    fillColour(photo, 0, 0, 980, 90, [210, 80, 60]);
    for (let index = 0; index < 10; index += 1) ring(doodle, 50 + index * 96, 45, 30, 4);

    const lesson = buildDoodleLesson(doodle, photo);
    const lines = lesson.steps.filter((step) => step.phase !== 'color');
    expect(lines.length).toBeGreaterThanOrEqual(10);
    const centres = lines.map((step) => stepCentroid(step.guidePaths.map((path) => path.d)).x);
    const ordered = [...centres].sort((a, b) => a - b);
    expect(centres).toEqual(ordered);
  });

  it('splits a thing into top, middle, and bottom', () => {
    // Three bars close enough to be one object, still three strokes.
    const doodle = blank(160, 120);
    const photo = blank(160, 120);
    fillColour(photo, 0, 0, 160, 120, [80, 140, 210]);
    rectOutline(doodle, 30, 20, 100, 20);
    rectOutline(doodle, 30, 43, 100, 20);
    rectOutline(doodle, 30, 66, 100, 20);

    const lesson = buildDoodleLesson(doodle, photo);
    const lines = lesson.steps.filter((step) => step.phase !== 'color');
    expect(lines.map((step) => step.instruction)).toEqual([
      'Gambar bagian atas.',
      'Gambar bagian tengah.',
      'Gambar bagian bawah.',
    ]);
    expect(localizeSentence(lines[2]?.hint ?? '')).toBe('Draw the bottom part.');
  });

  it('keeps a concave gap and a hole out of the fill', () => {
    const doodle = blank(220, 300);
    const photo = blank(220, 300);
    fillColour(photo, 0, 0, 220, 300, [210, 220, 200]);
    ring(doodle, 110, 48, 32, 3);
    strokeLine(doodle, 80, 78, 140, 78);
    strokeLine(doodle, 140, 78, 150, 160);
    strokeLine(doodle, 150, 160, 128, 160);
    strokeLine(doodle, 128, 160, 124, 250);
    strokeLine(doodle, 124, 250, 100, 250);
    strokeLine(doodle, 100, 250, 96, 170);
    strokeLine(doodle, 96, 170, 70, 170);
    strokeLine(doodle, 70, 170, 60, 250);
    strokeLine(doodle, 60, 250, 40, 250);
    strokeLine(doodle, 40, 250, 48, 160);
    strokeLine(doodle, 48, 160, 30, 120);
    strokeLine(doodle, 30, 120, 70, 100);
    strokeLine(doodle, 70, 100, 80, 78);
    ring(doodle, 110, 48, 8, 2);
    fillColour(photo, 78, 20, 64, 60, [40, 40, 48]);
    fillColour(photo, 50, 80, 100, 90, [30, 30, 36]);
    fillColour(photo, 40, 170, 90, 80, [24, 24, 28]);
    fillColour(photo, 102, 40, 16, 16, [210, 60, 50]);

    const painted = coverByColour(doodle, photo);
    // The armpit notch is open paper. A chord across it is the dark triangle.
    expect(painted.regions.some((region) => insideFill(region, 36, 145))).toBe(false);
    // The eye is a hole in the head, not part of the head fill.
    const head = painted.regions.find((region) => insideFill(region, 98, 40));
    expect(head).toBeDefined();
    expect(insideFill(head!, 110, 48)).toBe(false);
    // The torso itself is still filled.
    expect(painted.regions.some((region) => insideFill(region, 100, 120))).toBe(true);
    // The page stays white.
    expect(painted.regions.some((region) => insideFill(region, 8, 8))).toBe(false);

    const separate = blank(240, 120);
    const separatePhoto = blank(240, 120);
    fillColour(separatePhoto, 0, 0, 240, 120, [230, 230, 220]);
    ring(separate, 50, 60, 36, 3);
    ring(separate, 180, 60, 36, 3);
    fillColour(separatePhoto, 20, 30, 60, 60, [40, 40, 48]);
    fillColour(separatePhoto, 150, 30, 60, 60, [40, 40, 48]);
    const parts = coverByColour(separate, separatePhoto);
    expect(parts.regions.some((region) => insideFill(region, 115, 60))).toBe(false);
    expect(parts.regions.some((region) => insideFill(region, 50, 60))).toBe(true);
    expect(parts.regions.some((region) => insideFill(region, 180, 60))).toBe(true);
  });

  it('refuses a blank page', () => {
    expect(() => buildDoodleLesson(blank(40, 40), blank(40, 40))).toThrow(/kosong/);
  });
});

function blank(width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  data.fill(255);
  return { width, height, data };
}

function fillRect(image: RgbaImage, x: number, y: number, width: number, height: number): void {
  fillColour(image, x, y, width, height, [0, 0, 0]);
}

function fillColour(
  image: RgbaImage,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: [number, number, number],
): void {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      const offset = (row * image.width + col) * 4;
      image.data[offset] = colour[0];
      image.data[offset + 1] = colour[1];
      image.data[offset + 2] = colour[2];
      image.data[offset + 3] = 255;
    }
  }
}

function ring(image: RgbaImage, cx: number, cy: number, radius: number, thickness: number): void {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance <= radius && distance >= radius - thickness) {
        const offset = (y * image.width + x) * 4;
        image.data[offset] = 0;
        image.data[offset + 1] = 0;
        image.data[offset + 2] = 0;
        image.data[offset + 3] = 255;
      }
    }
  }
}

function strokeLine(image: RgbaImage, x1: number, y1: number, x2: number, y2: number): void {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(x1 + ((x2 - x1) * i) / steps);
    const y = Math.round(y1 + ((y2 - y1) * i) / steps);
    fillRect(image, x - 1, y - 1, 3, 3);
  }
}

function insideFill(
  region: { points: readonly { x: number; y: number }[]; holes?: readonly (readonly { x: number; y: number }[])[] },
  x: number,
  y: number,
): boolean {
  if (!ringContains(region.points, x, y)) return false;
  return !(region.holes ?? []).some((hole) => ringContains(hole, x, y));
}

function ringContains(points: readonly { x: number; y: number }[], x: number, y: number): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const start = points[previous];
    const end = points[index];
    if (!start || !end || (start.y > y) === (end.y > y) || end.y === start.y) continue;
    const at = start.x + ((y - start.y) / (end.y - start.y)) * (end.x - start.x);
    if (at > x) inside = !inside;
  }
  return inside;
}

function coversPoint(d: string, x: number, y: number): boolean {
  const points = pointsOf(d);
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const start = points[previous];
    const end = points[index];
    if (!start || !end || (start.y > y) === (end.y > y)) continue;
    const span = end.y - start.y;
    if (span === 0) continue;
    const at = start.x + ((y - start.y) / span) * (end.x - start.x);
    if (at > x) inside = !inside;
  }
  return inside;
}

function stepCentroid(paths: readonly string[]): { x: number; y: number } {
  const points = paths.flatMap((path) => pointsOf(path));
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

/** The first line step of a living subject sits in the top of that subject's box. */
function headLeads(steps: ReadonlyArray<{ guidePaths: ReadonlyArray<{ d: string }> }>): boolean {
  const points = steps.flatMap((step) => step.guidePaths.flatMap((path) => pointsOf(path.d)));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  const first = stepCentroid(steps[0]?.guidePaths.map((path) => path.d) ?? []);
  return first.y < top + (bottom - top) * 0.45;
}

function colourReachesOutline(lesson: { steps: ReadonlyArray<{ phase?: string; guidePaths: ReadonlyArray<{ d: string }> }>; colorRegions: ReadonlyArray<{ d: string }> }): boolean {
  const outlineBottom = Math.max(...lesson.steps.filter((step) => step.phase !== 'color').flatMap((step) => (
    step.guidePaths.flatMap((path) => pointsOf(path.d).map((point) => point.y))
  )));
  const colourBottom = Math.max(...lesson.colorRegions.flatMap((region) => pointsOf(region.d).map((point) => point.y)));
  return colourBottom > outlineBottom * 0.85;
}

function pointsOf(d: string): Array<{ x: number; y: number }> {
  return [...d.matchAll(/[ML] (-?\d+) (-?\d+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
}

function teddyPicture(): { doodle: RgbaImage; photo: RgbaImage } {
  const doodle = blank(240, 240);
  const photo = blank(240, 240);
  fillColour(photo, 0, 0, 240, 240, [210, 230, 210]);
  ring(doodle, 120, 78, 36, 4);
  ring(doodle, 78, 50, 16, 3);
  ring(doodle, 162, 50, 16, 3);
  ring(doodle, 120, 150, 14, 3);
  rectOutline(doodle, 78, 112, 84, 70);
  strokeLine(doodle, 90, 182, 86, 220);
  strokeLine(doodle, 102, 182, 106, 220);
  strokeLine(doodle, 140, 182, 136, 220);
  strokeLine(doodle, 152, 182, 156, 220);
  fillColour(photo, 80, 40, 80, 80, [186, 140, 90]);
  fillColour(photo, 78, 114, 84, 68, [150, 96, 52]);
  fillColour(photo, 106, 136, 28, 28, [196, 40, 56]);
  fillColour(photo, 84, 184, 76, 40, [120, 72, 40]);
  return { doodle, photo };
}

function catPicture(): { doodle: RgbaImage; photo: RgbaImage } {
  const doodle = blank(240, 200);
  const photo = blank(240, 200);
  fillColour(photo, 0, 0, 240, 200, [180, 210, 170]);
  ring(doodle, 120, 70, 40, 4);
  strokeLine(doodle, 86, 48, 70, 16);
  strokeLine(doodle, 98, 46, 86, 18);
  strokeLine(doodle, 154, 48, 170, 16);
  strokeLine(doodle, 142, 46, 154, 18);
  rectOutline(doodle, 88, 108, 64, 50);
  strokeLine(doodle, 150, 130, 210, 150);
  strokeLine(doodle, 150, 142, 208, 162);
  fillColour(photo, 80, 30, 80, 80, [210, 150, 60]);
  fillColour(photo, 64, 12, 46, 42, [210, 150, 60]);
  fillColour(photo, 136, 12, 46, 42, [210, 150, 60]);
  fillColour(photo, 108, 78, 24, 16, [40, 40, 48]);
  fillColour(photo, 88, 110, 64, 48, [190, 120, 40]);
  fillColour(photo, 148, 126, 68, 40, [200, 140, 50]);
  return { doodle, photo };
}

function rectOutline(image: RgbaImage, x: number, y: number, width: number, height: number): void {
  fillRect(image, x, y, width, 5);
  fillRect(image, x, y + height - 5, width, 5);
  fillRect(image, x, y, 5, height);
  fillRect(image, x + width - 5, y, 5, height);
}
