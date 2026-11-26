/**
 * Buku Gambarku: saved drawings on the picture-choosing screen (FR-14).
 *
 * The list comes from the session store. Each card paints the committed
 * strokes only, then offers open, PNG export, and delete-with-confirmation.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { getPlayableLesson } from '../categories/library';
import { useI18n } from '../i18n/context';
import { say } from '../i18n/generated';
import { presentLesson } from '../i18n/present';
import type { LessonPackage } from '../lesson-data/schema';
import type { Stroke } from '../lesson-engine/types';
import { fromRestoredSession } from '../persistence/mapping';
import type { SavedArtworkSummary, SessionStore } from '../persistence/types';
import { artworkFileName, renderArtworkToCanvas } from '../renderer/export';
import { formatShareDate } from '../share/date';
import { shareOrDownload } from '../share/file';
import { shareArtworkFile } from '../share/frame';
import { recordUsage } from '../usage/client';
import { downloadArtwork, formatArtworkWhen, paintArtworkThumbnail } from './artwork-files';
import { ParentGate } from './ParentGate';
import { parentUnlocked } from './parent-session';
import { AlivePicture, type AliveHandle } from './AlivePicture';
import { PrintBook } from './PrintBook';
import { clipPathsFromLesson, toRenderStrokes } from './render-adapter';

interface ArtworkGalleryProps {
  readonly store: SessionStore;
  readonly actionsDisabled: boolean;
  readonly onOpen: (sessionId: string) => void;
  /** Bumped when an exit save finishes, so a new picture appears without a reload. */
  readonly reloadToken?: number;
  /** Photo lessons are not in the bundled catalogue. */
  readonly extraLessons?: readonly LessonPackage[];
}

export function ArtworkGallery({ store, actionsDisabled, onOpen, reloadToken = 0, extraLessons = [] }: ArtworkGalleryProps) {
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
  }, [store, revision, reloadToken]);

  return (
    <section className="artwork-gallery" id="buku-gambarku" aria-labelledby="artwork-gallery-title">
      <h2 id="artwork-gallery-title">{t('galleryTitle')}</h2>
      {loadError && <p className="banner banner--warning">{t('galleryLoadError')}</p>}
      {artworks?.length === 0 && <p className="artwork-gallery__empty">{t('galleryEmpty')}</p>}
      {artworks && artworks.some((artwork) => artwork.finished) && (
        <ul className="artwork-gallery__list">
          {artworks.filter((artwork) => artwork.finished).map((artwork) => (
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
      {artworks && artworks.some((artwork) => !artwork.finished) && (
        <>
          <h2>{t('stillDrawing')}</h2>
          <ul className="artwork-gallery__list">
            {artworks.filter((artwork) => !artwork.finished).map((artwork) => (
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
        </>
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
  const extraKey = extraLessons.map((item) => `${item.id}:${item.contentVersion}`).join(',');
  const lesson = useMemo(
    () => lookupLesson(artwork.lessonId, extraLessons),
    // The parent passes a fresh array when there are no photo lessons.
    // extraKey is the part that actually changes which package we show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [artwork.lessonId, extraKey],
  );
  const shown = useMemo(() => (lesson ? presentLesson(lesson, locale) : null), [lesson, locale]);
  const title = shown?.title ?? t('oldLesson');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<'delete' | 'share' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportName, setExportName] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pictureHost, setPictureHost] = useState<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<readonly Stroke[] | null>(null);
  const [printArt, setPrintArt] = useState<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const aliveRef = useRef<AliveHandle>(null);

  useEffect(() => {
    if (!pictureHost || !lesson || playing) return;
    let cancelled = false;
    void store.loadSession(artwork.sessionId).then((restored) => {
      if (cancelled || !restored) return;
      try {
        const restoredStrokes = fromRestoredSession(restored).strokes;
        setStrokes(restoredStrokes);
        paintArtworkThumbnail(pictureHost, lesson, restoredStrokes, t('artworkNamed', { title }));
      } catch {
        /* A broken log leaves the card usable for delete. */
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pictureHost, lesson, store, artwork.sessionId, t, title, playing]);

  const painted = () => {
    if (!lesson || !strokes) return null;
    return renderArtworkToCanvas({
      space: lesson.coordinateSpace,
      strokes: toRenderStrokes(strokes),
      clipPaths: clipPathsFromLesson(lesson),
    });
  };

  const shareNow = () => {
    const artwork = painted();
    if (!lesson || !artwork || !shown) return;
    setError(null);
    setShareError(null);
    setShareStatus(null);
    try {
      const dateLabel = formatShareDate(new Date(), locale);
      const fileName = artworkFileName(shown.title);
      const file = shareArtworkFile(artwork, shown.title, dateLabel, fileName);
      void shareOrDownload(file, shown.title, `${shown.title} — ${dateLabel}`).then((result) => {
        if (result === 'cancelled') return;
        recordUsage('share_picture', lesson.id);
        setShareStatus(result === 'shared' ? t('shareSent') : t('shareDownloaded', { name: fileName }));
      });
    } catch (cause) {
      setShareError(cause instanceof Error ? cause.message : t('shareFailed'));
    }
  };

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
      <div className="artwork-card__picture">
        {playing && lesson && strokes ? (
          <AlivePicture
            lesson={lesson}
            strokes={strokes}
            clipPaths={clipPathsFromLesson(lesson)}
            label={t('artworkNamed', { title })}
            autoPlay
            className="artwork-card__canvas"
            handle={aliveRef}
            onPlay={() => recordUsage('animation_play', lesson.id)}
          />
        ) : (
          <div className="artwork-card__still" ref={setPictureHost} />
        )}
      </div>
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
          disabled={actionsDisabled || lesson === null || strokes === null}
          aria-label={t('moveNamed', { title })}
          onClick={() => {
            if (playing) aliveRef.current?.replay();
            else setPlaying(true);
          }}
        >
          {t('moveAgain')}
        </button>
        <button
          type="button"
          className="button"
          disabled={actionsDisabled || lesson === null || strokes === null}
          aria-label={t('shareNamed', { title })}
          onClick={() => {
            if (parentUnlocked()) shareNow();
            else setPending('share');
          }}
        >
          {t('share')}
        </button>
        <button
          type="button"
          className="button"
          disabled={actionsDisabled || lesson === null || strokes === null}
          aria-label={t('printNamed', { title })}
          onClick={() => {
            const artwork = painted();
            if (artwork) setPrintArt(artwork);
          }}
        >
          {t('print')}
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
        <div className="artwork-card__more">
          <button
            type="button"
            className="button artwork-card__more-button"
            disabled={actionsDisabled}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('moreFor', { title })}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ···
          </button>
          {menuOpen && (
            <div className="artwork-card__menu" role="menu">
              <button
                type="button"
                className="button"
                role="menuitem"
                aria-label={t('deleteNamed', { title })}
                onClick={() => {
                  setMenuOpen(false);
                  if (parentUnlocked()) setConfirming(true);
                  else setPending('delete');
                }}
              >
                {t('delete')}
              </button>
            </div>
          )}
        </div>
      </div>
      {pending !== null && (
        <ParentGate
          onPass={() => {
            const action = pending;
            setPending(null);
            if (action === 'delete') setConfirming(true);
            else shareNow();
          }}
          onCancel={() => setPending(null)}
        />
      )}
      {printArt !== null && lesson !== null && (
        <PrintBook
          lesson={lesson}
          artwork={printArt}
          onClose={() => setPrintArt(null)}
          onExported={() => recordUsage('print_sheet', lesson.id)}
        />
      )}
      {confirming && (
        <div className="artwork-card__confirm" role="group" aria-label={t('deleteArtworkQuestion')}>
          <p>{t('deleteArtworkQuestion')}</p>
          <div className="artwork-card__actions">
            <button type="button" className="button" onClick={() => setConfirming(false)}>{t('cancel')}</button>
            <button type="button" className="button button--primary" onClick={() => void remove()}>{t('delete')}</button>
          </div>
        </div>
      )}
      {shareStatus !== null && <p className="banner" role="status">{shareStatus}</p>}
      {shareError !== null && <p className="banner banner--warning" role="alert">{shareError}</p>}
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
