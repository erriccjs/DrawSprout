import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { createSession, reduceSession } from '../lesson-engine/session';
import { fromRestoredSession, toCheckpoint } from '../persistence/mapping';
import { MemorySessionStore } from '../persistence/memory-store';
import * as exportApi from '../renderer/export';
import { strokeInput } from '../test/factories';
import { ArtworkGallery } from './ArtworkGallery';

async function savedCat(store: MemorySessionStore): Promise<void> {
  const stepId = CAT_LESSON.steps[0]!.id;
  const drawn = reduceSession(
    CAT_LESSON,
    reduceSession(CAT_LESSON, createSession(CAT_LESSON, 'gallery-cat'), {
      type: 'commit-stroke',
      stroke: strokeInput(stepId, { id: 'kept', points: [{ x: 12, y: 12 }, { x: 40, y: 48 }] }),
    }),
    { type: 'commit-stroke', stroke: strokeInput(stepId, { id: 'undone' }) },
  );
  const undone = reduceSession(CAT_LESSON, drawn, { type: 'undo' });
  await store.saveProgress({
    checkpoint: toCheckpoint(undone, 1, Date.UTC(2026, 9, 21, 9, 5)),
    newStrokes: [...drawn.strokes],
  });
}

describe('Karyaku', () => {
  it('lists a saved drawing, opens it, and deletes it only after confirmation', async () => {
    const store = new MemorySessionStore();
    await savedCat(store);
    const onOpen = vi.fn();
    const renderSpy = vi.spyOn(exportApi, 'renderArtworkToCanvas');
    render(<ArtworkGallery store={store} actionsDisabled={false} onOpen={onOpen} />);

    expect(await screen.findByRole('heading', { name: 'Karyaku' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Kucing Duduk' })).toBeTruthy();
    expect(screen.getByRole('time').getAttribute('dateTime')).toBe('2026-10-21T09:05:00.000Z');
    expect(document.querySelector('.artwork-gallery svg')).toBeNull();

    await screen.findByRole('img', { name: 'Karya Kucing Duduk' });
    const painted = renderSpy.mock.calls.at(-1)?.[0];
    const restored = fromRestoredSession((await store.loadSession('gallery-cat'))!);
    expect(painted?.strokes).toHaveLength(restored.strokes.length);
    expect(painted?.strokes).toHaveLength(1);
    expect(painted).not.toHaveProperty('guides');

    fireEvent.click(screen.getByRole('button', { name: 'Buka Kucing Duduk' }));
    expect(onOpen).toHaveBeenCalledWith('gallery-cat');

    fireEvent.click(screen.getByRole('button', { name: 'Hapus Kucing Duduk' }));
    expect(screen.getByRole('group', { name: 'Hapus karya ini?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(await store.loadSession('gallery-cat')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Hapus Kucing Duduk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    expect(await screen.findByText('Belum ada karya tersimpan.')).toBeTruthy();
    expect(await store.loadSession('gallery-cat')).toBeNull();
    renderSpy.mockRestore();
  });

  it('disables opening, export, and delete while an update is applying', async () => {
    const store = new MemorySessionStore();
    await savedCat(store);
    render(<ArtworkGallery store={store} actionsDisabled onOpen={() => {}} />);
    expect((await screen.findByRole('button', { name: 'Buka Kucing Duduk' })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Simpan PNG Kucing Duduk' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Hapus Kucing Duduk' }).hasAttribute('disabled')).toBe(true);
  });

  it('says when nothing is saved', async () => {
    render(<ArtworkGallery store={new MemorySessionStore()} actionsDisabled={false} onOpen={() => {}} />);
    expect(await screen.findByText('Belum ada karya tersimpan.')).toBeTruthy();
  });
});
