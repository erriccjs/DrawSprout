import { BUNDLED_LESSONS } from '../lesson-data';

interface LessonPickerProps {
  readonly onSelect: (lessonId: string) => void;
  readonly notice: string | null;
  /** True only after the worker has stored and checked the whole shell. */
  readonly offlineReady: boolean;
  /** `applying` means a reload was requested and lesson choices wait for it. */
  readonly updatePhase: 'hidden' | 'prompt' | 'applying';
  readonly onApplyUpdate: () => void;
  readonly onDismissUpdate: () => void;
}

export function LessonPicker({
  onSelect,
  notice,
  offlineReady,
  updatePhase,
  onApplyUpdate,
  onDismissUpdate,
}: LessonPickerProps) {
  return (
    <section className="lesson-picker" aria-labelledby="lesson-picker-title">
      <h1 id="lesson-picker-title">Mau gambar apa hari ini?</h1>
      <p>Pilih gambar yang kamu suka, lalu ikuti langkahnya.</p>
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
        {BUNDLED_LESSONS.map((lesson) => (
          <button
            className="lesson-picker__choice"
            key={lesson.id}
            type="button"
            disabled={updatePhase === 'applying'}
            onClick={() => onSelect(lesson.id)}
          >
            <svg
              className="lesson-picker__picture"
              viewBox={`0 0 ${lesson.coordinateSpace.width} ${lesson.coordinateSpace.height}`}
              role="img"
              aria-label={`Gambar ${lesson.title}`}
            >
              {lesson.targetPreview.paths.map((path) => (
                <path
                  key={path.id}
                  d={path.d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
            <span className="lesson-picker__name">{lesson.title}</span>
            <span className="lesson-picker__subtitle">{lesson.subtitle}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
