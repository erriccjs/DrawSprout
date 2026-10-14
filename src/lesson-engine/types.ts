/**
 * Lesson engine types.
 *
 * The engine owns the session state machine, step navigation, tool presets and
 * the undo/redo history. It must stay free of DOM, canvas and storage concerns
 * (PRD section 11: "Lesson engine, schema lesson, stroke model ... dipisahkan
 * dari renderer serta browser storage"), so that a native client could reuse it
 * unchanged.
 */

import type { ToolKind } from '../lesson-data/schema';

export type { ToolKind };

/** A point in lesson coordinate space, never in device pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Which layer a stroke belongs to. Colour sits under ink so the child's
 * outline stays visible, and an eraser only ever affects its own layer.
 * PRD section 9 requires child strokes and colour to be stored separately.
 */
export type LayerId = 'ink' | 'color';

/** One completed user operation. An eraser pass is a stroke too, so undo restores it (FR-02). */
export interface Stroke {
  readonly id: string;
  readonly stepId: string;
  readonly layerId: LayerId;
  readonly points: readonly Point[];
  readonly color: string;
  /** Stroke width in lesson coordinate units (PRD section 12). */
  readonly width: number;
  readonly tool: ToolKind;
  /** Monotonic per session; replay order. */
  readonly sequence: number;
  /**
   * Colour regions this stroke was clipped to when it was drawn, empty when the
   * boundary assist was off. Captured at pointer-down so toggling the assist
   * later never silently repaints existing work (PRD section 14).
   */
  readonly clipRegionIds: readonly string[];
}

/** How much help the lesson shows (PRD section 3, FR-06..FR-08). */
export type AssistanceMode = 'visible' | 'temporary' | 'independent';

/** Hint visibility for `temporary` mode, in ms (FR-07). */
export type HintDurationMs = 3000 | 5000 | 10000;

/** Which pointer types may draw (FR-22). */
export type InputMode = 'pencil' | 'finger';

/** Where the active colour comes from (FR-04). */
export type ColorSource = 'guide' | 'custom';

export interface ToolPreferences {
  readonly activeTool: ToolKind;
  readonly colorSource: ColorSource;
  /** Survives step changes until the child switches back to `guide` (FR-04). */
  readonly customColor: string;
  /** `null` means "use whatever the step prepared" (FR-03). */
  readonly customWidth: number | null;
  /** Optional colouring boundary; the child can switch it off (FR-11). */
  readonly colorBoundaryAssist: boolean;
}

/** PRD section 12 session state machine, minus the deferred `free_creation`. */
export type SessionPhase = 'not_started' | 'drawing' | 'coloring' | 'completed';

export interface SessionState {
  readonly sessionId: string;
  readonly lessonId: string;
  readonly lessonContentVersion: string;
  readonly currentStepIndex: number;
  readonly assistanceMode: AssistanceMode;
  readonly hintDurationMs: HintDurationMs;
  readonly inputMode: InputMode;
  readonly toolPreferences: ToolPreferences;
  /** Committed strokes in replay order. */
  readonly strokes: readonly Stroke[];
  /** Undone strokes, most recently undone last. Cleared by a new stroke (AT-07). */
  readonly redoStack: readonly Stroke[];
  /** Next sequence number to hand out; never reused, so ids stay stable. */
  readonly nextSequence: number;
  /** Set only by the explicit finish action; never inferred from the drawing (PRD section 12). */
  readonly finished: boolean;
}

/**
 * Preferences that outlive a single session and are stored separately
 * (FR-04, FR-07, FR-22).
 */
export interface SessionPreferences {
  readonly assistanceMode: AssistanceMode;
  readonly hintDurationMs: HintDurationMs;
  readonly inputMode: InputMode;
  readonly toolPreferences: ToolPreferences;
}

export type SessionAction =
  | { readonly type: 'commit-stroke'; readonly stroke: Omit<Stroke, 'sequence'> }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'next-step' }
  | { readonly type: 'prev-step' }
  | { readonly type: 'set-assistance-mode'; readonly mode: AssistanceMode }
  | { readonly type: 'set-hint-duration'; readonly ms: HintDurationMs }
  | { readonly type: 'set-input-mode'; readonly mode: InputMode }
  | { readonly type: 'set-tool'; readonly tool: ToolKind }
  | { readonly type: 'set-custom-color'; readonly color: string }
  | { readonly type: 'use-guide-color' }
  | { readonly type: 'set-custom-width'; readonly width: number }
  | { readonly type: 'clear-custom-width' }
  | { readonly type: 'set-boundary-assist'; readonly enabled: boolean }
  | { readonly type: 'finish' }
  | { readonly type: 'reopen' }
  | { readonly type: 'restart' };
