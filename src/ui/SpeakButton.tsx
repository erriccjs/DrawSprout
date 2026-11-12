/**
 * Reads the current step aloud. The tap is the gesture. Nothing speaks on its own.
 * When this language has no browser voice, the button stays visible and disabled.
 */

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/context';
import { pickVoice, speechSupported, type SpeechVoice } from './speech';

interface SpeakButtonProps {
  readonly text: string;
  readonly className?: string;
}

function listedVoices(): readonly SpeechVoice[] {
  if (!speechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function SpeakButton({ text, className }: SpeakButtonProps) {
  const { t, locale } = useI18n();
  const [voices, setVoices] = useState<readonly SpeechVoice[]>(listedVoices);
  const [speaking, setSpeaking] = useState(false);
  const voice = pickVoice(voices, locale);

  useEffect(() => {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    const refresh = () => setVoices(synth.getVoices());
    synth.addEventListener?.('voiceschanged', refresh);
    return () => {
      synth.removeEventListener?.('voiceschanged', refresh);
      synth.cancel();
    };
  }, []);

  useEffect(() => {
    if (!speechSupported()) return;
    window.speechSynthesis.cancel();
  }, [text]);

  const available = voice !== null && text.trim().length > 0;

  return (
    <button
      type="button"
      className={className ?? 'speak-button'}
      disabled={!available}
      aria-pressed={speaking}
      aria-label={available ? t('speakStep') : t('speakUnavailable')}
      onClick={() => {
        if (!voice || !speechSupported()) return;
        const synth = window.speechSynthesis;
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = voice.lang;
        utter.voice = voice as SpeechSynthesisVoice;
        utter.onend = () => setSpeaking(false);
        utter.onerror = () => setSpeaking(false);
        setSpeaking(true);
        synth.speak(utter);
      }}
    >
      <SpeakerIcon />
      <span className="speak-button__label">{available ? t('speakStep') : t('speakUnavailable')}</span>
    </button>
  );
}

function SpeakerIcon() {
  return (
    <svg className="speak-button__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 9h3l5-4v14l-5-4H4z" />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a6.5 6.5 0 0 1 0 10" />
    </svg>
  );
}
