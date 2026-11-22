/**
 * Tunas, a small sprout. A tap reads one short line. Nothing speaks alone.
 */

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/context';
import { mascotLine } from '../daily/mascot-lines';
import { recordUsage } from '../usage/client';
import { useMotionPreference } from './useMotionPreference';
import { pickVoice, speechSupported, type SpeechVoice } from './speech';

interface MascotProps {
  readonly mood?: 'idle' | 'cheer';
  readonly size?: 'home' | 'small';
}

export function Mascot({ mood = 'idle', size = 'small' }: MascotProps) {
  const { t, locale } = useI18n();
  const motion = useMotionPreference();
  const line = mascotLine(mood, locale, new Date());
  const [voices, setVoices] = useState<readonly SpeechVoice[]>(() => (
    speechSupported() ? window.speechSynthesis.getVoices() : []
  ));
  useEffect(() => {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    const refresh = () => setVoices(synth.getVoices());
    refresh();
    synth.addEventListener?.('voiceschanged', refresh);
    return () => synth.removeEventListener?.('voiceschanged', refresh);
  }, []);
  const voice = pickVoice(voices, locale);

  return (
    <button
      type="button"
      className={`mascot mascot--${size}`}
      data-mood={mood}
      data-motion={motion}
      aria-label={t('mascotTalk')}
      onClick={() => {
        recordUsage('mascot_tap');
        speakMascot(line, voice);
      }}
    >
      <Tunas />
    </button>
  );
}

function speakMascot(text: string, voice: SpeechVoice | null): void {
  if (!voice || !speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = voice.lang;
  utter.voice = voice as SpeechSynthesisVoice;
  synth.speak(utter);
}

function Tunas() {
  return (
    <svg className="mascot__art" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="58" rx="10" ry="3" fill="#e4d3b4" />
      <path d="M32 54 V34" stroke="#3f8f4e" strokeWidth="4" strokeLinecap="round" />
      <path className="mascot__leaf" d="M32 40 C18 36 16 22 28 24 C26 34 30 38 32 40 Z" fill="#67b86a" />
      <path className="mascot__leaf" d="M32 38 C46 32 48 18 36 22 C38 32 34 36 32 38 Z" fill="#8ed18a" />
      <circle cx="32" cy="24" r="14" fill="#7bc67e" />
      <circle cx="27" cy="22" r="2" fill="#1f2933" />
      <circle cx="37" cy="22" r="2" fill="#1f2933" />
      <path d="M27 28 Q32 32 37 28" fill="none" stroke="#1f2933" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
