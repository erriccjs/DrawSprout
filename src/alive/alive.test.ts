import { describe, expect, it } from 'vitest';
import { recordedCalls } from '../test/fake-canvas';
import { transformAt } from './motion';
import { paintAlive } from './paint';
import { frameAt, type AliveStroke } from './presets';

const space = { width: 1000, height: 750 };

function stroke(stepId: string, sequence = 1, extra: Partial<AliveStroke> = {}): AliveStroke {
  return {
    stepId,
    points: [{ x: 700, y: 400 }, { x: 760, y: 360 }, { x: 720, y: 300 }],
    color: '#c45a2a',
    width: 6,
    layer: 'ink',
    erase: false,
    sequence,
    clipRegionIds: [],
    ...extra,
  };
}

describe('living picture presets', () => {
  it('wags a cat tail, blinks the face, and leaves a shared fur fill still', () => {
    const frame = frameAt('cat', space, [
      stroke('tail', 1),
      stroke('face', 2),
      stroke('color-fur', 3, { layer: 'color', clipRegionIds: ['fur-head', 'fur-tail'] }),
      stroke('color-fur', 4, { layer: 'color', clipRegionIds: ['fur-tail'], color: '#e8a33d' }),
    ], 0.125);
    expect(frame.mode).toBe('parts');
    expect(frame.draws[0]?.transform.rotation).toBeCloseTo(0.22, 2);
    expect(frame.draws[1]?.transform.scaleY).toBe(1);
    expect(frameAt('cat', space, [stroke('face')], 0.28).draws[0]?.transform.scaleY).toBeCloseTo(0.2, 5);
    expect(frame.draws[2]?.transform.rotation).toBe(0);
    expect(frame.draws[3]?.transform.rotation).toBeCloseTo(0.22, 2);
  });

  it('swims a fish, spins sun rays, sways a flower, and lifts chimney smoke in the child colour', () => {
    const fish = frameAt('fish', space, [stroke('body')], 1 / 6);
    expect(fish.whole.translateX).toBeCloseTo(36, 1);
    const sun = frameAt('sun-smiling', space, [stroke('vertical-rays-outline')], 1);
    expect(sun.draws[0]?.transform.rotation).toBeCloseTo(Math.PI * 1.5, 5);
    const flower = frameAt('flower', space, [stroke('petals')], 0.25);
    expect(flower.draws[0]?.transform.rotation).toBeCloseTo(0.12, 2);
    const house = frameAt('house-front', space, [stroke('chimney')], 0);
    expect(house.puffs).toHaveLength(3);
    expect(house.puffs[0]?.color).toBe('#c45a2a');
    expect(house.puffs[0]?.y).toBeGreaterThan(house.puffs[2]?.y ?? 0);
  });

  it('redraws an unknown lesson in stroke order, then keeps the picture still at the end', () => {
    const strokes = [stroke('head', 1), stroke('body', 2)];
    const start = frameAt('star', space, strokes, 0);
    expect(start.mode).toBe('redraw');
    expect(start.draws.every((draw) => !draw.visible)).toBe(true);
    expect(start.sparkles.length).toBeGreaterThan(0);
    const end = frameAt('star', space, strokes, 1);
    expect(end.draws.every((draw) => draw.visible)).toBe(true);
    expect(end.whole.translateY).toBeCloseTo(0, 5);
  });

  it('paints the child stroke and not a guide path', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 150;
    paintAlive(canvas, 'cat', space, [stroke('tail')], 0.125, { head: 'M 0 0 L 10 10' });
    const calls = recordedCalls(canvas);
    expect(calls.some((call) => call.op === 'rotate' && Math.abs(call.args[0] as number) > 0.1)).toBe(true);
    expect(calls.some((call) => call.op === 'moveTo')).toBe(true);
    expect(calls.some((call) => call.op === 'setLineDash' && Array.isArray(call.args[0]) && (call.args[0] as unknown[]).length > 0)).toBe(false);
    expect(transformAt('still', 0.5, { x: 1, y: 2 }, space).rotation).toBe(0);
  });
});
