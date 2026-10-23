/**
 * The step's target picture, kept off the instruction card.
 *
 * Tablet landscape has room beside the sheet, so the picture is a card in the
 * top-left corner, above the brush slider. Portrait and phone keep a small
 * thumbnail that opens a large preview. A tap on that preview closes it.
 * The picture is never the child's artwork (PRD section 9).
 */

import { useLayoutEffect, useState } from 'react';
import { useI18n } from '../i18n/context';
import type { LessonPackage, LessonStep } from '../lesson-data/schema';
import { referencePresentation } from './reference-spot';
import { TargetPreview } from './TargetPreview';
import { useLayoutTier } from './useLayoutTier';

function useLandscape(): boolean {
  const [landscape, setLandscape] = useState(() => window.innerWidth > window.innerHeight);
  useLayoutEffect(() => {
    const update = () => setLandscape(window.innerWidth > window.innerHeight);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return landscape;
}

interface StepReferenceProps {
  readonly lesson: LessonPackage;
  readonly step: LessonStep;
  /** Tests pin a presentation. The pad omits this and follows the viewport. */
  readonly presentation?: 'card' | 'thumb';
}

export function StepReference({ lesson, step, presentation }: StepReferenceProps) {
  const { t } = useI18n();
  const layout = useLayoutTier();
  const landscape = useLandscape();
  const spot = presentation ?? referencePresentation(layout, landscape);
  const [open, setOpen] = useState(false);
  const preview = () => (
    <TargetPreview
      space={lesson.coordinateSpace}
      paths={lesson.targetPreview.paths}
      title={lesson.title}
      step={step}
      steps={lesson.steps}
      colorRegions={lesson.colorRegions}
    />
  );

  return (
    <>
      <button
        type="button"
        className={`step-reference step-reference--${spot}`}
        aria-label={t('enlargeExample')}
        onClick={() => setOpen(true)}
      >
        {preview()}
      </button>
      {open && (
        <div
          className="example-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t('bigExample')}
          onClick={() => setOpen(false)}
        >
          <button type="button" className="button example-lightbox__close" onClick={() => setOpen(false)}>
            {t('closeExample')}
          </button>
          {preview()}
        </div>
      )}
    </>
  );
}
