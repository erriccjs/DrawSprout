/**
 * One doodle from an image-editing model on Replicate.
 *
 * The default is flux-kontext-pro, the same editor the photo pipeline uses.
 * It is asked to restyle the photo rather than to draw a new picture from it,
 * which is what keeps the child's subject in its own pose. flux-2-klein-4b
 * drew the subject again from scratch and lost it on any busy photo.
 *
 * The seed stays fixed. A 429 is retried once, then reported so the child can
 * pick a category lesson instead.
 */

import { bytesToBase64 } from '../photo/bytes';

export const DOODLE_MODEL = 'black-forest-labs/flux-kontext-pro';
export const DOODLE_SEED = 7;

/**
 * Positive only. A negative list backfires on kontext: naming a thing to leave
 * out is enough to put it in the picture (D-70).
 */
export const DOODLE_PROMPT = [
  'Turn this photo into a simple children\'s how-to-draw doodle of the main subject.',
  'Thick bold black outlines on a plain white background.',
  'A few clean lines, flat and open, like a colouring book page waiting to be coloured.',
  'Keep the subject\'s pose, proportions and features as they are in the photo.',
  'Draw the main subject alone.',
].join(' ');

/** Any owner/name id is allowed, so a run can compare models without a deploy. */
export function doodleModelFor(configured: string | undefined): string {
  const trimmed = configured?.trim();
  if (trimmed && /^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed;
  return DOODLE_MODEL;
}

/**
 * Which key the model takes the photo under. The kontext editors take one
 * image, the flux-2 line takes a list, and klein names that list `images`.
 */
export function doodleImageField(model: string): 'input_image' | 'input_images' | 'images' {
  const name = model.split('/').pop() ?? model;
  if (name.startsWith('flux-2-klein')) return 'images';
  if (name.startsWith('flux-2')) return 'input_images';
  return 'input_image';
}

const PREDICT_URL = 'https://api.replicate.com/v1/models';

export class DoodleUpstreamError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DoodleUpstreamError';
    this.status = status;
  }
}

export async function doodleWithReplicate(input: {
  readonly apiKey: string;
  readonly jpeg: Uint8Array;
  readonly model?: string;
  readonly signal?: AbortSignal;
  readonly fetch?: typeof fetch;
}): Promise<Uint8Array> {
  const call = input.fetch ?? fetch;
  const signal = input.signal ?? AbortSignal.timeout(45_000);
  const model = doodleModelFor(input.model);
  const field = doodleImageField(model);
  const dataUri = `data:image/jpeg;base64,${bytesToBase64(input.jpeg)}`;
  const body = {
    input: {
      prompt: DOODLE_PROMPT,
      [field]: field === 'input_image' ? dataUri : [dataUri],
      output_format: 'png',
      // The doodle must land on the same frame as the photo: the colour step
      // reads the photo at the doodle's own coordinates. Quantising to 1:1,
      // 4:3 or 3:4 re-framed the subject and the colours came off the
      // background.
      aspect_ratio: 'match_input_image',
      seed: DOODLE_SEED,
    },
  };
  let response = await call(`${PREDICT_URL}/${model}/predictions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
      prefer: 'wait=60',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 429) {
    await wait(Math.min(8_000, retryAfter(response)), signal);
    response = await call(`${PREDICT_URL}/${model}/predictions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
        prefer: 'wait=60',
      },
      body: JSON.stringify(body),
      signal,
    });
  }
  const payload: unknown = await response.json().catch(() => ({}));
  if (response.status === 429) throw new DoodleUpstreamError('rate', 429);
  if (!response.ok) throw new DoodleUpstreamError('failed', response.status || 502);
  const record = asRecord(payload);
  const output = record.output;
  const url = typeof output === 'string'
    ? output
    : Array.isArray(output) && typeof output[0] === 'string'
      ? output[0]
      : '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DoodleUpstreamError('failed', 502);
  }
  if (parsed.protocol !== 'https:' || (parsed.hostname !== 'replicate.delivery' && !parsed.hostname.endsWith('.replicate.delivery'))) {
    throw new DoodleUpstreamError('failed', 502);
  }
  const image = await call(parsed, { signal });
  if (!image.ok) throw new DoodleUpstreamError('failed', 502);
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (bytes[0] !== 137) throw new DoodleUpstreamError('failed', 502);
  return bytes;
}

function retryAfter(response: Response): number {
  const header = Number(response.headers.get('retry-after'));
  if (Number.isFinite(header) && header >= 0) return Math.min(8_000, header * 1000);
  return 1_200;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}
