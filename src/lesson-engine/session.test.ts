import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeClipRegionIds,
  activeLayerId,
  activeStep,
  effectiveToolPreset,
  guideOverlayMode,
  reduceSession,
  sessionPhase,
} from './session';
import { applyAll, draw, lesson, newSessionState, stepIdAt } from '../test/factories';
import type { SessionState } from './types';

describe('step navigation', () => {
  let state: SessionState;
  beforeEach(() => {
    state = newSessionState();
  });

  it('starts on the first step', () => {
    expect(state.currentStepIndex).toBe(0);
    expect(activeStep(lesson, state).id).toBe('head-outline');
  });

  it('moves forward and back without asking how the drawing looks (FR-09, AT-04)', () => {
    const forward = applyAll(state, [{ type: 'next-step' }, { type: 'next-step' }]);
    expect(activeStep(lesson, forward).id).toBe('body');

    const back = reduceSession(lesson, forward, { type: 'prev-step' });
    expect(activeStep(lesson, back).id).toBe('ears');
  });

  it('refuses to step past either end of the lesson', () => {
    expect(reduceSession(lesson, state, { type: 'prev-step' })).toBe(state);

    const last = applyAll(
      state,
      lesson.steps.slice(1).map(() => ({ type: 'next-step' }) as const),
    );
    expect(last.currentStepIndex).toBe(lesson.steps.length - 1);
    expect(reduceSession(lesson, last, { type: 'next-step' })).toBe(last);
  });

  it('keeps strokes from later steps when the child goes back (FR-09)', () => {
    const drawn = draw(draw(state, stepIdAt(0)), stepIdAt(0));
    const forward = reduceSession(lesson, drawn, { type: 'next-step' });
    const drawnLater = draw(forward, stepIdAt(1));
    const back = reduceSession(lesson, drawnLater, { type: 'prev-step' });

    expect(back.strokes).toHaveLength(3);
    expect(back.strokes.filter((stroke) => stroke.stepId === stepIdAt(1))).toHaveLength(1);
  });
});

describe('session state machine', () => {
  it('walks not_started to drawing to coloring to completed', () => {
    const fresh = newSessionState();
    expect(sessionPhase(lesson, fresh)).toBe('not_started');

    const drawing = draw(fresh, stepIdAt(0));
    expect(sessionPhase(lesson, drawing)).toBe('drawing');

    const colorIndex = lesson.steps.findIndex((step) => step.phase === 'color');
    const coloring = applyAll(
      drawing,
      Array.from({ length: colorIndex }, () => ({ type: 'next-step' }) as const),
    );
    expect(sessionPhase(lesson, coloring)).toBe('coloring');

    const done = reduceSession(lesson, coloring, { type: 'finish' });
    expect(sessionPhase(lesson, done)).toBe('completed');
    // "Selesai" is the child's declaration, never inferred from the artwork
    // (PRD section 12).
    expect(done.finished).toBe(true);
    expect(reduceSession(lesson, done, { type: 'reopen' }).finished).toBe(false);
  });

  it('puts colour steps on the colour layer and the rest on ink', () => {
    const fresh = newSessionState();
    expect(activeLayerId(lesson, fresh)).toBe('ink');

    const colorIndex = lesson.steps.findIndex((step) => step.phase === 'color');
    const coloring = applyAll(
      fresh,
      Array.from({ length: colorIndex }, () => ({ type: 'next-step' }) as const),
    );
    expect(activeLayerId(lesson, coloring)).toBe('color');
  });
});

describe('tool presets and colour preference', () => {
  it('hands over the step preset by default (FR-03)', () => {
    const state = newSessionState();
    expect(effectiveToolPreset(lesson, state)).toEqual(lesson.steps[0]!.toolPreset);
  });

  it('keeps a chosen colour across steps until the guide colour is asked for (FR-04)', () => {
    const chosen = applyAll(newSessionState(), [
      { type: 'set-custom-color', color: '#8a5bd6' },
      { type: 'next-step' },
      { type: 'next-step' },
    ]);
    expect(effectiveToolPreset(lesson, chosen).color).toBe('#8a5bd6');

    const backToGuide = reduceSession(lesson, chosen, { type: 'use-guide-color' });
    expect(effectiveToolPreset(lesson, backToGuide).color).toBe(lesson.steps[2]!.toolPreset.color);
    // The custom colour is remembered, not discarded, so re-picking it is one tap.
    expect(backToGuide.toolPreferences.customColor).toBe('#8a5bd6');
  });

  it('drops a width override when the step changes, since the next step has its own scale', () => {
    const wide = applyAll(newSessionState(), [{ type: 'set-custom-width', width: 40 }]);
    expect(effectiveToolPreset(lesson, wide).widthViewbox).toBe(40);

    const next = reduceSession(lesson, wide, { type: 'next-step' });
    expect(next.toolPreferences.customWidth).toBeNull();
    expect(effectiveToolPreset(lesson, next).widthViewbox).toBe(lesson.steps[1]!.toolPreset.widthViewbox);
  });

  it('hands the step its own tool, so an eraser does not follow the child into colouring (FR-03)', () => {
    const erasingOnDetail = applyAll(newSessionState(), [
      { type: 'next-step' },
      { type: 'next-step' },
      { type: 'next-step' },
      { type: 'next-step' },
      { type: 'next-step' },
      { type: 'set-tool', tool: 'eraser' },
    ]);
    expect(activeStep(lesson, erasingOnDetail).id).toBe('eyes-nose');
    expect(effectiveToolPreset(lesson, erasingOnDetail).tool).toBe('eraser');

    const colouring = applyAll(erasingOnDetail, [
      { type: 'next-step' },
      { type: 'next-step' },
    ]);
    const step = activeStep(lesson, colouring);
    expect(step.id).toBe('color-fur');
    // The colour step paints with the tool it authored, at its own width, not
    // with the eraser that fixed a line two steps ago.
    const preset = effectiveToolPreset(lesson, colouring);
    expect(preset.tool).toBe(step.toolPreset.tool);
    expect(preset.widthViewbox).toBe(step.toolPreset.widthViewbox);
  });

  it('still lets the child pick a different tool within a step', () => {
    const onColourStep = applyAll(
      newSessionState(),
      lesson.steps.slice(1).map(() => ({ type: 'next-step' }) as const),
    );
    const erasing = reduceSession(lesson, onColourStep, { type: 'set-tool', tool: 'eraser' });
    expect(effectiveToolPreset(lesson, erasing).tool).toBe('eraser');
  });

  it('gives the eraser a wider default than the pen it replaces', () => {
    const erasing = reduceSession(lesson, newSessionState(), { type: 'set-tool', tool: 'eraser' });
    const preset = effectiveToolPreset(lesson, erasing);
    expect(preset.tool).toBe('eraser');
    expect(preset.widthViewbox).toBe(lesson.steps[0]!.toolPreset.widthViewbox * 2);
  });
});

describe('assistance, input mode and colour boundaries', () => {
  it('maps each assistance mode to an overlay behaviour (FR-06, FR-07, FR-08)', () => {
    expect(guideOverlayMode('visible')).toBe('persistent');
    expect(guideOverlayMode('temporary')).toBe('timed');
    expect(guideOverlayMode('independent')).toBe('on-request');
  });

  it('never touches the artwork when the assistance mode changes', () => {
    const drawn = draw(draw(newSessionState(), stepIdAt(0)), stepIdAt(0));
    const changed = reduceSession(lesson, drawn, { type: 'set-assistance-mode', mode: 'independent' });
    expect(changed.strokes).toBe(drawn.strokes);
    expect(changed.currentStepIndex).toBe(drawn.currentStepIndex);
  });

  it('never resets the artwork when the input mode changes (FR-22)', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const switched = reduceSession(lesson, drawn, { type: 'set-input-mode', mode: 'pencil' });
    expect(switched.inputMode).toBe('pencil');
    expect(switched.strokes).toBe(drawn.strokes);
  });

  it('drops the colouring boundary as soon as the child switches it off (FR-11)', () => {
    const colorIndex = lesson.steps.findIndex((step) => step.id === 'color-face');
    const coloring = applyAll(
      newSessionState(),
      Array.from({ length: colorIndex }, () => ({ type: 'next-step' }) as const),
    );
    expect(activeClipRegionIds(lesson, coloring)).toEqual(['inner-ear-left', 'inner-ear-right', 'nose']);

    const unassisted = reduceSession(lesson, coloring, { type: 'set-boundary-assist', enabled: false });
    expect(activeClipRegionIds(lesson, unassisted)).toEqual([]);
  });

  it('has no boundary to apply on a line step', () => {
    expect(activeClipRegionIds(lesson, newSessionState())).toEqual([]);
  });
});
