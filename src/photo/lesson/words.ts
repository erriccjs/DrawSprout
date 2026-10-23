/**
 * Indonesian instruction sentences: part names, verbs, and repeated lines.
 */

import type { GuidePath, LessonStep } from '../../lesson-data/schema';
import { knownColourName } from '../colors';
import { cleanPartName } from '../parts';
import { ADJECTIVES, ANIMAL_DETAIL, ANIMAL_WORD, BACKGROUND_NOUN, GENERIC_COLOUR, MODIFIERS, SIDE_WORDS } from './types';
import type { DetailBundle, MappedContour, TutorialGroup } from './types';

/** Table, people, leashes, and props are not steps, even when they are in the photo. */
export function isBackgroundPart(name: string): boolean {
  const noun = stepNoun(name);
  if (BACKGROUND_NOUN.test(noun)) return true;
  if (/\bbiji\b/.test(noun)) return true;
  if (/\borang\b/.test(noun)) return true;
  return false;
}

/** Plain step name, with side words removed, so both wheels share one step. */
export function partNoun(name: string): string {
  return stepNoun(name);
}

export function sanitizeTitle(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2 || /latar belakang|wajah anak/i.test(cleaned)) return 'Dari foto';
  return cleaned.slice(0, 40);
}

export function fixVerb(text: string): string {
  return text.replace(/\bWarna\b/gi, 'Warnai');
}

export function normalizeInstruction(text: string): string {
  return text.toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();
}

export function stepNoun(name: string): string {
  const plain = plainNoun(bareName(name));
  const words = plain.split(' ').filter((word) => word.length > 0 && !SIDE_WORDS.has(word));
  return words.join(' ') || plain;
}

export function animalDetailGap(title: string, groups: readonly TutorialGroup[], steps: readonly LessonStep[]): string | null {
  const blob = `${title} ${groups.map((group) => group.name).join(' ')}`.toLowerCase();
  if (!ANIMAL_WORD.test(blob)) return null;
  const planned = groups.filter((group) => !group.guide && ANIMAL_DETAIL.test(group.name));
  if (planned.length < 4) return null;
  const text = steps.filter((step) => step.phase !== 'color').map((step) => normalizeInstruction(step.instruction)).join(' ');
  const present = planned.filter((group) => text.includes(group.name)).length;
  if (present < planned.length) return 'Detail hewan terlalu sedikit. Cek dulu sebelum dipakai.';
  return null;
}

export function tutorialInstruction(
  group: TutorialGroup,
  isMass: boolean,
  contours: readonly MappedContour[],
  fit: 'circle' | 'ellipse' | null,
): string {
  if (group.guide) return `Gambar garis bantu untuk ${group.name}.`;
  if (isMass) {
    const word = group.shape === 'dome'
      ? 'kubah'
      : group.shape === 'circle' || fit === 'circle'
        ? 'lingkaran'
        : group.shape === 'oval' || fit === 'ellipse'
          ? 'oval'
          : '';
    if (word) return `Gambar ${word} besar untuk ${group.name}.`;
  }
  if (contours.length === 2 && (group.pair || group.count === 2) && group.count !== 1 && !/\bdua\b/.test(group.name)) {
    return `Tambahkan dua ${group.name}.`;
  }
  return `Gambar ${group.name}.`;
}

export function plainNoun(name: string): string {
  return name.split(' ').filter((word) => word.length > 0 && !ADJECTIVES.has(word)).join(' ');
}

export function bareName(name: string): string {
  return name.trim().replace(/garis\s*luar/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function outlineInstruction(name: string, title: string): string {
  const cleaned = plainNoun(bareName(name)) || headNoun(title);
  if (!cleaned) return 'Gambar garis luar.';
  return `Gambar garis luar ${cleaned}.`;
}

export function detailInstruction(bundle: DetailBundle, inks: readonly MappedContour[]): string {
  return bundleIsPair(bundle, inks) ? `Tambahkan dua ${bundle.name}.` : `Gambar ${bundle.name}.`;
}

export function bundleIsPair(bundle: DetailBundle, inks: readonly MappedContour[]): boolean {
  if (inks.length !== 2) return false;
  if (/\bdua\b/.test(bundle.name)) return false;
  if (bundle.count === 2) return true;
  if (bundle.count > 0 && bundle.count !== 2) return false;
  return bundle.pair;
}

export function constructionInstruction(kind: 'circle' | 'ellipse', name: string): string {
  const word = kind === 'circle' ? 'lingkaran' : 'oval';
  return `Gambar ${word} sebagai bentuk dasar untuk ${name}.`;
}

export function colourInstruction(names: readonly string[], colour: string): string {
  const unique = names.filter((name, index) => names.indexOf(name) === index).slice(0, 3);
  const first = unique[0];
  const second = unique[1];
  const third = unique[2];
  if (!first) return `Warnai bagian ini dengan ${colour}.`;
  if (!second) return `Warnai ${first} dengan ${colour}.`;
  if (!third) return `Warnai ${first} dan ${second} dengan ${colour}.`;
  return `Warnai ${first}, ${second}, dan ${third} dengan ${colour}.`;
}

/** A sentence that does not name a part. Numbered copies of one still match. */
export function isGenericInstruction(text: string): boolean {
  const key = normalizeInstruction(text);
  if (/bagian kecil ini|bentuk yang paling besar|bagian berikutnya|bentuk utama/.test(key)) return true;
  if (/^gambar garis luar$/.test(key)) return true;
  const colourOnly = /^warnai dengan (.+)$/.exec(key);
  return colourOnly !== null && GENERIC_COLOUR.test(colourOnly[1] ?? '');
}

export function lineStep(id: string, phase: 'outline' | 'detail', text: string, guides: readonly GuidePath[]): LessonStep {
  return {
    id,
    phase,
    instruction: text,
    guidePaths: guides,
    colorRegionIds: [],
    toolPreset: { tool: 'pen', color: '#3a3a3a', widthViewbox: 8 },
    completionPolicy: { manualAllowed: true, automaticEnabled: false },
  };
}

export function uniquify(steps: LessonStep[]): LessonStep[] {
  const used = new Set<string>();
  const cap = steps.length + 2;
  return steps.map((step, index) => {
    const base = fixVerb(step.instruction);
    let text = base;
    let key = normalizeInstruction(text);
    let extra = 0;
    while (used.has(key) && extra < cap) {
      extra += 1;
      const suffix = extra === 1 ? ' yang lain' : ` lagi (${extra})`;
      text = `${base.replace(/\.$/, '')}${suffix}.`;
      key = normalizeInstruction(text);
    }
    if (used.has(key)) {
      text = `${base.replace(/\.$/, '')} (${index + 1}).`;
      key = normalizeInstruction(text);
    }
    used.add(key);
    return text === step.instruction ? step : { ...step, instruction: text };
  });
}

/** Distinct sentences for repeated lines. The loop stops even if a suffix stops changing the key. */
export function uniquifyInstructions(lines: readonly string[]): string[] {
  return uniquify(lines.map((instruction, index) => lineStep(`dup-${index}`, 'detail', instruction, []))).map((step) => step.instruction);
}

export function subjectNoun(title: string): string | null {
  const cleaned = sanitizeTitle(title);
  if (cleaned === 'Dari foto') return null;
  return cleanPartName(cleaned);
}

/** First plain noun of the title: "mobil", not "mobil anak klasik". */
export function headNoun(title: string): string {
  const base = subjectNoun(title);
  if (!base) return '';
  const words = plainNoun(bareName(base)).split(' ').filter((word) => word.length > 0 && !MODIFIERS.has(word));
  return words[0] ?? '';
}

export function colourWord(instruction: string): string | null {
  const match = /dengan (.+)$/.exec(normalizeInstruction(instruction));
  const word = match?.[1]?.trim() ?? '';
  if (!word) return null;
  return knownColourName(word);
}

export function repeatsWords(text: string): boolean {
  const words = normalizeInstruction(text).split(' ').filter((word) => word.length >= 2);
  for (let index = 1; index < words.length; index += 1) {
    if (words[index] === words[index - 1]) return true;
    const previous = words[index - 1];
    const current = words[index];
    const older = words[index - 3];
    const mid = words[index - 2];
    if (index >= 3 && previous === older && current === mid) return true;
  }
  return false;
}
