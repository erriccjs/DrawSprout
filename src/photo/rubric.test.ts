import { describe, expect, it } from 'vitest';
import { computeRubric, parseRubricCsv, rubricCsv, type RubricRow } from './rubric';

function scored(file: string, score: number, critical = false): RubricRow {
  return {
    file,
    criticalStructure: critical,
    scores: {
      pose: score,
      proporsi_siluet: score,
      ciri_khas: score,
      warna: score,
      kemudahan: score,
    },
  };
}

describe('photo rubric', () => {
  it('never claims the gate, even when the arithmetic is go', () => {
    const rows = [1, 2, 3, 4, 5].map((index) => scored(`p${index}.jpg`, 5));
    const result = computeRubric(rows);
    expect(result.counted).toBe('go');
    expect(result.claimedPass).toBe(false);
    expect(result.note).toContain('bukan pernyataan lulus');
  });

  it('filters a critical structure error out and counts no-go', () => {
    const rows = [scored('ok.jpg', 5), scored('bad.jpg', 5, true)];
    const result = computeRubric(rows);
    expect(result.counted).toBe('no-go');
    expect(result.criticalErrors).toBe(1);
    expect(result.eligible).toBe(1);
    expect(result.claimedPass).toBe(false);
  });

  it('stays incomplete until every dimension has a score', () => {
    const csv = rubricCsv([{ file: 'cat.jpg', scores: {}, criticalStructure: false }]);
    expect(csv.split('\n')[0]).toBe('file,pose,proporsi_siluet,ciri_khas,warna,kemudahan,cacat_struktur,catatan');
    const result = computeRubric(parseRubricCsv(csv));
    expect(result.counted).toBe('incomplete');
    expect(result.claimedPass).toBe(false);
  });

  it('needs 80 percent of the eligible rows at 4 or better on every dimension', () => {
    const rows = [scored('a.jpg', 4), scored('b.jpg', 4), scored('c.jpg', 4), scored('d.jpg', 4), scored('e.jpg', 3)];
    expect(computeRubric(rows).counted).toBe('go');
    rows[3] = scored('d.jpg', 3);
    expect(computeRubric(rows).counted).toBe('no-go');
  });
});
