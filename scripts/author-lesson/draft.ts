/**
 * Draft one lesson from the command line.
 *
 *   REPLICATE_API_KEY=... npx tsx scripts/author-lesson/draft.ts dinosaur
 *
 * The key stays in the environment. The JSON file is a draft for review,
 * not a lesson the app ships.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { draftLessonWithReplicate } from '../../src/authoring/replicate';

const name = process.argv.slice(2).join(' ').trim();
const apiKey = process.env.REPLICATE_API_KEY?.trim() ?? '';

if (!name || !apiKey) {
  console.error('Usage: REPLICATE_API_KEY=... npx tsx scripts/author-lesson/draft.ts <category name>');
  process.exit(1);
}

const draft = await draftLessonWithReplicate({ apiKey, name });
const directory = path.join(process.cwd(), 'drafts');
await mkdir(directory, { recursive: true });
const file = path.join(directory, `${draft.id || 'lesson'}.json`);
await writeFile(file, `${JSON.stringify(draft, null, 2)}\n`);
console.log(file);
