/**
 * Shared sizes, boxes, and part groups for a traced lesson.
 * The numbers are the ones the lesson builder already used.
 */

import type { LessonPackage } from '../../lesson-data/schema';
import type { DetectedPart, PlanShape } from '../parts';
import type { Point } from '../trace';

export const LESSON_WIDTH = 1000;

export const LESSON_HEIGHT = 750;

/** Largest closed outline / subject box. Below this, the drawing is asked for again. */
export const OUTLINE_COVERAGE_MIN = 0.6;

/** Filled overlap required before a circle or oval may introduce a part. */
export const CONSTRUCTION_IOU_MIN = 0.9;

/** A box larger than the subject itself cannot name an interior line. A petal box the size of the flower still can. */
export const WIDE_PART = 1.08;

/** Share of a region that must sit inside a part before that part can name it. */
export const ENCLOSE = 0.55;

/** Outline, construction, and details together. Extra details are merged away. */
export const MAX_DRAWING_STEPS = 7;

/** How-to-draw lessons scale with the subject, up to about eleven drawing steps. */
export const TUTORIAL_DRAWING_MAX = 11;

export const MASK_W = 160;

export const MASK_H = 120;

export const MIN_NEW_INK = 10;

export const CONTAIN_MIN = 0.45;

/** Planned strokes that must stay even when they touch the outline. */
export const INTERIOR_STEP = /^(kelopak|tengah|pusat|tengah bunga|kumis|kaki|mata|hidung|lidah|telinga|ekor|sayap|paruh|cakar)$/;

export const BACKGROUND_NOUN = /^(tali|biji|biji kopi|meja|lantai|orang|manusia|tangan|kaki orang|alas|latar|latar belakang)$/;

export interface BuiltLesson {
  readonly lesson: LessonPackage;
  readonly coverage: number;
  /** Same figure as `coverage`: outline box / subject box. */
  readonly subjectFit: number;
  readonly builder: 'parts' | 'traced' | 'tutorial';
  /** Part names in draw order. Empty on the traced fallback. */
  readonly planNames: readonly string[];
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
  readonly reviewReasons: readonly string[];
  /** Interior contours that were not given their own part name. */
  readonly unnamedInteriors: number;
}

export interface LessonPiece {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MappedContour {
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly area: number;
  readonly length: number;
  readonly cx: number;
  readonly cy: number;
  readonly nx: number;
  readonly ny: number;
  readonly silhouette: boolean;
  readonly path: string;
  readonly id: number;
}

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly area: number;
}

export interface TutorialGroup {
  name: string;
  parts: DetectedPart[];
  contours: MappedContour[];
  guide: boolean;
  pair: boolean;
  count: number;
  shape: PlanShape | '';
}

export const SIDE_WORDS = new Set(['kiri', 'kanan', 'depan', 'belakang', 'atas', 'bawah']);

export const MASS_BOX = /^(kepala|wajah|cangkir|bunga|badan)$/;

export const ANIMAL_WORD = /\b(kucing|anjing|burung|ikan|lebah|sapi|panda|kelinci|kuda|katak|hamster|tikus|hewan)\b/;

export const ANIMAL_DETAIL = /^(telinga|mata|hidung|lidah|kaki|ekor|kumis|sayap|paruh|cakar)$/;

export interface DetailBundle {
  name: string;
  pair: boolean;
  count: number;
  contours: MappedContour[];
}

export interface ColourBucket {
  colour: string;
  hex: string;
  pixels: number;
  names: string[];
  paths: string[];
}

export const ADJECTIVES = new Set([
  'hitam', 'putih', 'lucu', 'merah', 'biru', 'kuning', 'hijau', 'ungu', 'cokelat', 'coklat',
  'oranye', 'jingga', 'abu-abu', 'besar', 'kecil', 'tua', 'muda', 'imut', 'cantik', 'manis',
  'gelap', 'terang', 'gemas', 'bagus',
]);

export const COFFEE_COLOURS = new Set(['hitam', 'cokelat tua', 'cokelat']);

export const GENERIC_COLOUR = /^(merah muda|abu-abu|cokelat tua|merah|oranye|kuning|hijau|biru|ungu|cokelat|hitam|putih)$/;

export const MODIFIERS = new Set([...ADJECTIVES, 'anak', 'klasik', 'mainan', 'lain', 'yang']);
