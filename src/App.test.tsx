import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as lessonData from './lesson-data';
import type { LessonPackage } from './lesson-data/schema';
import { DEFAULT_PREFERENCES, createSession, reduceSession } from './lesson-engine/session';
import * as persistence from './persistence';
import { toCheckpoint } from './persistence/mapping';
import { MemorySessionStore } from './persistence/memory-store';
import { StorageFullError } from './persistence/types';
import { markOfflineReady, markUpdateWaiting, resetOfflineStatus } from './offline/status';
import { strokeInput } from './test/factories';
import { drawStroke, pointerDown, pointerMove, pointerUp, stubLayoutBox } from './test/pointer';
import { App } from './App';
import { TABLET_NOTICE_KEY } from './ui/tablet-notice';

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
  resetOfflineStatus();
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
  it('asks for fullscreen when a picture is opened, not when the first stroke starts', async () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const host = document.documentElement;
    const original = host.requestFullscreen;
    host.requestFullscreen = requestFullscreen;
    try {
      render(<App />);
      await open('Kucing');
      expect(requestFullscreen).toHaveBeenCalledTimes(1);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeTruthy();
      act(() =>
        drawStroke(canvas!, [
          { x: 40, y: 40 },
          { x: 90, y: 70 },
        ]),
      );
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
    } finally {
      host.requestFullscreen = original;
    }
  });

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

  it('refuses with a calm line and logs the technical detail when a bundled package is broken', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    lessons.splice(0, lessons.length, {
      ...lessonData.CAT_LESSON,
      coordinateSpace: { ...lessonData.CAT_LESSON.coordinateSpace, width: 0 },
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Pelajaran tidak dapat dibuka' });
    expect(screen.getByText(/pelajaran belum bisa dibuka/)).toBeTruthy();
    expect(screen.queryByText(/positive width and height/)).toBeNull();
    expect(logged.mock.calls.some((call) => call.some(
      (arg) => arg instanceof Error && /positive width and height/.test(arg.message),
    ))).toBe(true);
    logged.mockRestore();
    expect(screen.queryByRole('heading', { name: 'Mau gambar apa hari ini?' })).toBeNull();
  });

  it('does not claim the app works offline until the shell has been checked', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    expect(screen.queryByText('Bisa dibuka tanpa internet.')).toBeNull();

    cleanup();
    markOfflineReady();
    render(<App />);
    expect(await screen.findByText('Bisa dibuka tanpa internet.')).toBeTruthy();
  });

  it('offers a waiting update on the picker and hides it while a drawing is open', async () => {
    markUpdateWaiting();
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Muat versi baru' })).toBeTruthy();
    expect(screen.getByText(/Gambar yang sudah tersimpan tetap ada/)).toBeTruthy();

    await open('Kucing');
    expect(screen.queryByRole('button', { name: 'Muat versi baru' })).toBeNull();
    expect(screen.queryByText(/Ada versi baru/)).toBeNull();

    await returnToPicker();
    // The prompt stays hidden until the exit save settles, so wait for it.
    fireEvent.click(await screen.findByRole('button', { name: 'Nanti saja' }));
    expect(screen.queryByRole('button', { name: 'Muat versi baru' })).toBeNull();

    await open('Kucing');
    await returnToPicker();
    fireEvent.click(await screen.findByRole('button', { name: 'Muat versi baru' }));
    expect(screen.getByText('Memuat versi baru…')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Kucing/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Mau gambar apa hari ini?' })).toBeTruthy();
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

  it('opens the picker from the restart question without changing the drawing', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const drawn = reduceSession(cat, createSession(cat, 'finished-cat'), {
      type: 'commit-stroke',
      stroke: {
        id: 'saved-stroke', stepId: cat.steps[0]!.id, layerId: 'ink',
        points: [{ x: 100, y: 100 }, { x: 200, y: 160 }],
        color: '#000000', width: 4, tool: 'pen', clipRegionIds: [],
      },
    });
    const finished = reduceSession(cat, reduceSession(cat, drawn, { type: 'next-step' }), { type: 'finish' });
    await store.saveProgress({ checkpoint: toCheckpoint(finished, 1, 123), newStrokes: [...finished.strokes] });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Kucing/ }));
    await screen.findByRole('heading', { name: 'Selesai! Ini karyamu.' });
    fireEvent.click(screen.getByRole('button', { name: /Gambar lagi/ }));
    expect(screen.getByRole('heading', { name: 'Mau mulai dengan gambar kosong?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pilih gambar lain' }));
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    const saved = await store.loadSession('finished-cat');
    expect(saved?.checkpoint.currentStepIndex).toBe(finished.currentStepIndex);
    expect(saved?.strokes.map((stroke) => stroke.id)).toEqual(['saved-stroke']);
  });
});

describe('leaving a drawing', () => {
  it('reopens the latest work before its exit save finishes', async () => {
    stubLayoutBox();
    const saveProgress = store.saveProgress.bind(store);
    let releaseSave: () => void = () => {};
    const pending = new Promise<void>((resolve) => { releaseSave = resolve; });
    let firstSave = true;
    const save = vi.spyOn(store, 'saveProgress').mockImplementation((input) => {
      if (!firstSave) return saveProgress(input);
      firstSave = false;
      return pending.then(() => saveProgress(input));
    });

    render(<App />);
    await open('Kucing');
    act(() => drawStroke(screen.getByRole('img', { name: /Kanvas gambar/ }), [
      { x: 100, y: 100 }, { x: 200, y: 200 },
    ], { pointerType: 'touch' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    await returnToPicker();

    await open('Kucing');
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    act(() => drawStroke(screen.getByRole('img', { name: /Kanvas gambar/ }), [
      { x: 250, y: 250 }, { x: 300, y: 300 },
    ], { pointerType: 'touch' }));
    await act(() => Promise.resolve(releaseSave()));
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);

    await returnToPicker();
    await waitFor(async () => {
      expect((await store.loadLatestSessionForLesson(lessonData.CAT_LESSON.id))?.strokes).toHaveLength(2);
    });
  });

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

    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: [] })));
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

  it('keeps a saved drawing latest after repeated selected-control taps during its load', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const stepped = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const saved = reduceSession(cat, stepped, {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[1]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    const saveProgress = store.saveProgress.bind(store);
    let releaseSave: () => void = () => {};
    const pendingSave = new Promise<void>((resolve) => { releaseSave = resolve; });
    const save = vi.spyOn(store, 'saveProgress').mockImplementation((input) =>
      pendingSave.then(() => saveProgress(input)));
    const loadLatestSessionForLesson = store.loadLatestSessionForLesson.bind(store);
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('button', { name: /Mode jari/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ikuti panduan' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Ukuran kuas' }), { target: { value: '12' } });
    expect(save).not.toHaveBeenCalled();

    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: saved.strokes })));

    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByText(RESUMED)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.lastCall?.[0].checkpoint.sessionId).toBe(saved.sessionId);
    await act(() => Promise.resolve(releaseSave()));
    await waitFor(async () => {
      const latest = await loadLatestSessionForLesson(cat.id);
      expect(latest?.checkpoint.sessionId).toBe(saved.sessionId);
      expect(latest?.checkpoint.committedStrokeIds).toEqual([saved.strokes[0]!.id]);
    });
  });

  it('keeps saved work when a pointer goes down but the child leaves before lifting', async () => {
    stubLayoutBox();
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const stepped = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const saved = reduceSession(cat, stepped, {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[1]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    const loadLatestSessionForLesson = store.loadLatestSessionForLesson.bind(store);
    const save = vi.spyOn(store, 'saveProgress');
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await open('Kucing');
    act(() => pointerDown(screen.getByRole('img', { name: /Kanvas gambar/ }),
      { x: 100, y: 100 }, { pointerType: 'touch' }));
    await returnToPicker();
    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: saved.strokes })));

    expect(save).not.toHaveBeenCalled();
    const latest = await loadLatestSessionForLesson(cat.id);
    expect(latest?.checkpoint.sessionId).toBe(saved.sessionId);
    expect(latest?.checkpoint.committedStrokeIds).toEqual([saved.strokes[0]!.id]);
  });

  it('restores a saved drawing under a changed control selected during loading', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const stepped = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const saved = reduceSession(cat, stepped, {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[1]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('button', { name: /Mode pensil/ }));
    expect(screen.getByRole('button', { name: /Mode pensil/ }).getAttribute('aria-pressed')).toBe('true');

    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: saved.strokes })));
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: /Mode pensil/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps a committed new stroke when an older saved drawing arrives late', async () => {
    stubLayoutBox();
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const loadLatestSessionForLesson = store.loadLatestSessionForLesson.bind(store);
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await open('Kucing');
    act(() => drawStroke(screen.getByRole('img', { name: /Kanvas gambar/ }), [
      { x: 100, y: 100 }, { x: 200, y: 200 },
    ], { pointerType: 'touch' }));
    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: [] })));

    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(RESUMED)).toBeNull();
    await waitFor(async () => {
      const latest = await loadLatestSessionForLesson(cat.id);
      expect(latest?.checkpoint.currentStepIndex).toBe(0);
      expect(latest?.strokes).toHaveLength(1);
    });
  });

  it('keeps a live stroke when the saved drawing arrives before pointer-up', async () => {
    stubLayoutBox();
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const stepped = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const saved = reduceSession(cat, stepped, {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[1]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    const loadLatestSessionForLesson = store.loadLatestSessionForLesson.bind(store);
    const save = vi.spyOn(store, 'saveProgress');
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await open('Kucing');
    const canvas = screen.getByRole('img', { name: /Kanvas gambar/ });
    act(() => {
      pointerDown(canvas, { x: 100, y: 100 }, { pointerType: 'touch' });
      pointerMove(canvas, { x: 150, y: 150 }, { pointerType: 'touch' });
    });

    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: saved.strokes })));
    expect(screen.getByRole('img', { name: /Kanvas gambar/ })).toBe(canvas);
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.queryByText(RESUMED)).toBeNull();
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Mode pensil/ }));
    act(() => pointerUp(canvas, { x: 200, y: 200 }, { pointerType: 'touch' }));
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    await waitFor(async () => {
      const latest = await loadLatestSessionForLesson(cat.id);
      expect(latest?.checkpoint.currentStepIndex).toBe(0);
      expect(latest?.strokes).toHaveLength(1);
      expect(latest?.strokes[0]?.points).toHaveLength(2);
    });
  });

  it('opens an outdated checkpoint without progress silently', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    await store.saveProgress({
      checkpoint: { ...toCheckpoint(createSession(cat, 'old-untouched'), 1, 123), lessonContentVersion: 'older' },
      newStrokes: [],
    });

    render(<App />);
    await open('Kucing');
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByText(/Pelajaran sudah diperbarui/)).toBeNull();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
  });

  it('tells the child when an outdated checkpoint with progress opens as new', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const worked = reduceSession(cat, createSession(cat, 'old-worked'), { type: 'next-step' });
    await store.saveProgress({
      checkpoint: { ...toCheckpoint(worked, 1, 123), lessonContentVersion: 'older' },
      newStrokes: [],
    });

    render(<App />);
    await open('Kucing');

    expect(await screen.findByText(/Pelajaran sudah diperbarui/)).toBeTruthy();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
  });

  it('opens fresh with one calm notice when loading fails', async () => {
    vi.spyOn(store, 'loadLatestSessionForLesson').mockRejectedValue(new Error('secret database failure'));

    render(<App />);
    await open('Kucing');

    expect(await screen.findByText(/Karya sebelumnya tidak dapat dibuka/)).toBeTruthy();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.queryByText(/secret database failure/)).toBeNull();
  });

  it('leaves a saved drawing latest after a failed load of an empty session', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[0]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    const loadLatest = store.loadLatestSessionForLesson.bind(store);
    vi.spyOn(store, 'loadLatestSessionForLesson').mockRejectedValueOnce(new Error('load failed'));
    const save = vi.spyOn(store, 'saveProgress');

    render(<App />);
    await open('Kucing');
    expect(await screen.findByText(/Karya sebelumnya tidak dapat dibuka/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Mode pensil/ }));
    await returnToPicker();

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(await save.mock.results[0]!.value).toBe(false);
    expect((await loadLatest(cat.id))?.checkpoint.sessionId).toBe(saved.sessionId);
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

    await act(() => Promise.resolve(rejectLoad(new Error('secret database failure'))));
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

    await act(() => Promise.resolve(release({
      checkpoint: { ...toCheckpoint(saved, 1, 123), committedStrokeIds: ['missing-stroke'] },
      strokes: [],
    })));
    expect(screen.getAllByText(/Karya sebelumnya tidak dapat dibuka/)).toHaveLength(1);
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(screen.queryByText(/missing-stroke/)).toBeNull();
  });

  it.each(['step', 'stroke'] as const)(
    'keeps stored preferences while their read settles after a %s change', async (activity) => {
      stubLayoutBox();
      const savedPreferences = { ...DEFAULT_PREFERENCES, hintDurationMs: 10000 as const };
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

      await act(() => Promise.resolve(release(savedPreferences)));
      expect(savePreferences).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Mode pensil/ }));
      await waitFor(() => expect(savePreferences).toHaveBeenCalled());
      expect(savePreferences.mock.lastCall?.[0].inputMode).toBe('pencil');
    },
  );

  it('saves a later preference change after a pending read fails', async () => {
    let rejectPreferences: (error: Error) => void = () => {};
    vi.spyOn(store, 'loadPreferences').mockImplementation(() => new Promise((_resolve, reject) => {
      rejectPreferences = reject;
    }));
    const savePreferences = vi.spyOn(store, 'savePreferences');

    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('button', { name: /Lanjut/ }));
    await act(() => Promise.resolve(rejectPreferences(new Error('unavailable'))));
    expect(savePreferences).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Mode pensil/ }));
    await waitFor(() => expect(savePreferences).toHaveBeenCalled());
    expect(savePreferences.mock.lastCall?.[0].inputMode).toBe('pencil');
  });

  it('keeps an explicit control change when both lesson reads finish late', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    let releasePreferences: (value: typeof DEFAULT_PREFERENCES) => void = () => {};
    let releaseSession: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadPreferences').mockImplementation(() => new Promise((resolve) => { releasePreferences = resolve; }));
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { releaseSession = resolve; }));
    const savePreferences = vi.spyOn(store, 'savePreferences');

    render(<App />);
    await open('Kucing');
    fireEvent.click(screen.getByRole('radio', { name: /Mandiri/ }));
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Mandiri/ }).checked).toBe(true);

    await act(() => Promise.resolve(releasePreferences(DEFAULT_PREFERENCES)));
    await waitFor(() => expect(savePreferences.mock.lastCall?.[0].assistanceMode).toBe('independent'));
    await act(() => Promise.resolve(releaseSession({ checkpoint: toCheckpoint(saved, 1, 123), strokes: [] })));
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Mandiri/ }).checked).toBe(true);
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByText(RESUMED)).toBeTruthy();
  });

  it.each(['null', 'failure'] as const)(
    'keeps a control choice for later lessons when preferences load with %s after restore', async (outcome) => {
      const cat = lessonData.BUNDLED_LESSONS[0]!;
      const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
      await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: [] });
      let releasePreferences: (value: typeof DEFAULT_PREFERENCES | null) => void = () => {};
      let rejectPreferences: (error: Error) => void = () => {};
      vi.spyOn(store, 'loadPreferences').mockImplementationOnce(() => new Promise((resolve, reject) => {
        releasePreferences = resolve;
        rejectPreferences = reject;
      }));

      render(<App />);
      await open('Kucing');
      fireEvent.click(screen.getByRole('button', { name: /Mode pensil/ }));
      expect(await screen.findByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();

      if (outcome === 'null') {
        await act(() => Promise.resolve(releasePreferences(null)));
      } else {
        await act(() => Promise.resolve(rejectPreferences(new Error('unavailable'))));
      }
      await waitFor(async () => expect((await store.loadPreferences())?.inputMode).toBe('pencil'));

      await returnToPicker();
      await open('Bunga');
      expect(screen.getByRole('button', { name: /Mode pensil/ }).getAttribute('aria-pressed')).toBe('true');
    },
  );

  it('does not replace stored preferences with an older checkpoint on restore', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: [] });
    await store.savePreferences({ ...DEFAULT_PREFERENCES, inputMode: 'pencil' });
    const savePreferences = vi.spyOn(store, 'savePreferences');

    render(<App />);
    await open('Kucing');
    expect(await screen.findByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(savePreferences).not.toHaveBeenCalled();
    expect((await store.loadPreferences())?.inputMode).toBe('pencil');
  });

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

describe('the phone tablet notice', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  function setViewport(nextWidth: number, nextHeight: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: nextWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: nextHeight });
  }

  afterEach(() => {
    setViewport(width, height);
    localStorage.removeItem(TABLET_NOTICE_KEY);
  });

  it('shows on a phone, remembers Mengerti, and does not write a drawing', async () => {
    setViewport(390, 844);
    const save = vi.spyOn(store, 'saveProgress');
    render(<App />);
    expect(await screen.findByText(/DrawSprout paling nyaman di tablet/)).toBeTruthy();
    expect(screen.getByText(/Di HP tetap bisa menggambar/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mengerti' }));
    expect(screen.queryByText(/DrawSprout paling nyaman di tablet/)).toBeNull();
    expect(localStorage.getItem(TABLET_NOTICE_KEY)).toBe('1');
    expect(save).not.toHaveBeenCalled();

    cleanup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    expect(screen.queryByText(/DrawSprout paling nyaman di tablet/)).toBeNull();
  });

  it('stays hidden on a tablet', async () => {
    setViewport(1024, 768);
    localStorage.removeItem(TABLET_NOTICE_KEY);
    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    expect(screen.queryByText(/DrawSprout paling nyaman di tablet/)).toBeNull();
  });
});
