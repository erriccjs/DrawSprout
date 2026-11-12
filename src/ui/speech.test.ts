import { describe, expect, it } from 'vitest';
import { pickVoice, voiceLanguage } from './speech';

describe('step read-aloud voices', () => {
  it('picks a voice that matches the language and ignores the other one', () => {
    const voices = [
      { lang: 'en-US', name: 'Samantha' },
      { lang: 'id-ID', name: 'Damayanti' },
      { lang: 'fr-FR', name: 'Amelie' },
    ];
    expect(pickVoice(voices, 'id')?.name).toBe('Damayanti');
    expect(pickVoice(voices, 'en')?.name).toBe('Samantha');
    expect(pickVoice([{ lang: 'en_GB', name: 'Daniel' }], 'en')?.name).toBe('Daniel');
  });

  it('has no voice when the browser has none for that language', () => {
    expect(pickVoice([], 'id')).toBeNull();
    expect(pickVoice([{ lang: 'en-US', name: 'Samantha' }], 'id')).toBeNull();
    expect(pickVoice([{ lang: '', name: 'blank' }], 'en')).toBeNull();
  });

  it('normalises voice language tags', () => {
    expect(voiceLanguage('ID_id')).toBe('id-id');
  });
});
