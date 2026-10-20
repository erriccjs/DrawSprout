import { describe, expect, it } from 'vitest';
import { TABLET_NOTICE_KEY, dismissTabletNotice, isTabletNoticeDismissed } from './tablet-notice';

describe('the tablet notice memory', () => {
  it('remembers a dismissal and ignores a blocked store', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(isTabletNoticeDismissed(storage)).toBe(false);
    dismissTabletNotice(storage);
    expect(values.get(TABLET_NOTICE_KEY)).toBe('1');
    expect(isTabletNoticeDismissed(storage)).toBe(true);

    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => dismissTabletNotice(blocked)).not.toThrow();
    expect(isTabletNoticeDismissed(blocked)).toBe(false);
    expect(isTabletNoticeDismissed(null)).toBe(false);
    expect(() => dismissTabletNotice(null)).not.toThrow();
  });
});
