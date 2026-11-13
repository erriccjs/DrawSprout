/**
 * Anonymous usage events.
 *
 * The allowlist is the whole contract. A lesson id is a catalogue slug, never
 * a sentence. Nothing here is a person, a photo, or a device fingerprint.
 */

export const USAGE_EVENTS = [
  'app_open',
  'lesson_start',
  'lesson_complete',
  'trace_photo_start',
  'doodle_start',
  'doodle_success',
  'free_draw_start',
  'feedback_up',
  'feedback_down',
] as const;

export type UsageEventName = (typeof USAGE_EVENTS)[number];

export const USAGE_DEVICES = ['phone', 'tablet', 'desktop'] as const;
export type UsageDevice = (typeof USAGE_DEVICES)[number];

export const USAGE_LANGUAGES = ['en', 'id'] as const;
export type UsageLanguage = (typeof USAGE_LANGUAGES)[number];

/** Reject anything larger before it is parsed. */
export const MAX_USAGE_BYTES = 512;

const LESSON_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** These events name a lesson. The others must not carry one. */
const LESSON_REQUIRED = new Set<UsageEventName>([
  'lesson_start',
  'lesson_complete',
  'feedback_up',
  'feedback_down',
]);

/** A lesson slug is useful, but the event still counts without one. */
const LESSON_OPTIONAL = new Set<UsageEventName>([
  'trace_photo_start',
  'doodle_success',
  'free_draw_start',
]);

const ALLOWED_KEYS = new Set(['name', 'language', 'device', 'returning', 'lesson']);

export interface UsageEvent {
  readonly name: UsageEventName;
  readonly language: UsageLanguage;
  readonly device: UsageDevice;
  /** True when this browser already opened the app earlier in the same UTC week. */
  readonly returning: boolean;
  readonly lesson?: string;
}

export type UsageReject =
  | 'not_object'
  | 'unknown_field'
  | 'bad_name'
  | 'bad_language'
  | 'bad_device'
  | 'bad_returning'
  | 'bad_lesson'
  | 'lesson_required'
  | 'lesson_forbidden';

export function parseUsageEvent(value: unknown): UsageEvent | UsageReject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'not_object';
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) return 'unknown_field';
  }
  if (!USAGE_EVENTS.includes(record.name as UsageEventName)) return 'bad_name';
  const name = record.name as UsageEventName;
  if (!USAGE_LANGUAGES.includes(record.language as UsageLanguage)) return 'bad_language';
  if (!USAGE_DEVICES.includes(record.device as UsageDevice)) return 'bad_device';
  if (typeof record.returning !== 'boolean') return 'bad_returning';

  const hasLesson = Object.prototype.hasOwnProperty.call(record, 'lesson');
  if (LESSON_REQUIRED.has(name)) {
    if (!hasLesson || !isLessonId(record.lesson)) return 'lesson_required';
  } else if (hasLesson) {
    if (!LESSON_OPTIONAL.has(name)) return 'lesson_forbidden';
    if (!isLessonId(record.lesson)) return 'bad_lesson';
  }

  return {
    name,
    language: record.language as UsageLanguage,
    device: record.device as UsageDevice,
    returning: record.returning,
    ...(hasLesson && isLessonId(record.lesson) ? { lesson: record.lesson } : {}),
  };
}

export function isLessonId(value: unknown): value is string {
  return typeof value === 'string' && LESSON_ID.test(value);
}

/** ISO week in UTC, so two browsers agree on the week without a shared clock zone. */
export function utcWeekKey(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
