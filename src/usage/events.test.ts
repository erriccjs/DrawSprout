import { describe, expect, it } from 'vitest';
import { returningThisWeek } from './client';
import { parseUsageEvent, utcWeekKey } from './events';

const ok = {
  name: 'app_open',
  language: 'id',
  device: 'tablet',
  returning: false,
};

describe('usage event allowlist', () => {
  it('accepts a known event and nothing else', () => {
    expect(parseUsageEvent(ok)).toEqual(ok);
    expect(parseUsageEvent({ ...ok, name: 'lesson_complete', lesson: 'cat-sitting' })).toMatchObject({
      name: 'lesson_complete',
      lesson: 'cat-sitting',
    });
    expect(parseUsageEvent({ ...ok, name: 'stamp_earned', lesson: 'cup' })).toMatchObject({
      name: 'stamp_earned',
      lesson: 'cup',
    });
    expect(parseUsageEvent({ ...ok, name: 'album_open' })).toMatchObject({ name: 'album_open' });
    expect(parseUsageEvent({ ...ok, name: 'daily_challenge_start', lesson: 'cup' })).toMatchObject({
      name: 'daily_challenge_start',
      lesson: 'cup',
    });
    expect(parseUsageEvent({ ...ok, name: 'mascot_tap' })).toMatchObject({ name: 'mascot_tap' });
    expect(parseUsageEvent({ ...ok, name: 'share_picture', lesson: 'cat-sitting' })).toMatchObject({
      name: 'share_picture',
      lesson: 'cat-sitting',
    });
    expect(parseUsageEvent({ ...ok, name: 'print_sheet', lesson: 'star' })).toMatchObject({
      name: 'print_sheet',
      lesson: 'star',
    });
  });

  it('rejects an unknown name, an extra field, and a sentence used as a lesson', () => {
    expect(parseUsageEvent({ ...ok, name: 'page_view' })).toBe('bad_name');
    expect(parseUsageEvent({ ...ok, name: 'stamp_earned' })).toBe('lesson_required');
    expect(parseUsageEvent({ ...ok, name: 'album_open', lesson: 'cup' })).toBe('lesson_forbidden');
    expect(parseUsageEvent({ ...ok, name: 'daily_challenge_complete' })).toBe('lesson_required');
    expect(parseUsageEvent({ ...ok, name: 'mascot_tap', lesson: 'cup' })).toBe('lesson_forbidden');
    expect(parseUsageEvent({ ...ok, name: 'share_picture' })).toBe('lesson_required');
    expect(parseUsageEvent({ ...ok, name: 'print_sheet' })).toBe('lesson_required');
    expect(parseUsageEvent({ ...ok, note: 'hello from a child' })).toBe('unknown_field');
    expect(parseUsageEvent({ ...ok, name: 'feedback_up', lesson: 'the cat was cute' })).toBe('lesson_required');
    expect(parseUsageEvent({ ...ok, name: 'feedback_down' })).toBe('lesson_required');
    expect(parseUsageEvent({ ...ok, lesson: 'cat-sitting' })).toBe('lesson_forbidden');
    expect(parseUsageEvent({ ...ok, returning: 'yes' })).toBe('bad_returning');
    expect(parseUsageEvent([])).toBe('not_object');
  });

  it('treats a later open in the same UTC week as returning, and a new week as not', () => {
    const monday = new Date('2026-11-09T00:30:00Z');
    const later = new Date('2026-11-12T18:00:00Z');
    const next = new Date('2026-11-16T00:30:00Z');
    const mondayWeek = utcWeekKey(monday);
    const laterWeek = utcWeekKey(later);
    expect(mondayWeek).toEqual(laterWeek);
    expect(returningThisWeek(later, mondayWeek)).toEqual(true);
    expect(returningThisWeek(next, mondayWeek)).toEqual(false);
    expect(returningThisWeek(monday, null)).toEqual(false);
  });
});
