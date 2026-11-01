/**
 * One doodle from black-forest-labs/flux-2-klein-4b.
 * The prompt and seed stay fixed. A 429 is retried once, then reported
 * so the child can pick a category lesson instead.
 */

import { bytesToBase64 } from '../photo/bytes';

export const DOODLE_MODEL = 'black-forest-labs/flux-2-klein-4b';
export const DOODLE_SEED = 7;
export const DOODLE_PROMPT = [
  'Turn this photo into a simple children\'s how-to-draw doodle of the main subject only:',
  'thick bold black outlines on a pure white background, friendly and not chibi,',
  'very few clean lines, no shading, no hatching, no texture strokes, no grey,',
  'no color fill, no background, no ground.',
  'Keep the subject\'s pose, proportions and key features recognisable.',
].join(' ');

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
  readonly width: number;
  readonly height: number;
  readonly signal?: AbortSignal;
  readonly fetch?: typeof fetch;
}): Promise<Uint8Array> {
  const call = input.fetch ?? fetch;
  const signal = input.signal ?? AbortSignal.timeout(45_000);
  const body = {
    input: {
      prompt: DOODLE_PROMPT,
      images: [`data:image/jpeg;base64,${bytesToBase64(input.jpeg)}`],
      output_format: 'png',
      aspect_ratio: aspectRatio(input.width, input.height),
      seed: DOODLE_SEED,
    },
  };
  let response = await call(`${PREDICT_URL}/${DOODLE_MODEL}/predictions`, {
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
    response = await call(`${PREDICT_URL}/${DOODLE_MODEL}/predictions`, {
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

function aspectRatio(width: number, height: number): string {
  const ratio = width / Math.max(1, height);
  if (Math.abs(ratio - 1) < 0.15) return '1:1';
  return ratio > 1 ? '4:3' : '3:4';
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
