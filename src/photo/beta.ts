/** Parent-only flag. Session storage, not the drawing database. */

export const PHOTO_BETA_STORAGE_KEY = 'drawsprout-beta-foto';

/**
 * `?beta=foto` turns the photo spike on for this tab. `?beta=off` clears it.
 * With neither, the previous choice in this tab stands. Default is off.
 */
export function readPhotoBeta(search?: string): boolean {
  const query = search ?? (typeof location === 'undefined' ? '' : location.search);
  const storage = sessionStorageOrNull();
  const flag = new URLSearchParams(query).get('beta');
  if (flag === 'foto') storage?.setItem(PHOTO_BETA_STORAGE_KEY, '1');
  if (flag === 'off') storage?.removeItem(PHOTO_BETA_STORAGE_KEY);
  return storage?.getItem(PHOTO_BETA_STORAGE_KEY) === '1';
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
