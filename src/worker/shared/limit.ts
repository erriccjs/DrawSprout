/**
 * Sliding window shared by the paid photo routes.
 *
 * Six new jobs per ten minutes, per client. The Worker stores the window in
 * a Durable Object. Tests pass a memory map or a gate of their own.
 */

export const RATE_LIMIT = 6;
export const RATE_WINDOW_MS = 10 * 60 * 1000;

export interface RateGate {
  allow(key: string, now: number): boolean | Promise<boolean>;
}

export function slidingWindowAllow(buckets: Map<string, number[]>, key: string, nowMs: number): boolean {
  const recent = (buckets.get(key) ?? []).filter((time) => nowMs - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  buckets.set(key, recent);
  return true;
}

export function memoryGate(buckets: Map<string, number[]>): RateGate {
  return {
    allow(key, now) {
      return slidingWindowAllow(buckets, key, now);
    },
  };
}

/** A caller-supplied gate wins. Otherwise the map is the window, created fresh when omitted. */
export function rateGateFrom(deps: { readonly rateGate?: RateGate; readonly rateBuckets?: Map<string, number[]> }): RateGate {
  if (deps.rateGate) return deps.rateGate;
  return memoryGate(deps.rateBuckets ?? new Map<string, number[]>());
}
