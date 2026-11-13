/**
 * Sliding window shared by the paid photo routes.
 *
 * Six category-photo jobs per ten minutes, per client. Doodles use their own
 * larger window. The Worker stores each window in a Durable Object. Tests
 * pass a memory map or a gate of their own.
 */

export const RATE_LIMIT = 6;
/** A doodle is cheap, and it no longer shares the category-photo window. */
export const DOODLE_RATE_LIMIT = 12;
/** Usage counts are tiny writes. They do not share the paid photo window. */
export const USAGE_RATE_LIMIT = 40;
export const RATE_WINDOW_MS = 10 * 60 * 1000;

export type RateDenial = 'limited' | 'unavailable';

export interface RateVerdict {
  readonly allowed: boolean;
  readonly reason: RateDenial | null;
}

export function allowedVerdict(): RateVerdict {
  return { allowed: true, reason: null };
}

export function deniedVerdict(reason: RateDenial): RateVerdict {
  return { allowed: false, reason };
}

export interface RateGate {
  allow(key: string, now: number): RateVerdict | Promise<RateVerdict>;
}

export function slidingWindowAllow(
  buckets: Map<string, number[]>,
  key: string,
  nowMs: number,
  limit = RATE_LIMIT,
): boolean {
  const recent = (buckets.get(key) ?? []).filter((time) => nowMs - time < RATE_WINDOW_MS);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  buckets.set(key, recent);
  return true;
}

export function memoryGate(buckets: Map<string, number[]>, limit = RATE_LIMIT): RateGate {
  return {
    allow(key, now) {
      return slidingWindowAllow(buckets, key, now, limit) ? allowedVerdict() : deniedVerdict('limited');
    },
  };
}

/** A caller-supplied gate wins. Otherwise the map is the window, created fresh when omitted. */
export function rateGateFrom(deps: { readonly rateGate?: RateGate; readonly rateBuckets?: Map<string, number[]> }): RateGate {
  if (deps.rateGate) return deps.rateGate;
  return memoryGate(deps.rateBuckets ?? new Map<string, number[]>());
}
