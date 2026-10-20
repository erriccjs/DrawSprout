import { describe, expect, it } from 'vitest';
import {
  PHONE_LANDSCAPE_MAX_HEIGHT,
  PHONE_LANDSCAPE_MAX_WIDTH,
  PHONE_PORTRAIT_MAX_WIDTH,
  layoutTier,
} from './layout-tier';

describe('layoutTier', () => {
  it('treats common phone portraits as phones', () => {
    expect(layoutTier(360, 800)).toBe('phone-portrait');
    expect(layoutTier(390, 844)).toBe('phone-portrait');
    expect(layoutTier(430, 932)).toBe('phone-portrait');
    expect(layoutTier(375, 667)).toBe('phone-portrait');
    expect(layoutTier(PHONE_PORTRAIT_MAX_WIDTH, 900)).toBe('phone-portrait');
  });

  it('keeps the measured tablet portraits on the tablet layout', () => {
    expect(layoutTier(600, 960)).toBe('tablet');
    expect(layoutTier(768, 1024)).toBe('tablet');
    expect(layoutTier(820, 1180)).toBe('tablet');
    expect(layoutTier(744, 1133)).toBe('tablet');
  });

  it('treats phone landscape, including a narrow window that is wider than it is tall, as phone landscape', () => {
    expect(layoutTier(844, 390)).toBe('phone-landscape');
    expect(layoutTier(667, 375)).toBe('phone-landscape');
    expect(layoutTier(800, 360)).toBe('phone-landscape');
    expect(layoutTier(932, 430)).toBe('phone-landscape');
    expect(layoutTier(PHONE_LANDSCAPE_MAX_WIDTH, PHONE_LANDSCAPE_MAX_HEIGHT)).toBe('phone-landscape');
    expect(layoutTier(500, 400)).toBe('phone-landscape');
  });

  it('keeps short tablet landscapes on the tablet layout', () => {
    expect(layoutTier(1024, 430)).toBe('tablet');
    expect(layoutTier(1024, 600)).toBe('tablet');
    expect(layoutTier(960, 600)).toBe('tablet');
    expect(layoutTier(960, 480)).toBe('tablet');
    expect(layoutTier(1180, 820)).toBe('tablet');
    expect(layoutTier(1024, 768)).toBe('tablet');
    expect(layoutTier(PHONE_LANDSCAPE_MAX_WIDTH + 1, PHONE_LANDSCAPE_MAX_HEIGHT)).toBe('tablet');
  });

  it('falls back to the tablet layout for an unusable size', () => {
    expect(layoutTier(0, 800)).toBe('tablet');
    expect(layoutTier(390, Number.NaN)).toBe('tablet');
    expect(layoutTier(-100, 400)).toBe('tablet');
  });
});
