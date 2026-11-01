/**
 * Doodle from a photo: the child picks a picture, waits, then either
 * follows the steps or traces the line drawing.
 */

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/context';
import { say } from '../i18n/generated';
import type { LessonPackage } from '../lesson-data/schema';
import { encodePng } from '../photo/png';
import { TargetPreview } from '../ui/TargetPreview';
import { requestDoodle } from './client';
import { prepareDoodlePhoto } from './prepare';
import { buildDoodleLesson } from './steps';

interface ReadyDoodle {
  readonly lesson: LessonPackage;
  readonly previewUrl: string;
}

interface DoodleFlowProps {
  readonly onCancel: () => void;
  readonly onFollow: (lesson: LessonPackage) => void;
  readonly onTrace: (lesson: LessonPackage, previewUrl: string) => void;
}

export function DoodleFlow({ onCancel, onFollow, onTrace }: DoodleFlowProps) {
  const { t, locale } = useI18n();
  const [phase, setPhase] = useState<'choose' | 'working' | 'ready' | 'error'>('choose');
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

  const start = async (file: File) => {
    setPhase('working');
    setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 55_000);
    try {
      const prepared = await prepareDoodlePhoto(file);
      const doodle = await requestDoodle(prepared.jpeg, controller.signal);
      const lesson = buildDoodleLesson(doodle, prepared.photo);
      const png = await encodePng(doodle);
      const copy = new Uint8Array(png.byteLength);
      copy.set(png);
      setReady({ lesson, previewUrl: URL.createObjectURL(new Blob([copy], { type: 'image/png' })) });
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
              if (file) void start(file);
            }}
          />
        </label>
      )}
      {phase === 'working' && <p role="status">{t('doodleWorking')}</p>}
      {phase === 'error' && (
        <p className="banner banner--warning" role="alert">{say(locale, error)}</p>
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
            <button type="button" className="button button--primary" onClick={() => onFollow(ready.lesson)}>
              {t('doodleFollow')}
            </button>
            <button type="button" className="button" onClick={() => { handedOff.current = true; onTrace(ready.lesson, ready.previewUrl); }}>
              {t('doodleTrace')}
            </button>
          </div>
        </>
      )}
      <button type="button" className="button" onClick={onCancel}>{t('doodleBack')}</button>
    </section>
  );
}
