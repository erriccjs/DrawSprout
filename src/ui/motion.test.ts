import { describe, expect, it } from 'vitest';
import { motionPreference } from './motion';

describe('motionPreference', () => {
  it('follows the reduced-motion setting', () => {
    expect(motionPreference(true)).toBe('reduce');
    expect(motionPreference(false)).toBe('full');
  });
});
