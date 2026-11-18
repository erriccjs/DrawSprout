import { afterEach, describe, expect, it, vi } from 'vitest';
import { installWebAnalytics, recordUsage } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem('drawsprout.opened-week');
  document.querySelector('script[data-cf-beacon]')?.remove();
});

describe('the usage client', () => {
  it('does not throw when the request fails, the browser is offline, or the id is not a slug', () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('down')));
    expect(() => recordUsage('app_open')).not.toThrow();
    expect(() => recordUsage('lesson_start', 'a child typed this')).not.toThrow();

    const calls = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', calls);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    recordUsage('lesson_start', 'cat-sitting');
    expect(calls).not.toHaveBeenCalled();
  });

  it('sends a small JSON body without cookies', () => {
    const calls = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', calls);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    recordUsage('lesson_complete', 'cat-sitting');
    expect(calls).toHaveBeenCalledTimes(1);
    const [url, init] = calls.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/event');
    expect(init.credentials).toBe('omit');
    expect(init.keepalive).toBe(true);
    if (typeof init.body !== 'string') throw new Error('Expected a JSON string body');
    const body = JSON.parse(init.body) as { name: string; lesson: string };
    expect(body.name).toBe('lesson_complete');
    expect(body.lesson).toBe('cat-sitting');
    expect(JSON.stringify(body).length).toBeLessThanOrEqual(512);
  });

  it('does not add a beacon when no token was configured', () => {
    installWebAnalytics(undefined);
    installWebAnalytics('   ');
    expect(document.querySelector('script[data-cf-beacon]')).toBeNull();
    installWebAnalytics('public-token');
    expect(document.querySelector('script[data-cf-beacon]')?.getAttribute('src')).toBe(
      'https://static.cloudflareinsights.com/beacon.min.js',
    );
  });
});
