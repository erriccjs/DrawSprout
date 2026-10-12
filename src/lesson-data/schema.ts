/**
 * Lesson package schema.
 *
 * This module is plain versioned data only: no DOM, no renderer, no engine, no
 * storage. A future authoring tool or the PRD section 11 photo pipeline is
 * expected to emit exactly this shape, so nothing here may depend on how the
 * app happens to draw or store things today.
 *
 * Maps to PRD section 12 (`LessonPackage`, `LessonStep`).
 */

/** Bumped when the *shape* below changes incompatibly. */
export const LESSON_SCHEMA_VERSION = 1;

/**
 * Fixed coordinate space every path and stroke width in a package is expressed
 * in (PRD section 12: "koordinat kanvas yang dinormalisasi atau viewBox tetap").
 * The renderer maps this onto device pixels, so geometry survives resize and
 * orientation change without being rewritten.
 */
export interface CoordinateSpace {
  readonly width: number;
  readonly height: number;
}

/** Which part of the lesson a step belongs to. */
export type LessonPhase = 'outline' | 'detail' | 'color';

/**
 * Role of a guide path. `construction` geometry is scaffolding the child is not
 * expected to keep; `final-outline` geometry is part of the finished drawing.
 * PRD section 9 requires the two to be distinguishable.
 */
export type GuideRole = 'final-outline' | 'construction';

/**
 * A single guide shape.
 *
 * `d` is restricted to the SVG path subset validated by
 * `lesson-data/validate.ts` (M, L, C, Q, A, Z and their relative forms).
 * PRD section 13 forbids executing script, external URLs, or active markup
 * from lesson content, so the subset is enforced rather than trusted.
 */
export interface GuidePath {
  readonly id: string;
  readonly d: string;
  readonly role: GuideRole;
}

/** Drawing implement a step hands the child. */
export type ToolKind = 'pen' | 'brush' | 'eraser';

/**
 * Colour and size the app prepares before the child starts a step
 * (FR-03). `widthViewbox` is in coordinate-space units, never device pixels.
 */
export interface ToolPreset {
  readonly tool: ToolKind;
  readonly color: string;
  readonly widthViewbox: number;
}

/**
 * A fillable area for the colouring phase. The path doubles as the optional
 * clipping boundary (FR-11): it constrains where paint lands but never paints
 * anything by itself, and the child can switch it off.
 */
export interface ColorRegion {
  readonly id: string;
  readonly label: string;
  readonly d: string;
  readonly suggestedColor: string;
}

/** Whether a step may be advanced manually and/or detected automatically. */
export interface CompletionPolicy {
  readonly manualAllowed: boolean;
  readonly automaticEnabled: boolean;
}

export interface LessonStep {
  readonly id: string;
  readonly phase: LessonPhase;
  /** One short, speakable goal, e.g. "Gambar telinga kiri" (PRD section 9.2). */
  readonly instruction: string;
  /** Extra sentence shown under the instruction; optional. */
  readonly hint?: string;
  readonly guidePaths: readonly GuidePath[];
  readonly colorRegionIds: readonly string[];
  readonly toolPreset: ToolPreset;
  readonly completionPolicy: CompletionPolicy;
}

export interface LessonPackage {
  readonly id: string;
  readonly schemaVersion: number;
  /** Bumped when this lesson's own geometry or step list changes. */
  readonly contentVersion: string;
  readonly title: string;
  readonly subtitle: string;
  readonly coordinateSpace: CoordinateSpace;
  readonly steps: readonly LessonStep[];
  readonly colorRegions: readonly ColorRegion[];
  /**
   * Target illustration shown in the reference panel. It is reference material
   * only: PRD section 9 forbids exporting it as the child's artwork.
   */
  readonly targetPreview: {
    readonly paths: readonly GuidePath[];
  };
}
