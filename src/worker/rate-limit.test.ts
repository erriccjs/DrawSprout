import { describe, expect, it } from 'vitest';
import { PaidRateLimit } from './rate-limit';
import { RATE_LIMIT, slidingWindowAllow } from './shared/limit';

describe('paid rate limit', () => {
  it('keeps one sliding window inside the durable object', async () => {
    const store = new Map<string, unknown>();
    const limiter = new PaidRateLimit({
      storage: {
        transaction: async <T>(closure: (txn: {
          get<TValue>(key: string): Promise<TValue | undefined>;
          put<TValue>(key: string, value: TValue): Promise<void>;
        }) => Promise<T>) => closure({
          get<TValue>(key: string): Promise<TValue | undefined> {
            return Promise.resolve(store.get(key) as TValue | undefined);
          },
          put<TValue>(key: string, value: TValue): Promise<void> {
            store.set(key, value);
            return Promise.resolve();
          },
        }),
      },
    }, {});
    for (let count = 0; count < RATE_LIMIT; count += 1) {
      expect(await limiter.allow(1_000)).toBe(true);
    }
    expect(await limiter.allow(1_000)).toBe(false);
    expect(await limiter.allow(1_000 + 11 * 60 * 1000)).toBe(true);
  });

  it('counts two callers separately in the memory window', () => {
    const buckets = new Map<string, number[]>();
    for (let count = 0; count < RATE_LIMIT; count += 1) {
      expect(slidingWindowAllow(buckets, 'a', 1_000)).toBe(true);
    }
    expect(slidingWindowAllow(buckets, 'a', 1_000)).toBe(false);
    expect(slidingWindowAllow(buckets, 'b', 1_000)).toBe(true);
  });
});
