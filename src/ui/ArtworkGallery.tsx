/**
 * Karyaku: saved drawings on the picture-choosing screen (FR-14).
 *
 * The list comes from the session store. Each card paints the committed
 * strokes only, then offers open, PNG export, and delete-with-confirmation.
 */

import { useEffect, useMemo, useState } from 'react';
import { getPlayableLesson } from '../categories/library';
import { useI18n } from '../i18n/context';
import { say } from '../i18n/generated';
import { presentLesson } from '../i18n/present';
import type { LessonPackage } from '../lesson-data/schema';
import type { Stroke } from '../lesson-engine/types';
import { fromRestoredSession } from '../persistence/mapping';
import type { SavedArtworkSummary, SessionStore } from '../persistence/types';
import { downloadArtwork, formatArtworkWhen, paintArtworkThumbnail } from './artwork-files';

interface ArtworkGalleryProps {
  readonly store: SessionStore;
  readonly actionsDisabled: boolean;
  readonly onOpen: (sessionId: string) => void;
  /** Photo lessons are not in the bundled catalogue. */
  readonly extraLessons?: readonly LessonPackage[];
}

export function ArtworkGallery({ store, actionsDisabled, onOpen, extraLessons = [] }: ArtworkGalleryProps) {
  const { t } = useI18n();
  const [artworks, setArtworks] = useState<readonly SavedArtworkSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void store.listSavedArtworks().then((saved) => {
      if (cancelled) return;
      setArtworks(saved);
      setLoadError(false);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store, revision]);

  return (
    <section className="artwork-gallery" aria-labelledby="artwork-gallery-title">
      <h2 id="artwork-gallery-title">{t('galleryTitle')}</h2>
      {loadError && <p className="banner banner--warning">{t('galleryLoadError')}</p>}
      {artworks?.length === 0 && <p className="artwork-gallery__empty">{t('galleryEmpty')}</p>}
      {artworks && artworks.length > 0 && (
        <ul className="artwork-gallery__list">
          {artworks.map((artwork) => (
            <ArtworkCard
              key={artwork.sessionId}
              store={store}
              artwork={artwork}
              actionsDisabled={actionsDisabled}
              onOpen={onOpen}
              extraLessons={extraLessons}
              onDeleted={() => setRevision((current) => current + 1)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface ArtworkCardProps {
  readonly store: SessionStore;
  readonly artwork: SavedArtworkSummary;
  readonly actionsDisabled: boolean;
  readonly onOpen: (sessionId: string) => void;
  readonly extraLessons: readonly LessonPackage[];
  readonly onDeleted: () => void;
}

function ArtworkCard({ store, artwork, actionsDisabled, onOpen, extraLessons, onDeleted }: ArtworkCardProps) {
  const { t, locale } = useI18n();
  const lesson = lookupLesson(artwork.lessonId, extraLessons);
  const shown = useMemo(() => (lesson ? presentLesson(lesson, locale) : null), [lesson, locale]);
  const title = shown?.title ?? t('oldLesson');
  const [confirming, setConfirming] = useState(false);
  const [exportName, setExportName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pictureHost, setPictureHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pictureHost || !lesson) return;
    let cancelled = false;
    void store.loadSession(artwork.sessionId).then((restored) => {
      if (cancelled || !restored) return;
      try {
        const strokes = fromRestoredSession(restored).strokes;
        paintArtworkThumbnail(pictureHost, lesson, strokes, t('artworkNamed', { title }));
      } catch {
        /* A broken log leaves the card usable for delete. */
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pictureHost, lesson, store, artwork.sessionId, t, title]);

  const savePng = async () => {
    if (!lesson) return;
    setError(null);
    setExportName(null);
    try {
      const restored = await store.loadSession(artwork.sessionId);
      if (!restored) {
        setError('Karya ini tidak dapat disimpan.');
        return;
      }
      const strokes: readonly Stroke[] = fromRestoredSession(restored).strokes;
      const fileName = await downloadArtwork(lesson, strokes);
      setExportName(fileName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan gambar.');
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await store.deleteSession(artwork.sessionId);
      onDeleted();
    } catch {
      setError('Karya ini belum terhapus. Coba lagi.');
    }
  };

  return (
    <li className="artwork-card">
      <div className="artwork-card__picture" ref={setPictureHost} />
      <h3 className="artwork-card__title">{title}</h3>
      <time className="artwork-card__when" dateTime={new Date(artwork.updatedAt).toISOString()}>
        {formatArtworkWhen(artwork.updatedAt, undefined, locale)}
      </time>
      <div className="artwork-card__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={actionsDisabled}
          aria-label={t('openNamed', { title })}
          onClick={() => onOpen(artwork.sessionId)}
        >
          {t('open')}
        </button>
        <button
          type="button"
          className="button"
          disabled={actionsDisabled || lesson === null}
          aria-label={t('savePngNamed', { title })}
          onClick={() => void savePng()}
        >
          {t('savePng')}
        </button>
        {!confirming && (
          <button
            type="button"
            className="button"
            disabled={actionsDisabled}
            aria-label={t('deleteNamed', { title })}
            onClick={() => setConfirming(true)}
          >
            {t('delete')}
          </button>
        )}
      </div>
      {confirming && (
        <div className="artwork-card__confirm" role="group" aria-label={t('deleteArtworkQuestion')}>
          <p>{t('deleteArtworkQuestion')}</p>
          <div className="artwork-card__actions">
            <button type="button" className="button" onClick={() => setConfirming(false)}>{t('cancel')}</button>
            <button type="button" className="button button--primary" onClick={() => void remove()}>{t('delete')}</button>
          </div>
        </div>
      )}
      {exportName !== null && (
        <p className="banner" role="status">
          {t('downloadSentShort', { name: exportName })}
        </p>
      )}
      {error !== null && <p className="banner banner--warning" role="alert">{say(locale, error)}</p>}
    </li>
  );
}

function lookupLesson(lessonId: string, extraLessons: readonly LessonPackage[]): LessonPackage | null {
  const extra = extraLessons.find((lesson) => lesson.id === lessonId);
  if (extra) return extra;
  try {
    return getPlayableLesson(lessonId);
  } catch {
    return null;
  }
}
