import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../lesson-data';
import type { RgbaImage } from '../photo/png';
import { buildDoodleLesson, photoSampler } from './steps';
import { fitPhoto } from '../trace/placement';

describe('doodle step builder', () => {
  it('starts with one simple shape, then the parts on the subject, ignoring a speck of background', () => {
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
    expect(lines[0]?.id).toBe('shape');
    expect(lines[0]?.guidePaths).toHaveLength(1);
    expect(lines[0]?.guidePaths[0]?.d).toMatch(/Z/);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length).toBeLessThanOrEqual(6);

    // Every guide the child draws sits on the subject, so the corner square
    // never became a part of its own.
    const head = pointsOf(lines[0]?.guidePaths[0]?.d ?? '');
    const headLeft = Math.min(...head.map((point) => point.x));
    const headTop = Math.min(...head.map((point) => point.y));
    for (const step of lines.slice(1)) {
      for (const path of step.guidePaths) {
        for (const point of pointsOf(path.d)) {
          expect(point.x).toBeGreaterThanOrEqual(headLeft - 1);
          expect(point.y).toBeGreaterThanOrEqual(headTop - 1);
        }
      }
    }

    expect(lesson.steps.at(-1)?.phase).toBe('color');
    const colours = lesson.steps.filter((step) => step.phase === 'color').map((step) => step.toolPreset.color);
    expect(colours.length).toBeGreaterThan(0);
    expect(colours.length).toBeLessThanOrEqual(8);
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
    const shape = lesson.steps[0]?.guidePaths[0]?.d ?? '';
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
    expect(lines.length).toBeGreaterThanOrEqual(5);
    const paths = lines.slice(1).reduce((sum, step) => sum + step.guidePaths.length, 0);
    expect(paths).toBeGreaterThanOrEqual(6);
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
    strokeLine(doodle, 78, 166, 78, 230);
    strokeLine(doodle, 108, 166, 112, 232);
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
    const outlines = lines.filter((step) => step.guidePaths.some((path) => path.d.includes('Z')));
    expect(outlines.length).toBeGreaterThanOrEqual(2);
    const centres = outlines.map((step) => {
      const points = pointsOf(step.guidePaths[0]?.d ?? '');
      const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      return x;
    });
    expect(Math.max(...centres) - Math.min(...centres)).toBeGreaterThan(180);

    const colours = lesson.steps.filter((step) => step.phase === 'color');
    expect(colours.length).toBeGreaterThanOrEqual(4);
    expect(lesson.colorRegions.length).toBeGreaterThanOrEqual(4);
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

function pointsOf(d: string): Array<{ x: number; y: number }> {
  return [...d.matchAll(/[ML] (-?\d+) (-?\d+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
}

function rectOutline(image: RgbaImage, x: number, y: number, width: number, height: number): void {
  fillRect(image, x, y, width, 5);
  fillRect(image, x, y + height - 5, width, 5);
  fillRect(image, x, y, 5, height);
  fillRect(image, x + width - 5, y, 5, height);
}
