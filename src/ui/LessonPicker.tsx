import { useRef, useState } from 'react';
import {
  BEGINNER_PATH,
  THEME_ORDER,
  lessonDifficulty,
  lessonTheme,
  nextBeginnerLesson,
  type Difficulty,
  type ThemeId,
} from '../categories/growth';
import { lessonsForPicker } from '../categories/library';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { useI18n } from '../i18n/context';
import { say } from '../i18n/generated';
import { presentLesson } from '../i18n/present';
import { PREVIEW_INK, stepPreview } from '../lesson-data/step-preview';
import type { LessonPackage } from '../lesson-data/schema';
import type { MessageKey } from '../i18n/messages';
import type { PhotoLessonRecord } from '../persistence/photo-lesson-store';

interface LessonPickerProps {
  readonly onSelect: (lessonId: string) => void;
  readonly onTrace: (file: File | null) => void;
  readonly onDoodle: () => void;
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
  /** Lesson ids that already have a stamp. */
  readonly stamps?: readonly string[];
  readonly onFreeDraw?: () => void;
  readonly onOpenAlbum?: () => void;
}

export function LessonPicker({
  onSelect,
  onTrace,
  onDoodle,
  notice,
  offlineReady,
  updatePhase,
  onApplyUpdate,
  onDismissUpdate,
  photoBeta = false,
  photoLessons = [],
  onCreatePhoto,
  onDeletePhoto,
  stamps = [],
  onFreeDraw,
  onOpenAlbum,
}: LessonPickerProps) {
  const traceInput = useRef<HTMLInputElement>(null);
  const { t, locale } = useI18n();
  const [traceHint, setTraceHint] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [stampsOpen, setStampsOpen] = useState(false);
  const applying = updatePhase === 'applying';
  const lessons = lessonsForPicker();
  const stamped = new Set(stamps);
  const nextId = nextBeginnerLesson(lessons.map((lesson) => lesson.id), stamps);
  const pathLessons = BEGINNER_PATH.flatMap((id) => {
    const lesson = lessons.find((item) => item.id === id);
    return lesson ? [lesson] : [];
  });
  const groups = THEME_ORDER.flatMap((theme) => {
    const items = lessons.filter((lesson) => lessonTheme(lesson.id) === theme);
    return items.length > 0 ? [{ theme, items }] : [];
  });
  return (
    <section className="lesson-picker" aria-labelledby="lesson-picker-title">
      <LanguageSwitch />
      <h1 id="lesson-picker-title">{t('pickerTitle')}</h1>
      <p>{t('pickerLead')}</p>
      <div className="button-row home-actions">
        {nextId && (
          <button type="button" className="button button--primary" disabled={applying} onClick={() => onSelect(nextId)}>
            {t('startHere')}
          </button>
        )}
        <button type="button" className="button" disabled={applying} onClick={() => onFreeDraw?.()}>
          {t('freeDrawHome')}
        </button>
        <button type="button" className="button" onClick={() => onOpenAlbum?.()}>
          {t('albumJump')}
        </button>
        <button
          type="button"
          className="button"
          aria-expanded={stampsOpen}
          onClick={() => setStampsOpen((open) => !open)}
        >
          {t('stampsTitle')}
        </button>
      </div>
      {pathLessons.length > 0 && (
        <section className="beginner-path" aria-labelledby="beginner-path-title">
          <h2 id="beginner-path-title">{t('startHere')}</h2>
          <p>{t('startHereLead')}</p>
          <div className="beginner-path__steps">
            {pathLessons.map((lesson, index) => {
              const shown = presentLesson(lesson, locale);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  className="beginner-path__step"
                  disabled={applying}
                  onClick={() => onSelect(lesson.id)}
                >
                  <span className="beginner-path__number">{index + 1}</span>
                  <span className="beginner-path__title">{shown.title}</span>
                  <span className="difficulty-badge difficulty-badge--easy">{t('difficultyEasy')}</span>
                  {stamped.has(lesson.id) && <span className="lesson-picker__stamp">{t('stampMark')}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {stampsOpen && (
        <section className="stamp-book" aria-labelledby="stamp-book-title">
          <h2 id="stamp-book-title">{t('stampsCount', { count: stamps.length })}</h2>
          {stamps.length === 0 && <p>{t('stampsEmpty')}</p>}
          {stamps.length > 0 && (
            <ul className="stamp-book__list">
              {stamps.map((id) => {
                const lesson = lessons.find((item) => item.id === id);
                const title = lesson ? presentLesson(lesson, locale).title : id;
                return <li key={id}>{t('stampMark')} {title}</li>;
              })}
            </ul>
          )}
        </section>
      )}
      <div className="lesson-picker__photo">
        <button type="button" className="button button--primary" onClick={onDoodle}>
          {t('doodlePhoto')}
        </button>
        <button
          type="button"
          className="button"
          aria-describedby="trace-photo-note"
          onClick={() => {
            setTraceHint(t('traceOpening'));
            traceInput.current?.click();
          }}
        >
          {t('tracePhoto')}
        </button>
        <input
          ref={traceInput}
          className="sr-only"
          type="file"
          accept="image/*"
          aria-label={t('traceChoose')}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            setTraceHint(null);
            onTrace(file);
          }}
        />
        <p id="trace-photo-note" className="lesson-picker__photo-note">{t('traceStaysHere')}</p>
        <p className="lesson-picker__photo-note">{t('doodleUsesServer')}</p>
        {traceHint && <p className="banner" role="status">{traceHint}</p>}
      </div>
      {notice && <p className="banner" role="status">{say(locale, notice)}</p>}
      {offlineReady && (
        <p className="lesson-picker__offline">{t('offlineReady')}</p>
      )}
      <p className="lesson-picker__privacy">{t('usageNote')}</p>
      {updatePhase !== 'hidden' && (
        <div className="banner update-prompt" role="status" aria-busy={updatePhase === 'applying'}>
          {updatePhase === 'applying' ? (
            <p>{t('updateLoading')}</p>
          ) : (
            <>
              <p>{t('updateReady')}</p>
              <div className="update-prompt__actions">
                <button type="button" className="button" onClick={onDismissUpdate}>{t('later')}</button>
                <button type="button" className="button button--primary" onClick={onApplyUpdate}>
                  {t('loadUpdate')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {groups.map((group) => (
        <section key={group.theme} className="lesson-group" aria-labelledby={`theme-${group.theme}`}>
          <h2 id={`theme-${group.theme}`}>{t(themeKey(group.theme))}</h2>
          <div className="lesson-picker__choices">
            {group.items.map((lesson) => (
              <LessonChoice
                key={lesson.id}
                lesson={lesson}
                stamped={stamped.has(lesson.id)}
                disabled={applying}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
      {photoBeta && onCreatePhoto && (
        <div className="lesson-picker__photo">
          <button type="button" className="button" disabled={applying} onClick={onCreatePhoto}>
            {t('createFromPhoto')}
          </button>
        </div>
      )}
      {photoBeta && (
        <div className="lesson-picker__photo-lessons">
          <h2>{t('fromPhoto')}</h2>
          {deleteError && <p className="banner banner--warning" role="alert">{say(locale, deleteError)}</p>}
          {photoLessons.length === 0 && <p>{t('noPhotoLessons')}</p>}
          {photoLessons.length > 0 && (
            <div className="lesson-picker__choices">
              {photoLessons.map((record) => {
                const shown = presentLesson(record.lesson, locale);
                return (
                <div className="lesson-picker__photo-card" key={record.id}>
                  <button
                    className="lesson-picker__choice"
                    type="button"
                    disabled={applying}
                    onClick={() => onSelect(record.lesson.id)}
                  >
                    <LessonPicture lesson={shown} />
                    <span className="lesson-picker__name">{shown.title}</span>
                    <span className="lesson-picker__subtitle">{shown.subtitle}</span>
                  </button>
                  {confirmingId === record.id ? (
                    <div className="lesson-picker__photo-confirm" role="group" aria-label={t('deletePhotoLesson')}>
                      <p>{t('deletePhotoLesson')}</p>
                      <button type="button" className="button" onClick={() => setConfirmingId(null)}>{t('cancel')}</button>
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
                        {t('delete')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button"
                      disabled={applying}
                      aria-label={t('deleteLesson', { title: shown.title })}
                      onClick={() => setConfirmingId(record.id)}
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LessonChoice({
  lesson,
  stamped,
  disabled,
  onSelect,
}: {
  readonly lesson: LessonPackage;
  readonly stamped: boolean;
  readonly disabled: boolean;
  readonly onSelect: (lessonId: string) => void;
}) {
  const { t, locale } = useI18n();
  const shown = presentLesson(lesson, locale);
  const difficulty = lessonDifficulty(lesson.id);
  return (
    <button
      className="lesson-picker__choice"
      type="button"
      disabled={disabled}
      onClick={() => onSelect(lesson.id)}
    >
      <LessonPicture lesson={shown} />
      <span className="lesson-picker__name">{shown.title}</span>
      <span className="lesson-picker__meta">
        <span className={`difficulty-badge difficulty-badge--${difficulty}`}>{t(difficultyKey(difficulty))}</span>
        {stamped && <span className="lesson-picker__stamp">{t('stampMark')}</span>}
      </span>
      <span className="lesson-picker__subtitle">{shown.subtitle}</span>
    </button>
  );
}

function difficultyKey(level: Difficulty): MessageKey {
  if (level === 'easy') return 'difficultyEasy';
  if (level === 'hard') return 'difficultyHard';
  return 'difficultyMedium';
}

function themeKey(theme: ThemeId): MessageKey {
  if (theme === 'nature') return 'themeNature';
  if (theme === 'animals') return 'themeAnimals';
  if (theme === 'people') return 'themePeople';
  return 'themeThings';
}

/** The finished coloured drawing, used as the tile picture. */
function LessonPicture({ lesson }: { readonly lesson: LessonPackage }) {
  const { t } = useI18n();
  const preview = stepPreview(lesson, Math.max(0, lesson.steps.length - 1));
  return (
    <svg
      className="lesson-picker__picture"
      viewBox={`0 0 ${lesson.coordinateSpace.width} ${lesson.coordinateSpace.height}`}
      role="img"
      aria-label={t('pictureOf', { title: lesson.title })}
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
