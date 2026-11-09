/**
 * The choice before a lesson that already has a saved picture.
 *
 * A brand-new lesson never reaches this screen. Continue opens the saved
 * attempt. Start new begins at step 1 and leaves the saved picture where it is.
 */

import { useI18n } from '../i18n/context';
import { presentLesson } from '../i18n/present';
import type { LessonPackage } from '../lesson-data/schema';

interface ResumeChoiceProps {
  readonly lesson: LessonPackage;
  readonly finished: boolean;
  readonly onContinue: () => void;
  readonly onStartNew: () => void;
  readonly onBack: () => void;
}

export function ResumeChoice({ lesson, finished, onContinue, onStartNew, onBack }: ResumeChoiceProps) {
  const { t, locale } = useI18n();
  const shown = presentLesson(lesson, locale);
  return (
    <section className="resume-choice" aria-labelledby="resume-choice-title">
      <h1 id="resume-choice-title">{shown.title}</h1>
      <p>{finished ? t('resumeLeadDone') : t('resumeLeadProgress')}</p>
      <div className="resume-choice__actions">
        <button type="button" className="resume-choice__action button button--primary" onClick={onContinue}>
          <ResumeIcon kind={finished ? 'picture' : 'continue'} />
          <span>{finished ? t('seePicture') : t('continueLesson')}</span>
        </button>
        <button type="button" className="resume-choice__action button" onClick={onStartNew}>
          <ResumeIcon kind="new" />
          <span>{t('startFreshAttempt')}</span>
        </button>
      </div>
      <button type="button" className="button" onClick={onBack}>{t('doodleBack')}</button>
    </section>
  );
}

function ResumeIcon({ kind }: { readonly kind: 'continue' | 'picture' | 'new' }) {
  const path = kind === 'new'
    ? 'M12 5v14M5 12h14'
    : kind === 'picture'
      ? 'M4 6h16v12H4zM8 14l2.5-3 2 2.5L16 9l4 5'
      : 'M8 5v14l11-7z';
  return (
    <svg className="resume-choice__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill={kind === 'continue' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
