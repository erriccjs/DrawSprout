// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUNDLED_LESSONS } from '../lesson-data';
import { assemblePrecacheManifest } from './vite-plugin';

describe('precache manifest from a build directory', () => {
  let directory = '';

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  async function writeShell(script: string): Promise<void> {
    directory = await mkdtemp(path.join(tmpdir(), 'drawsprout-dist-'));
    await mkdir(path.join(directory, 'assets'));
    await writeFile(path.join(directory, 'index.html'), '<!doctype html><script src="/assets/app.js"></script>');
    await writeFile(path.join(directory, 'assets', 'app.js'), script);
    await writeFile(path.join(directory, 'assets', 'app.css'), 'body{}');
    await writeFile(path.join(directory, 'icon.svg'), '<svg></svg>');
    await writeFile(path.join(directory, 'manifest.webmanifest'), '{}');
    await writeFile(path.join(directory, 'sw.js'), '/* previous worker */');
    await writeFile(path.join(directory, '_headers'), '/sw.js\n  Cache-Control: no-cache\n');
  }

  it('includes the shell and every bundled lesson, and leaves the worker out', async () => {
    const script = BUNDLED_LESSONS.map((lesson) => `${lesson.id} ${lesson.title}`).join('\n');
    await writeShell(script);

    const manifest = await assemblePrecacheManifest(directory);

    expect(manifest.entries.map((entry) => entry.url).sort()).toEqual([
      '/assets/app.css',
      '/assets/app.js',
      '/icon.svg',
      '/index.html',
      '/manifest.webmanifest',
    ]);
    expect(manifest.lessons.map((lesson) => lesson.id).sort()).toEqual(
      BUNDLED_LESSONS.map((lesson) => lesson.id).sort(),
    );
    const scriptEntry = manifest.entries.find((entry) => entry.url === '/assets/app.js');
    expect(scriptEntry?.revision).toHaveLength(64);
  });

  it('fails when a bundled lesson is missing from the scripts', async () => {
    await writeShell('var app = 1;');
    await expect(assemblePrecacheManifest(directory)).rejects.toThrow(/cat-sitting/);
  });

  it('fails when the shell has no index document', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'drawsprout-dist-'));
    await expect(assemblePrecacheManifest(directory)).rejects.toThrow(/index.html/);
  });
});
