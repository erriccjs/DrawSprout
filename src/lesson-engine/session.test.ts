import { beforeEach, describe, expect, it } from 'vitest';
import {
  FREE_STEP_ID,
  activeClipRegionIds,
  activeLayerId,
  activeStep,
  canUndo,
  drawingStepId,
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
  it('restarts at the first step without strokes or redo history', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const later = reduceSession(lesson, drawn, { type: 'next-step' });
    const finished = reduceSession(lesson, later, { type: 'finish' });

    const restarted = reduceSession(lesson, finished, { type: 'restart' });
    expect(restarted.currentStepIndex).toBe(0);
    expect(restarted.strokes).toHaveLength(0);
    expect(restarted.redoStack).toHaveLength(0);
    expect(restarted.nextSequence).toBe(1);
    expect(restarted.finished).toBe(false);
  });

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

function onLastStep(): SessionState {
  return applyAll(
    newSessionState(),
    lesson.steps.slice(1).map(() => ({ type: 'next-step' }) as const),
  );
}

describe('free creation and repeating a step', () => {
  it('starts free drawing only on the last step, with no guide clip and every tool', () => {
    const fresh = newSessionState();
    expect(reduceSession(lesson, fresh, { type: 'enter-free-creation' })).toBe(fresh);

    const last = onLastStep();
    const free = reduceSession(lesson, last, { type: 'enter-free-creation' });
    expect(sessionPhase(lesson, free)).toBe('free_creation');
    expect(free.freeCreation).toBe(true);
    expect(free.strokes).toBe(last.strokes);
    expect(activeClipRegionIds(lesson, free)).toEqual([]);
    expect(drawingStepId(lesson, free)).toBe(FREE_STEP_ID);

    const pen = effectiveToolPreset(lesson, reduceSession(lesson, free, { type: 'set-tool', tool: 'pen' }));
    const brush = effectiveToolPreset(lesson, reduceSession(lesson, free, { type: 'set-tool', tool: 'brush' }));
    expect(pen.tool).toBe('pen');
    expect(pen.color).toBe('#3a3a3a');
    expect(activeLayerId(lesson, reduceSession(lesson, free, { type: 'set-tool', tool: 'pen' }))).toBe('ink');
    expect(brush.tool).toBe('brush');
    expect(activeLayerId(lesson, reduceSession(lesson, free, { type: 'set-tool', tool: 'brush' }))).toBe('color');
    expect(reduceSession(lesson, free, { type: 'leave-free-creation' }).freeCreation).toBe(false);

    const finished = reduceSession(lesson, last, { type: 'finish' });
    const continued = reduceSession(lesson, finished, { type: 'enter-free-creation' });
    expect(continued.finished).toBe(false);
    expect(continued.freeCreation).toBe(true);
  });

  it('repeats only the active step and one undo restores those strokes', () => {
    const first = draw(draw(newSessionState(), stepIdAt(0)), stepIdAt(0));
    const later = draw(reduceSession(lesson, first, { type: 'next-step' }), stepIdAt(1));
    const cleared = reduceSession(lesson, later, { type: 'clear-step' });

    expect(cleared.strokes.map((stroke) => stroke.stepId)).toEqual([stepIdAt(0), stepIdAt(0)]);
    expect(canUndo(lesson, cleared)).toBe(true);

    const restored = reduceSession(lesson, cleared, { type: 'undo' });
    expect(restored.strokes).toEqual(later.strokes);
    expect(restored.clearedSteps).toEqual([]);
  });

  it('does not let a free-drawing repeat delete the guided strokes', () => {
    const guided = draw(onLastStep(), stepIdAt(lesson.steps.length - 1));
    const free = reduceSession(lesson, guided, { type: 'enter-free-creation' });
    const withFreeStroke = reduceSession(lesson, free, {
      type: 'commit-stroke',
      stroke: {
        id: 'free-stroke',
        stepId: 'should-be-rewritten',
        layerId: 'ink',
        points: [{ x: 1, y: 1 }, { x: 4, y: 6 }],
        color: '#111111',
        width: 4,
        tool: 'pen',
        clipRegionIds: [],
      },
    });
    expect(withFreeStroke.strokes.map((stroke) => stroke.stepId)).toContain(FREE_STEP_ID);

    const repeated = reduceSession(lesson, withFreeStroke, { type: 'clear-step' });
    expect(repeated.strokes).toEqual(guided.strokes);
    expect(reduceSession(lesson, repeated, { type: 'undo' }).strokes.map((stroke) => stroke.id)).toContain('free-stroke');
  });

  it('drops the repeat when the picture is started over', () => {
    const cleared = reduceSession(lesson, draw(newSessionState(), stepIdAt(0)), { type: 'clear-step' });
    const restarted = reduceSession(lesson, cleared, { type: 'restart' });
    expect(restarted.clearedSteps).toEqual([]);
    expect(restarted.freeCreation).toBe(false);
    expect(canUndo(lesson, restarted)).toBe(false);
  });
});
