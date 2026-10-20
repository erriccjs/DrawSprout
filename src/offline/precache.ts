/**
 * Precache manifest for the production app shell.
 *
 * Bundled lessons are not separate downloads. They are compiled into the
 * JavaScript the shell loads, so a manifest that lists every built script —
 * and has been checked to contain each lesson id and title — is the offline
 * copy of the catalogue. Drawing data is not part of this manifest.
 */

export interface PrecacheFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface PrecacheLesson {
  readonly id: string;
  readonly contentVersion: string;
}

/** Strings that must survive minification because they are authored literals. */
export interface LessonScriptMarker {
  readonly id: string;
  readonly title: string;
}

export interface PrecacheEntry {
  readonly url: string;
  readonly revision: string;
}

export interface PrecacheManifest {
  /** Hash of every entry, used as the cache name so an old shell can be deleted. */
  readonly revision: string;
  readonly entries: readonly PrecacheEntry[];
  readonly lessons: readonly PrecacheLesson[];
}

export const PRECACHE_CACHE_PREFIX = 'drawsprout-precache-';

/** The service worker script is fetched by the browser's own update check. */
export function shouldPrecache(relativePath: string): boolean {
  if (relativePath === 'sw.js' || relativePath.endsWith('/sw.js')) return false;
  if (relativePath.endsWith('.map')) return false;
  if (relativePath.split('/').some((part) => part.startsWith('.'))) return false;
  return true;
}

export function cacheNameFor(revision: string): string {
  return `${PRECACHE_CACHE_PREFIX}${revision}`;
}

/**
 * Cache names this activation may delete. Anything outside the precache prefix
 * — including a future runtime cache — is left alone.
 */
export function retiredPrecacheNames(existing: readonly string[], current: string): readonly string[] {
  return existing.filter((name) => name.startsWith(PRECACHE_CACHE_PREFIX) && name !== current);
}

export function buildPrecacheManifest(
  files: readonly PrecacheFile[],
  lessons: readonly PrecacheLesson[],
  hash: (bytes: Uint8Array) => string,
): PrecacheManifest {
  const entries = files
    .map((file) => ({
      url: `/${file.path}`,
      revision: hash(file.bytes),
    }))
    .sort((left, right) => (left.url < right.url ? -1 : left.url > right.url ? 1 : 0));
  const revision = hash(new TextEncoder().encode(
    entries.map((entry) => `${entry.url} ${entry.revision}`).join('\n'),
  ));
  return {
    revision,
    entries,
    lessons: [...lessons].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
  };
}

/** Lessons whose id and title never appear together in a precached script. */
export function uncoveredLessons(
  scripts: readonly { readonly path: string; readonly text: string }[],
  lessons: readonly LessonScriptMarker[],
): readonly LessonScriptMarker[] {
  const javascript = scripts.filter((script) => script.path.endsWith('.js'));
  return lessons.filter((lesson) => !javascript.some((script) =>
    script.text.includes(lesson.id) && script.text.includes(lesson.title),
  ));
}

/**
 * The page may say the app works offline only when the worker reports every
 * lesson the running build contains, at the same content version.
 */
export function lessonsAreCovered(
  reported: readonly PrecacheLesson[],
  required: readonly PrecacheLesson[],
): boolean {
  if (required.length === 0) return false;
  return required.every((lesson) => reported.some((item) =>
    item.id === lesson.id && item.contentVersion === lesson.contentVersion,
  ));
}

export interface FetchedAsset {
  readonly status: number;
  readonly bytes: ArrayBuffer;
  readonly contentType: string | null;
}

export interface PrecacheWriter {
  put(url: string, bytes: ArrayBuffer, contentType: string | null): Promise<void>;
}

/**
 * Download every shell file, check its bytes, then store them.
 *
 * Verification finishes before the first write so a mismatch cannot leave a
 * half-valid cache that a later launch might treat as complete. An empty
 * manifest is a failure: "ready" must mean the shell is actually there.
 */
export async function fillPrecache(
  entries: readonly PrecacheEntry[],
  fetchAsset: (url: string) => Promise<FetchedAsset>,
  hash: (bytes: ArrayBuffer) => Promise<string>,
  cache: PrecacheWriter,
): Promise<void> {
  if (entries.length === 0) {
    throw new Error('Refusing to mark an empty precache as complete.');
  }
  if (!entries.some((entry) => entry.url === '/index.html')) {
    throw new Error('Precache is missing /index.html.');
  }

  const verified: { entry: PrecacheEntry; asset: FetchedAsset }[] = [];
  for (const entry of entries) {
    const asset = await fetchAsset(entry.url);
    if (asset.status !== 200) {
      throw new Error(`Precache failed for ${entry.url}: HTTP ${asset.status}.`);
    }
    const actual = await hash(asset.bytes);
    if (actual !== entry.revision) {
      throw new Error(`Precache revision mismatch for ${entry.url}.`);
    }
    verified.push({ entry, asset });
  }

  for (const { entry, asset } of verified) {
    await cache.put(entry.url, asset.bytes, asset.contentType);
  }
}

/** Lower-case SHA-256 hex, the same encoding the production build records. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export type FetchAction = 'passthrough' | 'navigate' | 'precache';

/**
 * Which requests the worker may answer.
 *
 * `cache: 'reload'` is how a new worker re-downloads the shell while the
 * previous worker is still in control. Answering that from the old cache would
 * make the checksum fail forever and the update could never install.
 */
export function resolveFetch(input: {
  readonly method: string;
  readonly sameOrigin: boolean;
  readonly pathname: string;
  readonly mode: string;
  readonly cacheMode: string;
  readonly precachedUrls: readonly string[];
}): FetchAction {
  if (input.method !== 'GET') return 'passthrough';
  if (!input.sameOrigin) return 'passthrough';
  if (input.cacheMode === 'reload') return 'passthrough';
  if (input.pathname === '/sw.js') return 'passthrough';
  if (input.mode === 'navigate') return 'navigate';
  if (input.precachedUrls.includes(input.pathname)) return 'precache';
  return 'passthrough';
}
