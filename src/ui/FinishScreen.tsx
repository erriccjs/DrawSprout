/**
 * The finish screen: look at the artwork, save it, or go back and keep drawing.
 *
 * The preview and the PNG come from the same `renderArtworkToCanvas` call the
 * export uses, so what the child sees here is exactly what gets saved — guides
 * and the target illustration included in neither (FR-14, AT-01).
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { useI18n } from '../i18n/context';
import { presentLesson } from '../i18n/present';
import { motionPreference, type MotionPreference } from './motion';
import type { LessonPackage } from '../lesson-data/schema';
import type { SessionState } from '../lesson-engine/types';
import { artworkFileName, exportArtworkPng, renderArtworkToCanvas } from '../renderer/export';
import { ClearArtworkPrompt } from './ClearArtworkPrompt';
import { toRenderStrokes } from './render-adapter';

interface FinishScreenProps {
  readonly lesson: LessonPackage;
  readonly state: SessionState;
  readonly clipPaths: Record<string, string>;
  readonly onKeepDrawing: () => void;
  readonly onDrawFreely: () => void;
  readonly onChoosePicture: () => void;
  readonly onStartFresh: () => void;
  readonly restartError: string | null;
}

/** Small enough to render instantly, large enough to look right on a tablet. */
const PREVIEW_WIDTH_PX = 900;

export function FinishScreen({ lesson, state, clipPaths, onKeepDrawing, onDrawFreely, onChoosePicture, onStartFresh, restartError }: FinishScreenProps) {
  const { t, locale } = useI18n();
  const shown = useMemo(() => presentLesson(lesson, locale), [lesson, locale]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [askingToClear, setAskingToClear] = useState(false);
  const [motion, setMotion] = useState<MotionPreference>('full');

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setMotion(motionPreference(query.matches));
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    const canvas = renderArtworkToCanvas({
      space: lesson.coordinateSpace,
      strokes: toRenderStrokes(state.strokes),
      clipPaths,
      pixelWidth: PREVIEW_WIDTH_PX,
    });
    canvas.className = 'finish__canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', t('yourArtwork', { title: shown.title }));
    host.replaceChildren(canvas);
  }, [lesson, state.strokes, clipPaths, shown.title, t]);

  const save = async () => {
    setExportError(null);
    try {
      const blob = await exportArtworkPng({
        space: lesson.coordinateSpace,
        strokes: toRenderStrokes(state.strokes),
        clipPaths,
      });
      const fileName = artworkFileName(shown.title);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      // Revoked on the next frame: revoking immediately can cancel the download
      // on some browsers.
      requestAnimationFrame(() => URL.revokeObjectURL(url));
      // Deliberately not phrased as "saved to Photos": PRD section 11 says not
      // to promise where a browser download ends up.
      setSavedName(fileName);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="finish">
      <div className="celebration" data-motion={motion} aria-hidden="true">
        <span /><span /><span />
      </div>
      <LanguageSwitch />
      <h1 className="finish__title">{t('finishTitle')}</h1>
      <p className="finish__lead">
        {t('finishLead')}
      </p>

      <div className="finish__preview" ref={previewRef} />

      <div className="finish__actions">
        <button type="button" className="button button--primary" onClick={() => void save()}>
          {t('savePicture')}
        </button>
        <button type="button" className="button" onClick={onDrawFreely}>
          {t('freeDraw')}
        </button>
        <button type="button" className="button" onClick={onChoosePicture}>
          {t('chooseAnother')}
        </button>
        {!askingToClear && (
          <button type="button" className="button" onClick={() => setAskingToClear(true)}>
            {t('drawAgain')}
          </button>
        )}
      </div>

      {askingToClear && (
        <ClearArtworkPrompt
          label={t('choiceDrawAgain')}
          onKeep={onKeepDrawing}
          onClear={onStartFresh}
        />
      )}

      {savedName !== null && (
        <p className="banner" role="status">
          {t('downloadSent', { name: savedName })}
        </p>
      )}
      {exportError !== null && (
        <p className="banner banner--warning">{t('saveImageFailed', { detail: exportError })}</p>
      )}
      {restartError !== null && <p className="banner banner--warning" role="alert">{t('restartFailed')}</p>}
    </div>
  );
}
