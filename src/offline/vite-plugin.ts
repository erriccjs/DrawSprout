/**
 * Writes `dist/sw.js` after Vite has emitted the shell.
 *
 * The worker is generated only for a production build. Its manifest is the
 * file list just written, minus the worker itself, and the build fails when a
 * bundled lesson is missing from those scripts.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';
import { BUNDLED_LESSONS } from '../lesson-data';
import {
  buildPrecacheManifest,
  shouldPrecache,
  uncoveredLessons,
  type PrecacheFile,
  type PrecacheManifest,
} from './precache';

function contentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function collectDistFiles(distDir: string): Promise<PrecacheFile[]> {
  const files: PrecacheFile[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(distDir, absolute).split(path.sep).join('/');
      if (!shouldPrecache(relative)) continue;
      files.push({ path: relative, bytes: new Uint8Array(await readFile(absolute)) });
    }
  }

  await walk(distDir);
  return files;
}

/** Manifest for `distDir`, or an error when the shell or a lesson is missing. */
export async function assemblePrecacheManifest(distDir: string): Promise<PrecacheManifest> {
  const files = await collectDistFiles(distDir);
  if (!files.some((file) => file.path === 'index.html')) {
    throw new Error('Offline precache requires dist/index.html.');
  }

  const scripts = files
    .filter((file) => file.path.endsWith('.js'))
    .map((file) => ({ path: file.path, text: new TextDecoder().decode(file.bytes) }));
  const markers = BUNDLED_LESSONS.map((lesson) => ({ id: lesson.id, title: lesson.title }));
  const missing = uncoveredLessons(scripts, markers);
  if (missing.length > 0) {
    const ids = missing.map((lesson) => lesson.id).join(', ');
    throw new Error(`Precache is missing bundled lessons: ${ids}.`);
  }

  return buildPrecacheManifest(
    files,
    BUNDLED_LESSONS.map((lesson) => ({ id: lesson.id, contentVersion: lesson.contentVersion })),
    contentHash,
  );
}

export async function bundleServiceWorker(outfile: string, manifest: PrecacheManifest): Promise<void> {
  await build({
    entryPoints: [path.resolve('src/offline/service-worker.ts')],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'none',
    logLevel: 'silent',
    define: {
      __PRECACHE_MANIFEST__: JSON.stringify(manifest),
    },
  });
}

export function drawsproutOffline(): Plugin {
  let outDir = path.resolve('dist');

  return {
    name: 'drawsprout-offline',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const manifest = await assemblePrecacheManifest(outDir);
      await bundleServiceWorker(path.join(outDir, 'sw.js'), manifest);
    },
  };
}
