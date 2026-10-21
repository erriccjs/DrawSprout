import { describe, expect, it } from 'vitest';
import { BASKETBALL_LESSON } from '../lesson-data/basketball-lesson';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { pathBounds, previewViewBox } from './preview-frame';

describe('preview frame', () => {
  it('includes the top and bottom of a circle, not only the arc endpoints', () => {
    const bounds = pathBounds(BASKETBALL_LESSON.targetPreview.paths[0]!.d);
    expect(bounds?.minX).toBeCloseTo(290, 0);
    expect(bounds?.maxX).toBeCloseTo(710, 0);
    expect(bounds?.minY).toBeCloseTo(170, 0);
    expect(bounds?.maxY).toBeCloseTo(590, 0);
  });

  it('frames the basketball so the ball fills a 4:3 card', () => {
    const viewBox = previewViewBox(
      BASKETBALL_LESSON.coordinateSpace,
      BASKETBALL_LESSON.targetPreview.paths.map((path) => path.d),
    );
    const [x, y, width, height] = viewBox.split(' ').map(Number);
    expect(width! / height!).toBeCloseTo(4 / 3, 2);
    expect(width!).toBeLessThan(800);
    expect(height!).toBeLessThan(600);
    const ballHeight = 420;
    expect(ballHeight / height!).toBeGreaterThan(0.8);
    expect(x! + width!).toBeLessThanOrEqual(1000);
    expect(y!).toBeGreaterThanOrEqual(0);
  });

  it('keeps a drawing that already spans the page inside the lesson space', () => {
    const viewBox = previewViewBox(CAT_LESSON.coordinateSpace, [
      ...CAT_LESSON.targetPreview.paths.map((path) => path.d),
      ...CAT_LESSON.colorRegions.map((region) => region.d),
    ]);
    const [x, y, width, height] = viewBox.split(' ').map(Number);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x! + width!).toBeLessThanOrEqual(1000);
    expect(y! + height!).toBeLessThanOrEqual(750);
    expect(width! / height!).toBeCloseTo(4 / 3, 2);
  });

  it('falls back to the whole space when there is nothing to frame', () => {
    expect(previewViewBox({ width: 1000, height: 750 }, [])).toBe('0 0 1000 750');
  });
});
