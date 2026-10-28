/**
 * Dev-server route for a draft. The Replicate key stays in this process.
 * The page only receives the lesson JSON.
 */

import type { Plugin } from 'vite';
import { draftLessonWithReplicate } from './replicate';

type DraftFn = typeof draftLessonWithReplicate;

export async function handleAuthorDraft(
  request: Request,
  env: { readonly REPLICATE_API_KEY?: string },
  draft: DraftFn = draftLessonWithReplicate,
): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Send a name in a POST.' }, { status: 405 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const name = isRecord(body) && typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return Response.json({ error: 'Name the thing to draw.' }, { status: 400 });
  const apiKey = env.REPLICATE_API_KEY?.trim() ?? '';
  if (!apiKey) {
    return Response.json({ error: 'Set REPLICATE_API_KEY in the environment that runs the dev server. The page does not take a key.' }, { status: 503 });
  }
  try {
    const lesson = await draft({ apiKey, name });
    return Response.json({ lesson });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The draft failed.';
    return Response.json({ error: message.split(apiKey).join('[key]') }, { status: 502 });
  }
}

export function authorDevApi(): Plugin {
  return {
    name: 'author-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== '/__author/draft') {
          next();
          return;
        }
        void readBody(req).then(async (raw) => {
          const method = req.method ?? 'GET';
          const request = new Request('http://drawsprout.local/__author/draft', {
            method,
            headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
            ...(method !== 'GET' && method !== 'HEAD' ? { body: raw } : {}),
          });
          const response = await handleAuthorDraft(request, process.env);
          res.statusCode = response.status;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(await response.text());
        }).catch((error: unknown) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'The draft failed.' }));
        });
      });
    },
  };
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
