/**
 * The chosen language for the whole screen. The choice is saved on the device.
 * The provider and the hook share this context, so they stay in one file.
 */
/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { messages, translate, type MessageKey, type MessageVars } from './messages';
import { readLocale, writeLocale, type Locale } from './locale';

export interface I18n {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  readonly t: (key: MessageKey, vars?: MessageVars) => string;
}

const LocaleContext = createContext<I18n | null>(null);

function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = messages[locale].documentTitle;
  const description = document.querySelector('meta[name="description"]');
  description?.setAttribute('content', messages[locale].documentDescription);
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) {
    manifest.setAttribute('href', locale === 'id' ? '/manifest.webmanifest' : '/manifest-en.webmanifest');
  }
}

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState(readLocale);
  const setLocale = useCallback((next: Locale) => {
    writeLocale(next);
    setLocaleState(next);
  }, []);
  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);
  const value = useMemo<I18n>(() => ({
    locale,
    setLocale,
    t: (key, vars) => translate(locale, key, vars),
  }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Works without a provider so a single screen can still be rendered in tests. */
export function useI18n(): I18n {
  const provided = useContext(LocaleContext);
  const [fallback, setFallback] = useState(readLocale);
  const setLocale = useCallback((next: Locale) => {
    writeLocale(next);
    setFallback(next);
  }, []);
  const fallbackValue = useMemo<I18n>(() => ({
    locale: fallback,
    setLocale,
    t: (key, vars) => translate(fallback, key, vars),
  }), [fallback, setLocale]);
  return provided ?? fallbackValue;
}
