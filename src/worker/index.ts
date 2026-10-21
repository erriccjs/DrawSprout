/**
 * DrawSprout Worker.
 *
 * `/api/*` is this script. Every other path, including `/sw.js`, is the assets
 * binding. The photo matcher does not log the photo.
 */

import { MissingMatchKey, handlePhotoMatch, PHOTO_MATCH_PATH } from '../categories/http';
import { classifyPhoto } from '../categories/openai';

interface AssetFetcher {
  fetch(input: Request): Promise<Response>;
}

export interface MatchWorkerEnv {
  readonly ASSETS: AssetFetcher;
  readonly OPENAI_API_KEY?: string;
  readonly OPENAI_TEXT_MODEL?: string;
}

const rateBuckets = new Map<string, number[]>();
const cache = new Map<string, string>();

export default {
  async fetch(request: Request, env: MatchWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === PHOTO_MATCH_PATH) {
      const started = Date.now();
      const response = await handlePhotoMatch(request, {
        classify: (image, mediaType, idempotencyKey, signal) => {
          const apiKey = env.OPENAI_API_KEY;
          if (!apiKey) return Promise.reject(new MissingMatchKey());
          const model = env.OPENAI_TEXT_MODEL;
          return classifyPhoto({
            apiKey,
            ...(model ? { model } : {}),
            image,
            mediaType,
            idempotencyKey,
            signal,
          });
        },
        rateBuckets,
        cache,
      });
      console.log(JSON.stringify({ route: 'photo-match', status: response.status, ms: Date.now() - started }));
      return response;
    }
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Tidak ada.', code: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
