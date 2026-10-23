/**
 * `wrangler types --include-runtime=false` names `Fetcher` and does not define
 * it. The full workerd runtime is not part of this app's TypeScript project:
 * it would replace the DOM types shared by the photo code. The assets binding
 * is only used as `env.ASSETS.fetch(request)`.
 */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

/**
 * The paid rate-limit binding. One object per client name. Declared in
 * wrangler.jsonc; this is the slice the Worker calls.
 */
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

/**
 * `cloudflare:workers` is the workerd runtime. Only the Durable Object base
 * used by PaidRateLimit is declared here, so the DOM types the photo code
 * shares stay in place.
 */
declare module 'cloudflare:workers' {
  interface DurableObjectTransaction {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  }

  interface DurableObjectState {
    readonly storage: {
      transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T>;
    };
  }

  export abstract class DurableObject<E = unknown> {
    constructor(ctx: DurableObjectState, env: E);
    readonly ctx: DurableObjectState;
    readonly env: E;
  }
}
