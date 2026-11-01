import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../lesson-data';
import type { RgbaImage } from '../photo/png';
import { buildDoodleLesson } from './steps';

describe('doodle step builder', () => {
  it('starts with one simple shape, then the separate parts, and ignores the grassy background', () => {
    const doodle = blank(80, 80);
    ring(doodle, 40, 40, 24, 2);
    fillRect(doodle, 36, 36, 6, 6);
    fillRect(doodle, 4, 4, 16, 16);
    const photo = blank(80, 80);
    fillColour(photo, 0, 0, 80, 80, [40, 140, 50]);
    fillColour(photo, 20, 20, 40, 40, [220, 40, 40]);

    const lesson = buildDoodleLesson(doodle, photo);
    expect(() => assertValidLessons([lesson])).not.toThrow();
    const lines = lesson.steps.filter((step) => step.phase !== 'color');
    expect(lines[0]?.id).toBe('shape');
    expect(lines[0]?.guidePaths).toHaveLength(1);
    expect(lines[0]?.guidePaths[0]?.d).toMatch(/Z/);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length).toBeLessThanOrEqual(6);
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
