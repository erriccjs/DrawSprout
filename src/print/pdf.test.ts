import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { FREE_DRAW_LESSON } from '../lesson-data/free-draw-lesson';
import { STAR_LESSON } from '../lesson-data/star-lesson';
import { A4_HEIGHT, A4_WIDTH, buildSheetPdf, contentBox, fitDrawing, pageOperators, toPdfPoint } from './pdf';
import { buildSheets } from './sheets';

const labels = {
  picture: 'Gambar jadi',
  practice: 'Lembar latihan',
  colouring: 'Halaman mewarnai',
  madeHere: 'Dibuat di perangkat ini. Tidak ada yang diunggah.',
  noLines: 'Pelajaran ini tidak punya garis untuk dijiplak.',
};

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  for (let index = from; index <= haystack.length - needle.length; index += 1) {
    let found = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        found = false;
        break;
      }
    }
    if (found) return index;
  }
  return -1;
}

function streamPayloads(pdf: Uint8Array): Uint8Array[] {
  const marker = new TextEncoder().encode('stream\n');
  const end = new TextEncoder().encode('\nendstream');
  const payloads: Uint8Array[] = [];
  let from = 0;
  while (from < pdf.length) {
    const start = indexOfBytes(pdf, marker, from);
    if (start < 0) break;
    const dataStart = start + marker.length;
    const stop = indexOfBytes(pdf, end, dataStart);
    if (stop < 0) break;
    payloads.push(pdf.slice(dataStart, stop));
    from = stop + end.length;
  }
  return payloads;
}

describe('A4 sheets', () => {
  const pages = buildSheets(STAR_LESSON, { includePicture: true, dateLabel: '23 Nov 2026', labels });

  it('splits a lesson into the picture, the dashed steps, and the outline', () => {
    expect(pages.map((page) => page.kind)).toEqual(['picture', 'practice', 'colouring']);
    expect(pages[1]?.steps.map((step) => step.instruction)).toEqual([
      'Gambar bintang lima.',
      'Gambar dua mata dan senyum.',
    ]);
    expect(pages[1]?.steps[0]?.paths[0]?.role).toBe('final-outline');
    expect(pages[2]?.outlines.some((path) => path.d.includes('M 455 415'))).toBe(true);
    expect(pages[2]?.outlines.every((path) => path.role === 'final-outline')).toBe(true);
  });

  it('omits the picture page when there is no finished drawing', () => {
    const printed = buildSheets(STAR_LESSON, { includePicture: false, dateLabel: '23 Nov 2026', labels });
    expect(printed.map((page) => page.kind)).toEqual(['practice', 'colouring']);
  });

  it('strokes dashed guides in A4 portrait and flips SVG y', () => {
    const practice = pages[1];
    expect(practice).toBeTruthy();
    const operators = pageOperators(practice!, STAR_LESSON.coordinateSpace, null);
    expect(operators).toContain('Lembar latihan');
    expect(operators).toContain('Gambar bintang lima.');
    expect(operators).toContain('] 0 d');
    expect(operators).not.toMatch(/\sf\s/);
    const fit = fitDrawing(STAR_LESSON.coordinateSpace, contentBox());
    const top = toPdfPoint(500, 130, fit);
    const lower = toPdfPoint(500, 600, fit);
    expect(top.y).toBeGreaterThan(lower.y);
    expect(top.x).toBeGreaterThan(0);
    expect(top.x).toBeLessThan(A4_WIDTH);
    expect(operators).toContain(String(Math.round(top.x * 100) / 100));
  });

  it('embeds the picture pixels and stays a local PDF', async () => {
    const rgb = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
    const pdf = await buildSheetPdf(pages, STAR_LESSON.coordinateSpace, { width: 2, height: 2, rgb });
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain(`/MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}]`);
    expect(text).toContain('DrawSprout');
    expect(text).toContain('Halaman mewarnai');
    expect(text).not.toContain('http');
    expect(text).toContain('/Width 2 /Height 2');
    const inflated = streamPayloads(pdf)
      .map((payload) => {
        try {
          return inflateSync(payload);
        } catch {
          return null;
        }
      })
      .find((payload) => payload !== null);
    expect(Array.from(inflated ?? [])).toEqual(Array.from(rgb));
  });

  it('paginates a longer lesson and still makes a sheet for a blank page', async () => {
    const cat = buildSheets(CAT_LESSON, { includePicture: false, dateLabel: '23 Nov 2026', labels });
    expect(cat.filter((page) => page.kind === 'practice').length).toBeGreaterThan(1);
    const pdf = await buildSheetPdf(cat, CAT_LESSON.coordinateSpace, null);
    expect(new TextDecoder('latin1').decode(pdf)).toContain('Gambar lingkaran besar untuk kepala.');
    const blank = buildSheets(FREE_DRAW_LESSON, { includePicture: true, dateLabel: '23 Nov 2026', labels });
    expect(blank.find((page) => page.kind === 'practice')?.note).toBe(labels.noLines);
    expect(blank.find((page) => page.kind === 'colouring')?.outlines).toEqual([]);
  });
});
