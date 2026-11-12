/**
 * Browser speech for one step instruction.
 *
 * No server and no paid voice. A missing voice disables the button instead of
 * throwing. Nothing here speaks until the child taps.
 */

export interface SpeechVoice {
  readonly lang: string;
  readonly name?: string;
}

export function voiceLanguage(lang: string): string {
  return lang.toLowerCase().replace('_', '-');
}

/** A voice whose language tag starts with the lesson language. No cross-language fallback. */
export function pickVoice(voices: readonly SpeechVoice[], locale: 'en' | 'id'): SpeechVoice | null {
  const prefix = locale === 'id' ? 'id' : 'en';
  return voices.find((voice) => {
    const tag = voiceLanguage(voice.lang);
    return tag === prefix || tag.startsWith(`${prefix}-`);
  }) ?? null;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}
