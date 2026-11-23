/**
 * A read-only page for a grown-up. Everything on it is already on this device.
 */

import { useEffect, useState } from 'react';
import { getPlayableLesson } from '../categories/library';
import { loadDaily, localDayNumber, visibleStreak } from '../daily/challenge';
import { useI18n } from '../i18n/context';
import { presentLesson } from '../i18n/present';
import type { LessonStamp, SavedArtworkSummary, SessionStore } from '../persistence/types';

interface ParentDashboardProps {
  readonly store: SessionStore;
  readonly onClose: () => void;
}

export function ParentDashboard({ store, onClose }: ParentDashboardProps) {
  const { t, locale } = useI18n();
  const [stamps, setStamps] = useState<readonly LessonStamp[]>([]);
  const [artworks, setArtworks] = useState<readonly SavedArtworkSummary[]>([]);
  const [failed, setFailed] = useState(false);
  const streak = visibleStreak(loadDaily(), localDayNumber(new Date()));

  useEffect(() => {
    let cancelled = false;
    void Promise.all([store.listStamps(), store.listSavedArtworks()]).then(([savedStamps, savedArt]) => {
      if (cancelled) return;
      setStamps(savedStamps);
      setArtworks(savedArt);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const finished = artworks.filter((artwork) => artwork.finished);
  const finishedLessons = new Set(finished.map((artwork) => artwork.lessonId)).size;
  const recent = finished.slice(0, 6);

  return (
    <section className="parent-dash" aria-labelledby="parent-dash-title">
      <h1 id="parent-dash-title">{t('parentDash')}</h1>
      {failed && <p className="banner banner--warning">{t('galleryLoadError')}</p>}
      <ul className="parent-dash__counts">
        <li>{t('parentFinished', { count: finishedLessons })}</li>
        <li>{t('parentStamps', { count: stamps.length })}</li>
        <li>{streak > 0 ? t('parentStreak', { count: streak }) : t('parentNoStreak')}</li>
      </ul>
      <h2>{t('parentRecent')}</h2>
      {recent.length === 0 && <p>{t('parentNoPictures')}</p>}
      {recent.length > 0 && (
        <ul>
          {recent.map((artwork) => (
            <li key={artwork.sessionId}>{lessonTitle(artwork.lessonId, locale)}</li>
          ))}
        </ul>
      )}
      <p>{t('parentTime')}</p>
      <h2>{t('parentPrivacyTitle')}</h2>
      <p>{t('parentPrivacyBody')}</p>
      <div className="button-row">
        <button type="button" className="button" onClick={onClose}>{t('back')}</button>
      </div>
    </section>
  );
}

function lessonTitle(lessonId: string, locale: 'en' | 'id'): string {
  try {
    return presentLesson(getPlayableLesson(lessonId), locale).title;
  } catch {
    return lessonId;
  }
}
