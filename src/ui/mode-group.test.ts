import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The mode box has to stay as wide as the tool buttons. A visible label is
 * what made the dock wider than the column of 56px chips.
 */
describe('mode group width', () => {
  const css = readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

  it('caps the vertical mode box at one tool button and does not show a label', () => {
    const rule = css.match(/\.float-dock \.toolbar__group--mode \{[^}]+\}/)?.[0] ?? '';
    expect(rule).toMatch(/max-width:\s*56px/);
    expect(rule).toMatch(/flex-direction:\s*column/);
    expect(css).not.toMatch(/toolbar__group--mode \.chip__label/);
    expect(css).toMatch(/min-height:\s*44px/);
  });

  it('lays the portrait-phone mode box in a row no wider than two tool buttons', () => {
    const rule = css.match(/phone-portrait'\] \.float-dock \.toolbar__group--mode \{[^}]+\}/)?.[0] ?? '';
    expect(rule).toMatch(/flex-direction:\s*row/);
    expect(rule).toMatch(/max-width:\s*100px/);
  });
});