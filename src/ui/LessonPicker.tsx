import { useRef, useState } from 'react';
import { lessonsForPicker } from '../categories/library';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { useI18n } from '../i18n/context';
import { say } from '../i18n/generated';
import { presentLesson } from '../i18n/present';
import { PREVIEW_INK, stepPreview } from '../lesson-data/step-preview';
import type { LessonPackage } from '../lesson-data/schema';
import type { PhotoLessonRecord } from '../persistence/photo-lesson-store';

interface LessonPickerProps {
  readonly onSelect: (lessonId: string) => void;
  readonly onPhoto: () => void;
  readonly onTrace: (file: File) => void;
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
  onTrace,
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
  const traceInput = useRef<HTMLInputElement>(null);
  const { t, locale } = useI18n();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const applying = updatePhase === 'applying';
  return (
    <section className="lesson-picker" aria-labelledby="lesson-picker-title">
      <LanguageSwitch />
      <h1 id="lesson-picker-title">{t('pickerTitle')}</h1>
      <p>{t('pickerLead')}</p>
      <div className="lesson-picker__photo">
        <button type="button" className="button button--primary" onClick={onPhoto}>
          {t('drawFromPhoto')}
        </button>
        <button type="button" className="button" onClick={() => traceInput.current?.click()}>
          {t('tracePhoto')}
        </button>
        <input
          ref={traceInput}
          className="sr-only"
          type="file"
          accept="image/*"
          aria-label={t('traceChoose')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onTrace(file);
          }}
        />
      </div>
      {notice && <p className="banner" role="status">{say(locale, notice)}</p>}
      {offlineReady && (
        <p className="lesson-picker__offline">{t('offlineReady')}</p>
      )}
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
      <div className="lesson-picker__choices">
        {lessonsForPicker().map((lesson) => {
          const shown = presentLesson(lesson, locale);
          return (
            <button
              className="lesson-picker__choice"
              key={lesson.id}
              type="button"
              disabled={applying}
              onClick={() => onSelect(lesson.id)}
            >
              <LessonPicture lesson={shown} />
              <span className="lesson-picker__name">{shown.title}</span>
              <span className="lesson-picker__subtitle">{shown.subtitle}</span>
            </button>
          );
        })}
      </div>
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
