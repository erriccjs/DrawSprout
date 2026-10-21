/**
 * Photo evaluation harness.
 *
 *   OPENAI_API_KEY=... npm run photo-eval -- <photo-directory>
 *
 * Writes ./photo-eval-out/ (contact sheet HTML and PNG, time and token counts,
 * rubric.csv). Recompute a filled rubric without calling the API:
 *
 *   npm run photo-eval -- --score photo-eval-out/rubric.csv
 *
 * This command never claims the go/no-go gate. Node 20.16+ (CompressionStream).
 * The app's own test suite still needs Node 22.12+.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { decode as decodeJpeg } from 'jpeg-js';
import { renderLessonPreview } from '../../src/photo/compare';
import { applyOrientation, downscaleLongEdge } from '../../src/photo/image-ops';
import { readJpegOrientation } from '../../src/photo/jpeg-orientation';
import type { TokenUsage } from '../../src/photo/openai';
import { openAiClients } from '../../src/photo/openai';
import { runPhotoPipeline } from '../../src/photo/pipeline';
import { encodePng, decodePng, type RgbaImage } from '../../src/photo/png';
import { DEFAULT_TEXT_MODEL, type PhotoVariant } from '../../src/photo/prompts';
import { computeRubric, parseRubricCsv, rubricCsv, type RubricRow } from '../../src/photo/rubric';
import { composeContactSheet } from '../../src/photo/sheet';

const OUT_DIR = path.join(process.cwd(), 'photo-eval-out');

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (arg === '--score') {
    const file = process.argv[3];
    if (!file) {
      console.error('Usage: npm run photo-eval -- --score <rubric.csv>');
      process.exit(1);
    }
    report(computeRubric(parseRubricCsv(await readFile(file, 'utf8'))));
    return;
  }
  if (!arg || arg.startsWith('-')) {
    console.error('Usage: OPENAI_API_KEY=... npm run photo-eval -- <photo-directory>');
    process.exit(1);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set.');
    process.exit(1);
  }

  const names = (await readdir(arg)).filter((name) => /\.(png|jpe?g|webp)$/i.test(name)).sort();
  if (names.length === 0) {
    console.error(`No PNG or JPEG photos in ${arg}`);
    process.exit(1);
  }

  const clients = openAiClients(apiKey);
  const variant = evalVariant(process.env.PHOTO_EVAL_VARIANT);
  const flatUsd = flatImageUsd(process.env.OPENAI_IMAGE_USD);
  const rows: RgbaImage[][] = [];
  const htmlRows: string[] = [];
  const metrics: PhotoMetric[] = [];
  let failures = 0;

  for (const name of names) {
    if (name.toLowerCase().endsWith('.webp')) {
      console.error(`Skipping ${name}: WebP is not decoded by this harness.`);
      failures += 1;
      metrics.push({ file: name, ok: false, error: 'webp' });
      continue;
    }
    const started = Date.now();
    try {
      const bytes = new Uint8Array(await readFile(path.join(arg, name)));
      const photo = await toPng(bytes, name);
      const result = await runPhotoPipeline({
        png: photo.png,
        variant,
        idempotencyKey: evalKey(name, photo.png),
        signal: AbortSignal.timeout(120_000),
        ...(process.env.OPENAI_IMAGE_MODEL ? { configuredImageModel: process.env.OPENAI_IMAGE_MODEL } : {}),
        textModel: process.env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
        lessonId: `photo-eval-${slug(name)}`,
      }, clients);
      const ms = Date.now() - started;
      const photoImage = await decodePng(photo.png);
      const illustration = await decodePng(result.illustrationPng);
      const render = renderLessonPreview(result.lesson, 320);
      rows.push([photoImage, illustration, render]);
      const photoB64 = base64(photo.png);
      const illustrationB64 = base64(result.illustrationPng);
      const renderPng = await encodePng(render);
      const renderB64 = base64(renderPng);
      htmlRows.push(htmlRow(name, photoB64, illustrationB64, renderB64, ms, result.model, result.imageUsage, flatUsd, result.needsReview));
      metrics.push({
        file: name,
        ok: true,
        ms,
        model: result.model,
        imageUsage: result.imageUsage,
        textUsage: result.textUsage,
        costUsd: flatUsd,
        needsReview: result.needsReview,
        targetHash: result.targetHash,
      });
      console.log(`${name}: ${ms} ms, model ${result.model}, image tokens ${result.imageUsage?.totalTokens ?? 'unknown'}`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message.slice(0, 180) : 'failed';
      metrics.push({ file: name, ok: false, ms: Date.now() - started, error: message });
      htmlRows.push(`<tr><td>${escapeHtml(name)}</td><td colspan="3">${escapeHtml(message)}</td></tr>`);
      console.error(`${name}: ${message}`);
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  const sheet = await encodePng(composeContactSheet(rows));
  await writeFile(path.join(OUT_DIR, 'contact-sheet.png'), sheet);
  const rubricPath = path.join(OUT_DIR, 'rubric.csv');
  const rubric = await mergeRubric(rubricPath, names.filter((name) => !name.toLowerCase().endsWith('.webp')));
  await writeFile(rubricPath, rubric);
  const computation = computeRubric(parseRubricCsv(rubric));
  const payload = { claimedPass: false as const, rubric: computation, photos: metrics };
  await writeFile(path.join(OUT_DIR, 'metrics.json'), `${JSON.stringify(payload, null, 2)}\n`);
  const sheetB64 = base64(sheet);
  await writeFile(path.join(OUT_DIR, 'contact-sheet.html'), htmlPage(sheetB64, htmlRows.join('\n'), computation.note));
  report(computation);
  console.log(`Wrote ${OUT_DIR}`);
  console.log('This run does not pass the go/no-go gate.');
  if (failures > 0) process.exit(1);
}

function report(result: ReturnType<typeof computeRubric>): void {
  console.log(`Rubric counted (not a pass): ${result.counted}`);
  console.log('claimedPass: false');
  console.log(result.note);
}

async function toPng(bytes: Uint8Array, name: string): Promise<{ png: Uint8Array }> {
  const lower = name.toLowerCase();
  let image: RgbaImage;
  if (lower.endsWith('.png')) {
    image = await decodePng(bytes);
  } else {
    const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
    image = applyOrientation(
      { width: decoded.width, height: decoded.height, data: decoded.data },
      readJpegOrientation(bytes),
    );
  }
  return { png: await encodePng(downscaleLongEdge(image)) };
}

async function mergeRubric(file: string, names: readonly string[]): Promise<string> {
  let previous: readonly RubricRow[] = [];
  try {
    previous = parseRubricCsv(await readFile(file, 'utf8'));
  } catch {
    previous = [];
  }
  const rows = names.map((name) => previous.find((row) => row.file === name) ?? { file: name, scores: {}, criticalStructure: false });
  return rubricCsv(rows);
}

function evalVariant(value: string | undefined): PhotoVariant {
  if (value === 'faithful' || value === 'simple' || value === 'default') return value;
  return 'default';
}

function flatImageUsd(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function evalKey(name: string, bytes: Uint8Array): string {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  return `eval-${digest}-${slug(name)}`.slice(0, 80);
}

function slug(name: string): string {
  const cleaned = name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  return cleaned.length >= 1 ? cleaned : 'photo';
}

interface PhotoMetric {
  readonly file: string;
  readonly ok: boolean;
  readonly ms?: number;
  readonly model?: string;
  readonly imageUsage?: TokenUsage | null;
  readonly textUsage?: TokenUsage | null;
  readonly costUsd?: number | null;
  readonly needsReview?: boolean;
  readonly targetHash?: string;
  readonly error?: string;
}

function htmlRow(
  name: string,
  photo: string,
  illustration: string,
  render: string,
  ms: number,
  model: string,
  usage: TokenUsage | null,
  costUsd: number | null,
  needsReview: boolean,
): string {
  const cost = costUsd === null ? 'unknown' : String(costUsd);
  const tokens = usage ? String(usage.totalTokens) : 'unknown';
  return `<tr><td>${escapeHtml(name)}<br>${ms} ms<br>${escapeHtml(model)}<br>tokens ${tokens}<br>usd ${cost}${needsReview ? '<br>review' : ''}</td>`
    + `<td><img alt="" src="data:image/png;base64,${photo}"></td>`
    + `<td><img alt="" src="data:image/png;base64,${illustration}"></td>`
    + `<td><img alt="" src="data:image/png;base64,${render}"></td></tr>`;
}

function htmlPage(sheet: string, rows: string, note: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<meta charset="utf-8">
<title>Photo eval</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; }
  img { max-width: 320px; background: white; }
  td { vertical-align: top; padding: 8px; }
  .note { border: 1px solid #c08a1e; background: #fdf0d5; padding: 12px; }
</style>
<p class="note">${escapeHtml(note)} claimedPass is false. This page is not a pass.</p>
<p><img alt="Contact sheet" src="data:image/png;base64,${sheet}"></p>
<table>
<thead><tr><th>Photo</th><th>Foto</th><th>Ilustrasi</th><th>Langkah</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</html>
`;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

await main();
