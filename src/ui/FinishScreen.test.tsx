import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
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
});
