import { BUNDLED_LESSONS } from '../lesson-data';

interface LessonPickerProps {
  readonly onSelect: (lessonId: string) => void;
  readonly notice: string | null;
}

export function LessonPicker({ onSelect, notice }: LessonPickerProps) {
  return (
    <section className="lesson-picker" aria-labelledby="lesson-picker-title">
      <h1 id="lesson-picker-title">Mau gambar apa hari ini?</h1>
      <p>Pilih gambar yang kamu suka, lalu ikuti langkahnya.</p>
      {notice && <p className="banner" role="status">{notice}</p>}
      <div className="lesson-picker__choices">
        {BUNDLED_LESSONS.map((lesson) => (
          <button
            className="lesson-picker__choice"
            key={lesson.id}
            type="button"
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
