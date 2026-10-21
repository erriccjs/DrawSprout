/**
 * A contact sheet of one lesson, one cell per step, using the same preview
 * model as the drawing screen.
 */

import { previewStrokeWidth, PREVIEW_INK, stepPreview } from '../lesson-data/step-preview';
import { previewViewBox } from '../ui/preview-frame';
import type { CategoryLesson } from './types';

export function contactSheetHtml(entry: CategoryLesson): string {
  const lesson = entry.lesson;
  const frame = previewViewBox(lesson.coordinateSpace, [
    ...lesson.targetPreview.paths.map((path) => path.d),
    ...lesson.colorRegions.map((region) => region.d),
  ]);
  const cells = lesson.steps.map((step, index) => {
    const preview = stepPreview(lesson, index);
    const fills = preview.fills.map((fill) => (
      `<path d="${escapeAttr(fill.d)}" fill="${fill.fill === 'paper' ? '#ffffff' : fill.fill}" />`
    )).join('');
    const strokes = preview.strokes.map((stroke) => (
      `<path d="${escapeAttr(stroke.d)}" fill="none" stroke="${PREVIEW_INK[stroke.kind]}" stroke-width="${previewStrokeWidth(stroke.kind)}" ${stroke.kind === 'construction' ? 'stroke-dasharray="12 14"' : ''} stroke-linecap="round" stroke-linejoin="round" />`
    )).join('');
    const active = preview.activeOutlines.map((stroke) => (
      `<path d="${escapeAttr(stroke.d)}" fill="none" stroke="${PREVIEW_INK.new}" stroke-width="7" stroke-linejoin="round" />`
    )).join('');
    return `<figure>
      <svg viewBox="${frame}" role="img" aria-label="${escapeAttr(step.instruction)}">${fills}${strokes}${active}</svg>
      <figcaption><strong>${index + 1}.</strong> ${escapeText(step.instruction)}</figcaption>
    </figure>`;
  }).join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeText(lesson.title)}</title>
  <style>
    body { margin: 0; background: #f3f0ea; color: #1f2933; font-family: system-ui, sans-serif; }
    h1 { margin: 16px 16px 0; font-size: 28px; }
    p { margin: 4px 16px 0; color: #5c6670; }
    .grid { display: grid; grid-template-columns: repeat(4, 320px); gap: 12px; padding: 16px; }
    figure { margin: 0; background: #fff; border-radius: 12px; padding: 8px 8px 10px; }
    svg { width: 304px; height: 228px; display: block; }
    figcaption { font-size: 14px; line-height: 1.3; min-height: 2.6em; margin-top: 6px; }
  </style>
</head>
<body>
  <h1>${escapeText(lesson.title)}</h1>
  <p>${escapeText(lesson.subtitle)}</p>
  <div class="grid">${cells}</div>
</body>
</html>`;
}

function escapeText(value: string): string {
  return value.replace(/[&<>]/g, (char) => (char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&gt;'));
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
