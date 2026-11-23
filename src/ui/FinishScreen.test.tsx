import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { createSession } from '../lesson-engine/session';
import { answerParentGate } from '../test/parent-gate';
import { clearParentUnlock, grantParent } from './parent-session';
import { FinishScreen } from './FinishScreen';

function media(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

describe('the finish celebration', () => {
  const original = window.matchMedia;

  afterEach(() => {
    window.matchMedia = original;
  });

  function renderFinish() {
    return render(
      <FinishScreen
        lesson={CAT_LESSON}
        state={createSession(CAT_LESSON, 'finish')}
        clipPaths={{}}
        onKeepDrawing={() => undefined}
        onDrawFreely={() => undefined}
        onChoosePicture={() => undefined}
        onStartFresh={() => undefined}
        restartError={null}
      />,
    );
  }

  it('plays a small decoration, and skips it when motion is reduced', () => {
    window.matchMedia = () => media(false);
    const full = renderFinish();
    const playing = full.container.querySelector('.celebration');
    expect(playing?.getAttribute('data-motion')).toBe('full');
    expect(playing?.getAttribute('aria-hidden')).toBe('true');
    expect(playing?.querySelectorAll('span')).toHaveLength(3);
    full.unmount();

    window.matchMedia = () => media(true);
    const reduced = renderFinish();
    expect(reduced.container.querySelector('.celebration')?.getAttribute('data-motion')).toBe('reduce');
  });

  it('shares the framed picture only after the parent gate, and prints the three sheets', async () => {
    clearParentUnlock();
    const bodies: string[] = [];
    vi.stubGlobal('fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(typeof init?.body === 'string' ? init.body : '');
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const share = vi.fn((_data: { files: File[]; title: string; text: string }) => Promise.resolve());
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:sheet';
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    renderFinish();
    fireEvent.click(screen.getByRole('button', { name: 'Bagikan' }));
    expect(share).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Untuk orang tua' })).toBeTruthy();
    answerParentGate();
    expect(share).toHaveBeenCalledTimes(1);
    const shared = share.mock.calls[0]?.[0];
    if (!shared) throw new Error('share was not called');
    expect(shared.files[0]?.type).toBe('image/png');
    expect(shared.files[0]?.name.endsWith('.png')).toBe(true);
    expect(shared.title).toBe('Kucing Duduk');
    expect(await screen.findByText(/Lembar berbagi terbuka/)).toBeTruthy();
    expect(bodies.some((body) => body.includes('"name":"share_picture"') && body.includes('"lesson":"cat-sitting"'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cetak' }));
    expect(screen.getByRole('article', { name: 'Gambar jadi' })).toBeTruthy();
    const practice = screen.getAllByRole('article', { name: 'Lembar latihan' });
    expect(practice.length).toBeGreaterThan(0);
    expect(practice[0]?.querySelector('[data-ink="dashed"]')?.getAttribute('stroke-dasharray')).toBe('20 14');
    const colouring = screen.getByRole('article', { name: 'Halaman mewarnai' });
    const outline = colouring.querySelector('[data-ink="outline"]');
    expect(outline?.getAttribute('fill')).toBe('none');
    expect(outline?.hasAttribute('stroke-dasharray')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Unduh PDF' }));
    expect(await screen.findByText(/diunduh/)).toBeTruthy();
    expect(bodies.some((body) => body.includes('"name":"print_sheet"'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cetak sekarang' }));
    expect(print).toHaveBeenCalledTimes(1);

    URL.createObjectURL = originalCreate;
    print.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps the plain PNG save available without the parent gate', () => {
    clearParentUnlock();
    renderFinish();
    expect(screen.getByRole('button', { name: 'Simpan gambar (PNG)' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    grantParent();
    clearParentUnlock();
  });

  it('lets a parent answer once for a finished lesson', () => {
    localStorage.removeItem('drawsprout.feedback-lessons');
    const calls = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', calls);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    const first = renderFinish();
    expect(screen.getByText('Untuk orang tua')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suka' }));
    expect(screen.getByText('Terima kasih.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suka' })).toBeNull();
    expect(calls).toHaveBeenCalledTimes(1);
    first.unmount();

    renderFinish();
    expect(screen.getByText('Terima kasih.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kurang' })).toBeNull();
    expect(calls).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
