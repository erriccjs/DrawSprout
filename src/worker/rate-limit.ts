/**
 * One sliding window per client, shared by every isolate.
 *
 * The Rate Limiting binding cannot express this. Its period is only 10 or 60
 * seconds, the count is approximate, and each Cloudflare location has its own
 * budget. A caller who misses a colo, or lands on a fresh isolate, would get
 * another six paid Replicate or OpenAI calls. A Durable Object keyed by
 * `cf-connecting-ip` keeps one strict window.
 *
 * The binding is declared in wrangler.jsonc. Nothing is typed into the
 * dashboard. If the object cannot be reached, the gate denies the job.
 */

import { DurableObject } from 'cloudflare:workers';
import { slidingWindowAllow, type RateGate } from './shared/limit';

const HITS = 'hits';

interface PaidRateLimitNamespace {
  idFromName(name: string): PaidRateLimitId;
  get(id: PaidRateLimitId): PaidRateLimitStub;
}

interface PaidRateLimitId {
  toString(): string;
}

interface PaidRateLimitStub {
  allow(now: number): Promise<boolean>;
}

export class PaidRateLimit extends DurableObject {
  async allow(now: number): Promise<boolean> {
    return this.ctx.storage.transaction(async (txn) => {
      const stored = await txn.get<number[]>(HITS);
      const buckets = new Map<string, number[]>([[HITS, stored ?? []]]);
      const allowed = slidingWindowAllow(buckets, HITS, now);
      await txn.put(HITS, buckets.get(HITS) ?? []);
      return allowed;
    });
  }
}

/** Missing binding or a thrown call denies the request. A paid route must not fail open. */
export function durableRateGate(namespace: PaidRateLimitNamespace | undefined): RateGate {
  if (!namespace) return { allow: () => false };
  return {
    async allow(key, now) {
      try {
        const allowed = await namespace.get(namespace.idFromName(key)).allow(now);
        return allowed === true;
      } catch {
        return false;
      }
    },
  };
}
