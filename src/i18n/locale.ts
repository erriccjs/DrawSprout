/**
 * English and Indonesian. A saved choice wins. Otherwise Indonesian is used
 * only when the device language is Indonesian; every other device starts in
 * English.
 */

export type Locale = 'en' | 'id';

export const LOCALE_STORAGE_KEY = 'drawsprout.locale';

export function detectLocale(languages: readonly string[], stored: string | null): Locale {
  if (stored === 'en' || stored === 'id') return stored;
  for (const language of languages) {
    const tag = language.toLowerCase();
    if (tag === 'id' || tag.startsWith('id-')) return 'id';
  }
  return 'en';
}

export function readLocale(): Locale {
  let stored: string | null;
  try {
    stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) ?? null;
  } catch {
    stored = null;
  }
  const navigatorLanguages = typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
  return detectLocale(navigatorLanguages, stored);
}

export function writeLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* A private window can refuse storage. The choice still lasts for this view. */
  }
}
