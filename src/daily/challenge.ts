/**
 * Today's picture, chosen from the calendar date and the lesson list.
 *
 * The same date always picks the same lesson, with no network. The next
 * calendar day picks a different one when there is more than one lesson.
 * A missed day does not scold anyone: the streak simply starts again at one.
 */

export interface DailyProgress {
  readonly schemaVersion: 1;
  readonly lastCompletedDay: number;
  readonly streak: number;
}

const STORAGE_KEY = 'drawsprout.daily-challenge';

/** Local calendar day, so midnight on this device starts the next challenge. */
export function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function dailyChallengeId(date: Date, lessonIds: readonly string[]): string | null {
  const ids = [...new Set(lessonIds)].sort();
  if (ids.length === 0) return null;
  const index = mod(localDayNumber(date), ids.length);
  return ids[index] ?? null;
}

export function visibleStreak(progress: DailyProgress | null, today: number): number {
  if (!progress || progress.lastCompletedDay !== today) return 0;
  return progress.streak;
}

/**
 * Marks today complete. The same day twice does not add another day.
 * A gap of more than one day starts again at 1.
 */
export function completeDaily(
  progress: DailyProgress | null,
  today: number,
): { readonly progress: DailyProgress; readonly fresh: boolean } {
  if (progress?.lastCompletedDay === today) return { progress, fresh: false };
  const continued = progress?.lastCompletedDay === today - 1;
  return {
    fresh: true,
    progress: {
      schemaVersion: 1,
      lastCompletedDay: today,
      streak: continued ? progress.streak + 1 : 1,
    },
  };
}

export function loadDaily(storage: Pick<Storage, 'getItem'> | null = browserStorage()): DailyProgress | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyProgress>;
    if (parsed.schemaVersion !== 1) return null;
    if (typeof parsed.lastCompletedDay !== 'number' || typeof parsed.streak !== 'number') return null;
    if (parsed.streak < 1) return null;
    return { schemaVersion: 1, lastCompletedDay: parsed.lastCompletedDay, streak: parsed.streak };
  } catch {
    return null;
  }
}

export function saveDaily(
  progress: DailyProgress,
  storage: Pick<Storage, 'setItem'> | null = browserStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* A private window can refuse the streak. Today's picture still opens. */
  }
}

function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
