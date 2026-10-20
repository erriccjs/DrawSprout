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
    clearedArtwork: null,
    finished: false,
  };
}

export function reduceSession(
  lesson: LessonPackage,
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case 'commit-stroke': {
      const stroke: Stroke = { ...action.stroke, sequence: state.nextSequence };
      return {
        ...state,
        strokes: [...state.strokes, stroke],
        // AT-07: a new stroke invalidates the old redo chain.
        redoStack: [],
        nextSequence: state.nextSequence + 1,
      };
    }

    case 'clear-all': {
      if (state.strokes.length === 0 && state.redoStack.length === 0) return state;
      return {
        ...state,
        strokes: [],
        // Redo would otherwise bring one stroke back on its own, which is not
        // what "undo the clear" means. It is kept in `clearedArtwork` instead.
        redoStack: [],
        // `nextSequence` is deliberately left alone: the cleared strokes keep
        // their sequence numbers, so putting them back restores paint order.
        clearedArtwork: { strokes: state.strokes, redoStack: state.redoStack },
      };
    }

    case 'undo': {
      // Undo is scoped to the active step so that navigating back and tapping
      // undo can never destroy work from a later step (FR-09).
      const stepId = activeStep(lesson, state).id;
      const index = lastIndexOfStep(state.strokes, stepId);
      // Nothing of this step's own left to take back, so the clear is the
      // operation this undo reverses. Putting the artwork back only ever adds
      // strokes, so reaching past a later step's work cannot destroy any.
      if (index === -1) return restoreClearedArtwork(state);
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
      if (state.currentStepIndex >= lesson.steps.length - 1) return state;
      return withStepIndex(lesson, state, state.currentStepIndex + 1);
    }

    case 'prev-step': {
      if (state.currentStepIndex <= 0) return state;
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

    case 'restart':
      return {
        ...state,
        currentStepIndex: 0,
        strokes: [],
        redoStack: [],
        nextSequence: 1,
        clearedArtwork: null,
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
 * Puts a cleared artwork back: a no-op when nothing was cleared.
 *
 * Strokes are reinserted by sequence so they land under or over whatever was
 * drawn after the clear, exactly as they were painted.
 */
function restoreClearedArtwork(state: SessionState): SessionState {
  const cleared = state.clearedArtwork;
  if (!cleared) return state;
  let strokes = state.strokes;
  for (const stroke of cleared.strokes) strokes = insertBySequence(strokes, stroke);
  return {
    ...state,
    strokes,
    // Older undos first, so "most recently undone last" still holds.
    redoStack: [...cleared.redoStack, ...state.redoStack],
    clearedArtwork: null,
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
  // A clear is real content, so a session that has been cleared has started
  // even while the canvas is empty.
  if (state.strokes.length === 0 && state.currentStepIndex === 0 && state.clearedArtwork === null) {
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
  return activeStep(lesson, state).phase === 'color' ? 'color' : 'ink';
}

/**
 * Colour regions the next stroke is clipped to, or an empty list when the step
 * has no regions or the child switched the boundary assist off (FR-11).
 */
export function activeClipRegionIds(lesson: LessonPackage, state: SessionState): readonly string[] {
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
  return (
    lastIndexOfStep(state.strokes, activeStep(lesson, state).id) !== -1 ||
    state.clearedArtwork !== null
  );
}

/** Whether there is any artwork for `clear-all` to take away. */
export function canClearAll(state: SessionState): boolean {
  return state.strokes.length > 0 || state.redoStack.length > 0;
}

export function canRedo(state: SessionState): boolean {
  return state.redoStack.length > 0;
}

export function strokesForStep(state: SessionState, stepId: string): Stroke[] {
  return state.strokes.filter((stroke) => stroke.stepId === stepId);
}
