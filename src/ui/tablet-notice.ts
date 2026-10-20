/**
 * Remembers that the phone visitor dismissed the "best on a tablet" note.
 *
 * This is a device preference, not part of a drawing. It stays in localStorage
 * and is never written into the session store.
 */

export const TABLET_NOTICE_KEY = 'drawsprout.prefer-tablet.dismissed';

type NoticeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isTabletNoticeDismissed(storage: NoticeStorage | null = browserStorage()): boolean {
  try {
    return storage?.getItem(TABLET_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissTabletNotice(storage: NoticeStorage | null = browserStorage()): void {
  try {
    storage?.setItem(TABLET_NOTICE_KEY, '1');
  } catch {
    /* Private mode can reject the write. The note may return next time. */
  }
}

function browserStorage(): NoticeStorage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
