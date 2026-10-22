/**
 * `wrangler types --include-runtime=false` names `Fetcher` and does not define
 * it. The full workerd runtime is not part of this app's TypeScript project:
 * it would replace the DOM types shared by the photo code. The assets binding
 * is only used as `env.ASSETS.fetch(request)`.
 */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
