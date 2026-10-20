// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUNDLED_LESSONS } from '../lesson-data';
import { buildPrecacheManifest } from './precache';
import { bundleServiceWorker } from './vite-plugin';

const encoder = new TextEncoder();

describe('service worker', () => {
  let directory = '';

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('activates only when the page asks, and never mentions the drawing database', async () => {
    const source = await readFile(new URL('./service-worker.ts', import.meta.url), 'utf8');
    expect(source.match(/scope\.skipWaiting\(/g)).toHaveLength(1);
    expect(source).not.toMatch(/indexedDB|localStorage|deleteDatabase/);
    expect(source).toContain('fillPrecache');
    expect(source).toContain('resolveFetch');
    expect(source).toContain('retiredPrecacheNames');
  });

  it('bundles a precache of the shell that names every bundled lesson', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'drawsprout-sw-'));
    const manifest = buildPrecacheManifest(
      [{ path: 'index.html', bytes: encoder.encode('<!doctype html>') }],
      BUNDLED_LESSONS.map((lesson) => ({ id: lesson.id, contentVersion: lesson.contentVersion })),
      (bytes) => createHash('sha256').update(bytes).digest('hex'),
    );
    const outfile = path.join(directory, 'sw.js');
    await bundleServiceWorker(outfile, manifest);
    const bundled = await readFile(outfile, 'utf8');

    expect(bundled).toContain('/index.html');
    for (const lesson of BUNDLED_LESSONS) {
      expect(bundled).toContain(lesson.id);
      expect(bundled).toContain(lesson.contentVersion);
    }
    expect(bundled.match(/\.skipWaiting\(/g)).toHaveLength(1);
    expect(bundled).toContain(manifest.revision);
    expect(bundled).not.toMatch(/indexedDB|localStorage|deleteDatabase/);
  });
});
