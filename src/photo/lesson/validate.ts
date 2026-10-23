/**
 * Checks a built lesson before it is returned: step counts, generic
 * sentences, palette, and construction lines left in the preview.
 */

import { LESSON_SCHEMA_VERSION } from '../../lesson-data/schema';
import type { ColorRegion, GuidePath, LessonPackage, LessonStep } from '../../lesson-data/schema';
import { assertValidLessons } from '../../lesson-data/validate';
import { LESSON_HEIGHT, LESSON_WIDTH, MAX_DRAWING_STEPS, OUTLINE_COVERAGE_MIN } from './types';
import type { BuiltLesson, MappedContour } from './types';
import { guidesFor } from './geometry';
import { colourWord, isGenericInstruction, normalizeInstruction, repeatsWords, sanitizeTitle, uniquify } from './words';

export function finish(
  input: {
    readonly id: string;
    readonly title: string;
    readonly targetHash: string;
  },
  steps: LessonStep[],
  regions: ColorRegion[],
  preview: GuidePath[],
  mapped: readonly MappedContour[],
  coverage: number,
  builder: 'parts' | 'traced' | 'tutorial',
  unnamedInteriors: number,
  notes: readonly string[] = [],
  regionNames: readonly string[] = [],
  maxDrawing = MAX_DRAWING_STEPS,
  planNames: readonly string[] = [],
): BuiltLesson {
  const uniqueSteps = uniquify(steps);
  const drawing = uniqueSteps.filter((step) => step.phase !== 'color');
  const colours = uniqueSteps.filter((step) => step.phase === 'color');
  const reasons: string[] = [];
  if (coverage < OUTLINE_COVERAGE_MIN) reasons.push('Garis luar hanya menutupi sebagian subjek. Cek dulu sebelum dipakai.');
  if (drawing.length < 3) reasons.push('Terlalu sedikit langkah menggambar. Cek dulu sebelum dipakai.');
  if (drawing.length > maxDrawing) reasons.push('Terlalu banyak langkah menggambar. Cek dulu sebelum dipakai.');
  if (uniqueSteps.some((step) => isGenericInstruction(step.instruction))) {
    reasons.push('Ada instruksi yang belum menyebut bagian. Cek dulu sebelum dipakai.');
  }
  const palette = new Set(regionNames);
  if (colours.length < 2 && palette.size >= 2) reasons.push('Warna subjek lebih dari satu. Cek dulu sebelum dipakai.');
  if (colours.length > 4) reasons.push('Terlalu banyak langkah warna. Cek dulu sebelum dipakai.');
  if (palette.size > 0 && colours.some((step) => {
    const name = colourWord(step.instruction);
    return name !== null && !palette.has(name);
  })) reasons.push('Ada warna yang tidak ada pada gambar. Cek dulu sebelum dipakai.');
  for (const note of notes) {
    if (!reasons.includes(note)) reasons.push(note);
  }
  if (uniqueSteps.some((step) => repeatsWords(step.instruction))) {
    reasons.push('Ada instruksi yang mengulang kata. Cek dulu sebelum dipakai.');
  }
  const construction = new Set(uniqueSteps.flatMap((step) => step.guidePaths.filter((path) => path.role === 'construction').map((path) => path.d)));
  if (preview.some((path) => path.role === 'construction' || construction.has(path.d))) {
    reasons.push('Bentuk bantu ikut gambar akhir. Cek dulu sebelum dipakai.');
  }
  if (uniqueSteps.some((step) => /\btambahkan dua\b/.test(normalizeInstruction(step.instruction)) && step.guidePaths.length !== 2)) {
    reasons.push('Jumlah bagian tidak sesuai instruksi. Cek dulu sebelum dipakai.');
  }
  if (uniqueSteps.some((step) => /garis\s*luar\s+garis|garisluar|\byang lain\b|lagi \(\d+\)/.test(normalizeInstruction(step.instruction)))) {
    reasons.push('Ada nama bagian yang tidak jelas. Cek dulu sebelum dipakai.');
  }
  const needsReview = reasons.length > 0;
  const lesson: LessonPackage = {
    id: input.id,
    schemaVersion: LESSON_SCHEMA_VERSION,
    contentVersion: `photo-${input.targetHash.slice(0, 12)}`,
    title: sanitizeTitle(input.title),
    subtitle: 'Dari foto',
    coordinateSpace: { width: LESSON_WIDTH, height: LESSON_HEIGHT },
    steps: uniqueSteps,
    colorRegions: regions,
    targetPreview: { paths: preview.length > 0 ? preview : [guidesFor('preview', mapped.slice(0, 1))[0] ?? { id: 'preview', d: 'M 0 0', role: 'final-outline' }] },
  };
  assertValidLessons([lesson]);
  return {
    lesson,
    coverage,
    subjectFit: coverage,
    builder,
    needsReview,
    reviewReason: needsReview ? reasons.join(' ') : null,
    reviewReasons: reasons,
    unnamedInteriors,
    planNames,
  };
}
