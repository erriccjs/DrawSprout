import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { createSession } from '../lesson-engine/session';
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
