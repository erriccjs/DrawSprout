/**
 * Send the five sample photos through the category matcher, and write a
 * contact sheet for each done lesson.
 *
 *   npx esbuild scripts/photo-eval/category-sheets.ts --bundle --platform=node --format=esm --outfile=/tmp/photo-eval.mjs
 *   node /tmp/photo-eval.mjs
 *
 * OPENAI_API_KEY is required for the live match. The sheets render either way.
 * The script does not print the key or the photo bytes.
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applyPhotoToLesson } from '../../src/categories/apply';
import { CATEGORY_LESSONS, doneCategory } from '../../src/categories/library';
import { interpretMatch } from '../../src/categories/match';
import { classifyPhoto } from '../../src/categories/openai';
import { matchCostUsd } from '../../src/categories/pricing';
import { contactSheetHtml } from '../../src/categories/sheet';

const root = process.cwd();
const samplesDir = path.join(root, 'scripts/photo-eval/samples');
const outDir = process.env.PHOTO_EVAL_OUT ?? '/opt/cursor/artifacts/category-lessons';

interface SampleReport {
  readonly file: string;
  readonly matched: boolean;
  readonly category: string;
  readonly confidence: number;
  readonly facing: string;
  readonly pose: string;
  readonly colours: readonly { readonly part: string; readonly color: string }[];
  readonly colourSteps: readonly { readonly step: string; readonly color: string }[];
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly imageInputTokens: number | null;
  readonly listCostUsd: number | null;
  readonly model: string | null;
  readonly error?: string;
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const sheets: string[] = [];
  let port = 9400;
  for (const entry of CATEGORY_LESSONS) {
    const htmlPath = path.join(outDir, `${entry.id}.html`);
    const pngPath = path.join(outDir, `${entry.id}.png`);
    await writeFile(htmlPath, contactSheetHtml(entry));
    await screenshot(htmlPath, pngPath, port);
    port += 1;
    const size = (await readFile(pngPath)).byteLength;
    if (size < 1000) throw new Error(`Contact sheet for ${entry.id} was empty`);
    sheets.push(pngPath);
    console.log(`sheet ${entry.id} ${size} bytes`);
  }

  const files = (await readdir(samplesDir)).filter((name) => name.endsWith('.jpg')).sort();
  const reports: SampleReport[] = [];
  const apiKey = process.env.OPENAI_API_KEY;
  for (const file of files) {
    if (!apiKey) {
      reports.push(emptyReport(file, 'OPENAI_API_KEY is not set'));
      continue;
    }
    const bytes = await readFile(path.join(samplesDir, file));
    try {
      const classified = await classifyPhoto({
        apiKey,
        image: bytes,
        mediaType: 'image/jpeg',
        idempotencyKey: `category-eval-${file}`,
        signal: AbortSignal.timeout(45_000),
      });
      const match = interpretMatch(classified.raw);
      const entry = doneCategory(match.category);
      const lesson = match.matched && entry
        ? applyPhotoToLesson(entry, { facing: match.facing, colours: match.colours })
        : null;
      const colourSteps = lesson
        ? lesson.steps.filter((step) => step.phase === 'color').map((step) => ({ step: step.id, color: step.toolPreset.color }))
        : [];
      const usage = classified.usage;
      reports.push({
        file,
        matched: match.matched,
        category: match.category,
        confidence: match.confidence,
        facing: match.facing,
        pose: match.pose,
        colours: match.colours,
        colourSteps,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        imageInputTokens: usage?.imageInputTokens ?? null,
        listCostUsd: usage ? matchCostUsd(usage) : null,
        model: classified.model,
      });
      console.log(`${file} ${match.category} ${match.confidence} $${usage ? matchCostUsd(usage) : '?'}`);
    } catch (error) {
      const message = error instanceof Error ? error.name : 'Error';
      reports.push(emptyReport(file, message));
      console.log(`${file} failed ${message}`);
    }
  }

  const report = { sheets, samples: reports };
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`wrote ${path.join(outDir, 'report.json')}`);
}

function emptyReport(file: string, error: string): SampleReport {
  return {
    file,
    matched: false,
    category: 'none',
    confidence: 0,
    facing: 'unknown',
    pose: '',
    colours: [],
    colourSteps: [],
    inputTokens: null,
    outputTokens: null,
    imageInputTokens: null,
    listCostUsd: null,
    model: null,
    error,
  };
}

function screenshot(htmlPath: string, pngPath: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn('google-chrome', [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-extensions',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/chrome-sheet-${port}`,
      '--window-size=1360,1200',
      '--virtual-time-budget=3000',
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ], { stdio: 'ignore' });
    const timer = setTimeout(() => child.kill('SIGKILL'), 20_000);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

await main();
