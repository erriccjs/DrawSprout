import { describe, expect, it } from 'vitest';
import { lessonsForPicker } from '../categories/library';
import {
  completeDaily,
  dailyChallengeId,
  loadDaily,
  localDayNumber,
  saveDaily,
  visibleStreak,
  type DailyProgress,
} from './challenge';
import { mascotLine } from './mascot-lines';

const IDS = ['cup', 'apple', 'cat', 'fish', 'star'];

describe('daily challenge', () => {
  it('picks the same lesson all day and a different one after midnight', () => {
    const morning = new Date(2026, 10, 22, 8, 15);
    const night = new Date(2026, 10, 22, 23, 59);
    const next = new Date(2026, 10, 23, 0, 1);
    expect(localDayNumber(night)).toBe(localDayNumber(morning));
    expect(localDayNumber(next)).toBe(localDayNumber(morning) + 1);
    expect(dailyChallengeId(morning, IDS)).toBe(dailyChallengeId(night, IDS));
    expect(dailyChallengeId(next, IDS)).not.toBe(dailyChallengeId(night, IDS));
  });

  it('does not repeat the lesson on consecutive days', () => {
    const start = new Date(2026, 0, 1, 12, 0);
    for (let offset = 0; offset < 60; offset += 1) {
      const today = new Date(start);
      today.setDate(start.getDate() + offset);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const first = dailyChallengeId(today, IDS);
      const second = dailyChallengeId(tomorrow, IDS);
      expect(first).toBeTruthy();
      expect(second).not.toBe(first);
    }
  });

  it('uses the real lesson list and ignores order and duplicates', () => {
    const ids = lessonsForPicker().map((lesson) => lesson.id);
    const date = new Date(2026, 5, 2, 9, 0);
    expect(dailyChallengeId(date, [...ids].reverse())).toBe(dailyChallengeId(date, ids));
    expect(dailyChallengeId(date, [...ids, ids[0]!])).toBe(dailyChallengeId(date, ids));
    expect(ids).toContain(dailyChallengeId(date, ids));
    expect(dailyChallengeId(date, [])).toBeNull();
  });

  it('adds a day when yesterday was done, and starts again quietly after a gap', () => {
    const today = 20_000;
    expect(completeDaily(null, today)).toEqual({
      fresh: true,
      progress: { schemaVersion: 1, lastCompletedDay: today, streak: 1 },
    });
    const yesterday: DailyProgress = { schemaVersion: 1, lastCompletedDay: today - 1, streak: 4 };
    const next = completeDaily(yesterday, today);
    expect(next.fresh).toBe(true);
    expect(next.progress.streak).toBe(5);
    const again = completeDaily(next.progress, today);
    expect(again.fresh).toBe(false);
    expect(again.progress.streak).toBe(5);
    const afterGap = completeDaily(yesterday, today + 3);
    expect(afterGap.progress.streak).toBe(1);
    expect(visibleStreak(yesterday, today)).toBe(0);
    expect(visibleStreak(next.progress, today)).toBe(5);
  });

  it('keeps the streak on this device', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    expect(loadDaily(storage)).toBeNull();
    const saved = completeDaily(null, 10).progress;
    saveDaily(saved, storage);
    expect(loadDaily(storage)).toEqual(saved);
    expect(loadDaily({ getItem: () => '{bad' })).toBeNull();
    expect(loadDaily({ getItem: () => '{"schemaVersion":2,"lastCompletedDay":1,"streak":1}' })).toBeNull();
  });

  it('changes the mascot line with the day and keeps it for that day', () => {
    const first = new Date(2026, 3, 1, 10, 0);
    const later = new Date(2026, 3, 1, 21, 0);
    const next = new Date(2026, 3, 2, 10, 0);
    expect(mascotLine('idle', 'id', first)).toBe(mascotLine('idle', 'id', later));
    expect(mascotLine('cheer', 'en', next)).not.toBe(mascotLine('cheer', 'en', first));
    expect(mascotLine('idle', 'id', first).length).toBeGreaterThan(0);
  });
});
