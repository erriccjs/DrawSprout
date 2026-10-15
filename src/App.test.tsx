import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as lessonData from './lesson-data';
import type { LessonPackage } from './lesson-data/schema';
import { DEFAULT_PREFERENCES, createSession, reduceSession } from './lesson-engine/session';
import * as persistence from './persistence';
import { toCheckpoint } from './persistence/mapping';
import { MemorySessionStore } from './persistence/memory-store';
import { StorageFullError } from './persistence/types';
import { drawStroke, stubLayoutBox } from './test/pointer';
import { App } from './App';

const lessons = vi.hoisted(() => [] as LessonPackage[]);

vi.mock('./lesson-data', async (importOriginal) => {
  const actual = await importOriginal<typeof lessonData>();
  return {
    ...actual,
    BUNDLED_LESSONS: lessons,
    getLesson: (id: string) => {
      const lesson = lessons.find((candidate) => candidate.id === id);
      if (!lesson) throw new Error(`Unknown lesson ${id}`);
      return lesson;
    },
  };
});

vi.mock('./persistence', async (importOriginal) => ({
  ...(await importOriginal<typeof persistence>()),
  createSessionStore: vi.fn(),
}));

// Each case renders the full drawing pad once or twice; the default 5s budget
// is not enough for that on a slow machine, as DrawingPad's own suite assumes.
vi.setConfig({ testTimeout: 60_000 });

let store: MemorySessionStore;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  lessons.splice(0, lessons.length, lessonData.CAT_LESSON, {
    ...lessonData.CAT_LESSON,
    id: 'test-flower',
    title: 'Bunga',
  });
  store = new MemorySessionStore();
  vi.mocked(persistence.createSessionStore).mockResolvedValue({ store, durable: true });
});

afterEach(() => {
  cleanup();
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  vi.clearAllMocks();
});

async function open(title: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(title) }));
  await screen.findByRole('heading', { name: new RegExp(title) });
  await act(async () => { await Promise.resolve(); });
}

async function returnToPicker() {
  fireEvent.click(screen.getByRole('button', { name: /Pilih gambar/ }));
  await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
}

describe('lesson picker', () => {
  it('lists the exposed lessons with pictures and opens the chosen one', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    for (const lesson of lessonData.BUNDLED_LESSONS) {
      const choice = screen.getByRole('button', { name: new RegExp(lesson.title) });
      expect(choice.querySelector('svg path')).not.toBeNull();
    }
    await open('Bunga');
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
  });

  it('keeps each lesson at its own saved step after visiting the picker', async () => {
    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('button', { name: /Lanjut/ }));
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    await returnToPicker();

    await open('Bunga');
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    await returnToPicker();

    await open('Kucing');
    expect(await screen.findByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect((await store.loadLatestSessionForLesson('test-flower'))?.checkpoint.currentStepIndex).toBe(0);
  });

  it('resumes a cat checkpoint saved before the picker existed', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const oldSession = reduceSession(cat, createSession(cat, 'old-cat-session'), {
      type: 'next-step',
    });
    await store.saveProgress({ checkpoint: toCheckpoint(oldSession, 1, 123), newStrokes: [] });

    render(<App />);
    await open('Kucing');
    expect(await screen.findByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    await waitFor(async () => {
      expect((await store.loadLatestSessionForLesson(cat.id))?.checkpoint.sessionId).toBe('old-cat-session');
    });
  });

  it('refuses with the child-facing message when a bundled package is broken', async () => {
    lessons.splice(0, lessons.length, {
      ...lessonData.CAT_LESSON,
      coordinateSpace: { ...lessonData.CAT_LESSON.coordinateSpace, width: 0 },
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Pelajaran tidak dapat dibuka' });
    expect(screen.getByText(/positive width and height/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Mau gambar apa hari ini?' })).toBeNull();
  });

  it('returns to the picker from a finished drawing', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const finished = reduceSession(cat, createSession(cat, 'finished-cat'), { type: 'finish' });
    await store.saveProgress({ checkpoint: toCheckpoint(finished, 1, 123), newStrokes: [] });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Kucing/ }));
    await screen.findByRole('heading', { name: 'Selesai! Ini karyamu.' });
    fireEvent.click(screen.getByRole('button', { name: 'Pilih gambar lain' }));
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
  });
});

describe('leaving a drawing', () => {
  it('still reaches the picker and says so when the save fails', async () => {
    vi.spyOn(store, 'saveProgress').mockRejectedValue(new StorageFullError());

    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('button', { name: /Pilih gambar/ }));

    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    expect(await screen.findByText(/mungkin belum tersimpan/)).toBeTruthy();
  });

  it('reaches the picker while the save is still pending, then reports the failure', async () => {
    let failPendingSave: (error: Error) => void = () => {};
    vi.spyOn(store, 'saveProgress').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          failPendingSave = reject;
        }),
    );

    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('button', { name: /Pilih gambar/ }));

    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    expect(screen.queryByText(/mungkin belum tersimpan/)).toBeNull();

    failPendingSave(new StorageFullError());
    expect(await screen.findByText(/mungkin belum tersimpan/)).toBeTruthy();
  });
});

describe('resume notice', () => {
  const RESUMED = /Karya terakhirmu dilanjutkan/;

  it('opens immediately while a saved drawing is stalled and keeps a changed step', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: [] });
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('button', { name: /Lanjut/ }));
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();

    await act(async () => release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: [] }));
    expect(screen.queryByText(RESUMED)).toBeNull();
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
  });

  it('applies a late saved drawing when the child has not started', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await open('Kucing');
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: [] });

    expect(await screen.findByText(RESUMED)).toBeTruthy();
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
  });

  it('opens fresh with one calm notice when loading fails', async () => {
    vi.spyOn(store, 'loadLatestSessionForLesson').mockRejectedValue(new Error('secret database failure'));

    render(<App />);
    await open('Kucing');

    expect(await screen.findByText(/Karya sebelumnya tidak dapat dibuka/)).toBeTruthy();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.queryByText(/secret database failure/)).toBeNull();
  });

  it('hides technical details when a saved checkpoint is broken', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    vi.spyOn(store, 'loadLatestSessionForLesson').mockResolvedValue({
      checkpoint: { ...toCheckpoint(saved, 1, 123), committedStrokeIds: ['missing-stroke'] },
      strokes: [],
    });

    render(<App />);
    await open('Kucing');

    expect(await screen.findByText(/Karya sebelumnya tidak dapat dibuka/)).toBeTruthy();
    expect(screen.queryByText(/missing-stroke/)).toBeNull();
  });

  it('shows a failed load after drawing without replacing the new stroke', async () => {
    stubLayoutBox();
    let rejectLoad: (error: Error) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((_resolve, reject) => {
      rejectLoad = reject;
    }));

    render(<App />);
    await open('Kucing');
    act(() => drawStroke(screen.getByRole('img', { name: /Kanvas gambar/ }), [
      { x: 100, y: 100 }, { x: 200, y: 200 },
    ], { pointerType: 'touch' }));
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);

    await act(async () => rejectLoad(new Error('secret database failure')));
    expect(screen.getAllByText(/Karya sebelumnya tidak dapat dibuka/)).toHaveLength(1);
    expect(screen.queryByText(/secret database failure/)).toBeNull();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
  });

  it('shows a corrupt late checkpoint after a step change without replacing the step', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = createSession(cat, 'broken-cat');
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('button', { name: /Lanjut/ }));

    await act(async () => release({
      checkpoint: { ...toCheckpoint(saved, 1, 123), committedStrokeIds: ['missing-stroke'] },
      strokes: [],
    }));
    expect(screen.getAllByText(/Karya sebelumnya tidak dapat dibuka/)).toHaveLength(1);
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(screen.queryByText(/missing-stroke/)).toBeNull();
  });

  it.each(['step', 'stroke'] as const)(
    'keeps stored preferences while their read settles after a %s change', async (activity) => {
      stubLayoutBox();
      const savedPreferences = { ...DEFAULT_PREFERENCES, hintDurationMs: 8000 };
      await store.savePreferences(savedPreferences);
      const savePreferences = vi.spyOn(store, 'savePreferences');
      let release: (value: typeof savedPreferences) => void = () => {};
      vi.spyOn(store, 'loadPreferences').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

      render(<App />);
      await open('Kucing');
      if (activity === 'step') {
        fireEvent.click(screen.getByRole('button', { name: /Lanjut/ }));
      } else {
        act(() => drawStroke(screen.getByRole('img', { name: /Kanvas gambar/ }), [
          { x: 100, y: 100 }, { x: 200, y: 200 },
        ], { pointerType: 'touch' }));
      }
      expect(savePreferences).not.toHaveBeenCalled();

      await act(async () => release(savedPreferences));
      expect(savePreferences).not.toHaveBeenCalled();
    },
  );

  it('opens a blank drawing silently after leaving and coming back', async () => {
    render(<App />);
    await open('Kucing');
    await returnToPicker();
    await open('Kucing');

    expect(await store.loadLatestSessionForLesson(lessonData.BUNDLED_LESSONS[0]!.id)).not.toBeNull();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.queryByText(RESUMED)).toBeNull();
  });

  it('tells the child when real progress is picked up again', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const started = reduceSession(cat, createSession(cat, 'started-cat'), { type: 'next-step' });
    await store.saveProgress({ checkpoint: toCheckpoint(started, 1, 123), newStrokes: [] });

    render(<App />);
    await open('Kucing');

    expect(await screen.findByText(RESUMED)).toBeTruthy();
  });
});
