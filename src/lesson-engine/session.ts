/**
 * The session reducer and its selectors.
 *
 * Pure functions over plain data: no DOM, no canvas, no storage. Every UI
 * change the child can make goes through `reduceSession`, which keeps the
 * invariants the PRD cares about in one testable place.
 */

import type { LessonPackage, LessonStep, ToolPreset } from '../lesson-data/schema';
import type {
  AssistanceMode,
  SessionAction,
  SessionPhase,
  SessionPreferences,
  SessionState,
  Stroke,
} from './types';

export const DEFAULT_PREFERENCES: SessionPreferences = {
  // Visible dashed guides are the gentlest starting point; the child or the
  // parent can reduce help from there (PRD section 9.6).
  assistanceMode: 'visible',
  // PRD FR-07 proposes 5 s as the default temporary-hint duration.
  hintDurationMs: 5000,
  // Finger works on every target device; a stylus is never required
  // (PRD section 10: "Stylus tidak wajib").
  inputMode: 'finger',
  toolPreferences: {
    activeTool: 'pen',
    colorSource: 'guide',
    customColor: '#e8552d',
    customWidth: null,
    colorBoundaryAssist: true,
  },
};

export function createSession(
  lesson: LessonPackage,
  sessionId: string,
  preferences: SessionPreferences = DEFAULT_PREFERENCES,
): SessionState {
  return {
    sessionId,
    lessonId: lesson.id,
    lessonContentVersion: lesson.contentVersion,
    currentStepIndex: 0,
    assistanceMode: preferences.assistanceMode,
    hintDurationMs: preferences.hintDurationMs,
    inputMode: preferences.inputMode,
    toolPreferences: preferences.toolPreferences,
    strokes: [],
    redoStack: [],
    nextSequence: 1,
    clearedArtworks: [],
    clearedSteps: [],
    freeCreation: false,
    finished: false,
  };
}

/** Step id stored on strokes drawn after the guided lesson, never a lesson step. */
export const FREE_STEP_ID = 'free-creation';

/** The step id a new stroke, an undo, or "repeat this step" belongs to. */
export function drawingStepId(lesson: LessonPackage, state: SessionState): string {
  return state.freeCreation ? FREE_STEP_ID : activeStep(lesson, state).id;
}

export function reduceSession(
  lesson: LessonPackage,
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case 'commit-stroke': {
      const stroke: Stroke = {
        ...action.stroke,
        stepId: state.freeCreation ? FREE_STEP_ID : action.stroke.stepId,
        sequence: state.nextSequence,
      };
      return {
        ...state,
        strokes: [...state.strokes, stroke],
        // AT-07: a new stroke invalidates the old redo chain.
        redoStack: [],
        nextSequence: state.nextSequence + 1,
      };
    }

    case 'clear-all': {
      if (state.strokes.length === 0) return state;
      return {
        ...state,
        strokes: [],
        // Redo would otherwise bring one stroke back on its own, which is not
        // what "undo the clear" means. It is kept with the cleared artwork.
        redoStack: [],
        // `nextSequence` is deliberately left alone: the cleared strokes keep
        // their sequence numbers, so putting them back restores paint order.
        // Pushed, never replaced: a second clear leaves the first one still
        // reachable, as a later step of undo once the newer drawing is gone.
        clearedArtworks: [...state.clearedArtworks, { strokes: state.strokes, redoStack: state.redoStack }],
      };
    }

    case 'clear-step': {
      const stepId = drawingStepId(lesson, state);
      const removed = state.strokes.filter((stroke) => stroke.stepId === stepId);
      if (removed.length === 0) return state;
      return {
        ...state,
        strokes: state.strokes.filter((stroke) => stroke.stepId !== stepId),
        redoStack: [],
        clearedSteps: [...state.clearedSteps, { stepId, strokes: removed, redoStack: state.redoStack }],
      };
    }

    case 'undo': {
      // Undo is scoped to the active step so that navigating back and tapping
      // undo can never destroy work from a later step (FR-09).
      const stepId = drawingStepId(lesson, state);
      const index = lastIndexOfStep(state.strokes, stepId);
      if (index === -1) {
        const clearedAt = lastClearedStepIndex(state, stepId);
        if (clearedAt !== -1) return restoreClearedStep(state, clearedAt);
        // The whole-canvas clear is undone only while the canvas is empty, so a
        // restored drawing is never laid over another one.
        return state.strokes.length === 0 ? restoreClearedArtwork(state) : state;
      }
      const stroke = state.strokes[index]!;
      return {
        ...state,
        strokes: [...state.strokes.slice(0, index), ...state.strokes.slice(index + 1)],
        redoStack: [...state.redoStack, stroke],
      };
    }

    case 'redo': {
      const stroke = state.redoStack[state.redoStack.length - 1];
      if (!stroke) return state;
      return {
        ...state,
        // Re-inserted by sequence so replay order survives an undo in the
        // middle of the log.
        strokes: insertBySequence(state.strokes, stroke),
        redoStack: state.redoStack.slice(0, -1),
      };
    }

    case 'next-step': {
      if (state.freeCreation || state.currentStepIndex >= lesson.steps.length - 1) return state;
      return withStepIndex(lesson, state, state.currentStepIndex + 1);
    }

    case 'prev-step': {
      if (state.freeCreation || state.currentStepIndex <= 0) return state;
      return withStepIndex(lesson, state, state.currentStepIndex - 1);
    }

    case 'set-assistance-mode':
      // Changing the assistance mode must not touch the artwork or the
      // geometry (PRD section 7, "Perilaku penting saat navigasi dan edit").
      return state.assistanceMode === action.mode
        ? state
        : { ...state, assistanceMode: action.mode };

    case 'set-hint-duration':
      return state.hintDurationMs === action.ms ? state : { ...state, hintDurationMs: action.ms };

    case 'set-input-mode':
      // FR-22: switching input mode never resets the artwork.
      return state.inputMode === action.mode ? state : { ...state, inputMode: action.mode };

    case 'set-tool':
      return state.toolPreferences.activeTool === action.tool
        ? state
        : withToolPreferences(state, { activeTool: action.tool });

    case 'set-custom-color':
      // FR-04: an explicit colour choice sticks until the child asks for the
      // guide colour back, including across steps.
      return state.toolPreferences.colorSource === 'custom' && state.toolPreferences.customColor === action.color
        ? state
        : withToolPreferences(state, { colorSource: 'custom', customColor: action.color });

    case 'use-guide-color':
      return state.toolPreferences.colorSource === 'guide'
        ? state
        : withToolPreferences(state, { colorSource: 'guide' });

    case 'set-custom-width':
      return state.toolPreferences.customWidth === action.width
        ? state
        : withToolPreferences(state, { customWidth: action.width });

    case 'clear-custom-width':
      return state.toolPreferences.customWidth === null
        ? state
        : withToolPreferences(state, { customWidth: null });

    case 'set-boundary-assist':
      return state.toolPreferences.colorBoundaryAssist === action.enabled
        ? state
        : withToolPreferences(state, { colorBoundaryAssist: action.enabled });

    case 'finish':
      return state.finished ? state : { ...state, finished: true };

    case 'reopen':
      return state.finished ? { ...state, finished: false } : state;

    case 'enter-free-creation': {
      if (state.currentStepIndex !== lesson.steps.length - 1) return state;
      if (state.freeCreation && !state.finished) return state;
      return { ...state, freeCreation: true, finished: false, redoStack: [] };
    }

    case 'leave-free-creation': {
      if (!state.freeCreation) return state;
      const step = activeStep(lesson, state);
      return {
        ...state,
        freeCreation: false,
        redoStack: [],
        toolPreferences: {
          ...state.toolPreferences,
          activeTool: step.toolPreset.tool,
          customWidth: null,
        },
      };
    }

    case 'restart':
      return {
        ...state,
        currentStepIndex: 0,
        strokes: [],
        redoStack: [],
        nextSequence: 1,
        clearedArtworks: [],
        clearedSteps: [],
        freeCreation: false,
        finished: false,
        toolPreferences: {
          ...state.toolPreferences,
          activeTool: lesson.steps[0]!.toolPreset.tool,
          customWidth: null,
        },
      };
  }
}

function withStepIndex(lesson: LessonPackage, state: SessionState, index: number): SessionState {
  const step = lesson.steps[index];
  if (!step) return state;
  return {
    ...state,
    currentStepIndex: index,
    // Redo belongs to the step it was undone in; carrying it across a step
    // change would let redo resurrect a stroke the child cannot see.
    redoStack: [],
    // A step hands over its own tool, so neither an eraser picked to fix the
    // previous step nor a width override for its scale follows the child into
    // this one (FR-03). A different tool within the step is still one tap away.
    toolPreferences: {
      ...state.toolPreferences,
      activeTool: step.toolPreset.tool,
      customWidth: null,
    },
  };
}

/**
 * Puts the most recent cleared artwork back onto an empty canvas: a no-op when
 * nothing was cleared.
 *
 * The strokes keep their original sequence numbers, so replay order is
 * unchanged.
 */
function restoreClearedStep(state: SessionState, index: number): SessionState {
  const cleared = state.clearedSteps[index];
  if (!cleared) return state;
  const strokes = cleared.strokes.reduce(
    (current, stroke) => insertBySequence(current, stroke),
    [...state.strokes],
  );
  return {
    ...state,
    strokes,
    redoStack: cleared.redoStack,
    clearedSteps: state.clearedSteps.filter((_, at) => at !== index),
  };
}

function lastClearedStepIndex(state: SessionState, stepId: string): number {
  for (let i = state.clearedSteps.length - 1; i >= 0; i -= 1) {
    if (state.clearedSteps[i]!.stepId === stepId) return i;
  }
  return -1;
}

function restoreClearedArtwork(state: SessionState): SessionState {
  const cleared = state.clearedArtworks[state.clearedArtworks.length - 1];
  if (!cleared) return state;
  return {
    ...state,
    strokes: cleared.strokes,
    // Redo gets back what it held at the clear. Anything undone since belonged
    // to a drawing that is no longer on screen, and redoing it would lay it
    // over the restored one.
    redoStack: cleared.redoStack,
    clearedArtworks: state.clearedArtworks.slice(0, -1),
  };
}

function withToolPreferences(
  state: SessionState,
  patch: Partial<SessionState['toolPreferences']>,
): SessionState {
  return { ...state, toolPreferences: { ...state.toolPreferences, ...patch } };
}

function lastIndexOfStep(strokes: readonly Stroke[], stepId: string): number {
  for (let i = strokes.length - 1; i >= 0; i -= 1) {
    if (strokes[i]!.stepId === stepId) return i;
  }
  return -1;
}

function insertBySequence(strokes: readonly Stroke[], stroke: Stroke): Stroke[] {
  const next = [...strokes];
  const at = next.findIndex((candidate) => candidate.sequence > stroke.sequence);
  if (at === -1) next.push(stroke);
  else next.splice(at, 0, stroke);
  return next;
}

// --- selectors ---------------------------------------------------------------

export function activeStep(lesson: LessonPackage, state: SessionState): LessonStep {
  const step = lesson.steps[state.currentStepIndex];
  if (!step) throw new Error(`Session points at step ${state.currentStepIndex}, which does not exist`);
  return step;
}

export function sessionPhase(lesson: LessonPackage, state: SessionState): SessionPhase {
  if (state.finished) return 'completed';
  if (state.freeCreation) return 'free_creation';
  // A clear is real content, so a session that has been cleared has started
  // even while the canvas is empty.
  if (
    state.strokes.length === 0 &&
    state.currentStepIndex === 0 &&
    state.clearedArtworks.length === 0 &&
    state.clearedSteps.length === 0
  ) {
    return 'not_started';
  }
  return activeStep(lesson, state).phase === 'color' ? 'coloring' : 'drawing';
}

/**
 * The tool the next stroke will use.
 *
 * The step's preset is the baseline (FR-03); a colour or width the child chose
 * overrides it (FR-04). An eraser keeps the step's width but carries no colour
 * of its own. Resolve this once at pointer-down: FR-03 forbids the tool
 * changing while the pen is on the glass.
 */
export function effectiveToolPreset(lesson: LessonPackage, state: SessionState): ToolPreset {
  const step = activeStep(lesson, state);
  const { activeTool, colorSource, customColor, customWidth } = state.toolPreferences;

  if (state.freeCreation) {
    const tool = activeTool;
    const color = colorSource === 'custom' ? customColor : tool === 'brush' ? '#e8552d' : '#3a3a3a';
    const widthViewbox = customWidth ?? (tool === 'brush' ? 36 : tool === 'eraser' ? 24 : 8);
    return { tool, color, widthViewbox };
  }

  if (activeTool === 'eraser') {
    return {
      tool: 'eraser',
      color: step.toolPreset.color,
      widthViewbox: customWidth ?? step.toolPreset.widthViewbox * 2,
    };
  }

  return {
    tool: activeTool,
    color: colorSource === 'custom' ? customColor : step.toolPreset.color,
    widthViewbox: customWidth ?? step.toolPreset.widthViewbox,
  };
}

/** Which layer the next stroke lands on: colour steps paint, others ink. */
export function activeLayerId(lesson: LessonPackage, state: SessionState): 'ink' | 'color' {
  if (state.freeCreation) {
    return state.toolPreferences.activeTool === 'brush' ? 'color' : 'ink';
  }
  return activeStep(lesson, state).phase === 'color' ? 'color' : 'ink';
}

/**
 * Colour regions the next stroke is clipped to, or an empty list when the step
 * has no regions or the child switched the boundary assist off (FR-11).
 */
export function activeClipRegionIds(lesson: LessonPackage, state: SessionState): readonly string[] {
  if (state.freeCreation) return [];
  const step = activeStep(lesson, state);
  if (!state.toolPreferences.colorBoundaryAssist) return [];
  return step.colorRegionIds;
}

/**
 * Whether a dashed overlay should be drawn on the canvas right now.
 * `independent` keeps the example in its own panel only (FR-08).
 */
export function guideOverlayMode(
  assistance: AssistanceMode,
): 'persistent' | 'timed' | 'on-request' {
  switch (assistance) {
    case 'visible':
      return 'persistent';
    case 'temporary':
      return 'timed';
    case 'independent':
      return 'on-request';
  }
}

export function canUndo(lesson: LessonPackage, state: SessionState): boolean {
  const stepId = drawingStepId(lesson, state);
  return (
    lastIndexOfStep(state.strokes, stepId) !== -1 ||
    lastClearedStepIndex(state, stepId) !== -1 ||
    (state.strokes.length === 0 && state.clearedArtworks.length > 0)
  );
}

/** Whether there is any visible artwork for `clear-all` to take away. */
export function canClearAll(state: SessionState): boolean {
  return state.strokes.length > 0;
}

export function canRedo(state: SessionState): boolean {
  return state.redoStack.length > 0;
}

export function strokesForStep(state: SessionState, stepId: string): Stroke[] {
  return state.strokes.filter((stroke) => stroke.stepId === stepId);
}
