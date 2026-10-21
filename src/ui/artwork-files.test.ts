import { describe, expect, it, vi } from 'vitest';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { createSession, reduceSession } from '../lesson-engine/session';
import { toCheckpoint } from '../persistence/mapping';
import { MemorySessionStore } from '../persistence/memory-store';
import * as exportApi from '../renderer/export';
import { strokeInput } from '../test/factories';
import { downloadArtwork, formatArtworkWhen, paintArtworkThumbnail } from './artwork-files';

describe('artwork files', () => {
  it('formats the saved time in Indonesian', () => {
    expect(formatArtworkWhen(Date.UTC(2026, 9, 21, 9, 5), 'UTC')).toMatch(/21.*2026/);
    expect(formatArtworkWhen(Date.UTC(2026, 9, 21, 9, 5), 'UTC')).toMatch(/09\.05|09:05/);
  });

  it('paints and downloads committed strokes only, with no guide parameter', async () => {
    const render = vi.spyOn(exportApi, 'renderArtworkToCanvas');
    const save = vi.spyOn(exportApi, 'exportArtworkPng');
    const stepId = CAT_LESSON.steps[0]!.id;
    const drawn = reduceSession(
      CAT_LESSON,
      reduceSession(CAT_LESSON, createSession(CAT_LESSON, 'art'), {
        type: 'commit-stroke',
        stroke: strokeInput(stepId, { id: 'kept' }),
      }),
      { type: 'commit-stroke', stroke: strokeInput(stepId, { id: 'undone' }) },
    );
    const undone = reduceSession(CAT_LESSON, drawn, { type: 'undo' });
    const store = new MemorySessionStore();
    await store.saveProgress({
      checkpoint: toCheckpoint(undone, 1, 1),
      newStrokes: [...drawn.strokes],
    });
    const restored = (await store.loadSession('art'))!;
    const host = document.createElement('div');
    paintArtworkThumbnail(host, CAT_LESSON, restored.strokes.filter((stroke) =>
      restored.checkpoint.committedStrokeIds.includes(stroke.id),
    ));
    const painted = render.mock.calls.at(-1)?.[0];
    expect(painted?.strokes).toHaveLength(1);
    expect(painted).not.toHaveProperty('guides');
    expect(host.querySelector('canvas')?.getAttribute('aria-label')).toBe('Karya Kucing Duduk');
    expect(host.querySelector('svg')).toBeNull();

    const createObjectURL = vi.fn(() => 'blob:artwork');
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    try {
      const committed = restored.strokes.filter((stroke) => restored.checkpoint.committedStrokeIds.includes(stroke.id));
      // fromRestoredSession is what the gallery uses; this fixture mirrors that filter.
      const fileName = await downloadArtwork(CAT_LESSON, committed);
      expect(fileName).toMatch(/\.png$/);
      expect(save.mock.calls.at(-1)?.[0]?.strokes).toHaveLength(1);
      expect(save.mock.calls.at(-1)?.[0]).not.toHaveProperty('guides');
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      render.mockRestore();
      save.mockRestore();
    }
  });
});
