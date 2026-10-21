/**
 * Instruction, step navigation and assistance controls
 * (FR-05, FR-07, FR-08, FR-09).
 *
 * Navigation is always available in both directions and never asks how close
 * the drawing is to the example (FR-09, AT-04). Nothing here judges the child's
 * work.
 */

import { useState } from 'react';
import type { LessonPackage, LessonStep } from '../lesson-data/schema';
import { drawingStepId } from '../lesson-engine/session';
import type { AssistanceMode, HintDurationMs, SessionAction, SessionState } from '../lesson-engine/types';
import { ClearArtworkPrompt } from './ClearArtworkPrompt';

const ASSISTANCE_CHOICES: readonly { mode: AssistanceMode; label: string; help: string }[] = [
  { mode: 'visible', label: 'Garis terlihat', help: 'Garis tetap tampil.' },
  { mode: 'temporary', label: 'Petunjuk sementara', help: 'Garis tampil sebentar.' },
  { mode: 'independent', label: 'Mandiri', help: 'Tanpa garis di kanvas.' },
];

const HINT_DURATIONS: readonly HintDurationMs[] = [3000, 5000, 10000];

interface StepPanelProps {
  readonly lesson: LessonPackage;
  readonly state: SessionState;
  readonly step: LessonStep;
  /** Phones open folded so the instruction does not cover the paper. */
  readonly startCollapsed?: boolean;
}

interface StepNavigationProps {
  readonly lesson: LessonPackage;
  readonly state: SessionState;
  readonly onFinish: () => void;
  readonly dispatch: (action: SessionAction) => void;
}

interface StepControlsProps {
  readonly state: SessionState;
  readonly guidesVisible: boolean;
  readonly onShowHint: () => void;
  readonly dispatch: (action: SessionAction) => void;
}

export function StepPanel({
  lesson,
  state,
  step,
  startCollapsed = false,
}: StepPanelProps) {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const stepNumber = state.currentStepIndex + 1;
  const stepCount = lesson.steps.length;

  return (
    <div className="step-panel" data-collapsed={collapsed}>
      <div className="step-panel__header">
        <p className="step-panel__counter">
          <span className="sr-only">
            Tahap {stepNumber} dari {stepCount}
            <span className="step-panel__phase"> · {phaseLabel(step.phase)}</span>
          </span>
          <span className="step-dots" aria-hidden="true">
            {lesson.steps.map((item, index) => (
              <span
                key={item.id}
                className="step-dots__dot"
                data-state={index === state.currentStepIndex ? 'current' : index < state.currentStepIndex ? 'done' : 'ahead'}
              />
            ))}
          </span>
        </p>
        {!collapsed && <h2 className="step-panel__instruction">{step.instruction}</h2>}
        {!collapsed && step.hint !== undefined && <p className="step-panel__hint">{step.hint}</p>}
      </div>

      <button
        type="button"
        className="step-card__toggle"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Tampilkan langkah' : 'Sembunyikan langkah'}
        onClick={() => setCollapsed((current) => !current)}
      >
        <span aria-hidden="true">{collapsed ? '▴' : '▾'}</span>
      </button>
    </div>
  );
}

export function StepNavigation({ lesson, state, onFinish, dispatch }: StepNavigationProps) {
  const isLastStep = state.currentStepIndex === lesson.steps.length - 1;
  const inFreeDraw = state.freeCreation;

  return (
    <div className="step-panel__nav">
      <button
        type="button"
        className="button"
        disabled={!inFreeDraw && state.currentStepIndex === 0}
        onClick={() => dispatch(inFreeDraw ? { type: 'leave-free-creation' } : { type: 'prev-step' })}
      >
        <span aria-hidden="true">← </span>
        <span className="button__text">Kembali</span>
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
  );
}

export function StepControls({ state, guidesVisible, onShowHint, dispatch }: StepControlsProps) {
  return (
    <div className="step-controls">
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

interface LessonEditsProps {
  readonly lesson: LessonPackage;
  readonly state: SessionState;
  readonly dispatch: (action: SessionAction) => void;
  readonly onRestart: () => void;
}

/**
 * In-lesson edits live in the help sheet so the dock stays the same width.
 * "Ulangi langkah ini" is one undoable action. "Mulai ulang" asks first.
 */
export function LessonEdits({ lesson, state, dispatch, onRestart }: LessonEditsProps) {
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const stepId = drawingStepId(lesson, state);
  const canRepeat = state.strokes.some((stroke) => stroke.stepId === stepId);
  const onLastStep = state.currentStepIndex === lesson.steps.length - 1;

  return (
    <fieldset className="lesson-edits">
      <legend>Langkah ini</legend>
      {onLastStep && !state.freeCreation && (
        <button type="button" className="button" onClick={() => dispatch({ type: 'enter-free-creation' })}>
          Gambar bebas
        </button>
      )}
      <button
        type="button"
        className="button"
        disabled={!canRepeat}
        onClick={() => dispatch({ type: 'clear-step' })}
      >
        Ulangi langkah ini
      </button>
      {confirmingRestart ? (
        <ClearArtworkPrompt
          compact
          label="Mulai ulang karya"
          onKeep={() => setConfirmingRestart(false)}
          onClear={onRestart}
        />
      ) : (
        <button
          type="button"
          className="button"
          aria-label="Mulai ulang karya"
          onClick={() => setConfirmingRestart(true)}
        >
          Mulai ulang
        </button>
      )}
    </fieldset>
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
