/**
 * Fullscreen API helpers.
 *
 * A page can ask, during a user gesture, to hide the browser chrome. The
 * browser may refuse, and leaving fullscreen is always the visitor's choice.
 * Android gesture navigation is outside this API.
 */

type FullscreenHost = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function isDocumentFullscreen(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenElement);
}

function settle(result: void | Promise<void>): void {
  if (result instanceof Promise) {
    void result.catch(() => {
      // The browser refused. Drawing continues in the window.
    });
  }
}

export function requestDocumentFullscreen(): void {
  if (typeof document === 'undefined' || document.fullscreenElement) return;
  const node = document.documentElement as FullscreenHost;
  try {
    if (typeof node.requestFullscreen === 'function') {
      settle(node.requestFullscreen());
      return;
    }
    if (typeof node.webkitRequestFullscreen === 'function') {
      settle(node.webkitRequestFullscreen());
    }
  } catch {
    // Called outside a user gesture, or the API is missing at runtime.
  }
}

export function exitDocumentFullscreen(): void {
  if (typeof document === 'undefined' || !document.fullscreenElement) return;
  if (typeof document.exitFullscreen !== 'function') return;
  void document.exitFullscreen().catch(() => {
    // Already leaving, or the browser rejected the request.
  });
}
