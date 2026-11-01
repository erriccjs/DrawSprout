import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../lesson-data';
import type { RgbaImage } from '../photo/png';
import { buildDoodleLesson, photoSampler } from './steps';

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
    expect(colours.length).toBeLessThanOrEqual(5);
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

  it('keeps a pale subject\'s own colour instead of letting one bright patch stand for it', () => {
    // A white plush under a brown head, photographed in a bright shop: the
    // body matches the room's corners, and dropping it left brown for the
    // whole animal.
    const doodle = blank(240, 240);
    ring(doodle, 120, 120, 90, 6);
    const photo = blank(240, 240);
    fillColour(photo, 0, 0, 240, 240, [238, 236, 230]);
    fillColour(photo, 40, 40, 160, 80, [150, 92, 44]);
    fillColour(photo, 40, 120, 160, 80, [245, 243, 240]);

    const lesson = buildDoodleLesson(doodle, photo);
    const colours = lesson.steps
      .filter((step) => step.phase === 'color')
      .map((step) => step.toolPreset.color);
    expect(colours.length).toBeGreaterThanOrEqual(2);
    const luma = (hex: string) => Number.parseInt(hex.slice(1, 3), 16) * 0.3
      + Number.parseInt(hex.slice(3, 5), 16) * 0.59
      + Number.parseInt(hex.slice(5, 7), 16) * 0.11;
    expect(colours.some((colour) => luma(colour) > 200)).toBe(true);
    expect(colours.some((colour) => luma(colour) < 160)).toBe(true);
  });

  it('gives each colour its own patch once there is more than one', () => {
    const doodle = blank(240, 240);
    ring(doodle, 120, 120, 90, 6);
    const photo = blank(240, 240);
    fillColour(photo, 0, 0, 240, 240, [238, 236, 230]);
    fillColour(photo, 40, 40, 160, 80, [40, 70, 210]);
    fillColour(photo, 40, 120, 160, 80, [210, 60, 50]);

    const lesson = buildDoodleLesson(doodle, photo);
    const outline = lesson.steps[0]?.guidePaths[0]?.d ?? '';
    expect(lesson.colorRegions.length).toBeGreaterThanOrEqual(2);
    // No colour takes the whole body when the subject is not one colour.
    for (const region of lesson.colorRegions) {
      expect(region.d).not.toBe(outline);
      expect(region.d).toMatch(/A /);
    }
    // The patches sit apart, each over its own half.
    const centres = lesson.colorRegions.map((region) => {
      const first = /M (-?\d+) (-?\d+)/.exec(region.d);
      return { x: Number(first?.[1] ?? 0), y: Number(first?.[2] ?? 0) };
    });
    expect(Math.abs((centres[0]?.y ?? 0) - (centres[1]?.y ?? 0))).toBeGreaterThan(40);
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
