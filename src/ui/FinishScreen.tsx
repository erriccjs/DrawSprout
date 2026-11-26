/**
 * The finish screen: look at the artwork, save it, or go back and keep drawing.
 *
 * The preview and the PNG come from the same `renderArtworkToCanvas` call the
 * export uses, so what the child sees here is exactly what gets saved — guides
 * and the target illustration included in neither (FR-14, AT-01).
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import { AlivePicture, type AliveHandle } from './AlivePicture';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { useI18n } from '../i18n/context';
import { presentLesson } from '../i18n/present';
import { motionPreference, type MotionPreference } from './motion';
import type { LessonPackage } from '../lesson-data/schema';
import type { SessionState } from '../lesson-engine/types';
import { artworkFileName, exportArtworkPng, renderArtworkToCanvas, type ExportUnderlay } from '../renderer/export';
import { formatShareDate } from '../share/date';
import { shareOrDownload } from '../share/file';
import { shareArtworkFile } from '../share/frame';
import { ClearArtworkPrompt } from './ClearArtworkPrompt';
import { Mascot } from './Mascot';
import { ParentGate } from './ParentGate';
import { parentUnlocked } from './parent-session';
import { PrintBook } from './PrintBook';
import { toRenderStrokes } from './render-adapter';
import { feedbackAlreadySent, rememberFeedback, recordUsage } from '../usage/client';

interface FinishScreenProps {
  readonly lesson: LessonPackage;
  readonly state: SessionState;
  readonly clipPaths: Record<string, string>;
  readonly onKeepDrawing: () => void;
  readonly onDrawFreely: () => void;
  readonly onChoosePicture: () => void;
  readonly onStartFresh: () => void;
  readonly restartError: string | null;
  /** When set, the saved PNG and the preview include the tracing photo. */
  readonly underlay?: ExportUnderlay;
  readonly includePhoto?: boolean;
  readonly onIncludePhoto?: (include: boolean) => void;
  /** Doodle tracing uses the doodle words on the save checkbox. */
  readonly traceSource?: 'photo' | 'doodle';
}

export function FinishScreen({ lesson, state, clipPaths, onKeepDrawing, onDrawFreely, onChoosePicture, onStartFresh, restartError, underlay, includePhoto = false, onIncludePhoto, traceSource }: FinishScreenProps) {
  const { t, locale } = useI18n();
  const shown = useMemo(() => presentLesson(lesson, locale), [lesson, locale]);
  const aliveRef = useRef<AliveHandle>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [askingToClear, setAskingToClear] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(() => feedbackAlreadySent(lesson.id));
  const [motion, setMotion] = useState<MotionPreference>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'full';
    return motionPreference(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  });
  const [shareGate, setShareGate] = useState<'png' | 'motion' | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [printArt, setPrintArt] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setMotion(motionPreference(query.matches));
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const shareFile = (file: File, fileName: string) => {
    void shareOrDownload(file, shown.title, `${shown.title} — ${formatShareDate(new Date(), locale)}`).then((result) => {
      if (result === 'cancelled') return;
      recordUsage('share_picture', lesson.id);
      setShareStatus(result === 'shared' ? t('shareSent') : t('shareDownloaded', { name: fileName }));
    });
  };

  const shareMotion = () => {
    setExportError(null);
    setShareStatus(null);
    const pending = aliveRef.current?.record() ?? Promise.resolve(null);
    void pending.then((blob) => {
      if (!blob || blob.size === 0) {
        shareNow();
        return;
      }
      const extension = blob.type.includes('mp4') ? '.mp4' : '.webm';
      const fileName = artworkFileName(shown.title).replace(/\.png$/, extension);
      shareFile(new File([blob], fileName, { type: blob.type || 'video/webm' }), fileName);
    }).catch(() => {
      shareNow();
    });
  };

  const artworkCanvas = () => renderArtworkToCanvas({
    space: lesson.coordinateSpace,
    strokes: toRenderStrokes(state.strokes),
    clipPaths,
    ...(underlay ? { underlay } : {}),
  });

  const shareNow = () => {
    setExportError(null);
    setShareStatus(null);
    try {
      const dateLabel = formatShareDate(new Date(), locale);
      const fileName = artworkFileName(shown.title);
      const file = shareArtworkFile(artworkCanvas(), shown.title, dateLabel, fileName);
      shareFile(file, fileName);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : t('shareFailed'));
    }
  };

  const save = async () => {
    setExportError(null);
    try {
      const blob = await exportArtworkPng({
        space: lesson.coordinateSpace,
        strokes: toRenderStrokes(state.strokes),
        clipPaths,
        ...(underlay ? { underlay } : {}),
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
      <Mascot mood="cheer" />
      <h1 className="finish__title">{t('finishTitle')}</h1>
      <p className="finish__lead">
        {t('finishLead')}
      </p>

      <div className="finish__preview">
        <AlivePicture
          lesson={lesson}
          strokes={state.strokes}
          clipPaths={clipPaths}
          {...(underlay ? { underlay } : {})}
          label={t('yourArtwork', { title: shown.title })}
          autoPlay={motion === 'full'}
          className="finish__canvas"
          handle={aliveRef}
          onPlay={() => recordUsage('animation_play', lesson.id)}
        />
      </div>

      {onIncludePhoto && (
        <label className="trace-controls__include">
          <input
            type="checkbox"
            checked={includePhoto}
            onChange={(event) => onIncludePhoto(event.target.checked)}
          />
          {t(traceSource === 'doodle' ? 'doodleTraceInclude' : 'traceInclude')}
        </label>
      )}

      <div className="finish__actions">
        <button type="button" className="button button--primary" onClick={() => void save()}>
          {t('savePicture')}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            if (parentUnlocked()) shareNow();
            else setShareGate('png');
          }}
        >
          {t('share')}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            if (parentUnlocked()) shareMotion();
            else setShareGate('motion');
          }}
        >
          {t('shareMotion')}
        </button>
        <button type="button" className="button" onClick={() => aliveRef.current?.replay()}>
          {t('moveAgain')}
        </button>
        <button type="button" className="button" onClick={() => setPrintArt(artworkCanvas())}>
          {t('print')}
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

      {shareGate !== null && (
        <ParentGate
          onPass={() => {
            const kind = shareGate;
            setShareGate(null);
            if (kind === 'motion') shareMotion();
            else shareNow();
          }}
          onCancel={() => setShareGate(null)}
        />
      )}
      {printArt !== null && (
        <PrintBook
          lesson={lesson}
          artwork={printArt}
          onClose={() => setPrintArt(null)}
          onExported={() => recordUsage('print_sheet', lesson.id)}
        />
      )}

      {shareStatus !== null && <p className="banner" role="status">{shareStatus}</p>}
      {savedName !== null && (
        <p className="banner" role="status">
          {t('downloadSent', { name: savedName })}
        </p>
      )}
      {exportError !== null && (
        <p className="banner banner--warning">{t('saveImageFailed', { detail: exportError })}</p>
      )}
      {restartError !== null && <p className="banner banner--warning" role="alert">{t('restartFailed')}</p>}

      <div className="finish__feedback">
        {feedbackSent ? (
          <p role="status">{t('feedbackThanks')}</p>
        ) : (
          <>
            <p>{t('feedbackAsk')}</p>
            <button type="button" className="finish__feedback-button" aria-label={t('feedbackUp')} onClick={() => sendFeedback(true)}>
              👍
            </button>
            <button type="button" className="finish__feedback-button" aria-label={t('feedbackDown')} onClick={() => sendFeedback(false)}>
              👎
            </button>
          </>
        )}
      </div>
    </div>
  );

  function sendFeedback(up: boolean): void {
    if (feedbackSent) return;
    setFeedbackSent(true);
    rememberFeedback(lesson.id);
    recordUsage(up ? 'feedback_up' : 'feedback_down', lesson.id);
  }
}
