import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CATEGORY_CATALOGUE, CATEGORY_LESSONS } from '../categories/library';
import { NO_MATCH_MESSAGE } from '../categories/match';
import { BUNDLED_LESSONS } from '../lesson-data';
import { buildPhotoLesson } from '../photo/lesson-build';
import type { RgbaImage } from '../photo/png';
import { traceInk } from '../photo/trace';
import { LanguageSwitch } from './LanguageSwitch';
import { LocaleProvider, useI18n } from './context';
import { localizeSentence, PHRASES_EN, say } from './generated';
import { detectLocale, LOCALE_STORAGE_KEY } from './locale';
import { messages, type MessageKey } from './messages';
import { categoryName, LESSON_EN, presentLesson } from './present';

const SERVER_MESSAGES = [
  NO_MATCH_MESSAGE,
  'Tidak ada.',
  'Terlalu banyak foto. Coba lagi nanti ya.',
  'Pilih foto JPG atau PNG ya.',
  'Fotonya terlalu besar. Coba foto yang lebih kecil.',
  'Foto belum bisa dipakai sekarang.',
  'Foto ini belum bisa dipakai. Coba lagi ya.',
  'Layanan foto belum dipasang di server (OPENAI_API_KEY atau REPLICATE_API_KEY).',
  'Foto tidak dapat dipakai. Pilih gambar lain.',
  'Foto terlalu besar. Pilih bagian yang lebih kecil.',
  'Terlalu banyak permintaan. Coba lagi nanti.',
  'Permintaan dibatalkan.',
  'Waktunya habis. Coba lagi.',
  'Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.',
  'Mode pensil: gambar dengan stylus, atau pindah ke mode jari.',
  'Karya terakhirmu dilanjutkan dari tempat kamu berhenti.',
] as const;

function rectangle(): RgbaImage {
  const width = 64;
  const height = 48;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = x >= 8 && x < 56 && y >= 8 && y < 40;
      const index = (y * width + x) * 4;
      data[index] = on ? 0 : 255;
      data[index + 1] = on ? 0 : 255;
      data[index + 2] = on ? 0 : 255;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

function Probe() {
  const { t, locale } = useI18n();
  const lesson = presentLesson(BUNDLED_LESSONS[0]!, locale);
  return (
    <>
      <LanguageSwitch />
      <p>{t('pickerTitle')}</p>
      <h2>{lesson.title}</h2>
      <p>{lesson.steps[0]?.instruction}</p>
    </>
  );
}

describe('languages', () => {
  it('uses English unless the device language is Indonesian or a choice was saved', () => {
    expect(detectLocale(['en-US'], null)).toBe('en');
    expect(detectLocale(['fr-FR', 'en'], null)).toBe('en');
    expect(detectLocale([], null)).toBe('en');
    expect(detectLocale(['id-ID'], null)).toBe('id');
    expect(detectLocale(['id'], null)).toBe('id');
    expect(detectLocale(['en-US', 'id-ID'], null)).toBe('id');
    expect(detectLocale(['id-ID'], 'en')).toBe('en');
    expect(detectLocale(['en-GB'], 'id')).toBe('id');
  });

  it('has the same keys in English and Indonesian, and neither copy is empty', () => {
    const keys = Object.keys(messages.id) as MessageKey[];
    expect(Object.keys(messages.en).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(messages.id[key].length).toBeGreaterThan(0);
      expect(messages.en[key].length).toBeGreaterThan(0);
    }
  });

  it('keeps every authored lesson in Indonesian and gives it English words', () => {
    const lessons = [...BUNDLED_LESSONS, ...CATEGORY_LESSONS.map((entry) => entry.lesson)];
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    for (const lesson of lessons) {
      expect(presentLesson(lesson, 'id')).toBe(lesson);
      const copy = LESSON_EN[lesson.id];
      expect(copy, lesson.id).toBeTruthy();
      const shown = presentLesson(lesson, 'en');
      expect(shown.title).toBe(copy?.title);
      expect(shown.subtitle).toBe(copy?.subtitle);
      expect(shown.title).not.toBe(lesson.title);
      expect(shown.subtitle).not.toBe(lesson.subtitle);
      for (const step of lesson.steps) {
        const text = copy?.steps[step.id];
        expect(text, `${lesson.id}.${step.id}`).toBeTruthy();
        const next = shown.steps.find((item) => item.id === step.id);
        expect(next?.instruction).toBe(text?.instruction);
        expect(next?.instruction).not.toBe(step.instruction);
        expect(next?.hint).toBe(text?.hint);
        expect(next?.hint).not.toBe(step.hint);
      }
      for (const region of lesson.colorRegions) {
        expect(copy?.regions[region.id], `${lesson.id}.${region.id}`).toBeTruthy();
        const next = shown.colorRegions.find((item) => item.id === region.id);
        expect(next?.label).toBe(copy?.regions[region.id]);
        expect(next?.label).not.toBe(region.label);
      }
    }
  });

  it('names every catalogue category in English', () => {
    for (const entry of CATEGORY_CATALOGUE) {
      expect(categoryName('id', entry.id, entry.title)).toBe(entry.title);
      const english = categoryName('en', entry.id, entry.title);
      expect(english.length).toBeGreaterThan(0);
      if (entry.title !== 'Robot') expect(english).not.toBe(entry.title);
    }
    expect(categoryName('en', 'person-standing', 'Orang Berdiri')).toBe('Standing Person');
    expect(categoryName('en', 'character', 'Tokoh')).toBe('Character');
  });

  it('switches language, keeps the choice, and shows the lesson in that language', () => {
    const view = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText('Mau gambar apa hari ini?')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Kucing Duduk' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(screen.getByText('What shall we draw today?')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sitting Cat' })).toBeTruthy();
    expect(screen.getByText('Draw a big circle for the head.')).toBeTruthy();
    view.unmount();
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Sitting Cat' })).toBeTruthy();
  });

  it('turns photo-lesson sentences into English and leaves Indonesian untouched by default', () => {
    expect(localizeSentence('Gambar garis luar kotak.')).toBe('Draw the outline of kotak.');
    expect(localizeSentence('Gambar garis luar.')).toBe('Draw the outline.');
    expect(localizeSentence('Tambahkan dua telinga.')).toBe('Add two telinga.');
    expect(localizeSentence('Gambar ekor yang lain.')).toBe('Draw ekor — another one.');
    expect(localizeSentence('Warnai kotak dengan hitam.')).toBe('Colour the kotak with black.');
    expect(localizeSentence('Warnai badan dan ekor dengan merah muda.')).toBe('Colour the badan and the ekor with pink.');
    expect(say('id', NO_MATCH_MESSAGE)).toBe(NO_MATCH_MESSAGE);
    expect(say('en', NO_MATCH_MESSAGE)).toBe('We cannot draw that yet. Try one of these.');
    for (const message of SERVER_MESSAGES) {
      expect(PHRASES_EN[message], message).toBeTruthy();
      expect(say('en', message)).not.toBe(message);
    }

    const art = rectangle();
    const contours = traceInk(art);
    const input = {
      id: 'photo-rectangle',
      title: 'Kotak',
      targetHash: 'abcdef1234567890',
      contours,
      sourceWidth: art.width,
      sourceHeight: art.height,
      photo: art,
      palette: ['#222222'],
    };
    const indonesian = buildPhotoLesson(input);
    const english = buildPhotoLesson({ ...input, locale: 'en' });
    expect(indonesian.lesson.steps[0]?.instruction).toBe('Gambar garis luar kotak.');
    expect(english.lesson.steps[0]?.instruction).toBe('Draw the outline of kotak.');
    expect(english.lesson.subtitle).toBe('From a photo');
    expect(english.reviewReason ?? '').toContain('Too few drawing steps');
    expect(presentLesson(indonesian.lesson, 'en').steps[0]?.instruction).toBe('Draw the outline of kotak.');
    expect(presentLesson(indonesian.lesson, 'id').steps[0]?.instruction).toBe('Gambar garis luar kotak.');
  });
});
