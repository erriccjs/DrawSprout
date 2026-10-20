/**
 * Production service worker.
 *
 * Install stores the shell and stops. It does not take over an open page.
 * The page sends SKIP_WAITING only after the update gate says the child is
 * back on the picture-choosing screen. This file never opens the drawing
 * database: an update replaces cached files, not saved drawings.
 *
 * The build injects `__PRECACHE_MANIFEST__`. The dev server does not emit this
 * file.
 */

import { fillPrecache, cacheNameFor, resolveFetch, retiredPrecacheNames, sha256Hex } from './precache';
import type { PrecacheManifest } from './precache';
import { parseClientMessage } from './messages';

declare const __PRECACHE_MANIFEST__: PrecacheManifest;

const manifest = __PRECACHE_MANIFEST__;
const precachedUrls = manifest.entries.map((entry) => entry.url);

interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEventLike extends ExtendableEventLike {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}

interface MessageSource {
  postMessage(message: unknown): void;
}

interface MessageEventLike extends Event {
  readonly data: unknown;
  readonly source: MessageSource | null;
}

interface WorkerScope {
  readonly location: { readonly origin: string };
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
    matchAll(options?: { includeUncontrolled?: boolean }): Promise<readonly MessageSource[]>;
  };
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEventLike) => void): void;
}

const scope = self as unknown as WorkerScope;

function notReadyResponse(): Response {
  return new Response('DrawSprout belum siap tanpa internet.', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function readyMessage(): { type: 'OFFLINE_READY'; lessons: PrecacheManifest['lessons'] } {
  return { type: 'OFFLINE_READY', lessons: manifest.lessons };
}

async function fetchAsset(url: string) {
  const response = await fetch(url, { cache: 'reload' });
  return {
    status: response.status,
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get('content-type'),
  };
}

async function installPrecache(): Promise<void> {
  const cache = await caches.open(cacheNameFor(manifest.revision));
  await fillPrecache(manifest.entries, fetchAsset, sha256Hex, {
    async put(url, bytes, contentType) {
      const headers = new Headers();
      if (contentType !== null) headers.set('content-type', contentType);
      await cache.put(url, new Response(bytes, { status: 200, headers }));
    },
  });
}

async function announceReady(): Promise<void> {
  const clients = await scope.clients.matchAll({ includeUncontrolled: true });
  const message = readyMessage();
  for (const client of clients) client.postMessage(message);
}

async function activatePrecache(): Promise<void> {
  const current = cacheNameFor(manifest.revision);
  const existing = await caches.keys();
  await Promise.all(retiredPrecacheNames(existing, current).map((name) => caches.delete(name)));
  await scope.clients.claim();
  await announceReady();
}

async function navigationResponse(): Promise<Response> {
  const cache = await caches.open(cacheNameFor(manifest.revision));
  const cached = await cache.match('/index.html');
  if (cached) return cached;
  try {
    return await fetch('/index.html');
  } catch {
    return notReadyResponse();
  }
}

async function cachedAsset(pathname: string): Promise<Response> {
  const cache = await caches.open(cacheNameFor(manifest.revision));
  const cached = await cache.match(pathname);
  if (cached) return cached;
  try {
    return await fetch(pathname);
  } catch {
    return notReadyResponse();
  }
}

scope.addEventListener('install', (event) => {
  // Leave the previous worker in control until the page asks.
  event.waitUntil(installPrecache());
});

scope.addEventListener('activate', (event) => {
  event.waitUntil(activatePrecache());
});

scope.addEventListener('message', (event) => {
  const message = parseClientMessage(event.data);
  if (message === 'SKIP_WAITING') {
    void scope.skipWaiting();
    return;
  }
  if (message === 'GET_STATUS') event.source?.postMessage(readyMessage());
});

scope.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const action = resolveFetch({
    method: event.request.method,
    sameOrigin: url.origin === scope.location.origin,
    pathname: url.pathname,
    mode: event.request.mode,
    cacheMode: event.request.cache,
    precachedUrls,
  });
  if (action === 'passthrough') return;
  const response = action === 'navigate' ? navigationResponse() : cachedAsset(url.pathname);
  event.respondWith(response.catch(() => notReadyResponse()));
});
