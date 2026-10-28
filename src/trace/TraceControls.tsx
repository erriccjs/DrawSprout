/**
 * Controls a child uses while tracing. The photo stays still unless they
 * choose to move it.
 */

import { useRef } from 'react';
import { useI18n } from '../i18n/context';
import { scalePhoto } from './placement';
import type { TraceSession } from './types';

interface TraceControlsProps {
  readonly trace: TraceSession;
  readonly spaceWidth: number;
  readonly spaceHeight: number;
  readonly onChange: (patch: Partial<TraceSession>) => void;
}

export function TraceControls({ trace, spaceWidth, spaceHeight, onChange }: TraceControlsProps) {
  const { t } = useI18n();
  const scaleRef = useRef(1);
  return (
    <div className="trace-controls">
      <label>
        {t('traceOpacity')}
        <input
          type="range"
          min={0.1}
          max={0.8}
          step={0.05}
          value={trace.opacity}
          aria-valuetext={t('traceOpacity')}
          onChange={(event) => onChange({ opacity: Number(event.target.value) })}
        />
      </label>
      <button type="button" className="button" aria-pressed={trace.visible} onClick={() => onChange({ visible: !trace.visible })}>
        {trace.visible ? t('traceHide') : t('traceShow')}
      </button>
      <button type="button" className="button" aria-pressed={trace.locked} onClick={() => onChange({ locked: !trace.locked })}>
        {trace.locked ? t('traceUnlock') : t('traceLock')}
      </button>
      {!trace.locked && (
        <label>
          {t('traceScale')}
          <input
            type="range"
            min={0.7}
            max={1.4}
            step={0.05}
            defaultValue={1}
            aria-valuetext={t('traceScale')}
            onChange={(event) => {
              const next = Number(event.target.value);
              const factor = next / scaleRef.current;
              scaleRef.current = next;
              onChange({ placement: scalePhoto(trace.placement, factor, spaceWidth, spaceHeight) });
            }}
          />
        </label>
      )}
      <label className="trace-controls__include">
        <input
          type="checkbox"
          checked={trace.includeInExport}
          onChange={(event) => onChange({ includeInExport: event.target.checked })}
        />
        {t('traceInclude')}
      </label>
    </div>
  );
}
