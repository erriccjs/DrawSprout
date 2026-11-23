import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CAT_LESSON } from '../lesson-data';
import { createSession, reduceSession } from '../lesson-engine/session';
import { toCheckpoint } from '../persistence/mapping';
import { MemorySessionStore } from '../persistence/memory-store';
import { ParentDashboard } from './ParentDashboard';

describe('parent dashboard', () => {
  it('reads finished lessons and stamps from this device only', async () => {
    const store = new MemorySessionStore();
    const finished = reduceSession(CAT_LESSON, createSession(CAT_LESSON, 'done-cat'), { type: 'finish' });
    await store.saveProgress({ checkpoint: toCheckpoint(finished, 1, 50), newStrokes: [] });
    await store.awardStamp(CAT_LESSON.id, 50);
    render(<ParentDashboard store={store} onClose={() => undefined} />);
    expect(await screen.findByText('Pelajaran selesai: 1')).toBeTruthy();
    expect(screen.getByText('Stempel: 1')).toBeTruthy();
    expect(screen.getByText('Belum ada tantangan hari ini.')).toBeTruthy();
    expect(screen.getByText(/tidak disimpan di perangkat/)).toBeTruthy();
    expect(screen.getByText(/Replicate/)).toBeTruthy();
    expect(screen.getByText('Kucing Duduk')).toBeTruthy();
  });
});
