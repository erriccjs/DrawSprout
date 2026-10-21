/**
 * DrawSprout Worker.
 *
 * `/api/*` is this script. Every other path, including `/sw.js`, is the assets
 * binding, so the single-page fallback and `_headers` stay on the asset layer.
 * The maps below are the in-isolate idempotency cache (D-66). They are not a
 * photo store: a finished entry is the JSON result, capped, and nothing here
 * is written to logs except status and duration.
 */

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

const cache: JobCache = { success: new Map(), inflight: new Map() };
const rateBuckets = new Map<string, number[]>();

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
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
        cache,
        rateBuckets,
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
