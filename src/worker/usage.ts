/**
 * POST /api/event.
 *
 * Writes one Analytics Engine point. The client address is used only as the
 * rate-limit key, the same way the paid routes already do, and is not stored.
 */

import { durableRateGate } from './rate-limit';
import { clientKey, json, jsonHeaders, sameOrigin } from './shared/http';
import { USAGE_RATE_LIMIT, type RateGate } from './shared/limit';
import { MAX_USAGE_BYTES, parseUsageEvent, type UsageEvent } from '../usage/events';

export const USAGE_PATH = '/api/event';

export interface UsageDataset {
  writeDataPoint(point: {
    readonly indexes?: readonly string[];
    readonly blobs?: readonly string[];
    readonly doubles?: readonly number[];
  }): void;
}

export interface UsageEnv {
  readonly USAGE?: UsageDataset;
  readonly PAID_RATE_LIMIT?: Parameters<typeof durableRateGate>[0];
}

export async function handleUsageEvent(
  request: Request,
  env: UsageEnv,
  rateGate: RateGate = durableRateGate(env.PAID_RATE_LIMIT, { scope: 'usage', limit: USAGE_RATE_LIMIT }),
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Tidak ada.', code: 'method' }, 405);
  if (!sameOrigin(request)) return json({ error: 'Tidak ada.', code: 'origin' }, 403);

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_USAGE_BYTES) {
    return json({ error: 'Terlalu besar.', code: 'too_big' }, 413);
  }
  const text = await request.text();
  if (text.length > MAX_USAGE_BYTES) return json({ error: 'Terlalu besar.', code: 'too_big' }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return json({ error: 'Tidak ada.', code: 'bad_json' }, 400);
  }
  const event = parseUsageEvent(body);
  if (typeof event === 'string') return json({ error: 'Tidak ada.', code: event }, 400);

  const verdict = await rateGate.allow(clientKey(request), Date.now());
  if (!verdict.allowed) {
    return json({ ok: false }, verdict.reason === 'limited' ? 429 : 204);
  }

  writeUsage(env.USAGE, event);
  return new Response(null, { status: 204, headers: jsonHeaders() });
}

export function writeUsage(dataset: UsageDataset | undefined, event: UsageEvent): void {
  if (!dataset) return;
  dataset.writeDataPoint({
    indexes: [event.name],
    blobs: [event.name, event.lesson ?? '', event.language, event.device],
    doubles: [event.returning ? 1 : 0],
  });
}
