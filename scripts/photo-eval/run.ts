/**
 * Photo evaluation harness.
 *
 *   OPENAI_API_KEY=... npm run photo-eval -- <photo-directory>
 *   OPENAI_API_KEY=... npm run photo-eval -- <photo-directory> --out <directory>
 *   REPLICATE_API_KEY=... npm run photo-eval -- <photo-directory> --provider replicate --model <id>
 *   npm run photo-eval -- <photo-directory> --compare
 *   npm run photo-eval -- <photo-directory> --steps strokes
 *   npm run photo-eval -- <photo-directory> --steps reverse --out <directory>
 *   npm run photo-eval -- <photo-directory> --steps both --out <directory>
 *
 * `--steps` defaults to `strokes` (call A's ink, two image calls). `reverse`
 * erases one part at a time at low quality. `both` keeps the stroke lesson and
 * adds the reverse images on the sheet. A v12 run and a v13 run are different
 * paid jobs; write v13 to its own `--out` directory. `reverseUsd` is only the
 * erase edits. `costUsd` is the whole job.
 *
 * `--compare` runs OpenAI and flux-kontext-pro. flux-1.1-pro is unsuitable.
 *
 * `PHOTO_EVAL_OUT` sets the same output directory. The default is
 * ./photo-eval-out/. The contact sheet shows the photo, the illustration,
 * and a cumulative render of each lesson step. Raw images are written to
 * illustrations/<photo>-line.png and illustrations/<photo>-colour.png.
 *
 * Recompute a filled rubric without calling the API:
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
import { renderCumulativeStep } from '../../src/photo/compare';
import { applyOrientation, downscaleLongEdge } from '../../src/photo/image-ops';
import { readJpegOrientation } from '../../src/photo/jpeg-orientation';
import type { TokenUsage } from '../../src/photo/openai';
import { openAiClients } from '../../src/photo/openai';
import { runPhotoPipeline, type PhotoStepMode } from '../../src/photo/pipeline';
import { imageProvider, replicateApiKey, type ImageProvider } from '../../src/photo/provider';
import { DEFAULT_REPLICATE_MODEL, replicateEditor } from '../../src/photo/replicate';
import { encodePng, decodePng, type RgbaImage } from '../../src/photo/png';
import { listCostUsd } from '../../src/photo/pricing';
import { DEFAULT_TEXT_MODEL, type PhotoVariant } from '../../src/photo/prompts';
import { computeRubric, parseRubricCsv, rubricCsv, type RubricRow } from '../../src/photo/rubric';
import { composeContactSheet } from '../../src/photo/sheet';

/** Bumped when the prompt or the lesson builder changes, so a rerun is a new paid job. */
const EVAL_KEY_REVISION = 'v13';

interface Args {
  readonly score?: string;
  readonly out?: string;
  readonly dir?: string;
  readonly provider?: ImageProvider;
  readonly model?: string;
  readonly compare?: boolean;
  readonly steps?: PhotoStepMode;
}

interface Job {
  readonly provider: ImageProvider;
  readonly model?: string;
  readonly label: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.score !== undefined) {
    if (!args.score) {
      console.error('Usage: npm run photo-eval -- --score <rubric.csv>');
      process.exit(1);
    }
    report(computeRubric(parseRubricCsv(await readFile(args.score, 'utf8'))));
    return;
  }
  if (!args.dir) {
    console.error('Usage: OPENAI_API_KEY=... npm run photo-eval -- <photo-directory> [--out <directory>] [--provider replicate --model <id>] [--compare] [--steps strokes|reverse|both]');
    process.exit(1);
  }
  const jobs = resolveJobs(args);
  if (!args.compare) {
    const only = jobs[0];
    if (!only || !keyFor(only.provider)) {
      console.error(only?.provider === 'replicate' ? 'REPLICATE_API_KEY is not set.' : 'OPENAI_API_KEY is not set.');
      process.exit(1);
    }
  }

  const outDir = path.resolve(args.out || process.env.PHOTO_EVAL_OUT || path.join(process.cwd(), 'photo-eval-out'));
  const names = (await readdir(args.dir)).filter((name) => /\.(png|jpe?g|webp)$/i.test(name)).sort();
  if (names.length === 0) {
    console.error(`No PNG or JPEG photos in ${args.dir}`);
    process.exit(1);
  }

  const variant = evalVariant(process.env.PHOTO_EVAL_VARIANT);
  const textModel = process.env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
  const rows: RgbaImage[][] = [];
  const htmlRows: string[] = [];
  const metrics: PhotoMetric[] = [];
  let failures = 0;
  const stepMode = args.steps ?? 'strokes';
  console.log(`Photo eval: ${names.length} file(s), variant ${variant}, steps ${stepMode}, jobs ${jobs.map((job) => job.label).join(', ')}, output ${outDir}`);

  for (const name of names) {
    if (name.toLowerCase().endsWith('.webp')) {
      console.error(`Skipping ${name}: WebP is not decoded by this harness.`);
      failures += 1;
      metrics.push({ file: name, ok: false, error: 'webp' });
      continue;
    }
    const bytes = new Uint8Array(await readFile(path.join(args.dir, name)));
    let photo: { png: Uint8Array };
    try {
      photo = await toPng(bytes, name);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message.slice(0, 300) : 'failed';
      metrics.push({ file: name, ok: false, error: message });
      htmlRows.push(`<section><h2>${escapeHtml(name)}</h2><p>${escapeHtml(message)}</p></section>`);
      console.error(`${name}: ${message}`);
      continue;
    }
    for (const job of jobs) {
    const started = Date.now();
    const label = jobs.length > 1 ? `${job.label}: ${name}` : name;
    const clients = clientsFor(job);
    if (!clients) {
      failures += 1;
      const message = job.provider === 'replicate' ? 'REPLICATE_API_KEY is not set.' : 'OPENAI_API_KEY is not set.';
      metrics.push({ file: name, provider: job.label, ok: false, error: message });
      htmlRows.push(`<section><h2>${escapeHtml(label)}</h2><p>${escapeHtml(message)}</p></section>`);
      console.error(`${label}: ${message}`);
      if (args.compare) process.exit(1);
      continue;
    }
    try {
      const flatUsd = flatImageUsd(job.provider === 'replicate' ? process.env.REPLICATE_IMAGE_USD : process.env.OPENAI_IMAGE_USD);
      const result = await runPhotoPipeline({
        png: photo.png,
        variant,
        provider: job.provider,
        idempotencyKey: evalKey(name, photo.png, job),
        signal: AbortSignal.timeout(stepMode === 'strokes' ? 180_000 : 420_000),
        ...(job.model ? { configuredImageModel: job.model } : {}),
        textModel,
        lessonId: `photo-eval-${slug(name)}`,
        stepMode,
      }, clients);
      const ms = Date.now() - started;
      const photoImage = await decodePng(photo.png);
      const illustration = await decodePng(result.illustrationPng);
      const stepImages = result.lesson.steps.map((_, index) => renderCumulativeStep(result.lesson, index + 1, 280, { r: 255, g: 255, b: 255 }, true));
      const reverseImages = result.reverseLesson
        ? result.reverseLesson.steps.map((_, index) => renderCumulativeStep(result.reverseLesson!, index + 1, 280, { r: 255, g: 255, b: 255 }, true))
        : [];
      const reverseStageImages = [];
      for (const png of result.reverseStages) {
        try {
          reverseStageImages.push(await decodePng(png));
        } catch {
          // A stage that is not a PNG is left off the sheet.
        }
      }
      const cells = [photoImage, illustration, ...stepImages];
      if (reverseImages.length > 0 || reverseStageImages.length > 0) {
        cells.push(...(reverseStageImages.length > 0 ? reverseStageImages : reverseImages));
      }
      for (let index = 0; index < cells.length; index += 6) rows.push(cells.slice(index, index + 6));
      const priced = listCostUsd({
        imageModel: result.model,
        image: result.imageUsage,
        textModel,
        text: result.textUsage,
        imageCalls: result.imageCalls,
      });
      const reversePriced = result.reverseCalls > 0
        ? listCostUsd({
          imageModel: result.model,
          image: result.reverseUsage,
          textModel,
          text: null,
          imageCalls: result.reverseCalls,
        })
        : null;
      const costUsd = flatUsd ?? priced.usd;
      const reverseUsd = reversePriced?.imageUsd ?? null;
      const photoB64 = base64(photo.png);
      const illustrationB64 = base64(result.illustrationPng);
      const stem = `${slug(name)}${jobs.length > 1 ? `-${slug(job.label)}` : ''}`;
      await mkdir(path.join(outDir, 'illustrations'), { recursive: true });
      await writeFile(path.join(outDir, 'illustrations', `${stem}-line.png`), result.lineArtPng);
      if (result.colouredPng) await writeFile(path.join(outDir, 'illustrations', `${stem}-colour.png`), result.colouredPng);
      const stepPngs = await Promise.all(stepImages.map((image) => encodePng(image)));
      const reversePngs = result.reverseLesson
        ? await Promise.all(reverseImages.map((image) => encodePng(image)))
        : result.reverseStages;
      const reverseSteps = result.reverseLesson
        ? result.reverseLesson.steps.map((step, index) => ({
          instruction: step.instruction,
          png: base64(reversePngs[index] ?? new Uint8Array()),
        }))
        : result.reverseStages.map((png, index) => ({ instruction: `erase ${index + 1}`, png: base64(png) }));
      htmlRows.push(htmlRow({
        name: label,
        photo: photoB64,
        illustration: illustrationB64,
        lineArt: base64(result.lineArtPng),
        coloured: result.colouredPng ? base64(result.colouredPng) : '',
        steps: result.lesson.steps.map((step, index) => ({
          instruction: step.instruction,
          png: base64(stepPngs[index] ?? new Uint8Array()),
        })),
        ms,
        model: result.model,
        quality: result.quality,
        imageUsage: result.imageUsage,
        textUsage: result.textUsage,
        costUsd,
        reverseUsd,
        needsReview: result.needsReview,
        reviewReasons: result.reviewReasons,
        regenerated: result.regenerated,
        stepMode,
        reverse: reverseSteps,
      }));
      metrics.push({
        file: name,
        provider: job.label,
        ok: true,
        ms,
        model: result.model,
        quality: result.quality,
        steps: result.lesson.steps.length,
        drawingSteps: result.lesson.steps.filter((step) => step.phase !== 'color').length,
        colorSteps: result.lesson.steps.filter((step) => step.phase === 'color').length,
        coverage: result.coverage,
        imageUsage: result.imageUsage,
        textUsage: result.textUsage,
        costUsd,
        listCostUsd: priced.usd,
        imageUsd: priced.imageUsd,
        textUsd: priced.textUsd,
        reverseCalls: result.reverseCalls,
        reverseUsd,
        needsReview: result.needsReview,
        reviewReasons: result.reviewReasons,
        regenerated: result.regenerated,
        targetHash: result.targetHash,
        stepMode,
        reverseSteps: result.reverseLesson?.steps.length ?? result.reverseStages.length,
      });
      console.log(`${label}: ${ms} ms, ${result.model} ${result.quality}, image ${tokens(result.imageUsage)}, text ${tokens(result.textUsage)}, usd ${costUsd ?? 'unknown'}${reverseUsd !== null ? `, reverse usd ${reverseUsd}` : ''}, steps ${result.lesson.steps.length}, ${stepMode}${result.regenerated ? ', regenerated' : ''}`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message.slice(0, 300) : 'failed';
      metrics.push({ file: name, provider: job.label, ok: false, ms: Date.now() - started, error: message });
      htmlRows.push(`<section><h2>${escapeHtml(label)}</h2><p>${escapeHtml(message)}</p></section>`);
      console.error(`${label}: ${message}`);
      if (args.compare) process.exit(1);
    }
    }
  }

  await mkdir(outDir, { recursive: true });
  const sheet = rows.length > 0 ? await encodePng(composeContactSheet(rows)) : await encodePng({ width: 1, height: 1, data: Uint8Array.of(255, 255, 255, 255) });
  await writeFile(path.join(outDir, 'contact-sheet.png'), sheet);
  const rubricPath = path.join(outDir, 'rubric.csv');
  const rubric = await mergeRubric(rubricPath, names.filter((name) => !name.toLowerCase().endsWith('.webp')));
  await writeFile(rubricPath, rubric);
  const computation = computeRubric(parseRubricCsv(rubric));
  const payload = { claimedPass: false as const, rubric: computation, photos: metrics };
  await writeFile(path.join(outDir, 'metrics.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(path.join(outDir, 'contact-sheet.html'), htmlPage(base64(sheet), htmlRows.join('\n'), computation.note));
  report(computation);
  console.log(`Wrote ${outDir}`);
  console.log('This run does not pass the go/no-go gate.');
  if (failures > 0) process.exit(1);
}

function parseArgs(argv: readonly string[]): Args {
  let score: string | undefined;
  let out: string | undefined;
  let provider: ImageProvider | undefined;
  let model: string | undefined;
  let compare = false;
  let steps: PhotoStepMode | undefined;
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? '';
    if (token === '--score') {
      score = argv[index + 1] ?? '';
      index += 1;
    } else if (token === '--out') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing directory after --out');
      out = value;
      index += 1;
    } else if (token === '--provider') {
      const value = argv[index + 1] ?? '';
      if (value !== 'openai' && value !== 'replicate') throw new Error('Provider must be openai or replicate');
      provider = value;
      index += 1;
    } else if (token === '--model') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing model id after --model');
      model = value;
      index += 1;
    } else if (token === '--compare') {
      compare = true;
    } else if (token === '--steps') {
      const value = argv[index + 1] ?? '';
      if (value !== 'strokes' && value !== 'reverse' && value !== 'both') {
        throw new Error('--steps must be strokes, reverse, or both');
      }
      steps = value;
      index += 1;
    } else if (token.startsWith('-')) {
      throw new Error(`Unknown option ${token}`);
    } else {
      positional.push(token);
    }
  }
  const dir = positional[0];
  return {
    ...(score !== undefined ? { score } : {}),
    ...(out !== undefined ? { out } : {}),
    ...(dir !== undefined ? { dir } : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(compare ? { compare } : {}),
    ...(steps ? { steps } : {}),
  };
}

function resolveJobs(args: Args): Job[] {
  if (args.compare) {
    return [
      { provider: 'openai', label: 'openai' },
      { provider: 'replicate', model: 'black-forest-labs/flux-kontext-pro', label: 'replicate/flux-kontext-pro' },
    ];
  }
  const provider = args.provider ?? imageProvider(process.env.IMAGE_PROVIDER);
  const model = args.model ?? (provider === 'replicate' ? process.env.REPLICATE_IMAGE_MODEL : process.env.OPENAI_IMAGE_MODEL);
  if (model?.includes('flux-1.1-pro')) console.error('flux-1.1-pro is unsuitable: it returns near-photos.');
  const label = provider === 'replicate' ? `replicate/${model || DEFAULT_REPLICATE_MODEL}` : 'openai';
  return [{ provider, ...(model ? { model } : {}), label }];
}

function keyFor(provider: ImageProvider): string | undefined {
  if (provider === 'replicate') {
    return replicateApiKey({
      REPLICATE_API_KEY: process.env.REPLICATE_API_KEY,
      REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
    });
  }
  return process.env.OPENAI_API_KEY;
}

function clientsFor(job: Job): { images: ReturnType<typeof replicateEditor>; instructions?: ReturnType<typeof openAiClients>['instructions'] } | null {
  const key = keyFor(job.provider);
  if (!key) return null;
  if (job.provider === 'replicate') {
    const textKey = process.env.OPENAI_API_KEY;
    return {
      images: replicateEditor(key),
      ...(textKey ? { instructions: openAiClients(textKey).instructions } : {}),
    };
  }
  return openAiClients(key);
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

function evalKey(name: string, bytes: Uint8Array, job: Job): string {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const modelBit = job.provider === 'replicate' ? `-r${(job.model ?? 'kontext').replace(/[^a-z0-9]+/gi, '').slice(-10)}` : '';
  return `eval-${digest}-${slug(name)}${modelBit}-${EVAL_KEY_REVISION}`.slice(0, 80);
}

function slug(name: string): string {
  const cleaned = name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  return cleaned.length >= 1 ? cleaned : 'photo';
}

function tokens(usage: TokenUsage | null): string {
  if (!usage) return 'unknown';
  return `${usage.inputTokens}/${usage.outputTokens}`;
}

interface PhotoMetric {
  readonly file: string;
  readonly provider?: string;
  readonly ok: boolean;
  readonly ms?: number;
  readonly model?: string;
  readonly quality?: string;
  readonly steps?: number;
  readonly drawingSteps?: number;
  readonly colorSteps?: number;
  readonly coverage?: number;
  readonly imageUsage?: TokenUsage | null;
  readonly textUsage?: TokenUsage | null;
  readonly costUsd?: number | null;
  readonly listCostUsd?: number | null;
  readonly imageUsd?: number | null;
  readonly textUsd?: number | null;
  readonly needsReview?: boolean;
  readonly reviewReasons?: readonly string[];
  readonly regenerated?: boolean;
  readonly targetHash?: string;
  readonly stepMode?: string;
  readonly reverseSteps?: number;
  readonly reverseCalls?: number;
  readonly reverseUsd?: number | null;
  readonly error?: string;
}

function htmlRow(input: {
  readonly name: string;
  readonly photo: string;
  readonly illustration: string;
  readonly lineArt: string;
  readonly coloured: string;
  readonly steps: readonly { instruction: string; png: string }[];
  readonly ms: number;
  readonly model: string;
  readonly quality: string;
  readonly imageUsage: TokenUsage | null;
  readonly textUsage: TokenUsage | null;
  readonly costUsd: number | null;
  readonly reverseUsd?: number | null;
  readonly needsReview: boolean;
  readonly reviewReasons: readonly string[];
  readonly regenerated: boolean;
  readonly stepMode?: string;
  readonly reverse?: readonly { instruction: string; png: string }[];
}): string {
  const cost = input.costUsd === null ? 'unknown' : input.costUsd.toFixed(4);
  const figures = (items: readonly { instruction: string; png: string }[]) => items.map((step, index) => (
    `<figure><img alt="" src="data:image/png;base64,${step.png}"><figcaption>${index + 1}. ${escapeHtml(step.instruction)}</figcaption></figure>`
  )).join('');
  const reverse = input.reverse ?? [];
  return `<section><h2>${escapeHtml(input.name)}</h2>`
    + `<p>${input.ms} ms, ${escapeHtml(input.model)} ${escapeHtml(input.quality)}, `
    + `image ${escapeHtml(tokens(input.imageUsage))}, text ${escapeHtml(tokens(input.textUsage))}, usd ${cost}`
    + (input.reverseUsd != null ? `, reverse usd ${input.reverseUsd.toFixed(4)}` : '')
    + `${input.needsReview ? ', review' : ''}${input.regenerated ? ', regenerated' : ''}`
    + (input.stepMode ? `, ${escapeHtml(input.stepMode)}` : '')
    + (input.reviewReasons.length > 0 ? ` — ${escapeHtml(input.reviewReasons.join(' '))}` : '')
    + `</p>`
    + `<div class="pair"><figure><img alt="" src="data:image/png;base64,${input.photo}"><figcaption>photo</figcaption></figure>`
    + `<figure><img alt="" src="data:image/png;base64,${input.lineArt}"><figcaption>line</figcaption></figure>`
    + (input.coloured ? `<figure><img alt="" src="data:image/png;base64,${input.coloured}"><figcaption>colour</figcaption></figure>` : '')
    + `</div>`
    + `<h3>${escapeHtml(input.stepMode === 'reverse' ? 'reverse' : 'strokes')}</h3><div class="steps">${figures(input.steps)}</div>`
    + (reverse.length > 0 ? `<h3>reverse edits</h3><div class="steps">${figures(reverse)}</div>` : '')
    + `</section>`;
}

function htmlPage(sheet: string, rows: string, note: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<meta charset="utf-8">
<title>Photo eval</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; }
  img { max-width: 280px; background: white; }
  .pair, .steps { display: flex; flex-wrap: wrap; gap: 8px; }
  figure { margin: 0; max-width: 280px; }
  figcaption { font-size: 14px; }
  .note { border: 1px solid #c08a1e; background: #fdf0d5; padding: 12px; }
  .sheet { max-width: 100%; }
</style>
<p class="note">${escapeHtml(note)} claimedPass is false. This page is not a pass.</p>
<p><img class="sheet" alt="Contact sheet" src="data:image/png;base64,${sheet}"></p>
${rows}
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`photo-eval failed: ${message}`);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});
