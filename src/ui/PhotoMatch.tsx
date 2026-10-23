/**
 * Pick a photo, match it to a category lesson, and open that lesson in the
 * same drawing screen. A miss shows the lessons we can already draw.
 */

import { useState } from 'react';
import { doneCategory } from '../categories/library';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { useI18n } from '../i18n/context';
import { say } from '../i18n/generated';
import { categoryName } from '../i18n/present';
import type { LessonPackage } from '../lesson-data/schema';
import { requestDocumentFullscreen } from './fullscreen';
import { lessonFromMatch, matchPhotoRequest, type ClientMatch } from './photo-match-client';

interface PhotoMatchProps {
  readonly onCancel: () => void;
  readonly onOpenLesson: (lesson: LessonPackage, resume: boolean) => void;
  readonly requestMatch?: (file: File) => Promise<ClientMatch>;
}

export function PhotoMatch({ onCancel, onOpenLesson, requestMatch = matchPhotoRequest }: PhotoMatchProps) {
  const { t, locale } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [miss, setMiss] = useState<ClientMatch | null>(null);

  const submit = () => {
    if (!file || busy) return;
    requestDocumentFullscreen();
    setBusy(true);
    setError(null);
    setMiss(null);
    void requestMatch(file).then((match) => {
      const lesson = lessonFromMatch(match);
      if (lesson) {
        onOpenLesson(lesson, false);
        return;
      }
      setMiss(match);
      setBusy(false);
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Foto ini belum bisa dipakai. Coba lagi ya.');
      setBusy(false);
    });
  };

  const openSuggestion = (category: string) => {
    const entry = doneCategory(category);
    if (!entry) return;
    onOpenLesson(entry.lesson, true);
  };

  return (
    <section className="photo-match" aria-labelledby="photo-match-title">
      <LanguageSwitch />
      <h1 id="photo-match-title">{t('photoMatchTitle')}</h1>
      <p>{t('photoMatchLead')}</p>
      <div className="photo-match__actions">
        <label className="button">
          {t('choosePhoto')}
          <input
            className="photo-match__file"
            type="file"
            accept="image/*"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setMiss(null);
              setError(null);
            }}
          />
        </label>
        <button type="button" className="button button--primary" disabled={!file || busy} onClick={submit}>
          {busy ? t('lookingAtPhoto') : t('makingLesson')}
        </button>
        <button type="button" className="button" onClick={onCancel}>{t('back')}</button>
      </div>
      {file && <p className="photo-match__file-name">{file.name}</p>}
      {error && <p className="banner banner--warning" role="alert">{say(locale, error)}</p>}
      {miss && (
        <div className="photo-match__miss" role="status">
          <p>{say(locale, miss.message)}</p>
          <div className="photo-match__suggestions">
            {miss.suggestions.map((suggestion) => (
              <button
                key={suggestion.category}
                type="button"
                className="button"
                onClick={() => openSuggestion(suggestion.category)}
              >
                {categoryName(locale, suggestion.category, suggestion.title)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
