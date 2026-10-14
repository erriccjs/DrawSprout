import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as lessonData from './lesson-data';
import { createSession, reduceSession } from './lesson-engine/session';
import * as persistence from './persistence';
import { toCheckpoint } from './persistence/mapping';
import { MemorySessionStore } from './persistence/memory-store';
import { App } from './App';

vi.mock('./lesson-data', async (importOriginal) => {
  const actual = await importOriginal<typeof lessonData>();
  const lessons = [actual.CAT_LESSON, { ...actual.CAT_LESSON, id: 'test-flower', title: 'Bunga' }];
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

let store: MemorySessionStore;

beforeEach(() => {
  store = new MemorySessionStore();
  vi.mocked(persistence.createSessionStore).mockResolvedValue({ store, durable: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function open(title: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(title) }));
  await screen.findByRole('heading', { name: new RegExp(title) });
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
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
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
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();
    await waitFor(async () => {
      expect((await store.loadLatestSessionForLesson(cat.id))?.checkpoint.sessionId).toBe('old-cat-session');
    });
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
