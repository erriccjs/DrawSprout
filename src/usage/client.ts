/**
 * Sends one anonymous event and then forgets it.
 *
 * Offline, a full browser, or a rejected request drops the event. The drawing
 * screen never waits on this and never surfaces an error.
 */

import { readLocale } from '../i18n/locale';
import { layoutTier } from '../ui/layout-tier';
import {
  isLessonId,
  parseUsageEvent,
  utcWeekKey,
  type UsageDevice,
  type UsageEventName,
  type UsageLanguage,
} from './events';

const WEEK_KEY = 'drawsprout.opened-week';
const FEEDBACK_KEY = 'drawsprout.feedback-lessons';

export function deviceClass(width: number, height: number): UsageDevice {
  const tier = layoutTier(width, height);
  if (tier === 'phone-portrait' || tier === 'phone-landscape') return 'phone';
  if (width >= 1280) return 'desktop';
  return 'tablet';
}

export function languageCode(locale: string): UsageLanguage {
  return locale === 'id' ? 'id' : 'en';
}

/**
 * A browser that already opened the app earlier in this UTC week.
 * The stored value is only the week label, on this device. It is not sent.
 */
export function returningThisWeek(now: Date, storedWeek: string | null): boolean {
  return storedWeek === utcWeekKey(now);
}

export function noteThisWeek(now: Date = new Date()): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(WEEK_KEY);
  } catch {
    /* Keep the empty week. */
  }
  const returning = returningThisWeek(now, stored);
  try {
    localStorage.setItem(WEEK_KEY, utcWeekKey(now));
  } catch {
    /* A private window can refuse the week label. The event still sends. */
  }
  return returning;
}

export function feedbackAlreadySent(lessonId: string): boolean {
  return readFeedback().includes(lessonId);
}

export function rememberFeedback(lessonId: string): void {
  const current = readFeedback().filter((id) => id !== lessonId);
  current.push(lessonId);
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(current.slice(-200)));
  } catch {
    /* The thank-you still shows. A reload may ask again. */
  }
}

function readFeedback(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isLessonId) : [];
  } catch {
    return [];
  }
}

let noted = false;
let returning = false;

function currentReturning(): boolean {
  if (!noted) {
    returning = noteThisWeek();
    noted = true;
  }
  return returning;
}

/** One event. Invalid ids are dropped here, so the server never sees free text. */
export function recordUsage(name: UsageEventName, lessonId?: string): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const lesson = lessonId && isLessonId(lessonId) ? lessonId : undefined;
    if (lessonId && !lesson) return;
    const width = typeof window === 'undefined' ? 0 : window.innerWidth;
    const height = typeof window === 'undefined' ? 0 : window.innerHeight;
    const event = parseUsageEvent({
      name,
      language: languageCode(readLocale()),
      device: deviceClass(width, height),
      returning: currentReturning(),
      ...(lesson ? { lesson } : {}),
    });
    if (typeof event === 'string') return;
    const body = JSON.stringify(event);
    if (typeof fetch !== 'function') return;
    void fetch('/api/event', {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
    }).catch(() => undefined);
  } catch {
    /* Dropped. */
  }
}

/** Loads the public Cloudflare beacon only when a build provided a token. */
export function installWebAnalytics(token: string | undefined): void {
  const value = token?.trim() ?? '';
  if (!value || typeof document === 'undefined') return;
  if (document.querySelector('script[data-cf-beacon]')) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token: value });
  document.head.appendChild(script);
}
