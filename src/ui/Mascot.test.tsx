import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n/context';
import { Mascot } from './Mascot';

describe('Tunas', () => {
  const speak = vi.fn();

  beforeEach(() => {
    speak.mockReset();
    class FakeUtterance {
      text: string;
      lang = '';
      voice: unknown = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak,
        cancel: vi.fn(),
        getVoices: () => [{ lang: 'id-ID', name: 'Damayanti' }],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it('does not speak until the sprout is tapped', () => {
    render(
      <LocaleProvider>
        <Mascot />
      </LocaleProvider>,
    );
    expect(speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dengar Tunas' }));
    expect(speak).toHaveBeenCalledTimes(1);
    const line = speak.mock.calls[0]?.[0] as SpeechSynthesisUtterance;
    expect(line.text.length).toBeGreaterThan(0);
    expect(line.lang).toBe('id-ID');
  });
});
