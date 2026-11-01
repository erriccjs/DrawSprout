/**
 * Doodle from a photo: the child picks a picture, frames the one subject,
 * waits, then either follows the steps or traces the line drawing.
 *
 * The crop is not decoration. The generator is small, and a photo of a whole
 * room gives it several subjects to choose between; the frame is how the
 * parent says which one. It also fixes the colour step, which reads the photo
 * at the doodle's own coordinates.
 */

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/context';
import { say } from '../i18n/generated';
import type { LessonPackage } from '../lesson-data/schema';
import { encodePng } from '../photo/png';
import { CropBox } from '../ui/CropBox';
import { clampCrop, DEFAULT_CROP, type NormalizedCrop } from '../photo/prepare';
import { TargetPreview } from '../ui/TargetPreview';
import { requestDoodle } from './client';
import { prepareDoodlePhoto } from './prepare';
import { buildDoodleLesson } from './steps';

interface ReadyDoodle {
  readonly lesson: LessonPackage;
  readonly previewUrl: string;
  readonly png: Uint8Array;
}

interface DoodleFlowProps {
  readonly onCancel: () => void;
  readonly onFollow: (lesson: LessonPackage, png: Uint8Array) => void;
  readonly onTrace: (lesson: LessonPackage, previewUrl: string, png: Uint8Array) => void;
}

export function DoodleFlow({ onCancel, onFollow, onTrace }: DoodleFlowProps) {
  const { t, locale } = useI18n();
  const [phase, setPhase] = useState<'choose' | 'crop' | 'working' | 'ready' | 'error'>('choose');
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const [crop, setCrop] = useState<NormalizedCrop>(DEFAULT_CROP);
  const [error, setError] = useState('');
  const [ready, setReady] = useState<ReadyDoodle | null>(null);
  const handedOff = useRef(false);
  const left = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    left.current = true;
    abortRef.current?.abort();
  }, []);

  useEffect(() => () => {
    if (!handedOff.current && ready) URL.revokeObjectURL(ready.previewUrl);
  }, [ready]);

  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url);
  }, [picked]);

  const choose = (file: File) => {
    setPicked((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return { file, url: URL.createObjectURL(file) };
    });
    setCrop(DEFAULT_CROP);
    setError('');
    setPhase('crop');
  };

  const start = async (file: File, frame: NormalizedCrop) => {
    setPhase('working');
    setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 55_000);
    try {
      const prepared = await prepareDoodlePhoto(file, clampCrop(frame));
      const doodle = await requestDoodle(prepared.jpeg, controller.signal);
      const lesson = buildDoodleLesson(doodle, prepared.photo);
      const png = await encodePng(doodle);
      const copy = new Uint8Array(png.byteLength);
      copy.set(png);
      setReady({ lesson, png: copy, previewUrl: URL.createObjectURL(new Blob([copy], { type: 'image/png' })) });
      setPhase('ready');
    } catch (cause) {
      if (left.current) return;
      const message = controller.signal.aborted
        ? 'Waktunya habis. Coba lagi.'
        : (cause instanceof Error ? cause.message : '');
      setError(message || t('doodleFailed'));
      setPhase('error');
    } finally {
      window.clearTimeout(timer);
    }
  };

  return (
    <section className="doodle-flow">
      <h1>{t('doodlePhoto')}</h1>
      <p>{t('doodleLead')}</p>
      {phase === 'choose' && (
        <label className="button button--primary doodle-flow__pick">
          {t('traceChoose')}
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) choose(file);
            }}
          />
        </label>
      )}
      {phase === 'crop' && picked && (
        <>
          <p>{t('cropLead')}</p>
          <CropBox crop={crop} imageUrl={picked.url} onChange={setCrop} />
          <div className="doodle-flow__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => void start(picked.file, crop)}
            >
              {t('useThisPart')}
            </button>
            <label className="button doodle-flow__pick">
              {t('changePhoto')}
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) choose(file);
                }}
              />
            </label>
          </div>
        </>
      )}
      {phase === 'working' && <p role="status">{t('doodleWorking')}</p>}
      {phase === 'error' && (
        <>
          <p className="banner banner--warning" role="alert">{say(locale, error)}</p>
          {picked && (
            <div className="doodle-flow__actions">
              <button type="button" className="button button--primary" onClick={() => setPhase('crop')}>
                {t('tryAgain')}
              </button>
            </div>
          )}
        </>
      )}
      {phase === 'ready' && ready && (
        <>
          <TargetPreview
            space={ready.lesson.coordinateSpace}
            paths={ready.lesson.targetPreview.paths}
            title={ready.lesson.title}
            step={ready.lesson.steps[0]!}
            steps={ready.lesson.steps}
            colorRegions={ready.lesson.colorRegions}
          />
          <div className="doodle-flow__actions">
            <button type="button" className="button button--primary" onClick={() => onFollow(ready.lesson, ready.png)}>
              {t('doodleFollow')}
            </button>
            <button type="button" className="button" onClick={() => { handedOff.current = true; onTrace(ready.lesson, ready.previewUrl, ready.png); }}>
              {t('doodleTrace')}
            </button>
          </div>
        </>
      )}
      <button type="button" className="button" onClick={onCancel}>{t('doodleBack')}</button>
    </section>
  );
}
