import { describe, expect, it } from 'vitest';
import { drawingChrome } from './drawing-chrome';

describe('drawing chrome', () => {
  function band(width: number, height: number, layout: 'tablet' | 'phone-portrait' | 'phone-landscape', notice = false) {
    const chrome = drawingChrome(layout, notice);
    return { chrome, inner: height - chrome.top - chrome.bottom, width };
  }

  it('leaves a band for the paper on a tablet, a portrait phone, and a landscape phone', () => {
    for (const sample of [
      band(1024, 768, 'tablet'),
      band(768, 1024, 'tablet'),
      band(390, 844, 'phone-portrait'),
      band(844, 390, 'phone-landscape'),
    ]) {
      expect(sample.inner).toBeGreaterThan(120);
      expect(sample.chrome.top).toBeGreaterThan(48);
      expect(sample.chrome.bottom).toBeGreaterThan(48);
    }
  });

  it('drops the paper further when the phone note is open', () => {
    const closed = drawingChrome('phone-portrait', false);
    const open = drawingChrome('phone-portrait', true);
    expect(open.top).toBeGreaterThan(closed.top);
    expect(open.bottom).toBe(closed.bottom);
    expect(drawingChrome('tablet', true)).toEqual(drawingChrome('tablet', false));
  });
});
