/**
 * What does the step builder make of a line drawing?
 *
 * `npm run doodle-eval -- <line-art.png> [photo.png]`
 *
 * Writes an SVG beside the input showing the drawing, every guide path
 * coloured by step, and the colour regions, then prints the step list. No
 * API key and no network: this reads a drawing the doodle route already
 * returned, so the builder can be judged apart from the model.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { buildDoodleLesson } from '../../src/doodle/steps';
import { decodePng } from '../../src/photo/png';
import type { LessonPackage } from '../../src/lesson-data/schema';

const STEP_COLOURS = ['#d62828', '#0b6e4f', '#1d4ed8', '#b45309', '#7c3aed', '#be185d'];

async function main(): Promise<void> {
  const [artPath, photoPath] = process.argv.slice(2);
  if (!artPath) {
    console.error('usage: npm run doodle-eval -- <line-art.png> [photo.png]');
    process.exitCode = 1;
    return;
  }
  const artBytes = new Uint8Array(await readFile(artPath));
  const art = await decodePng(artBytes);
  const photo = photoPath
    ? await decodePng(new Uint8Array(await readFile(photoPath)))
    : art;

  const lesson = buildDoodleLesson(art, photo);
  report(lesson);
  const out = join(dirname(artPath), `${basename(artPath).replace(/\.png$/i, '')}-steps.svg`);
  await writeFile(out, svg(lesson, artBytes), 'utf8');
  console.log(`\nwrote ${out}`);
}

function report(lesson: LessonPackage): void {
  const outline = lesson.steps.filter((step) => step.phase !== 'color');
  const colour = lesson.steps.filter((step) => step.phase === 'color');
  console.log(`title    ${lesson.title}`);
  console.log(`steps    ${outline.length} outline, ${colour.length} colour`);
  for (const step of outline) {
    const lengths = step.guidePaths.map((path) => countPoints(path.d));
    const total = lengths.reduce((sum, value) => sum + value, 0);
    console.log(
      `  ${step.id.padEnd(10)} ${String(step.guidePaths.length).padStart(2)} path(s), `
      + `${String(total).padStart(3)} points  [${lengths.join(', ')}]`,
    );
  }
  for (const region of lesson.colorRegions) {
    console.log(`  ${region.id.padEnd(10)} ${region.suggestedColor}  ${region.d.slice(0, 44)}`);
  }
}

function countPoints(d: string): number {
  return (d.match(/[ML]/g) ?? []).length;
}

function svg(lesson: LessonPackage, artBytes: Uint8Array): string {
  const { width, height } = lesson.coordinateSpace;
  const outline = lesson.steps.filter((step) => step.phase !== 'color');
  const guides = outline.flatMap((step, index) => step.guidePaths.map((path) => (
    `<path d="${path.d}" fill="none" stroke="${STEP_COLOURS[index % STEP_COLOURS.length]}"`
    + ` stroke-width="${index === 0 ? 5 : 3}" stroke-linecap="round" stroke-linejoin="round" />`
  )));
  const regions = lesson.colorRegions.map((region) => (
    `<path d="${region.d}" fill="${region.suggestedColor}" fill-opacity="0.55" stroke="none" />`
  ));
  const key = outline.map((step, index) => (
    `<text x="12" y="${22 + index * 20}" font-size="15" fill="${STEP_COLOURS[index % STEP_COLOURS.length]}">`
    + `${step.id} (${step.guidePaths.length})</text>`
  )).join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height}" viewBox="0 0 ${width * 2} ${height}">`,
    `<rect width="100%" height="100%" fill="#ffffff" />`,
    `<image href="data:image/png;base64,${Buffer.from(artBytes).toString('base64')}" x="0" y="0" width="${width}" height="${height}"`,
    ` preserveAspectRatio="xMidYMid meet" />`,
    `<text x="12" y="${height - 12}" font-size="15" fill="#555">drawing</text>`,
    `<g transform="translate(${width} 0)">`,
    `<rect width="${width}" height="${height}" fill="#fcfcfc" stroke="#ddd" />`,
    regions.join(''),
    guides.join(''),
    key,
    `<text x="12" y="${height - 12}" font-size="15" fill="#555">what the child is asked to draw</text>`,
    `</g></svg>`,
  ].join('');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`doodle-eval failed: ${message}`);
  process.exit(1);
});
