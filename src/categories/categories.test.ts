import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLED_LESSONS, assertValidLessons } from '../lesson-data';
import { pathBounds } from '../ui/preview-frame';
import { contactSheetHtml } from './sheet';
import { CATEGORY_CATALOGUE, CATEGORY_LESSONS, getPlayableLesson } from './library';
import { isDone } from './types';

const DONE_IDS = [
  'cat', 'dog', 'flower', 'cup', 'toy-car', 'fish',
  'house', 'tree', 'butterfly', 'bird', 'rabbit', 'turtle', 'rocket', 'apple',
  'person-standing', 'character',
  'elephant', 'lion', 'giraffe', 'panda', 'teddy-bear',
  'chicken', 'duck', 'horse', 'cow', 'dinosaur',
];

const doc = readFileSync(path.join(process.cwd(), 'docs/CATEGORY_LESSONS.md'), 'utf8');

describe('category catalogue', () => {
  it('lists a few dozen categories and marks which lessons exist', () => {
    expect(CATEGORY_CATALOGUE.length).toBeGreaterThanOrEqual(30);
    expect(CATEGORY_CATALOGUE.length).toBeLessThanOrEqual(50);
    expect(CATEGORY_LESSONS).toHaveLength(DONE_IDS.length);
    expect(CATEGORY_LESSONS.map((entry) => entry.id)).toEqual(DONE_IDS);
    for (const entry of CATEGORY_CATALOGUE) {
      expect(doc).toMatch(new RegExp(`\\| ${entry.id} \\|[^\\n]*\\| ${entry.status} \\|`));
    }
  });

  it('authors each done lesson as one simple first shape, then parts, then colour', () => {
    expect(() => assertValidLessons(CATEGORY_LESSONS.map((entry) => entry.lesson))).not.toThrow();
    for (const entry of CATEGORY_LESSONS) {
      const lines = entry.lesson.steps.filter((step) => step.phase !== 'color');
      expect(lines.length).toBeGreaterThanOrEqual(5);
      expect(lines.length).toBeLessThanOrEqual(11);
      expect(lines[0]?.guidePaths).toHaveLength(1);
      expect(lines[0]?.guidePaths[0]?.role).toBe('final-outline');
      expect(lines[0]?.guidePaths[0]?.d).toMatch(/A|Z/i);
      const firstColour = entry.lesson.steps.findIndex((step) => step.phase === 'color');
      expect(firstColour).toBeGreaterThan(0);
      expect(entry.lesson.steps.slice(firstColour).every((step) => step.phase === 'color')).toBe(true);
      expect(entry.lesson.steps.every((step) => step.completionPolicy.automaticEnabled === false)).toBe(true);
      const construction = new Set(lines.flatMap((step) => step.guidePaths.filter((path) => path.role === 'construction').map((path) => path.id)));
      for (const path of entry.lesson.targetPreview.paths) {
        expect(path.role).toBe('final-outline');
        expect(construction.has(path.id)).toBe(false);
      }
      for (const step of entry.lesson.steps.filter((item) => item.phase === 'color')) {
        expect(step.toolPreset.tool).toBe('brush');
        expect(step.colorRegionIds.length).toBeGreaterThan(0);
      }
    }
    const flower = CATEGORY_LESSONS.find((entry) => entry.id === 'flower')!;
    expect(flower.lesson.steps.map((step) => step.instruction).join(' ')).not.toMatch(/senyum|mata/i);
    const bundledIds = new Set(BUNDLED_LESSONS.map((lesson) => lesson.id));
    for (const entry of CATEGORY_LESSONS) {
      expect(bundledIds.has(entry.lesson.id)).toBe(false);
    }
    const house = CATEGORY_LESSONS.find((entry) => entry.id === 'house')!;
    expect(house.lesson.steps[0]?.guidePaths[0]?.d).not.toMatch(/A/);
    expect(getPlayableLesson('house').id).toBe('house');
    expect(getPlayableLesson('house-front').title).toBe('Rumah');
    expect(getPlayableLesson('butterfly').id).toBe('butterfly');
    expect(getPlayableLesson('butterfly-front').title).toBe('Kupu-kupu');
    expect(getPlayableLesson('tree').id).toBe('tree');
    const cup = getPlayableLesson('cup');
    const coloured = new Set(cup.steps.filter((step) => step.phase === 'color').flatMap((step) => step.colorRegionIds));
    expect([...coloured].sort()).toEqual(['body', 'drink', 'handle', 'saucer']);
    for (const region of cup.colorRegions) {
      expect(region.d.trim().endsWith('Z')).toBe(true);
    }
    const handlePath = cup.steps.find((step) => step.id === 'handle')?.guidePaths[0]?.d ?? '';
    expect(handlePath).toMatch(/C /);
    expect(handlePath.trim().endsWith('Z')).toBe(true);
    expect(cup.steps.map((step) => step.id).slice(0, 4)).toEqual(['rim', 'body', 'saucer', 'handle']);
    const bounds = (id: string) => {
      const region = cup.colorRegions.find((item) => item.id === id);
      const box = region ? pathBounds(region.d) : null;
      expect(box).not.toBeNull();
      return box!;
    };
    const rim = pathBounds(cup.steps.find((step) => step.id === 'rim')!.guidePaths[0]!.d)!;
    const body = bounds('body');
    const handle = bounds('handle');
    const saucer = bounds('saucer');
    const drink = bounds('drink');
    expect(rim.maxX - rim.minX).toBeGreaterThan((rim.maxY - rim.minY) * 2);
    const bodyLine = cup.steps.find((step) => step.id === 'body')!.guidePaths[0]!.d;
    const bodyNumbers = bodyLine.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const topWidth = bodyNumbers[8]! - bodyNumbers[0]!;
    const footWidth = bodyNumbers[6]! - bodyNumbers[2]!;
    expect(topWidth).toBeGreaterThan(footWidth);
    expect(bodyNumbers[3]!).toBeGreaterThan(bodyNumbers[1]!);
    expect(handle.minX).toBeGreaterThan((body.minX + body.maxX) / 2);
    expect(handle.maxX).toBeGreaterThan(body.maxX);
    expect(saucer.maxX - saucer.minX).toBeGreaterThan(body.maxX - body.minX);
    expect(saucer.maxY).toBeGreaterThan(body.maxY - 30);
    expect(drink.minX).toBeGreaterThan(rim.minX + 8);
    expect(drink.maxX).toBeLessThan(rim.maxX - 8);
    expect(drink.minY).toBeGreaterThan(rim.minY);
    expect(drink.maxY).toBeLessThanOrEqual(rim.maxY + 1);
    const seen = new Set<string>();
    for (const step of cup.steps.filter((item) => item.phase === 'color')) {
      for (const id of step.colorRegionIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });

  it('renders a contact sheet that names every step', () => {
    for (const entry of CATEGORY_LESSONS) {
      const html = contactSheetHtml(entry);
      expect(html).toContain(entry.title);
      expect(html).toContain('#e23b3b');
      expect(html).toContain('#2c2c2c');
      for (const step of entry.lesson.steps) {
        expect(html).toContain(step.instruction);
      }
    }
    expect(CATEGORY_CATALOGUE.filter((entry) => !isDone(entry)).length).toBe(CATEGORY_CATALOGUE.length - CATEGORY_LESSONS.length);
  });
});
