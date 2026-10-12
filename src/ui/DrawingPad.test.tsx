/**
 * The vertical slice at component level: draw, undo/redo, navigate, colour,
 * finish, save (PRD section 16 phase 1).
 *
 * Everything here runs in jsdom with synthetic pointer events. It proves the
 * app's own wiring. It does not and cannot say anything about Apple Pencil
 * input, palm rejection, frame rate or input latency; those need a real iPad
 * and Android tablet (AT-16, AT-17, AT-18, PRD section 13).
 */

import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { createSession } from '../lesson-engine/session';
import { fromRestoredSession } from '../persistence/mapping';
import { MemorySessionStore } from '../persistence/memory-store';
import { DrawingPad } from './DrawingPad';
import {
  drawStroke,
  pointerCancel,
  pointerDown,
  pointerMove,
  pointerUp,
  stubLayoutBox,
} from '../test/pointer';

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

function setup() {
  const store = new MemorySessionStore();
  const initialState = createSession(CAT_LESSON, 'test-session');
  const view = render(
    <DrawingPad
      lesson={CAT_LESSON}
      store={store}
      initialState={initialState}
      durable
      notice={null}
    />,
  );
  const canvas = view.container.querySelector('canvas')!;
  return { store, canvas, view };
}

function canvasGuides(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>('.guide-overlay path')];
}

beforeEach(() => {
  stubLayoutBox();
});

afterEach(() => {
  cleanup();
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

describe('starting a lesson', () => {
  it('shows the first step and its goal', () => {
    setup();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gambar lingkaran besar untuk kepala.' })).toBeTruthy();
  });

  it('shows the dashed guide for the active step only', () => {
    const { view } = setup();
    const paths = canvasGuides(view.container);
    expect(paths).toHaveLength(CAT_LESSON.steps[0]!.guidePaths.length);
    expect(paths[0]!.getAttribute('d')).toBe(CAT_LESSON.steps[0]!.guidePaths[0]!.d);
  });

  it('starts with nothing to undo or redo', () => {
    setup();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Ulangi/ }).hasAttribute('disabled')).toBe(true);
  });
});

describe('drawing', () => {
  it('commits a stroke and makes it undoable, then redoable (AT-07)', async () => {
    const { canvas } = setup();

    act(() =>
      drawStroke(canvas, [
        { x: 100, y: 100 },
        { x: 200, y: 160 },
        { x: 300, y: 120 },
      ]),
    );

    const undo = screen.getByRole('button', { name: /Batalkan/ });
    expect(undo.hasAttribute('disabled')).toBe(false);

    act(() => undo.click());
    await waitFor(() => expect(undo.hasAttribute('disabled')).toBe(true));

    const redo = screen.getByRole('button', { name: /Ulangi/ });
    expect(redo.hasAttribute('disabled')).toBe(false);
    act(() => redo.click());
    await waitFor(() => expect(undo.hasAttribute('disabled')).toBe(false));
  });

  it('ignores a second pointer that lands mid-stroke', async () => {
    const { store, canvas } = setup();

    act(() => {
      pointerDown(canvas, { x: 100, y: 100 }, { pointerId: 1 });
      // A palm or a second finger. It must not open a second stroke.
      pointerDown(canvas, { x: 400, y: 400 }, { pointerId: 2 });
      pointerUp(canvas, { x: 150, y: 150 }, { pointerId: 2 });
      pointerUp(canvas, { x: 150, y: 150 }, { pointerId: 1 });
    });

    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.checkpoint.committedStrokeIds).toHaveLength(1);
    });
  });

  it('ends a cancelled pointer cleanly, with no line joining it to the next stroke (AT-17)', async () => {
    const { store, canvas } = setup();

    // An OS interruption mid-stroke.
    act(() => {
      pointerDown(canvas, { x: 100, y: 100 }, { pointerId: 3 });
      pointerMove(canvas, { x: 150, y: 120 }, { pointerId: 3 });
      pointerCancel(canvas, { x: 150, y: 120 }, { pointerId: 3 });
    });

    // A second stroke, starting far away.
    act(() => {
      drawStroke(
        canvas,
        [
          { x: 700, y: 600 },
          { x: 760, y: 640 },
        ],
        { pointerId: 4 },
      );
    });

    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.checkpoint.committedStrokeIds).toHaveLength(2);
    });

    const restored = await store.loadSession('test-session');
    const [first, second] = fromRestoredSession(restored!).strokes;

    // The interrupted stroke kept the ink it produced...
    expect(first!.points).toHaveLength(2);
    expect(first!.points.at(-1)).toEqual({ x: 150, y: 120 });
    // ...and the next stroke begins at its own pointer-down, not at the point
    // the cancelled one stopped.
    expect(second!.points[0]).toEqual({ x: 700, y: 600 });
  });

  it('refuses a touch in pencil mode and says why, without losing the artwork (FR-22)', () => {
    const { canvas } = setup();

    act(() =>
      drawStroke(canvas, [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ]),
    );
    const undo = screen.getByRole('button', { name: /Batalkan/ });
    expect(undo.hasAttribute('disabled')).toBe(false);

    act(() => screen.getByRole('button', { name: /Mode pensil/ }).click());

    act(() =>
      drawStroke(
        canvas,
        [
          { x: 300, y: 300 },
          { x: 400, y: 400 },
        ],
        { pointerType: 'touch', pointerId: 7 },
      ),
    );

    expect(screen.getByText(/Mode pensil: gambar dengan stylus/)).toBeTruthy();
    // Switching modes never resets the artwork.
    expect(undo.hasAttribute('disabled')).toBe(false);

    // A pen is accepted in the same mode, and the explanation goes away.
    act(() =>
      drawStroke(
        canvas,
        [
          { x: 300, y: 300 },
          { x: 420, y: 380 },
        ],
        { pointerType: 'pen', pointerId: 8 },
      ),
    );
    expect(screen.queryByText(/Mode pensil: gambar dengan stylus/)).toBeNull();
  });
});

describe('the pointermove path', () => {
  it('does not re-render React while the pointer is down (PRD section 11)', () => {
    // PRD section 11: "Render stroke tidak bergantung pada rerender seluruh
    // komponen React per pointermove." A Profiler commit is exactly what that
    // forbids, so counting commits measures the claim rather than assuming it.
    const store = new MemorySessionStore();
    let commits = 0;

    const view = render(
      <Profiler id="pad" onRender={() => { commits += 1; }}>
        <DrawingPad
          lesson={CAT_LESSON}
          store={store}
          initialState={createSession(CAT_LESSON, 'profiled-session')}
          durable
          notice={null}
        />
      </Profiler>,
    );
    const canvas = view.container.querySelector('canvas')!;

    const afterMount = commits;
    expect(afterMount).toBeGreaterThan(0);

    act(() => pointerDown(canvas, { x: 100, y: 100 }, { pointerId: 11 }));
    expect(commits).toBe(afterMount);

    act(() => {
      for (let i = 1; i <= 40; i += 1) {
        pointerMove(canvas, { x: 100 + i * 5, y: 100 + i * 3 }, { pointerId: 11 });
      }
    });

    // Pointer-down and forty samples, not one commit: the ink went straight to
    // the canvas.
    expect(commits).toBe(afterMount);

    act(() => pointerUp(canvas, { x: 300, y: 220 }, { pointerId: 11 }));

    // Lifting the pointer commits the stroke to the session, which does render.
    expect(commits).toBeGreaterThan(afterMount);
  });
});

describe('assistance modes', () => {
  it('keeps the guide off the canvas in independent mode until it is asked for (FR-08)', async () => {
    const { view } = setup();

    act(() => screen.getByRole('radio', { name: /Mandiri/ }).click());
    await waitFor(() => expect(canvasGuides(view.container)).toHaveLength(0));

    // The example is still available in its own panel.
    expect(screen.getByRole('img', { name: /Contoh hasil akhir/ })).toBeTruthy();

    act(() => screen.getByRole('button', { name: /Tampilkan petunjuk/ }).click());
    await waitFor(() => expect(canvasGuides(view.container).length).toBeGreaterThan(0));
  });

  it('brings the hint back without touching the strokes or the step (AT-03)', () => {
    const { view, canvas } = setup();
    act(() =>
      drawStroke(canvas, [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ]),
    );
    const undo = screen.getByRole('button', { name: /Batalkan/ });
    expect(undo.hasAttribute('disabled')).toBe(false);

    act(() => screen.getByRole('radio', { name: /Petunjuk sementara/ }).click());
    act(() => screen.getByRole('button', { name: /Tampilkan petunjuk/ }).click());

    expect(canvasGuides(view.container).length).toBeGreaterThan(0);
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(undo.hasAttribute('disabled')).toBe(false);
  });
});

describe('navigation and colouring', () => {
  it('walks every step and reaches the colouring tools', () => {
    setup();

    for (let i = 1; i < CAT_LESSON.steps.length; i += 1) {
      act(() => screen.getByRole('button', { name: /Lanjut/ }).click());
    }

    expect(screen.getByText(`Tahap ${CAT_LESSON.steps.length} dari ${CAT_LESSON.steps.length}`, { exact: false })).toBeTruthy();
    // The colour-boundary control only exists on a colouring step (FR-11).
    expect(screen.getByRole('button', { name: /Batas area/ })).toBeTruthy();
  });

  it('switches the colour boundary off when the child asks (FR-11)', () => {
    setup();
    for (let i = 1; i < CAT_LESSON.steps.length; i += 1) {
      act(() => screen.getByRole('button', { name: /Lanjut/ }).click());
    }

    const toggle = screen.getByRole('button', { name: /Batas area/ });
    expect(toggle.textContent).toMatch(/aktif/);
    act(() => toggle.click());
    expect(screen.getByRole('button', { name: /Batas area/ }).textContent).toMatch(/nonaktif/);
  });

  it('keeps a chosen colour when the step changes (FR-04, AT-02)', () => {
    setup();
    act(() => screen.getByRole('button', { name: 'Warna Ungu' }).click());
    expect(screen.getByText(/warna pilihanku/)).toBeTruthy();

    act(() => screen.getByRole('button', { name: /Lanjut/ }).click());
    expect(screen.getByText(/warna pilihanku/)).toBeTruthy();

    act(() => screen.getByRole('button', { name: /Ikuti panduan/ }).click());
    expect(screen.getByText(/warna panduan/)).toBeTruthy();
  });
});

describe('finishing', () => {
  it('shows the artwork and a PNG save action (AT-01)', () => {
    setup();
    for (let i = 1; i < CAT_LESSON.steps.length; i += 1) {
      act(() => screen.getByRole('button', { name: /Lanjut/ }).click());
    }
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());

    expect(screen.getByRole('heading', { name: /Ini karyamu/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Simpan gambar/ })).toBeTruthy();
    expect(screen.getByText(/Garis panduan dan contoh tidak ikut tersimpan/)).toBeTruthy();

    act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
    expect(screen.getByRole('button', { name: /Selesai/ })).toBeTruthy();
  });
});

describe('autosave and resume', () => {
  it('stores the stroke and the step so the session can be reopened (FR-13, AT-05)', async () => {
    const { store, canvas } = setup();

    act(() =>
      drawStroke(canvas, [
        { x: 120, y: 140 },
        { x: 220, y: 200 },
      ]),
    );
    act(() => screen.getByRole('button', { name: /Lanjut/ }).click());

    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored).not.toBeNull();
      expect(restored!.checkpoint.currentStepIndex).toBe(1);
      expect(restored!.strokes).toHaveLength(1);
    });

    const restored = await store.loadSession('test-session');
    const reopened = fromRestoredSession(restored!);
    expect(reopened.strokes[0]!.stepId).toBe('head-outline');
    expect(reopened.currentStepIndex).toBe(1);
  });

  it('remembers preferences outside the session (FR-04, FR-22)', async () => {
    const { store } = setup();

    act(() => screen.getByRole('button', { name: /Mode pensil/ }).click());
    act(() => screen.getByRole('button', { name: 'Warna Hijau' }).click());

    await waitFor(async () => {
      const preferences = await store.loadPreferences();
      expect(preferences?.inputMode).toBe('pencil');
      expect(preferences?.toolPreferences.customColor).toBe('#4a9b5c');
    });
  });

  it('reports a failed save instead of pretending the work is stored', async () => {
    const store = new MemorySessionStore();
    store.saveProgress = () => Promise.reject(new Error('disk gone'));

    const { container } = render(
      <DrawingPad
        lesson={CAT_LESSON}
        store={store}
        initialState={createSession(CAT_LESSON, 'failing-session')}
        durable
        notice={null}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    act(() =>
      drawStroke(canvas, [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ]),
    );

    const banner = await screen.findByText(/Gagal menyimpan: disk gone/);
    expect(banner.className).toContain('banner--warning');
  });
});
