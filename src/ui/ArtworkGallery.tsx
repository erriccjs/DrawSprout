/**
 * Karyaku: saved drawings on the picture-choosing screen (FR-14).
 *
 * The list comes from the session store. Each card paints the committed
 * strokes only, then offers open, PNG export, and delete-with-confirmation.
 */

import { useEffect, useState } from 'react';
import { getLesson } from '../lesson-data';
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
      <h2 id="artwork-gallery-title">Karyaku</h2>
      {loadError && <p className="banner banner--warning">Daftar karya belum bisa dibuka.</p>}
      {artworks?.length === 0 && <p className="artwork-gallery__empty">Belum ada karya tersimpan.</p>}
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
  const lesson = lookupLesson(artwork.lessonId, extraLessons);
  const title = lesson?.title ?? 'Pelajaran lama';
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
        paintArtworkThumbnail(pictureHost, lesson, strokes);
      } catch {
        /* A broken log leaves the card usable for delete. */
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pictureHost, lesson, store, artwork.sessionId]);

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
        {formatArtworkWhen(artwork.updatedAt)}
      </time>
      <div className="artwork-card__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={actionsDisabled}
          aria-label={`Buka ${title}`}
          onClick={() => onOpen(artwork.sessionId)}
        >
          Buka
        </button>
        <button
          type="button"
          className="button"
          disabled={actionsDisabled || lesson === null}
          aria-label={`Simpan PNG ${title}`}
          onClick={() => void savePng()}
        >
          Simpan PNG
        </button>
        {!confirming && (
          <button
            type="button"
            className="button"
            disabled={actionsDisabled}
            aria-label={`Hapus ${title}`}
            onClick={() => setConfirming(true)}
          >
            Hapus
          </button>
        )}
      </div>
      {confirming && (
        <div className="artwork-card__confirm" role="group" aria-label="Hapus karya ini?">
          <p>Hapus karya ini?</p>
          <div className="artwork-card__actions">
            <button type="button" className="button" onClick={() => setConfirming(false)}>Batal</button>
            <button type="button" className="button button--primary" onClick={() => void remove()}>Hapus</button>
          </div>
        </div>
      )}
      {exportName !== null && (
        <p className="banner" role="status">
          File {exportName} dikirim ke unduhan browser.
        </p>
      )}
      {error !== null && <p className="banner banner--warning" role="alert">{error}</p>}
    </li>
  );
}

function lookupLesson(lessonId: string, extraLessons: readonly LessonPackage[]): LessonPackage | null {
  const extra = extraLessons.find((lesson) => lesson.id === lessonId);
  if (extra) return extra;
  try {
    return getLesson(lessonId);
  } catch {
    return null;
  }
}
