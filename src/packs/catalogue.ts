/**
 * Picture packs on the home screen.
 *
 * The core pack is the library that is already free. Nusantara is tagged
 * premium so the lock can appear when the freemium flag is on. With the flag
 * off, the tag does not lock anything.
 */

import { lessonsForPicker } from '../categories/library';
import type { LessonPackage } from '../lesson-data/schema';
import { NUSANTARA_LESSONS } from './nusantara/lessons';

export type PackTier = 'free' | 'premium';

export interface ContentPack {
  readonly id: string;
  readonly name: { readonly id: string; readonly en: string };
  readonly tier: PackTier;
  readonly lessonIds: readonly string[];
  /** A short line for the card. Not a price. */
  readonly blurb: { readonly id: string; readonly en: string };
}

const CORE_IDS = lessonsForPicker().map((lesson) => lesson.id);

export const PACKS: readonly ContentPack[] = [
  {
    id: 'inti',
    name: { id: 'Gambar inti', en: 'Core pictures' },
    tier: 'free',
    lessonIds: CORE_IDS,
    blurb: { id: 'Gambar yang sudah ada di beranda.', en: 'The pictures already on the home screen.' },
  },
  {
    id: 'nusantara',
    name: { id: 'Nusantara', en: 'Nusantara' },
    tier: 'premium',
    lessonIds: NUSANTARA_LESSONS.map((lesson) => lesson.id),
    blurb: { id: 'Gambar dari Indonesia.', en: 'Pictures from Indonesia.' },
  },
];

const BY_ID = new Map(NUSANTARA_LESSONS.map((lesson) => [lesson.id, lesson]));

export function packById(id: string): ContentPack | undefined {
  return PACKS.find((pack) => pack.id === id);
}

export function lessonsIn(pack: ContentPack): readonly LessonPackage[] {
  if (pack.id === 'inti') return lessonsForPicker();
  return pack.lessonIds.flatMap((id) => {
    const lesson = BY_ID.get(id);
    return lesson ? [lesson] : [];
  });
}
