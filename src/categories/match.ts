/**
 * Turn a vision model's JSON into a match or the friendly fallback.
 *
 * A planned category, an unknown name, and a low confidence all mean the
 * same thing for the child: we cannot draw this yet.
 */

import { CATEGORY_CATALOGUE, CATEGORY_LESSONS } from './library';
import { isDone, type CategoryEntry, type Facing } from './types';

/** Below this, or a category that is not drawn yet, the photo does not open a lesson. */
export const MATCH_CONFIDENCE = 0.55;

export const NO_MATCH_MESSAGE = 'Belum bisa digambar. Coba salah satu ini.';

export interface MatchColour {
  readonly part: string;
  readonly color: string;
}

export interface PhotoMatch {
  readonly matched: boolean;
  readonly category: string;
  readonly confidence: number;
  readonly facing: Facing;
  readonly pose: string;
  readonly colours: readonly MatchColour[];
  readonly suggestions: readonly { readonly category: string; readonly title: string }[];
  readonly message: string;
}

/**
 * Names the model may say instead of a catalogue id. Applied only when the
 * reply is not already an id, so a real lesson name always wins.
 */
const CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  person: 'person-standing',
  man: 'person-standing',
  woman: 'person-standing',
  boy: 'person-standing',
  girl: 'person-standing',
  child: 'person-standing',
  'statue of a person': 'person-standing',
  figure: 'person-standing',
  'people standing': 'person-standing',
  'anime character': 'character',
  'cartoon character': 'character',
  face: 'character',
  portrait: 'character',
  doll: 'character',
  'action figure': 'character',
  superhero: 'character',
};

const NAMED_COLOURS: Readonly<Record<string, string>> = {
  black: '#222222',
  hitam: '#222222',
  white: '#f7f7f7',
  putih: '#f7f7f7',
  red: '#d64545',
  merah: '#d64545',
  blue: '#3d74d6',
  biru: '#3d74d6',
  green: '#3e9a55',
  hijau: '#3e9a55',
  yellow: '#f0c43a',
  kuning: '#f0c43a',
  orange: '#f0913c',
  oranye: '#f0913c',
  pink: '#f2a6b3',
  merahmuda: '#f2a6b3',
  brown: '#8a5a32',
  coklat: '#8a5a32',
  grey: '#8a9099',
  gray: '#8a9099',
  abu: '#8a9099',
  purple: '#8a5bd6',
  ungu: '#8a5bd6',
};

export function interpretMatch(raw: unknown, catalogue: readonly CategoryEntry[] = CATEGORY_CATALOGUE): PhotoMatch {
  const record = asRecord(raw);
  const category = canonicalCategory(record?.category, catalogue);
  const known = catalogue.find((entry) => entry.id === category);
  const confidence = readConfidence(record?.confidence);
  const facing = readFacing(record?.facing);
  const pose = typeof record?.pose === 'string' ? record.pose.trim() : '';
  const colours = readColours(record?.colours, known && isDone(known) ? known : undefined);
  const matched = known !== undefined && isDone(known) && confidence >= MATCH_CONFIDENCE;
  return {
    matched,
    category: known ? known.id : 'none',
    confidence,
    facing,
    pose,
    colours,
    suggestions: matched ? [] : CATEGORY_LESSONS.map((entry) => ({ category: entry.id, title: entry.title })),
    message: matched ? '' : NO_MATCH_MESSAGE,
  };
}

export function normalizeHex(value: string): string | null {
  const text = value.trim().toLowerCase().replace(/\s+/g, '');
  const named = NAMED_COLOURS[text];
  if (named) return named;
  const short = /^#([0-9a-f]{3})$/.exec(text);
  if (short?.[1]) {
    const [r, g, b] = short[1];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const full = /^#([0-9a-f]{6})$/.exec(text);
  return full?.[1] ? `#${full[1]}` : null;
}

function canonicalCategory(value: unknown, catalogue: readonly CategoryEntry[]): string {
  if (typeof value !== 'string') return 'none';
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (catalogue.some((entry) => entry.id === normalized)) return normalized;
  return CATEGORY_ALIASES[normalized] ?? normalized;
}

function readConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const unit = value > 1 && value <= 100 ? value / 100 : value;
  return Math.min(1, Math.max(0, unit));
}

function readFacing(value: unknown): Facing {
  if (value === 'left' || value === 'right' || value === 'front' || value === 'unknown') return value;
  return 'unknown';
}

function readColours(value: unknown, lesson: { readonly parts: readonly { readonly id: string }[] } | undefined): MatchColour[] {
  if (!lesson) return [];
  const parts = lesson.parts.map((part) => part.id);
  const allowed = new Set(parts);
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => typeof item === 'string')) {
      const colours: MatchColour[] = [];
      for (let index = 0; index < value.length && index < parts.length; index += 1) {
        const part = parts[index];
        const text = value[index];
        if (!part || typeof text !== 'string') continue;
        const color = normalizeHex(text);
        if (!color) continue;
        colours.push({ part, color });
      }
      return colours;
    }
    const colours: MatchColour[] = [];
    for (const item of value) {
      const record = asRecord(item);
      if (!record || typeof record.part !== 'string' || typeof record.color !== 'string') continue;
      const part = record.part.trim().toLowerCase();
      if (!allowed.has(part)) continue;
      const color = normalizeHex(record.color);
      if (!color) continue;
      colours.push({ part, color });
    }
    return colours;
  }
  const record = asRecord(value);
  if (!record) return [];
  const byPart = new Map<string, string>();
  for (const [key, text] of Object.entries(record)) {
    if (typeof text === 'string') byPart.set(key.trim().toLowerCase(), text);
  }
  const colours: MatchColour[] = [];
  for (const part of parts) {
    const text = byPart.get(part);
    if (!text) continue;
    const color = normalizeHex(text);
    if (!color) continue;
    colours.push({ part, color });
  }
  return colours;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}
