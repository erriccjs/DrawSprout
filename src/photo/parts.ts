/**
 * A part the vision model names on the illustration.
 *
 * Coordinates are in the 1000×750 lesson space. The builder assigns traced
 * lines to these boxes; it does not replace those lines with the box.
 */

import type { Point } from './trace';

export interface DetectedPart {
  readonly name: string;
  readonly pair: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly points: readonly Point[];
  readonly colorName: string;
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
  if (/^(lingkaran|oval|persegi panjang|persegi|segitiga|garis)$/.test(text)) return null;
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
  return { name, pair: row.pair, x, y, width, height, points, colorName };
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}
