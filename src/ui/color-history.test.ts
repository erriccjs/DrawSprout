import { describe, expect, it } from 'vitest';
import { RECENT_COLOR_LIMIT, rememberColor } from './color-history';

describe('rememberColor', () => {
  it('puts the newest colour first and drops duplicates', () => {
    expect(rememberColor([], '#e8552d')).toEqual(['#e8552d']);
    expect(rememberColor(['#3f7ad6', '#e8552d'], '#e8552d')).toEqual(['#e8552d', '#3f7ad6']);
    expect(rememberColor(['#3F7AD6'], '#3f7ad6')).toEqual(['#3f7ad6']);
  });

  it('keeps only the most recent handful', () => {
    const colors = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'];
    const history = colors.reduce<readonly string[]>((current, color) => rememberColor(current, color), []);
    expect(history).toHaveLength(RECENT_COLOR_LIMIT);
    expect(history[0]).toBe('#666666');
    expect(history).not.toContain('#111111');
  });
});
