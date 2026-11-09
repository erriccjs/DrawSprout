import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as CategoryLibrary from './categories/library';
import * as lessonData from './lesson-data';
import type { LessonPackage } from './lesson-data/schema';
import { DEFAULT_PREFERENCES, createSession, reduceSession } from './lesson-engine/session';
import * as persistence from './persistence';
import { toCheckpoint } from './persistence/mapping';
import { MemorySessionStore } from './persistence/memory-store';
import { StorageFullError } from './persistence/types';
import { markOfflineReady, markUpdateWaiting, resetOfflineStatus } from './offline/status';
import * as exportApi from './renderer/export';
import { strokeInput } from './test/factories';
import { drawStroke, stubLayoutBox } from './test/pointer';
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

vi.mock('./categories/library', async (importOriginal) => {
  const actual = await importOriginal<typeof CategoryLibrary>();
  return {
    ...actual,
    lessonsForPicker: () => lessons,
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
  sessionStorage.clear();
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

function lessonChoice(title: string): HTMLElement {
  const choice = screen.getAllByRole('button', { name: new RegExp(title) })
    .find((button) => button.classList.contains('lesson-picker__choice'));
  if (!choice) throw new Error(`No lesson choice matching ${title}`);
  return choice;
}

async function open(title: string, resume: 'continue' | 'stay' = 'continue') {
  await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
  fireEvent.click(lessonChoice(title));
  // Level 1 is the drawing title or the continue choice. Gallery cards are level 3.
  await screen.findByRole('heading', { level: 1, name: new RegExp(title) });
  const choice = screen.queryByRole('button', { name: /Lanjutkan|Lihat karyamu/ });
  if (choice && resume === 'continue') fireEvent.click(choice);
  await act(async () => { await Promise.resolve(); });
}

async function returnToPicker() {
  fireEvent.click(screen.getByRole('button', { name: /Pilih gambar/ }));
  await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
}

describe('lesson picker', () => {
  it('hides the photo spike until a parent turns the beta flag on', async () => {
    const { unmount } = render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    expect(screen.queryByRole('button', { name: 'Buat dari foto' })).toBeNull();
    unmount();

    sessionStorage.setItem('drawsprout-beta-foto', '1');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Buat dari foto' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dari foto' })).toBeTruthy();
  });

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
      const choice = lessonChoice(lesson.title);
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
    await open('Kucing', 'stay');
    expect(screen.queryByText('Selesai! Ini karyamu.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lanjutkan' }));
    expect(await screen.findByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    await waitFor(async () => {
      expect((await store.loadLatestSessionForLesson(cat.id))?.checkpoint.sessionId).toBe('old-cat-session');
      expect((await store.loadSession('old-cat-session'))?.checkpoint.updatedAt).toBe(123);
    });
  });

  it('starts a new attempt without removing or re-dating the saved picture', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const finished = reduceSession(
      cat,
      reduceSession(cat, createSession(cat, 'finished-cat'), { type: 'next-step' }),
      { type: 'finish' },
    );
    await store.saveProgress({ checkpoint: toCheckpoint(finished, 2, 555), newStrokes: [] });

    render(<App />);
    await open('Kucing', 'stay');
    expect(screen.queryByText('Selesai! Ini karyamu.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lihat karyamu' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gambar baru' }));
    expect(await screen.findByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    const kept = await store.loadSession('finished-cat');
    expect(kept?.checkpoint.updatedAt).toBe(555);
    expect(kept?.checkpoint.finished).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Lanjut/ }));
    await returnToPicker();
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Kucing Duduk', level: 3 })).toHaveLength(2);
    });
    expect((await store.loadSession('finished-cat'))?.checkpoint.updatedAt).toBe(555);
  });

  it('offers the finished picture when a later visit has no marks', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const finished = reduceSession(
      cat,
      reduceSession(cat, createSession(cat, 'finished-cat'), { type: 'next-step' }),
      { type: 'finish' },
    );
    const blank = createSession(cat, 'blank-cat');
    await store.saveProgress({ checkpoint: toCheckpoint(finished, 1, 100), newStrokes: [] });
    await store.saveProgress({ checkpoint: toCheckpoint(blank, 1, 900), newStrokes: [] });

    render(<App />);
    await open('Kucing', 'stay');
    expect(screen.getByRole('button', { name: 'Lihat karyamu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gambar baru' })).toBeTruthy();
    expect((await store.loadSession('finished-cat'))?.checkpoint.updatedAt).toBe(100);
    expect((await store.loadSession('blank-cat'))?.checkpoint.updatedAt).toBe(900);
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
    expect(lessonChoice('Kucing').hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Mau gambar apa hari ini?' })).toBeTruthy();
  });

  it('returns to the picker from a finished drawing', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const finished = reduceSession(cat, createSession(cat, 'finished-cat'), { type: 'finish' });
    await store.saveProgress({ checkpoint: toCheckpoint(finished, 1, 123), newStrokes: [] });

    render(<App />);
    await screen.findByRole('heading', { name: 'Karyaku' });
    fireEvent.click(lessonChoice('Kucing'));
    fireEvent.click(await screen.findByRole('button', { name: 'Lihat karyamu' }));
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
    await screen.findByRole('heading', { name: 'Karyaku' });
    fireEvent.click(lessonChoice('Kucing'));
    fireEvent.click(await screen.findByRole('button', { name: 'Lihat karyamu' }));
    await screen.findByRole('heading', { name: 'Selesai! Ini karyamu.' });
    fireEvent.click(screen.getByRole('button', { name: /Gambar lagi/ }));
    expect(screen.getByRole('heading', { name: 'Mau mulai dengan gambar kosong?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pilih gambar lain' }));
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    const saved = await store.loadSession('finished-cat');
    expect(saved?.checkpoint.currentStepIndex).toBe(finished.currentStepIndex);
    expect(saved?.strokes.map((stroke) => stroke.id)).toEqual(['saved-stroke']);
  });

  it('opens a saved artwork from Karyaku and deletes it after confirmation', async () => {
    const cat = lessonData.CAT_LESSON;
    const drawn = reduceSession(cat, createSession(cat, 'gallery-cat'), {
      type: 'commit-stroke',
      stroke: strokeInput(cat.steps[0]!.id, { id: 'gallery-stroke' }),
    });
    await store.saveProgress({
      checkpoint: toCheckpoint(drawn, 1, Date.UTC(2026, 9, 21, 9, 5)),
      newStrokes: [...drawn.strokes],
    });

    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Karyaku' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Kucing Duduk', level: 3 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Buka Kucing Duduk' }));
    await screen.findByRole('heading', { name: 'Kucing Duduk', level: 1 });
    expect(screen.queryByRole('heading', { name: 'Karyaku' })).toBeNull();
    await returnToPicker();
    expect((await store.loadSession('gallery-cat'))?.checkpoint.updatedAt).toBe(Date.UTC(2026, 9, 21, 9, 5));

    fireEvent.click(await screen.findByRole('button', { name: 'Lainnya untuk Kucing Duduk' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hapus Kucing Duduk' }));
    expect(screen.getByText('Hapus karya ini?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(await store.loadSession('gallery-cat')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Lainnya untuk Kucing Duduk' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hapus Kucing Duduk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    expect(await screen.findByText('Belum ada karya tersimpan.')).toBeTruthy();
    expect(await store.loadSession('gallery-cat')).toBeNull();
  });

  it('lists a free-drawing session in Karyaku and reopens it without the guide', async () => {
    const cat = lessonData.CAT_LESSON;
    const lastStepId = cat.steps[cat.steps.length - 1]!.id;
    let state = createSession(cat, 'free-cat');
    for (let index = 1; index < cat.steps.length; index += 1) {
      state = reduceSession(cat, state, { type: 'next-step' });
    }
    state = reduceSession(cat, state, {
      type: 'commit-stroke',
      stroke: strokeInput(lastStepId, {
        id: 'guided',
        points: [{ x: 30, y: 40 }, { x: 50, y: 60 }],
      }),
    });
    state = reduceSession(cat, state, { type: 'enter-free-creation' });
    state = reduceSession(cat, state, {
      type: 'commit-stroke',
      stroke: strokeInput('ignored', {
        id: 'free-mark',
        points: [{ x: 70, y: 80 }, { x: 90, y: 100 }],
      }),
    });
    await store.saveProgress({
      checkpoint: toCheckpoint(state, 1, Date.UTC(2026, 9, 21, 9, 5)),
      newStrokes: [...state.strokes],
    });

    const paint = vi.spyOn(exportApi, 'renderArtworkToCanvas');
    render(<App />);
    expect(await screen.findByRole('img', { name: 'Karya Kucing Duduk' })).toBeTruthy();
    const thumbnail = paint.mock.calls.at(-1)?.[0];
    expect(thumbnail).not.toHaveProperty('guides');
    expect(thumbnail?.strokes.map((stroke) => stroke.points[0])).toEqual([
      { x: 30, y: 40 },
      { x: 70, y: 80 },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Buka Kucing Duduk' }));
    expect(await screen.findByRole('heading', { name: 'Gambar bebas.' })).toBeTruthy();
    expect(document.querySelector('.guide-overlay')?.getAttribute('data-visible')).toBe('false');
    expect(screen.queryByRole('heading', { name: 'Karyaku' })).toBeNull();
    paint.mockRestore();
  });

  it('says what happened when a trace photo is cancelled, rejected, or cannot be read', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    const input = screen.getByLabelText('Pilih atau ambil foto');

    fireEvent.click(screen.getByRole('button', { name: 'Jiplak foto' }));
    expect(screen.getByText(/Pilih foto untuk dijiplak/)).toBeTruthy();

    fireEvent.change(input, { target: { files: [] } });
    expect(await screen.findByText('Tidak ada foto yang dipilih.')).toBeTruthy();

    fireEvent.change(input, { target: { files: [new File(['hello'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Pilih foto JPG atau PNG ya.')).toBeTruthy();

    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = () => 'blob:trace-test';
    URL.revokeObjectURL = () => undefined;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    let decodeAttempts = 0;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get: () => 'blob:trace-test',
      set(this: HTMLImageElement) {
        decodeAttempts += 1;
        queueMicrotask(() => this.dispatchEvent(new Event('error')));
      },
    });
    try {
      const photo = new File([new Uint8Array([1, 2, 3])], 'bad.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [photo] } });
      fireEvent.change(input, { target: { files: [photo] } });
      expect(await screen.findByText('Foto tidak dapat dibaca. Pilih gambar lain.')).toBeTruthy();
      expect(decodeAttempts).toBe(2);
      expect(screen.queryByRole('heading', { name: 'Mau gambar apa hari ini?' })).toBeTruthy();

      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true,
        get: () => 'blob:trace-test',
        set(this: HTMLImageElement) {
          Object.defineProperty(this, 'naturalWidth', { configurable: true, value: 0 });
          Object.defineProperty(this, 'naturalHeight', { configurable: true, value: 0 });
          queueMicrotask(() => this.dispatchEvent(new Event('load')));
        },
      });
      fireEvent.change(input, { target: { files: [photo] } });
      expect(screen.getByText('Membuka foto…')).toBeTruthy();
      expect(await screen.findByText('Foto tidak dapat dibaca. Pilih gambar lain.')).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Mau gambar apa hari ini?' })).toBeTruthy();
    } finally {
      if (descriptor) Object.defineProperty(HTMLImageElement.prototype, 'src', descriptor);
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
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

  it('keeps the canvas hidden until a saved picture is known, then continues that step', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: [] });
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    fireEvent.click(lessonChoice('Kucing'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('img', { name: /Kanvas gambar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Lanjut/ })).toBeNull();

    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: [] })));
    fireEvent.click(await screen.findByRole('button', { name: 'Lanjutkan' }));
    expect(await screen.findByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByText(RESUMED)).toBeTruthy();
    expect((await store.loadSession('saved-cat'))?.checkpoint.updatedAt).toBe(123);
  });

  it('offers continue when a saved picture arrives and the child has not drawn', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    fireEvent.click(lessonChoice('Kucing'));
    expect(screen.queryByText('Tahap 1 dari 9', { exact: false })).toBeNull();
    release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: [] });

    fireEvent.click(await screen.findByRole('button', { name: 'Lanjutkan' }));
    expect(await screen.findByText(RESUMED)).toBeTruthy();
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
  });

  it('does not save or replace a picture while its continue choice is still loading', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const stepped = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const saved = reduceSession(cat, stepped, {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[1]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    const save = vi.spyOn(store, 'saveProgress');
    const loadLatestSessionForLesson = store.loadLatestSessionForLesson.bind(store);
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    fireEvent.click(lessonChoice('Kucing'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('button', { name: /Mode jari/ })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Ukuran kuas' })).toBeNull();
    expect(save).not.toHaveBeenCalled();

    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: saved.strokes })));
    fireEvent.click(screen.getByRole('button', { name: 'Pilih gambar lain' }));
    expect(save).not.toHaveBeenCalled();
    const latest = await loadLatestSessionForLesson(cat.id);
    expect(latest?.checkpoint.sessionId).toBe(saved.sessionId);
    expect(latest?.checkpoint.updatedAt).toBe(123);
    expect(latest?.checkpoint.committedStrokeIds).toEqual([saved.strokes[0]!.id]);
  });

  it('leaves the saved picture untouched when the child goes back from the choice', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const stepped = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const saved = reduceSession(cat, stepped, {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[1]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    const loadLatestSessionForLesson = store.loadLatestSessionForLesson.bind(store);
    const save = vi.spyOn(store, 'saveProgress');

    render(<App />);
    await open('Kucing', 'stay');
    expect(screen.queryByRole('img', { name: /Kanvas gambar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pilih gambar lain' }));
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });

    expect(save).not.toHaveBeenCalled();
    const latest = await loadLatestSessionForLesson(cat.id);
    expect(latest?.checkpoint.sessionId).toBe(saved.sessionId);
    expect(latest?.checkpoint.committedStrokeIds).toEqual([saved.strokes[0]!.id]);
    expect(latest?.checkpoint.updatedAt).toBe(123);
  });

  it('continues a saved drawing and keeps a control chosen after that', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const stepped = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const saved = reduceSession(cat, stepped, {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[1]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });

    render(<App />);
    await open('Kucing');
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Mode pensil/ }));
    expect(screen.getByRole('button', { name: /Mode pensil/ }).getAttribute('aria-pressed')).toBe('true');
    expect((await store.loadSession('saved-cat'))?.checkpoint.updatedAt).toBe(123);
  });

  it('starts a second attempt only after the child asks, and keeps the first picture', async () => {
    stubLayoutBox();
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: [] });
    const loadLatestSessionForLesson = store.loadLatestSessionForLesson.bind(store);

    render(<App />);
    await open('Kucing', 'stay');
    expect(screen.queryByRole('img', { name: /Kanvas gambar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gambar baru' }));
    expect(await screen.findByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    act(() => drawStroke(screen.getByRole('img', { name: /Kanvas gambar/ }), [
      { x: 100, y: 100 }, { x: 200, y: 200 },
    ], { pointerType: 'touch' }));
    await returnToPicker();

    await waitFor(async () => {
      const latest = await loadLatestSessionForLesson(cat.id);
      expect(latest?.checkpoint.sessionId).not.toBe('saved-cat');
      expect(latest?.strokes).toHaveLength(1);
    });
    const first = await store.loadSession('saved-cat');
    expect(first?.checkpoint.currentStepIndex).toBe(1);
    expect(first?.checkpoint.updatedAt).toBe(123);
  });

  it('does not mount the canvas while a saved picture is still being read', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const stepped = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    const saved = reduceSession(cat, stepped, {
      type: 'commit-stroke', stroke: strokeInput(cat.steps[1]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    const save = vi.spyOn(store, 'saveProgress');
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    fireEvent.click(lessonChoice('Kucing'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('img', { name: /Kanvas gambar/ })).toBeNull();
    expect(save).not.toHaveBeenCalled();

    await act(() => Promise.resolve(release({ checkpoint: toCheckpoint(saved, 1, 123), strokes: saved.strokes })));
    expect(screen.queryByRole('img', { name: /Kanvas gambar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lanjutkan' }));
    expect(await screen.findByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByText(RESUMED)).toBeTruthy();
    expect((await store.loadSession('saved-cat'))?.checkpoint.updatedAt).toBe(123);
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

  it('shows one calm notice when a saved picture fails to load, before any canvas', async () => {
    let rejectLoad: (error: Error) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((_resolve, reject) => {
      rejectLoad = reject;
    }));

    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    fireEvent.click(lessonChoice('Kucing'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('img', { name: /Kanvas gambar/ })).toBeNull();

    await act(() => Promise.resolve(rejectLoad(new Error('secret database failure'))));
    expect(await screen.findByText(/Karya sebelumnya tidak dapat dibuka/)).toBeTruthy();
    expect(screen.getAllByText(/Karya sebelumnya tidak dapat dibuka/)).toHaveLength(1);
    expect(screen.queryByText(/secret database failure/)).toBeNull();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(true);
  });

  it('shows a calm notice for a corrupt checkpoint and opens a fresh step 1', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = createSession(cat, 'broken-cat');
    let release: (value: Awaited<ReturnType<typeof store.loadLatestSessionForLesson>>) => void = () => {};
    vi.spyOn(store, 'loadLatestSessionForLesson').mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    render(<App />);
    await screen.findByRole('heading', { name: 'Mau gambar apa hari ini?' });
    fireEvent.click(lessonChoice('Kucing'));
    expect(screen.queryByRole('button', { name: /Lanjut/ })).toBeNull();

    await act(() => Promise.resolve(release({
      checkpoint: { ...toCheckpoint(saved, 1, 123), committedStrokeIds: ['missing-stroke'] },
      strokes: [],
    })));
    expect(await screen.findByText(/Karya sebelumnya tidak dapat dibuka/)).toBeTruthy();
    expect(screen.getAllByText(/Karya sebelumnya tidak dapat dibuka/)).toHaveLength(1);
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
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

  it('keeps a control chosen after continuing, and uses it on the next lesson', async () => {
    const cat = lessonData.BUNDLED_LESSONS[0]!;
    const saved = reduceSession(cat, createSession(cat, 'saved-cat'), { type: 'next-step' });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: [] });

    render(<App />);
    await open('Kucing');
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Mode pensil/ }));
    await waitFor(async () => expect((await store.loadPreferences())?.inputMode).toBe('pencil'));

    await returnToPicker();
    await open('Bunga');
    expect(screen.getByRole('button', { name: /Mode pensil/ }).getAttribute('aria-pressed')).toBe('true');
    expect((await store.loadSession('saved-cat'))?.checkpoint.updatedAt).toBe(123);
  });

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
