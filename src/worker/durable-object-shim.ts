/**
 * Vitest stand-in for `cloudflare:workers`. Wrangler resolves the real module
 * when it bundles the Worker. This file only exists so unit tests can
 * construct PaidRateLimit.
 */

export class DurableObject<E = unknown> {
  readonly ctx: {
    readonly storage: {
      transaction<T>(closure: (txn: {
        get<TValue>(key: string): Promise<TValue | undefined>;
        put<TValue>(key: string, value: TValue): Promise<void>;
      }) => Promise<T>): Promise<T>;
    };
  };

  readonly env: E;

  constructor(ctx: DurableObject<E>['ctx'], env: E) {
    this.ctx = ctx;
    this.env = env;
  }
}
