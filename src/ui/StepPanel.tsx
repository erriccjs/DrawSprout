/**
 * Instruction, step navigation and assistance controls
 * (FR-05, FR-07, FR-08, FR-09).
 *
 * Navigation is always available in both directions and never asks how close
 * the drawing is to the example (FR-09, AT-04). Nothing here judges the child's
 * work.
 */

import type { LessonPackage, LessonStep } from '../lesson-data/schema';
import type { AssistanceMode, HintDurationMs, SessionAction, SessionState } from '../lesson-engine/types';
import { TargetPreview } from './TargetPreview';

const ASSISTANCE_CHOICES: readonly { mode: AssistanceMode; label: string; help: string }[] = [
  { mode: 'visible', label: 'Garis terlihat', help: 'Garis putus-putus tetap tampil.' },
  { mode: 'temporary', label: 'Petunjuk sementara', help: 'Garis tampil sebentar, lalu hilang.' },
  { mode: 'independent', label: 'Mandiri', help: 'Hanya contoh di panel, tanpa garis di kanvas.' },
];

const HINT_DURATIONS: readonly HintDurationMs[] = [3000, 5000, 10000];

interface StepPanelProps {
  readonly lesson: LessonPackage;
  readonly state: SessionState;
  readonly step: LessonStep;
  readonly guidesVisible: boolean;
  readonly onShowHint: () => void;
  readonly onFinish: () => void;
  readonly dispatch: (action: SessionAction) => void;
}

export function StepPanel({
  lesson,
  state,
  step,
  guidesVisible,
  onShowHint,
  onFinish,
  dispatch,
}: StepPanelProps) {
  const stepNumber = state.currentStepIndex + 1;
  const stepCount = lesson.steps.length;
  const isLastStep = state.currentStepIndex === stepCount - 1;

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <p className="step-panel__counter">
          Tahap {stepNumber} dari {stepCount}
          <span className="step-panel__phase"> · {phaseLabel(step.phase)}</span>
        </p>
        <h2 className="step-panel__instruction">{step.instruction}</h2>
        {step.hint !== undefined && <p className="step-panel__hint">{step.hint}</p>}
      </div>

      <div className="step-panel__nav">
        <button
          type="button"
          className="button"
          disabled={state.currentStepIndex === 0}
          onClick={() => dispatch({ type: 'prev-step' })}
        >
          ← Kembali
        </button>
        {isLastStep ? (
          <button type="button" className="button button--primary" onClick={onFinish}>
            Selesai ✓
          </button>
        ) : (
          <button
            type="button"
            className="button button--primary"
            onClick={() => dispatch({ type: 'next-step' })}
          >
            Lanjut →
          </button>
        )}
      </div>

      <TargetPreview
        space={lesson.coordinateSpace}
        paths={lesson.targetPreview.paths}
        title={lesson.title}
        step={step}
        colorRegions={lesson.colorRegions}
      />

      <fieldset className="step-panel__group">
        <legend>Bantuan</legend>
        {ASSISTANCE_CHOICES.map((choice) => (
          <label key={choice.mode} className="radio">
            <input
              type="radio"
              name="assistance"
              value={choice.mode}
              checked={state.assistanceMode === choice.mode}
              onChange={() => dispatch({ type: 'set-assistance-mode', mode: choice.mode })}
            />
            <span>
              {choice.label}
              <small>{choice.help}</small>
            </span>
          </label>
        ))}

        <button type="button" className="button" onClick={onShowHint}>
          {guidesVisible ? 'Tampilkan petunjuk lagi' : 'Tampilkan petunjuk'}
        </button>

        {state.assistanceMode !== 'visible' && (
          <label className="field">
            Lama petunjuk
            <select
              value={state.hintDurationMs}
              onChange={(event) =>
                dispatch({
                  type: 'set-hint-duration',
                  ms: Number(event.target.value) as HintDurationMs,
                })
              }
            >
              {HINT_DURATIONS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms / 1000} detik
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
    </div>
  );
}

function phaseLabel(phase: LessonStep['phase']): string {
  switch (phase) {
    case 'outline':
      return 'bentuk besar';
    case 'detail':
      return 'detail';
    case 'color':
      return 'mewarnai';
  }
}
