/**
 * Section 8 rubric arithmetic.
 *
 * A photo counts only when every similarity dimension is at least 4.
 * A critical structure error is filtered out, not averaged into a high score,
 * and any such error means the batch is no-go. This function never reports
 * that the spike passed: the 30-photo evaluation has not been run.
 */

export const RUBRIC_DIMENSIONS = ['pose', 'proporsi_siluet', 'ciri_khas', 'warna', 'kemudahan'] as const;

export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

export interface RubricRow {
  readonly file: string;
  readonly scores: Partial<Record<RubricDimension, number>>;
  /** Yes when a person marks a critical structure error. */
  readonly criticalStructure: boolean;
  readonly note?: string;
}

export interface RubricComputation {
  readonly counted: 'incomplete' | 'go' | 'no-go';
  readonly eligible: number;
  readonly passedDimensions: number;
  readonly criticalErrors: number;
  /** Always false. The harness must not claim the gate. */
  readonly claimedPass: false;
  readonly note: string;
}

const NOT_CLAIMED = 'Hitungan ini bukan pernyataan lulus. Evaluasi 30 foto berizin belum dijalankan, dan ambang 80% belum dikalibrasi.';

export function computeRubric(rows: readonly RubricRow[]): RubricComputation {
  if (rows.length === 0 || rows.some((row) => RUBRIC_DIMENSIONS.some((dimension) => row.scores[dimension] === undefined))) {
    return {
      counted: 'incomplete',
      eligible: 0,
      passedDimensions: 0,
      criticalErrors: rows.filter((row) => row.criticalStructure).length,
      claimedPass: false,
      note: `Skor belum lengkap. ${NOT_CLAIMED}`,
    };
  }
  const criticalErrors = rows.filter((row) => row.criticalStructure).length;
  const eligibleRows = rows.filter((row) => !row.criticalStructure);
  const passedDimensions = eligibleRows.filter((row) =>
    RUBRIC_DIMENSIONS.every((dimension) => (row.scores[dimension] ?? 0) >= 4),
  ).length;
  const fraction = eligibleRows.length === 0 ? 0 : passedDimensions / eligibleRows.length;
  const counted = criticalErrors === 0 && eligibleRows.length > 0 && fraction >= 0.8 ? 'go' : 'no-go';
  return {
    counted,
    eligible: eligibleRows.length,
    passedDimensions,
    criticalErrors,
    claimedPass: false,
    note: NOT_CLAIMED,
  };
}

export function rubricCsv(rows: readonly RubricRow[]): string {
  const header = ['file', ...RUBRIC_DIMENSIONS, 'cacat_struktur', 'catatan'];
  const lines = [header.join(',')];
  for (const row of rows) {
    const scores = RUBRIC_DIMENSIONS.map((dimension) => {
      const score = row.scores[dimension];
      return score === undefined ? '' : String(score);
    });
    lines.push([csv(row.file), ...scores, row.criticalStructure ? 'ya' : '', csv(row.note ?? '')].join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function parseRubricCsv(text: string): RubricRow[] {
  const lines = text.trim().split(/\r?\n/).slice(1).filter((line) => line.trim() !== '');
  return lines.map((line) => {
    const cells = splitCsv(line);
    const scores: Partial<Record<RubricDimension, number>> = {};
    RUBRIC_DIMENSIONS.forEach((dimension, index) => {
      const raw = cells[index + 1] ?? '';
      if (raw !== '') scores[dimension] = Number(raw);
    });
    const note = cells[2 + RUBRIC_DIMENSIONS.length] ?? '';
    return {
      file: cells[0] ?? '',
      scores,
      criticalStructure: (cells[1 + RUBRIC_DIMENSIONS.length] ?? '').toLowerCase() === 'ya',
      ...(note ? { note } : {}),
    };
  });
}

function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted && char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
