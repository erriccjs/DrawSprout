import { describe, expect, it } from 'vitest';
import { circle } from '../categories/shapes';
import { svgToOps, type DrawOp } from './svg-path';

function endPoint(ops: readonly DrawOp[]): { x: number; y: number } | null {
  for (let index = ops.length - 1; index >= 0; index -= 1) {
    const op = ops[index];
    if (op && op.op !== 'Z') return { x: op.x, y: op.y };
  }
  return null;
}

describe('svg path conversion', () => {
  it('keeps absolute lines and closes the subpath', () => {
    const ops = svgToOps('M 10 20 L 30 20 H 40 V 50 Z');
    expect(ops.map((op) => op.op)).toEqual(['M', 'L', 'L', 'L', 'Z']);
    expect(endPoint(ops)).toEqual({ x: 40, y: 50 });
  });

  it('resolves relative commands from the current point', () => {
    const ops = svgToOps('m 10 20 l 5 0 h 5 v 5 z');
    expect(ops).toEqual([
      { op: 'M', x: 10, y: 20 },
      { op: 'L', x: 15, y: 20 },
      { op: 'L', x: 20, y: 20 },
      { op: 'L', x: 20, y: 25 },
      { op: 'Z' },
    ]);
  });

  it('turns a quadratic into a cubic that ends on the same point', () => {
    const ops = svgToOps('M 0 0 Q 10 20 20 0');
    expect(ops[1]?.op).toBe('C');
    expect(endPoint(ops)).toEqual({ x: 20, y: 0 });
  });

  it('draws a circle as cubics around the centre', () => {
    const ops = svgToOps(circle(100, 100, 14));
    const points: Array<{ x: number; y: number }> = [];
    for (const op of ops) {
      if (op.op === 'C') {
        points.push({ x: op.x1, y: op.y1 }, { x: op.x2, y: op.y2 }, { x: op.x, y: op.y });
      }
    }
    expect(points.length).toBeGreaterThan(4);
    for (const point of points) {
      const distance = Math.hypot(point.x - 100, point.y - 100);
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(18);
    }
    expect(Math.min(...points.map((point) => point.y))).toBeLessThan(90);
    expect(Math.max(...points.map((point) => point.y))).toBeGreaterThan(110);
  });
});
