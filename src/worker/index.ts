/**
 * DrawSprout Worker.
 *
 * `/api/*` is this script. Every other path, including `/sw.js`, is the assets
 * binding, so the single-page fallback and `_headers` stay on the asset layer.
 * Two routes live here. `/api/photo-lesson` is the generated-lesson spike.
 * `/api/photo-match` picks a hand-authored category lesson. Neither log stores
 * a photo: a finished cache entry is JSON, and a log line is status and
 * duration only.
 */

import { MissingMatchKey, handlePhotoMatch, PHOTO_MATCH_PATH } from '../categories/http';
import { classifyPhoto } from '../categories/openai';
import { handlePhotoLessonRequest, PHOTO_API_PATH, type JobCache } from '../photo/api';
import { openAiClients } from '../photo/openai';
import { imageProvider, replicateApiKey } from '../photo/provider';
import { replicateEditor } from '../photo/replicate';

type WorkerEnv = Env & {
  readonly OPENAI_API_KEY?: string;
  readonly OPENAI_IMAGE_MODEL?: string;
  readonly OPENAI_TEXT_MODEL?: string;
  readonly IMAGE_PROVIDER?: string;
  readonly REPLICATE_API_KEY?: string;
  readonly REPLICATE_API_TOKEN?: string;
  readonly REPLICATE_IMAGE_MODEL?: string;
};

const photoCache: JobCache = { success: new Map(), inflight: new Map() };
const photoRateBuckets = new Map<string, number[]>();
const matchCache = new Map<string, string>();
const matchRateBuckets = new Map<string, number[]>();

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
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
        rateBuckets: matchRateBuckets,
        cache: matchCache,
      });
      console.log(JSON.stringify({ route: 'photo-match', status: response.status, ms: Date.now() - started }));
      return response;
    }
    if (url.pathname === PHOTO_API_PATH) {
      const started = Date.now();
      const openai = env.OPENAI_API_KEY ? openAiClients(env.OPENAI_API_KEY) : null;
      const replicateKey = replicateApiKey(env);
      const images = imageProvider(env.IMAGE_PROVIDER) === 'replicate'
        ? (replicateKey ? replicateEditor(replicateKey) : null)
        : openai?.images;
      const response = await handlePhotoLessonRequest(request, env, {
        images: images ?? { edit() { return Promise.reject(new Error('missing key')); } },
        ...(openai ? { instructions: openai.instructions } : {}),
        cache: photoCache,
        rateBuckets: photoRateBuckets,
      });
      console.log(JSON.stringify({
        route: 'photo-lesson',
        status: response.status,
        ms: Date.now() - started,
      }));
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
