/**
 * Place the photo on the paper before any line is drawn.
 * Drag moves it. The slider scales it. Nothing is uploaded.
 */

import { useRef } from 'react';
import { useI18n } from '../i18n/context';
import type { TracePlacement } from './placement';
import { movePhoto, scalePhoto } from './placement';

interface TraceSetupProps {
  readonly image: HTMLImageElement;
  readonly placement: TracePlacement;
  readonly spaceWidth: number;
  readonly spaceHeight: number;
  readonly onPlacement: (placement: TracePlacement) => void;
  readonly onStart: () => void;
  readonly onCancel: () => void;
}

export function TraceSetup({
  image,
  placement,
  spaceWidth,
  spaceHeight,
  onPlacement,
  onStart,
  onCancel,
}: TraceSetupProps) {
  const { t } = useI18n();
  const drag = useRef<{ x: number; y: number; placement: TracePlacement } | null>(null);
  const scaleRef = useRef(1);

  return (
    <section className="trace-setup">
      <h1>{t('tracePhoto')}</h1>
      <p>{t('tracePlace')}</p>
      <div
        className="trace-setup__paper"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, placement };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const unit = spaceWidth / Math.max(1, rect.width);
          onPlacement(movePhoto(
            start.placement,
            (event.clientX - start.x) * unit,
            (event.clientY - start.y) * unit,
            spaceWidth,
            spaceHeight,
          ));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <svg viewBox={`0 0 ${spaceWidth} ${spaceHeight}`} role="img" aria-label={t('tracePhoto')}>
          <image href={image.src} x={placement.x} y={placement.y} width={placement.width} height={placement.height} opacity={0.45} />
        </svg>
      </div>
      <label className="trace-setup__scale">
        {t('traceScale')}
        <input
          type="range"
          min={0.6}
          max={1.8}
          step={0.02}
          defaultValue={1}
          aria-valuetext={t('traceScale')}
          onChange={(event) => {
            const next = Number(event.target.value);
            const factor = next / scaleRef.current;
            scaleRef.current = next;
            onPlacement(scalePhoto(placement, factor, spaceWidth, spaceHeight));
          }}
        />
      </label>
      <div className="trace-setup__actions">
        <button type="button" className="button" onClick={onCancel}>{t('cancel')}</button>
        <button type="button" className="button button--primary" onClick={onStart}>{t('traceStart')}</button>
      </div>
    </section>
  );
}
