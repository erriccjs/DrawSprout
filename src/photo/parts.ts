/**
 * A part the vision model names on the illustration.
 *
 * Coordinates are in the 1000×750 lesson space. The builder assigns traced
 * lines to these boxes; it does not replace those lines with the box.
 */

import type { Point } from './trace';

/** A how-to-draw primitive. Empty when the model did not choose one. */
export type PlanShape = 'circle' | 'oval' | 'dome' | 'line' | 'triangle';

export interface DetectedPart {
  readonly name: string;
  readonly pair: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly points: readonly Point[];
  readonly colorName: string;
  /** Traced piece indexes that belong to this part. Empty when the model only drew a box. */
  readonly pieceIds: readonly number[];
  /** How many of this part one step draws. 0 means the model did not say. */
  readonly count: number;
  /** Basic shape of this part in the construction plan. */
  readonly shape?: PlanShape;
  /** 1-based draw order. 0 means the model did not say, so the box size decides. */
  readonly order?: number;
  /** Name of the part this one is drawn onto. Empty when it is the first mass. */
  readonly dependsOn?: string;
  /** Faint guide (centre cross, petal oval, torso triangle) that is erased from the finished ink. */
  readonly guide?: boolean;
}

const BANNED = /latar belakang|wajah anak|barcode|ventilasi|bagian berikutnya|bentuk utama|bagian kecil|bagian ini|\bbuih\b|\bbusa\b|\buap\b/;

/** Indonesian noun, or null when the model returned a shape word or a banned phrase. */
export function cleanPartName(raw: string): string | null {
  const text = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N} '-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^dua\s+/, '');
  if (text.length < 2 || text.length > 40) return null;
  if (BANNED.test(text) || /\buntuk\b/.test(text)) return null;
  if (/^(lingkaran|oval|persegi panjang|persegi|segitiga|garis|garis luar)$/.test(text)) return null;
  return text;
}

export function detectedPartFrom(value: unknown): DetectedPart | null {
  const row = asRecord(value);
  if (typeof row.name !== 'string' || typeof row.pair !== 'boolean') return null;
  const name = cleanPartName(row.name);
  if (!name) return null;
  const x = finite(row.x);
  const y = finite(row.y);
  const width = finite(row.width);
  const height = finite(row.height);
  if (x === null || y === null || width === null || height === null || width < 4 || height < 4) return null;
  const points: Point[] = [];
  if (Array.isArray(row.points)) {
    for (const item of row.points) {
      const point = asRecord(item);
      const px = finite(point.x);
      const py = finite(point.y);
      if (px === null || py === null) continue;
      points.push({ x: px, y: py });
      if (points.length === 16) break;
    }
  }
  const colorName = typeof row.colorName === 'string' ? row.colorName : '';
  const pieceIds: number[] = [];
  if (Array.isArray(row.pieceIds)) {
    for (const item of row.pieceIds) {
      if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) continue;
      pieceIds.push(item);
      if (pieceIds.length === 24) break;
    }
  }
  const shape = planShape(row.shape);
  const order = wholeOrder(row.order);
  const depends = typeof row.dependsOn === 'string' ? cleanPartName(row.dependsOn) : null;
  return {
    name,
    pair: row.pair,
    x,
    y,
    width,
    height,
    points,
    colorName,
    pieceIds,
    count: wholeCount(row.count),
    ...(shape ? { shape } : {}),
    ...(order ? { order } : {}),
    ...(depends ? { dependsOn: depends } : {}),
    ...(row.guide === true ? { guide: true } : {}),
  };
}

const PLAN_SHAPES = new Set<PlanShape>(['circle', 'oval', 'dome', 'line', 'triangle']);

function planShape(value: unknown): PlanShape | null {
  return typeof value === 'string' && PLAN_SHAPES.has(value as PlanShape) ? value as PlanShape : null;
}

function wholeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 12) return 0;
  return value;
}

function wholeOrder(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 11) return 0;
  return value;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}
