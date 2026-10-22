import { useState } from 'react';
import { lessonsForPicker } from '../categories/library';
import { PREVIEW_INK, stepPreview } from '../lesson-data/step-preview';
import type { LessonPackage } from '../lesson-data/schema';
import type { PhotoLessonRecord } from '../persistence/photo-lesson-store';

interface LessonPickerProps {
  readonly onSelect: (lessonId: string) => void;
  readonly onPhoto: () => void;
  readonly notice: string | null;
  /** True only after the worker has stored and checked the whole shell. */
  readonly offlineReady: boolean;
  /** `applying` means a reload was requested and lesson choices wait for it. */
  readonly updatePhase: 'hidden' | 'prompt' | 'applying';
  readonly onApplyUpdate: () => void;
  readonly onDismissUpdate: () => void;
  /** Parent photo spike. Off unless `?beta=foto` was set for this tab. */
  readonly photoBeta?: boolean;
  readonly photoLessons?: readonly PhotoLessonRecord[];
  readonly onCreatePhoto?: () => void;
  readonly onDeletePhoto?: (lessonId: string) => Promise<void>;
}

export function LessonPicker({
  onSelect,
  onPhoto,
  notice,
  offlineReady,
  updatePhase,
  onApplyUpdate,
  onDismissUpdate,
  photoBeta = false,
  photoLessons = [],
  onCreatePhoto,
  onDeletePhoto,
}: LessonPickerProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const applying = updatePhase === 'applying';
  return (
    <section className="lesson-picker" aria-labelledby="lesson-picker-title">
      <h1 id="lesson-picker-title">Mau gambar apa hari ini?</h1>
      <p>Pilih gambar yang kamu suka, lalu ikuti langkahnya.</p>
      <button type="button" className="button button--primary lesson-picker__photo" onClick={onPhoto}>
        Gambar dari foto
      </button>
      {notice && <p className="banner" role="status">{notice}</p>}
      {offlineReady && (
        <p className="lesson-picker__offline">Bisa dibuka tanpa internet.</p>
      )}
      {updatePhase !== 'hidden' && (
        <div className="banner update-prompt" role="status" aria-busy={updatePhase === 'applying'}>
          {updatePhase === 'applying' ? (
            <p>Memuat versi baru…</p>
          ) : (
            <>
              <p>Ada versi baru. Gambar yang sudah tersimpan tetap ada.</p>
              <div className="update-prompt__actions">
                <button type="button" className="button" onClick={onDismissUpdate}>Nanti saja</button>
                <button type="button" className="button button--primary" onClick={onApplyUpdate}>
                  Muat versi baru
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <div className="lesson-picker__choices">
        {lessonsForPicker().map((lesson) => (
          <button
            className="lesson-picker__choice"
            key={lesson.id}
            type="button"
            disabled={applying}
            onClick={() => onSelect(lesson.id)}
          >
            <LessonPicture lesson={lesson} />
            <span className="lesson-picker__name">{lesson.title}</span>
            <span className="lesson-picker__subtitle">{lesson.subtitle}</span>
          </button>
        ))}
      </div>
      {photoBeta && onCreatePhoto && (
        <div className="lesson-picker__photo">
          <button type="button" className="button" disabled={applying} onClick={onCreatePhoto}>
            Buat dari foto
          </button>
        </div>
      )}
      {photoBeta && (
        <div className="lesson-picker__photo-lessons">
          <h2>Dari foto</h2>
          {deleteError && <p className="banner banner--warning" role="alert">{deleteError}</p>}
          {photoLessons.length === 0 && <p>Belum ada pelajaran dari foto.</p>}
          {photoLessons.length > 0 && (
            <div className="lesson-picker__choices">
              {photoLessons.map((record) => (
                <div className="lesson-picker__photo-card" key={record.id}>
                  <button
                    className="lesson-picker__choice"
                    type="button"
                    disabled={applying}
                    onClick={() => onSelect(record.lesson.id)}
                  >
                    <LessonPicture lesson={record.lesson} />
                    <span className="lesson-picker__name">{record.lesson.title}</span>
                    <span className="lesson-picker__subtitle">{record.lesson.subtitle}</span>
                  </button>
                  {confirmingId === record.id ? (
                    <div className="lesson-picker__photo-confirm" role="group" aria-label="Hapus pelajaran foto ini?">
                      <p>Hapus pelajaran foto ini?</p>
                      <button type="button" className="button" onClick={() => setConfirmingId(null)}>Batal</button>
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => {
                          if (!onDeletePhoto) return;
                          void onDeletePhoto(record.id).then(() => {
                            setConfirmingId(null);
                            setDeleteError(null);
                          }).catch(() => setDeleteError('Pelajaran foto belum terhapus. Coba lagi.'));
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button"
                      disabled={applying}
                      aria-label={`Hapus pelajaran ${record.lesson.title}`}
                      onClick={() => setConfirmingId(record.id)}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** The finished coloured drawing, used as the tile picture. */
function LessonPicture({ lesson }: { readonly lesson: LessonPackage }) {
  const preview = stepPreview(lesson, Math.max(0, lesson.steps.length - 1));
  return (
    <svg
      className="lesson-picker__picture"
      viewBox={`0 0 ${lesson.coordinateSpace.width} ${lesson.coordinateSpace.height}`}
      role="img"
      aria-label={`Gambar ${lesson.title}`}
    >
      {preview.fills.map((fill) => (
        <path key={fill.id} d={fill.d} fill={fill.fill === 'paper' ? 'var(--paper)' : fill.fill} stroke="none" />
      ))}
      {preview.strokes.map((stroke) => (
        <path
          key={stroke.id}
          d={stroke.d}
          fill="none"
          stroke={PREVIEW_INK[stroke.kind]}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
