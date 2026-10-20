import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUNDLED_LESSONS } from '../lesson-data';
import {
  buildPrecacheManifest,
  cacheNameFor,
  fillPrecache,
  lessonsAreCovered,
  retiredPrecacheNames,
  resolveFetch,
  sha256Hex,
  shouldPrecache,
  uncoveredLessons,
  type FetchedAsset,
  type PrecacheEntry,
  type PrecacheFile,
} from './precache';

const encoder = new TextEncoder();

function file(path: string, text: string): PrecacheFile {
  return { path, bytes: encoder.encode(text) };
}

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('precache manifest', () => {
  it('keeps the shell and drops the worker script and source maps', () => {
    expect(shouldPrecache('index.html')).toBe(true);
    expect(shouldPrecache('assets/index-abc.js')).toBe(true);
    expect(shouldPrecache('assets/index-abc.css')).toBe(true);
    expect(shouldPrecache('manifest.webmanifest')).toBe(true);
    expect(shouldPrecache('icon.svg')).toBe(true);
    expect(shouldPrecache('sw.js')).toBe(false);
    expect(shouldPrecache('assets/index-abc.js.map')).toBe(false);
    expect(shouldPrecache('.vite/manifest.json')).toBe(false);
    expect(shouldPrecache('_headers')).toBe(false);
    expect(shouldPrecache('_redirects')).toBe(false);
  });

  it('names the cache from the manifest revision and only retires older precaches', () => {
    const current = cacheNameFor('rev-new');
    expect(retiredPrecacheNames([
      current,
      cacheNameFor('rev-old'),
      'drawsprout',
      'some-other-cache',
    ], current)).toEqual([cacheNameFor('rev-old')]);
  });

  it('lists every bundled lesson and changes revision when a file changes', () => {
    const lessons = BUNDLED_LESSONS.map((lesson) => ({
      id: lesson.id,
      contentVersion: lesson.contentVersion,
    }));
    const script = file('assets/app.js', BUNDLED_LESSONS.map((lesson) => `${lesson.id} ${lesson.title}`).join('\n'));
    const shell = [file('index.html', '<html></html>'), script, file('icon.svg', '<svg></svg>')];

    const manifest = buildPrecacheManifest(shell, lessons, hash);

    expect(manifest.entries.map((entry) => entry.url)).toEqual([
      '/assets/app.js',
      '/icon.svg',
      '/index.html',
    ]);
    expect(manifest.lessons.map((lesson) => lesson.id).sort()).toEqual(lessons.map((lesson) => lesson.id).sort());
    expect(manifest.revision).toHaveLength(64);

    const edited = buildPrecacheManifest(
      [file('index.html', '<html>edited</html>'), script, file('icon.svg', '<svg></svg>')],
      lessons,
      hash,
    );
    expect(edited.revision).not.toBe(manifest.revision);
  });

  it('treats a script that contains every bundled lesson as covering the catalogue', () => {
    const markers = BUNDLED_LESSONS.map((lesson) => ({ id: lesson.id, title: lesson.title }));
    const text = BUNDLED_LESSONS.map((lesson) => `${lesson.id}\n${lesson.title}`).join('\n');
    expect(uncoveredLessons([{ path: 'assets/index.js', text }], markers)).toEqual([]);
    expect(uncoveredLessons([{ path: 'assets/index.css', text }], markers).map((lesson) => lesson.id))
      .toEqual(markers.map((lesson) => lesson.id));
  });

  it('reports a bundled lesson that the scripts do not contain', () => {
    const markers = BUNDLED_LESSONS.map((lesson) => ({ id: lesson.id, title: lesson.title }));
    const present = markers.slice(1);
    const text = present.map((lesson) => `${lesson.id} ${lesson.title}`).join('\n');
    expect(uncoveredLessons([{ path: 'assets/index.js', text }], markers)).toEqual([markers[0]]);
  });
});

describe('offline-ready gate', () => {
  const required = BUNDLED_LESSONS.map((lesson) => ({
    id: lesson.id,
    contentVersion: lesson.contentVersion,
  }));

  it('stays closed until every bundled lesson is reported at its content version', () => {
    expect(lessonsAreCovered([], required)).toBe(false);
    expect(lessonsAreCovered(required.slice(1), required)).toBe(false);
    expect(lessonsAreCovered(
      required.map((lesson) => ({ ...lesson, contentVersion: 'other' })),
      required,
    )).toBe(false);
    expect(lessonsAreCovered(required, required)).toBe(true);
    expect(lessonsAreCovered([], [])).toBe(false);
  });
});

describe('precache validation', () => {
  const entries: PrecacheEntry[] = [
    { url: '/index.html', revision: 'html-hash' },
    { url: '/assets/app.js', revision: 'js-hash' },
  ];

  function fetched(url: string, status = 200): Promise<FetchedAsset> {
    return Promise.resolve({
      status,
      bytes: encoder.encode(url).buffer,
      contentType: url.endsWith('.js') ? 'text/javascript' : 'text/html',
    });
  }

  it('stores each file only after every revision matches', async () => {
    const written: string[] = [];
    await fillPrecache(
      entries,
      fetched,
      (bytes) => {
        const url = new TextDecoder().decode(bytes);
        return Promise.resolve(entries.find((entry) => entry.url === url)?.revision ?? 'missing');
      },
      {
        put(url, bytes, contentType) {
          written.push(`${url} ${bytes.byteLength} ${contentType ?? ''}`);
          return Promise.resolve();
        },
      },
    );
    expect(written).toEqual([
      `/index.html ${encoder.encode('/index.html').byteLength} text/html`,
      `/assets/app.js ${encoder.encode('/assets/app.js').byteLength} text/javascript`,
    ]);
  });

  it('refuses a revision mismatch before storing any file', async () => {
    const written: string[] = [];
    await expect(fillPrecache(
      entries,
      () => Promise.resolve({ status: 200, bytes: new ArrayBuffer(1), contentType: null }),
      () => Promise.resolve('different'),
      { put(url) { written.push(url); return Promise.resolve(); } },
    )).rejects.toThrow(/revision mismatch/);
    expect(written).toEqual([]);
  });

  it('refuses a failed download and an empty shell', async () => {
    await expect(fillPrecache(
      entries,
      () => Promise.resolve({ status: 404, bytes: new ArrayBuffer(0), contentType: null }),
      () => Promise.resolve('unused'),
      { put() { return Promise.resolve(); } },
    )).rejects.toThrow(/HTTP 404/);

    await expect(fillPrecache(
      [],
      () => Promise.resolve({ status: 200, bytes: new ArrayBuffer(0), contentType: null }),
      () => Promise.resolve('unused'),
      { put() { return Promise.resolve(); } },
    )).rejects.toThrow(/empty precache/);

    await expect(fillPrecache(
      [{ url: '/assets/app.js', revision: 'js-hash' }],
      () => Promise.resolve({ status: 200, bytes: new ArrayBuffer(0), contentType: null }),
      () => Promise.resolve('js-hash'),
      { put() { return Promise.resolve(); } },
    )).rejects.toThrow(/index.html/);
  });

  it('uses the same SHA-256 hex as the build hash', async () => {
    const bytes = encoder.encode('drawsprout');
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    expect(await sha256Hex(buffer)).toBe(hash(bytes));
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('does not answer a revalidating install fetch from the old cache', () => {
    const precachedUrls = ['/index.html', '/assets/app.js'];
    expect(resolveFetch({
      method: 'GET', sameOrigin: true, pathname: '/index.html', mode: 'cors',
      cacheMode: 'reload', precachedUrls,
    })).toBe('passthrough');
    expect(resolveFetch({
      method: 'GET', sameOrigin: true, pathname: '/sw.js', mode: 'same-origin',
      cacheMode: 'default', precachedUrls,
    })).toBe('passthrough');
    expect(resolveFetch({
      method: 'GET', sameOrigin: true, pathname: '/lesson/new', mode: 'navigate',
      cacheMode: 'default', precachedUrls,
    })).toBe('navigate');
    expect(resolveFetch({
      method: 'GET', sameOrigin: true, pathname: '/assets/app.js', mode: 'same-origin',
      cacheMode: 'default', precachedUrls,
    })).toBe('precache');
    expect(resolveFetch({
      method: 'POST', sameOrigin: true, pathname: '/index.html', mode: 'same-origin',
      cacheMode: 'default', precachedUrls,
    })).toBe('passthrough');
    expect(resolveFetch({
      method: 'GET', sameOrigin: false, pathname: '/index.html', mode: 'navigate',
      cacheMode: 'default', precachedUrls,
    })).toBe('passthrough');
  });
});
