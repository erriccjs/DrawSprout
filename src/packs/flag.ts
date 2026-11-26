/**
 * The freemium flag. Off unless this browser opts in.
 *
 * While it is off, every pack opens. Nothing that is free today becomes locked.
 * `?premium=1` turns it on for this visit. `?premium=0` turns it off.
 * `localStorage` key `drawsprout.premium` = `on` keeps it on after that.
 */

const STORAGE_KEY = 'drawsprout.premium';

let override: boolean | null = null;

/** Test hook. `null` returns to the URL and localStorage. */
export function setPremiumFlag(on: boolean | null): void {
  override = on;
}

export function premiumFlagEnabled(): boolean {
  if (override !== null) return override;
  if (typeof window === 'undefined') return false;
  try {
    const query = new URLSearchParams(window.location.search).get('premium');
    if (query === '1') return true;
    if (query === '0') return false;
  } catch {
    /* A missing location still counts as off. */
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function rememberPremiumFlag(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* The query string still works for this visit. */
  }
}
