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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { backingSize, fitViewport } from '../renderer/coordinates';
import { recordedCalls } from '../test/fake-canvas';
import { createSession, reduceSession } from '../lesson-engine/session';
import { RESUME_NOTICE, RESUME_TOAST_MS } from './resume-notice';
import { fromRestoredSession } from '../persistence/mapping';
import { MemorySessionStore } from '../persistence/memory-store';
import { drawingChrome } from './drawing-chrome';
import { layoutTier } from './layout-tier';
import { DrawingPad } from './DrawingPad';
import {
  drawStroke,
  pointerCancel,
  pointerDown,
  pointerMove,
  pointerUp,
  stubLayoutBox,
  TEST_CANVAS_RECT,
} from '../test/pointer';

// The step-walk helper drives real UI interactions step by step, so these tests
// are slow rather than broken; a generous timeout keeps them off the flake line.
vi.setConfig({ testTimeout: 60_000 });

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

function setup(options?: { readonly notice?: string | null; readonly initialState?: ReturnType<typeof createSession> }) {
  const store = new MemorySessionStore();
  const initialState = options?.initialState ?? createSession(CAT_LESSON, 'test-session');
  const view = render(
    <DrawingPad
      lesson={CAT_LESSON}
      store={store}
      initialState={initialState}
      durable
      notice={options?.notice ?? null}
      restorePending={false}
      preferencesPending={false}
      pendingSave={null}
      surfaceRef={{ current: null }}
      onActivity={() => undefined}
      onControlChange={() => undefined}
      onChoosePicture={() => undefined}
    />,
  );
  const canvas = view.container.querySelector('canvas')!;
  return { store, canvas, view };
}

function stageCanvas(container: HTMLElement): HTMLCanvasElement {
  return container.querySelector<HTMLCanvasElement>('.stage__canvas')!;
}

/**
 * Replaces the inert jsdom `ResizeObserver` with one the test can fire, so a
 * reflow of the stage can be provoked the way the browser would.
 */
function controllableResizeObserver(): { fire: () => void; restore: () => void } {
  const original = globalThis.ResizeObserver;
  const callbacks: ResizeObserverCallback[] = [];
  class Controllable {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: Controllable,
    writable: true,
    configurable: true,
  });
  return {
    fire: () => {
      for (const callback of callbacks) {
        callback([], {} as ResizeObserver);
      }
    },
    restore: () => {
      Object.defineProperty(globalThis, 'ResizeObserver', {
        value: original,
        writable: true,
        configurable: true,
      });
    },
  };
}

function canvasGuides(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>('.guide-overlay path')];
}

function previewPaths(): SVGPathElement[] {
  return [...screen.getByRole('img', { name: /Contoh hasil akhir/ }).querySelectorAll('path')];
}

function advanceToStep(stepId: string): void {
  const stepIndex = CAT_LESSON.steps.findIndex((step) => step.id === stepId);
  for (let i = 0; i < stepIndex; i += 1) {
    act(() => screen.getByRole('button', { name: /Lanjut/ }).click());
  }
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
    const help = screen.getByRole('button', { name: 'Bantuan' });
    expect(help.textContent).toBe('?');
    expect(screen.queryByRole('button', { name: 'Palet warna' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Layar penuh' })).toBeTruthy();
  });

  it('opens line help from the question mark and leaves colours on the circle', () => {
    const { view } = setup();
    const help = screen.getByRole('button', { name: 'Bantuan' });
    const sheet = () => view.container.querySelector('.float-help');
    expect(sheet()?.getAttribute('data-active')).toBe('false');

    act(() => help.click());
    expect(help.getAttribute('aria-expanded')).toBe('true');
    expect(sheet()?.getAttribute('data-active')).toBe('true');
    expect(sheet()?.textContent).toMatch(/Tampilkan petunjuk/);
    expect(sheet()?.textContent).toMatch(/Cara menggambar/);

    act(() => help.click());
    expect(sheet()?.getAttribute('data-active')).toBe('false');

    act(() => screen.getByRole('button', { name: /Pilih warna/ }).click());
    expect(screen.getByRole('group', { name: 'Palet' })).toBeTruthy();
    const popover = view.container.querySelector('.color-well__popover');
    expect(popover?.textContent).not.toMatch(/Bantuan/);
  });

  it('switches pencil and finger from the toolbar while help is closed', () => {
    const { view } = setup();
    expect(view.container.querySelector('.float-help')?.getAttribute('data-active')).toBe('false');
    const finger = screen.getByRole('button', { name: 'Mode jari' });
    const pencil = screen.getByRole('button', { name: 'Mode pensil' });
    expect(finger.getAttribute('aria-pressed')).toBe('true');
    expect(finger.getAttribute('title')).toBe('Jari');
    expect(pencil.getAttribute('title')).toBe('Pensil');
    expect(finger.textContent?.trim()).toBe('');
    expect(pencil.textContent?.trim()).toBe('');
    expect(finger.querySelector('svg')).toBeTruthy();
    expect(pencil.querySelector('svg')).toBeTruthy();
    const modeGroup = finger.closest('.toolbar__group--mode');
    expect(modeGroup).toBeTruthy();
    expect(modeGroup?.querySelectorAll('button')).toHaveLength(2);

    act(() => pencil.click());

    expect(pencil.getAttribute('aria-pressed')).toBe('true');
    expect(finger.getAttribute('aria-pressed')).toBe('false');
    expect(view.container.querySelector('.float-help')?.getAttribute('data-active')).toBe('false');
    expect(screen.getAllByRole('button', { name: 'Mode pensil' })).toHaveLength(1);
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
    expect(screen.getByRole('button', { name: 'Ulangi' }).hasAttribute('disabled')).toBe(true);
  });
});

function fittedBacking(width: number, height: number) {
  const chrome = drawingChrome(layoutTier(window.innerWidth, window.innerHeight), false);
  return backingSize(
    fitViewport(
      CAT_LESSON.coordinateSpace,
      Math.max(1, width - chrome.side * 2),
      Math.max(1, height - chrome.top - chrome.bottom),
      window.devicePixelRatio || 1,
    ),
  );
}

describe('fullscreen and a resizing screen', () => {
  const originalRequest = document.documentElement.requestFullscreen;
  const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');

  beforeEach(() => {
    if (window.visualViewport) return;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: new EventTarget(),
    });
  });

  afterEach(() => {
    document.documentElement.requestFullscreen = originalRequest;
    if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
    else Reflect.deleteProperty(window, 'visualViewport');
  });

  it('draws without asking for fullscreen, and Layar penuh still asks', () => {
    document.documentElement.requestFullscreen = vi.fn(() => Promise.resolve());
    const { canvas } = setup();

    act(() =>
      drawStroke(canvas, [
        { x: 40, y: 40 },
        { x: 90, y: 70 },
      ]),
    );

    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);

    act(() => screen.getByRole('button', { name: 'Layar penuh' }).click());
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['resize', () => window.dispatchEvent(new Event('resize'))],
    ['orientationchange', () => window.dispatchEvent(new Event('orientationchange'))],
    ['fullscreenchange', () => document.dispatchEvent(new Event('fullscreenchange'))],
    ['visualViewport resize', () => window.visualViewport?.dispatchEvent(new Event('resize'))],
  ])('drops the stroke in progress when %s fires and fits the canvas again', async (_label, fire) => {
    const { store, canvas } = setup();
    const before = canvas.width;

    act(() => {
      pointerDown(canvas, { x: 100, y: 100 });
      pointerMove(canvas, { x: 180, y: 140 });
    });

    stubLayoutBox(800, 600);
    act(() => {
      fire();
    });
    act(() => pointerUp(canvas, { x: 220, y: 180 }));

    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(true);
    const expected = fittedBacking(800, 600);
    expect(canvas.width).toBe(expected.width);
    expect(canvas.height).toBe(expected.height);
    expect(canvas.width).not.toBe(before);

    act(() =>
      drawStroke(canvas, [
        { x: 80, y: 60 },
        { x: 160, y: 120 },
      ]),
    );
    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.strokes).toHaveLength(1);
    });
    const restored = await store.loadSession('test-session');
    expect(fromRestoredSession(restored!).strokes[0]!.points[0]).toEqual({ x: 100, y: 75 });
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

    const redo = screen.getByRole('button', { name: 'Ulangi' });
    expect(redo.hasAttribute('disabled')).toBe(false);
    act(() => redo.click());
    await waitFor(() => expect(undo.hasAttribute('disabled')).toBe(false));
  });

  it('drops the in-progress stroke when a second finger lands, so the tap leaves no ink', async () => {
    const { store, canvas } = setup();

    act(() => {
      pointerDown(canvas, { x: 100, y: 100 }, { pointerId: 1 });
      // A second finger. The dot from the first finger is discarded rather than
      // committed, and it must not open a second stroke either.
      pointerDown(canvas, { x: 400, y: 400 }, { pointerId: 2 });
      pointerUp(canvas, { x: 150, y: 150 }, { pointerId: 2 });
      pointerUp(canvas, { x: 150, y: 150 }, { pointerId: 1 });
    });

    act(() =>
      drawStroke(canvas, [
        { x: 700, y: 600 },
        { x: 740, y: 640 },
      ]),
    );

    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.checkpoint.committedStrokeIds).toHaveLength(1);
    });
    const restored = await store.loadSession('test-session');
    const [stroke] = fromRestoredSession(restored!).strokes;
    expect(stroke!.points[0]).toEqual({ x: 700, y: 600 });
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

  it('keeps the stroke in progress when a refused palm reflows the stage (FR-22, AT-17)', async () => {
    const observer = controllableResizeObserver();
    try {
      const { store, canvas } = setup();
      act(() => screen.getByRole('button', { name: /Mode pensil/ }).click());

      act(() => {
        pointerDown(canvas, { x: 100, y: 100 }, { pointerType: 'pen', pointerId: 20 });
        pointerMove(canvas, { x: 150, y: 120 }, { pointerType: 'pen', pointerId: 20 });
      });

      // A palm lands. It is refused, which inserts the explanation banner and
      // so shortens the stage.
      act(() => pointerDown(canvas, { x: 600, y: 600 }, { pointerType: 'touch', pointerId: 21 }));
      expect(screen.getByText(/Mode pensil: gambar dengan stylus/)).toBeTruthy();
      act(() => observer.fire());

      // The pen never left the glass, so the rest of the stroke belongs to it.
      act(() => {
        pointerMove(canvas, { x: 200, y: 160 }, { pointerType: 'pen', pointerId: 20 });
        pointerUp(canvas, { x: 200, y: 160 }, { pointerType: 'pen', pointerId: 20 });
      });

      await waitFor(async () => {
        const restored = await store.loadSession('test-session');
        expect(restored?.checkpoint.committedStrokeIds).toHaveLength(1);
      });

      const restored = await store.loadSession('test-session');
      const [committed] = fromRestoredSession(restored!).strokes;
      expect(committed!.points).toEqual([
        { x: 100, y: 100 },
        { x: 150, y: 120 },
        { x: 200, y: 160 },
      ]);
    } finally {
      observer.restore();
    }
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

describe('in-lesson edits and free drawing', () => {
  it('clears only this step from the help sheet, and undo puts the strokes back', () => {
    const { canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 80, y: 80 }, { x: 160, y: 140 }]));
    act(() => screen.getByRole('button', { name: 'Bantuan' }).click());
    const repeat = screen.getByRole('button', { name: 'Ulangi langkah ini' });
    expect(repeat.hasAttribute('disabled')).toBe(false);
    act(() => repeat.click());
    expect(screen.getByRole('button', { name: 'Ulangi langkah ini' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    act(() => screen.getByRole('button', { name: /Batalkan/ }).click());
    expect(screen.getByRole('button', { name: 'Ulangi langkah ini' }).hasAttribute('disabled')).toBe(false);
  });

  it('asks before Mulai ulang and leaves the drawing when the child declines', () => {
    const { canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 80, y: 80 }, { x: 160, y: 140 }]));
    act(() => screen.getByRole('button', { name: 'Bantuan' }).click());
    act(() => screen.getByRole('button', { name: 'Mulai ulang karya' }).click());
    expect(screen.getByRole('heading', { name: 'Mau mulai dengan gambar kosong?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    act(() => screen.getByRole('button', { name: 'Gambar lama tetap ada' }).click());
    expect(screen.queryByRole('heading', { name: 'Mau mulai dengan gambar kosong?' })).toBeNull();
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
  });

  it('offers free drawing on the last step with no canvas guide and every tool', () => {
    let state = createSession(CAT_LESSON, 'test-session');
    for (let index = 1; index < CAT_LESSON.steps.length; index += 1) {
      state = reduceSession(CAT_LESSON, state, { type: 'next-step' });
    }
    setup({ initialState: state });
    expect(document.querySelector('.guide-overlay')?.getAttribute('data-visible')).toBe('true');
    act(() => screen.getByRole('button', { name: 'Bantuan' }).click());
    act(() => screen.getByRole('button', { name: 'Gambar bebas' }).click());
    expect(screen.getByRole('heading', { name: 'Gambar bebas.' })).toBeTruthy();
    expect(document.querySelector('.guide-overlay')?.getAttribute('data-visible')).toBe('false');
    expect(screen.getByRole('button', { name: 'Pen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kuas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Penghapus' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pilih warna/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gambar bebas' })).toBeNull();
  });
});

describe('resume toast', () => {
  it('lets the child keep drawing while the toast is up, then hides it', () => {
    vi.useFakeTimers();
    try {
      const { canvas } = setup({ notice: RESUME_NOTICE });
      expect(screen.getByText(RESUME_NOTICE)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Mulai ulang' })).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();

      act(() => drawStroke(canvas, [{ x: 160, y: 160 }, { x: 240, y: 200 }]));
      expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);

      act(() => {
        vi.advanceTimersByTime(RESUME_TOAST_MS);
      });
      expect(screen.queryByText(RESUME_NOTICE)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts over from Mulai ulang without a modal question', async () => {
    const restored = reduceSession(CAT_LESSON, createSession(CAT_LESSON, 'test-session'), { type: 'next-step' });
    setup({ notice: RESUME_NOTICE, initialState: restored });
    expect(screen.getByText('Tahap 2 dari 9', { exact: false })).toBeTruthy();

    act(() => screen.getByRole('button', { name: 'Mulai ulang' }).click());

    await waitFor(() => {
      expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Mau mulai dengan gambar kosong?' })).toBeNull();
  });
});

describe('finger-mode edge and palm', () => {
  it('does not start a touch stroke in the screen margin or from a large contact', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    const { canvas } = setup();
    const undo = () => screen.getByRole('button', { name: /Batalkan/ });

    act(() =>
      drawStroke(canvas, [{ x: 8, y: 200 }, { x: 80, y: 240 }], { pointerType: 'touch', pointerId: 31 }),
    );
    expect(undo().hasAttribute('disabled')).toBe(true);

    act(() =>
      drawStroke(
        canvas,
        [{ x: 240, y: 240 }, { x: 300, y: 280 }],
        { pointerType: 'touch', pointerId: 32, width: 120, height: 90 },
      ),
    );
    expect(undo().hasAttribute('disabled')).toBe(true);

    act(() =>
      drawStroke(canvas, [{ x: 240, y: 240 }, { x: 320, y: 300 }], { pointerType: 'touch', pointerId: 33, width: 22, height: 28 }),
    );
    expect(undo().hasAttribute('disabled')).toBe(false);
  });

  it('still explains a touch in pencil mode instead of treating it as a palm', () => {
    const { canvas } = setup();
    act(() => screen.getByRole('button', { name: 'Mode pensil' }).click());
    act(() =>
      drawStroke(
        canvas,
        [{ x: 240, y: 240 }, { x: 300, y: 280 }],
        { pointerType: 'touch', pointerId: 34, width: 140, height: 100 },
      ),
    );
    expect(screen.getByText(/Mode pensil: gambar dengan stylus/)).toBeTruthy();
  });
});

describe('finger gestures', () => {
  function tapFingers(target: Element, count: number): void {
    act(() => {
      for (let index = 0; index < count; index += 1) {
        pointerDown(target, { x: 160 + index * 48, y: 240 }, { pointerId: 40 + index, pointerType: 'touch' });
      }
      for (let index = 0; index < count; index += 1) {
        pointerUp(target, { x: 164 + index * 48, y: 244 }, { pointerId: 40 + index, pointerType: 'touch' });
      }
    });
  }

  it('undoes with two fingers and redoes with three, and the buttons still work', async () => {
    const { store, canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 120, y: 120 }, { x: 200, y: 180 }]));
    await waitFor(async () => {
      expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
    });

    tapFingers(canvas, 2);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(true);
    });
    expect(screen.getByRole('button', { name: 'Ulangi' }).hasAttribute('disabled')).toBe(false);

    tapFingers(canvas, 3);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(false);
    });

    act(() => screen.getByRole('button', { name: /Batalkan/ }).click());
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ulangi' }).hasAttribute('disabled')).toBe(false);
    });
  });

  it('lets a finger tap undo in pencil mode without ending the pen stroke', async () => {
    const { store, canvas } = setup();
    act(() => screen.getByRole('button', { name: /Mode pensil/ }).click());
    act(() =>
      drawStroke(
        canvas,
        [
          { x: 80, y: 80 },
          { x: 140, y: 120 },
        ],
        { pointerType: 'pen', pointerId: 3 },
      ),
    );
    await waitFor(async () => {
      expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
    });

    act(() => {
      pointerDown(canvas, { x: 300, y: 300 }, { pointerType: 'pen', pointerId: 4 });
      pointerMove(canvas, { x: 340, y: 330 }, { pointerType: 'pen', pointerId: 4 });
    });
    tapFingers(canvas, 2);
    act(() => pointerUp(canvas, { x: 360, y: 350 }, { pointerType: 'pen', pointerId: 4 }));

    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.checkpoint.committedStrokeIds).toHaveLength(1);
      expect(fromRestoredSession(restored!).strokes[0]!.points[0]).toEqual({ x: 300, y: 300 });
    });
    expect(screen.queryByText(/Mode pensil: gambar dengan stylus/)).toBeNull();
  });
});

describe('pinch and pan', () => {
  it('zooms without a React commit per move, keeps the guide in the frame, and fits back', () => {
    const store = new MemorySessionStore();
    let commits = 0;
    const view = render(
      <Profiler id="pad" onRender={() => { commits += 1; }}>
        <DrawingPad
          lesson={CAT_LESSON}
          store={store}
          initialState={createSession(CAT_LESSON, 'zoom-session')}
          durable
          notice={null}
          restorePending={false}
          preferencesPending={false}
          pendingSave={null}
          surfaceRef={{ current: null }}
          onActivity={() => undefined}
          onControlChange={() => undefined}
          onChoosePicture={() => undefined}
        />
      </Profiler>,
    );
    const canvas = stageCanvas(view.container);
    const frame = view.container.querySelector('.stage__frame');
    expect(frame?.querySelector('.guide-overlay')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sesuai layar' })).toBeNull();

    const afterMount = commits;
    act(() => {
      pointerDown(canvas, { x: 200, y: 300 }, { pointerId: 1, pointerType: 'touch' });
      pointerDown(canvas, { x: 400, y: 300 }, { pointerId: 2, pointerType: 'touch' });
      for (let step = 1; step <= 8; step += 1) {
        pointerMove(canvas, { x: 400 + step * 30, y: 300 }, { pointerId: 2, pointerType: 'touch' });
      }
    });
    expect(commits).toBe(afterMount);
    expect(frame?.getAttribute('style') ?? '').not.toMatch(/rotate/);
    expect((frame as HTMLElement).style.transform).toMatch(/scale\((?!1\))/);

    act(() => {
      pointerUp(canvas, { x: 640, y: 300 }, { pointerId: 2, pointerType: 'touch' });
      pointerUp(canvas, { x: 200, y: 300 }, { pointerId: 1, pointerType: 'touch' });
    });
    const fit = screen.getByRole('button', { name: 'Sesuai layar' });
    expect(fit.querySelector('svg')).toBeTruthy();
    expect(fit.textContent).not.toContain('⛶');
    act(() => fit.click());
    expect((frame as HTMLElement).style.transform).toContain('scale(1)');
    expect(screen.queryByRole('button', { name: 'Sesuai layar' })).toBeNull();
    // The guide is still a child of the transformed frame, so it cannot drift
    // from the paper. Export never reads this transform.
    expect(frame?.querySelector('.guide-overlay')).toBeTruthy();
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
          restorePending={false}
          preferencesPending={false}
          pendingSave={null}
          surfaceRef={{ current: null }}
          onActivity={() => undefined}
          onControlChange={() => undefined}
          onChoosePicture={() => undefined}
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
  it('shows this step in red and hides the lines that come later', () => {
    setup();
    const paths = previewPaths();
    const current = CAT_LESSON.steps[0]!.guidePaths;
    expect(paths).toHaveLength(current.length);
    expect(paths.map((path) => path.getAttribute('d'))).toEqual(current.map((path) => path.d));
    expect(paths.map((path) => [
      path.getAttribute('fill'),
      path.getAttribute('stroke'),
      path.getAttribute('stroke-width'),
    ])).toEqual(current.map(() => ['none', '#e23b3b', '10']));
  });

  it('emphasises fur while leaving the later ear and nose regions blank on color-fur', () => {
    setup();
    advanceToStep('color-fur');
    const step = CAT_LESSON.steps.find((item) => item.id === 'color-fur')!;
    const filled = previewPaths().filter((path) => path.getAttribute('fill') === step.toolPreset.color);
    expect(filled.map((path) => path.getAttribute('d'))).toEqual(
      CAT_LESSON.colorRegions
        .filter((region) => step.colorRegionIds.includes(region.id))
        .map((region) => region.d),
    );
    expect(
      previewPaths()
        .filter((path) => path.getAttribute('fill') === 'var(--paper)')
        .map((path) => path.getAttribute('d')),
    ).toEqual(
      CAT_LESSON.colorRegions
        .filter((region) => CAT_LESSON.steps.find((item) => item.id === 'color-face')!.colorRegionIds.includes(region.id))
        .map((region) => region.d),
    );
    expect(
      previewPaths()
        .filter((path) => path.getAttribute('stroke') === '#e23b3b')
        .map((path) => path.getAttribute('d')),
    ).toEqual(filled.map((path) => path.getAttribute('d')));
    expect(
      previewPaths()
        .filter((path) => path.getAttribute('fill') === 'none' && path.getAttribute('stroke') !== '#e23b3b')
        .every((path) => path.getAttribute('stroke') === '#2c2c2c'),
    ).toBe(true);
  });

  it('keeps fur coloured and emphasises only the new pink regions on color-face', () => {
    setup();
    advanceToStep('color-face');
    const step = CAT_LESSON.steps.find((item) => item.id === 'color-face')!;
    const furStep = CAT_LESSON.steps.find((item) => item.id === 'color-fur')!;
    const filled = previewPaths().filter((path) => path.getAttribute('fill') === step.toolPreset.color);
    expect(
      previewPaths()
        .filter((path) => path.getAttribute('fill') === furStep.toolPreset.color)
        .map((path) => path.getAttribute('d')),
    ).toEqual(
      CAT_LESSON.colorRegions
        .filter((region) => furStep.colorRegionIds.includes(region.id))
        .map((region) => region.d),
    );
    expect(filled.map((path) => path.getAttribute('d'))).toEqual(
      CAT_LESSON.colorRegions
        .filter((region) => step.colorRegionIds.includes(region.id))
        .map((region) => region.d),
    );
    expect(
      previewPaths()
        .filter((path) => path.getAttribute('stroke') === '#e23b3b')
        .map((path) => path.getAttribute('d')),
    ).toEqual(filled.map((path) => path.getAttribute('d')));
    expect(previewPaths().filter((path) => path.getAttribute('fill') === 'var(--paper)')).toHaveLength(0);
  });

  it('paints with a self-chosen colour during a colour step', async () => {
    const { store, canvas } = setup();
    advanceToStep('color-fur');
    act(() => screen.getByRole('button', { name: 'Warna Ungu' }).click());
    expect(
      previewPaths()
        .filter((path) => path.getAttribute('fill') !== 'none' && path.getAttribute('fill') !== 'var(--paper)')
        .every((path) => path.getAttribute('fill') === CAT_LESSON.steps.find((step) => step.id === 'color-fur')!.toolPreset.color),
    ).toBe(true);
    act(() => drawStroke(canvas, [{ x: 450, y: 215 }, { x: 500, y: 215 }]));

    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.strokes).toHaveLength(1);
      expect(restored?.strokes[0]?.color).toBe('#8a5bd6');
    });
  });

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

  it('opens the colour circle, keeps a recent swatch, and can follow the guide again', () => {
    setup();
    const orb = screen.getByRole('button', { name: /Pilih warna/ });
    expect(orb.getAttribute('aria-expanded')).toBe('false');
    expect(orb.getAttribute('aria-pressed')).toBe('false');

    act(() => orb.click());
    expect(orb.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'Palet' })).toBeTruthy();

    act(() => screen.getByRole('button', { name: 'Warna Merah' }).click());
    expect(orb.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/warna pilihanku/)).toBeTruthy();
    const recent = screen.getByRole('button', { name: 'Warna terakhir Merah' });
    expect(recent.getAttribute('aria-pressed')).toBe('true');

    act(() => screen.getByRole('button', { name: 'Warna Biru' }).click());
    const recents = screen.getByRole('group', { name: 'Warna terakhir' }).querySelectorAll('button');
    expect(recents[0]?.getAttribute('aria-label')).toBe('Warna terakhir Biru');
    expect(recents[1]?.getAttribute('aria-label')).toBe('Warna terakhir Merah');

    act(() => screen.getByRole('button', { name: 'Warna terakhir Merah' }).click());
    expect(screen.getByRole('button', { name: 'Warna Merah' }).getAttribute('aria-pressed')).toBe('true');

    act(() => screen.getByRole('button', { name: /Ikuti panduan/ }).click());
    expect(screen.getByText(/warna panduan/)).toBeTruthy();
    expect(orb.getAttribute('aria-pressed')).toBe('false');
    // The recent list is only the colours the child picked. Closing the guide
    // choice does not forget them.
    expect(screen.getByRole('button', { name: 'Warna terakhir Merah' })).toBeTruthy();
  });

  it('draws at the slider width, then takes the next step\'s own width (FR-03)', async () => {
    const { store, canvas } = setup();
    const slider = screen.getByRole('slider', { name: 'Ukuran kuas' });
    expect(slider.getAttribute('aria-valuetext')).toBe('Ukuran langkah');
    const dot = () => document.querySelector<HTMLElement>('.brush-slider__dot')!;
    expect(dot().style.backgroundColor).toBeTruthy();
    const thin = Number.parseFloat(dot().style.width);

    act(() => {
      fireEvent.change(slider, { target: { value: '12' } });
    });
    expect(Number.parseFloat(dot().style.width)).toBeGreaterThan(thin);
    const ink = dot().style.backgroundColor;
    act(() => screen.getByRole('button', { name: /Pilih warna/ }).click());
    act(() => screen.getByRole('button', { name: 'Warna Merah' }).click());
    const red = dot().style.backgroundColor.replace(/\s/g, '').toLowerCase();
    expect(red).not.toBe(ink.replace(/\s/g, '').toLowerCase());
    expect(red).toMatch(/e8552d|232,85,45/);
    expect(screen.getByRole('slider', { name: 'Ukuran kuas' }).getAttribute('aria-valuetext')).toBe(
      'Ukuran pilihanku',
    );

    act(() => drawStroke(canvas, [{ x: 80, y: 80 }, { x: 140, y: 120 }]));
    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.strokes[0]?.width).toBe(12);
    });

    act(() => screen.getByRole('button', { name: /Lanjut/ }).click());
    const nextWidth = String(CAT_LESSON.steps[1]!.toolPreset.widthViewbox);
    expect(screen.getByRole('slider', { name: 'Ukuran kuas' }).getAttribute('value')).toBe(nextWidth);
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
    expect(screen.getByRole('heading', { name: 'Mau mulai dengan gambar kosong?' })).toBeTruthy();
    act(() => screen.getByRole('button', { name: 'Gambar lama tetap ada' }).click());
    expect(screen.getByRole('button', { name: /Selesai/ })).toBeTruthy();
  });

  it('keeps the PNG save action usable while the question is on screen', async () => {
    const createObjectURL = vi.fn(() => 'blob:artwork');
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clicks: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function recordClick(this: HTMLAnchorElement) {
      clicks.push(this.download);
    };
    try {
      setup();
      advanceToStep(CAT_LESSON.steps.at(-1)!.id);
      act(() => screen.getByRole('button', { name: /Selesai/ }).click());
      act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());

      expect(screen.getByRole('heading', { name: 'Mau mulai dengan gambar kosong?' })).toBeTruthy();
      const saveWhileAsking = screen.getByRole('button', { name: /Simpan gambar/ });
      expect(saveWhileAsking.hasAttribute('disabled')).toBe(false);
      act(() => saveWhileAsking.click());
      expect(await screen.findByText(/dikirim ke unduhan browser/)).toBeTruthy();
      expect(clicks).toHaveLength(1);
      expect(clicks[0]).toMatch(/\.png$/);

      act(() => screen.getByRole('button', { name: 'Gambar lama tetap ada' }).click());
      act(() => screen.getByRole('button', { name: /Selesai/ }).click());
      act(() => screen.getByRole('button', { name: /Simpan gambar/ }).click());
      expect(await screen.findByText(/dikirim ke unduhan browser/)).toBeTruthy();
      expect(clicks).toHaveLength(2);
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('focuses the first choice after asking to draw again', () => {
    setup();
    advanceToStep(CAT_LESSON.steps.at(-1)!.id);
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    const drawAgain = screen.getByRole('button', { name: /Gambar lagi/ });
    drawAgain.focus();
    act(() => drawAgain.click());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Gambar lama tetap ada' }));
  });

  it('gives back a sized, repainted canvas that still draws after Gambar lagi', async () => {
    const { store, view } = setup();
    act(() =>
      drawStroke(stageCanvas(view.container), [
        { x: 100, y: 100 },
        { x: 200, y: 160 },
      ]),
    );
    for (let i = 1; i < CAT_LESSON.steps.length; i += 1) {
      act(() => screen.getByRole('button', { name: /Lanjut/ }).click());
    }
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
    act(() => screen.getByRole('button', { name: 'Gambar lama tetap ada' }).click());

    const reopened = stageCanvas(view.container);
    const chrome = drawingChrome(layoutTier(window.innerWidth, window.innerHeight), false);
    const expected = backingSize(
      fitViewport(
        CAT_LESSON.coordinateSpace,
        TEST_CANVAS_RECT.width - chrome.side * 2,
        TEST_CANVAS_RECT.height - chrome.top - chrome.bottom,
        1,
      ),
    );
    // Sized to the stage it is in, not left at the intrinsic 300x150.
    expect(reopened.width).toBe(expected.width);
    expect(reopened.height).toBe(expected.height);
    // Both artwork layers were composited back onto it, so the drawing the
    // child already made is on screen again.
    const composites = recordedCalls(reopened).filter((call) => call.op === 'drawImage');
    expect(composites.length).toBeGreaterThanOrEqual(2);
    expect(new Set(composites.map((call) => call.args[0])).size).toBe(2);

    // And the child can keep drawing: the new element has its own listeners.
    act(() =>
      drawStroke(reopened, [
        { x: 300, y: 300 },
        { x: 360, y: 340 },
      ]),
    );
    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.checkpoint.committedStrokeIds).toHaveLength(2);
    });
  });

  it('asks before changing the drawing, then keeps the old strokes and step when chosen', async () => {
    const { store, canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    advanceToStep(CAT_LESSON.steps.at(-1)!.id);
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    await waitFor(async () => {
      expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
    });

    act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
    expect(screen.getByRole('heading', { name: 'Mau mulai dengan gambar kosong?' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Karyamu:/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Selesai/ })).toBeNull();
    expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);

    act(() => screen.getByRole('button', { name: 'Gambar lama tetap ada' }).click());
    expect(screen.getByText(`Tahap ${CAT_LESSON.steps.length} dari ${CAT_LESSON.steps.length}`, { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Selesai/ })).toBeTruthy();
    expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
  });

  it('clears the canvas and stored strokes and returns to the first step when chosen', async () => {
    const { store, canvas, view } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    advanceToStep(CAT_LESSON.steps.at(-1)!.id);
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    await waitFor(async () => {
      expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
    });

    act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
    expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
    act(() => screen.getByRole('button', { name: 'Ya, mulai gambar baru' }).click());

    await waitFor(() => {
      expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(true);
    const composites = recordedCalls(stageCanvas(view.container)).filter((call) => call.op === 'drawImage');
    const inkLayer = composites.at(-1)!.args[0] as HTMLCanvasElement;
    const inkCalls = recordedCalls(inkLayer);
    const lastClear = inkCalls.map((call) => call.op).lastIndexOf('clearRect');
    expect(inkCalls.slice(lastClear + 1).filter((call) => call.op === 'stroke')).toHaveLength(0);
    await waitFor(async () => {
      const restored = await store.loadSession('test-session');
      expect(restored?.checkpoint.currentStepIndex).toBe(0);
      expect(restored?.checkpoint.committedStrokeIds).toHaveLength(0);
      expect(restored?.strokes).toHaveLength(0);
    }, { timeout: 4000 });
  });

  it('starts fresh only once when the choice is tapped twice in a row', async () => {
    const { store, canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    advanceToStep(CAT_LESSON.steps.at(-1)!.id);
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    await waitFor(async () => {
      expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
    });

    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const realDelete = store.deleteSession.bind(store);
    const deleteSession = vi.fn(async (id: string) => {
      await pending;
      await realDelete(id);
    });
    store.deleteSession = deleteSession;

    act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
    const startFresh = screen.getByRole('button', { name: 'Ya, mulai gambar baru' });
    act(() => startFresh.click());
    await waitFor(() => expect(deleteSession).toHaveBeenCalledTimes(1));
    act(() => startFresh.click());

    await act(async () => {
      release();
      await pending;
    });
    await waitFor(() => {
      expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    });
    expect(deleteSession).toHaveBeenCalledTimes(1);
    const restored = await store.loadSession('test-session');
    expect(restored?.strokes ?? []).toHaveLength(0);
  });

  it('ignores the keep choice once a fresh start is under way', async () => {
    const { store, canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    advanceToStep(CAT_LESSON.steps.at(-1)!.id);
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    await waitFor(async () => {
      expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
    });

    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const realDelete = store.deleteSession.bind(store);
    const deleteSession = vi.fn(async (id: string) => {
      await pending;
      await realDelete(id);
    });
    store.deleteSession = deleteSession;

    act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
    act(() => screen.getByRole('button', { name: 'Ya, mulai gambar baru' }).click());
    await waitFor(() => expect(deleteSession).toHaveBeenCalledTimes(1));

    act(() => screen.getByRole('button', { name: 'Gambar lama tetap ada' }).click());
    expect(screen.getByRole('heading', { name: /Ini karyamu/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Selesai/ })).toBeNull();

    await act(async () => {
      release();
      await pending;
    });
    await waitFor(() => {
      expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Batalkan/ }).hasAttribute('disabled')).toBe(true);
  });

  it('saves the finished drawing when starting fresh fails', async () => {
    const { store, canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    await waitFor(async () => {
      expect((await store.loadSession('test-session'))?.strokes).toHaveLength(1);
    });

    advanceToStep(CAT_LESSON.steps.at(-1)!.id);
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    store.deleteSession = vi.fn().mockRejectedValue(new Error('delete failed'));
    act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
    act(() => screen.getByRole('button', { name: 'Ya, mulai gambar baru' }).click());

    expect(await screen.findByText(/Belum bisa mulai gambar baru/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/Belum bisa mulai gambar baru/);
    expect(screen.getByRole('heading', { name: /Ini karyamu/ })).toBeTruthy();
    const restored = await store.loadSession('test-session');
    expect(restored?.checkpoint.finished).toBe(true);
    expect(restored?.checkpoint.currentStepIndex).toBe(CAT_LESSON.steps.length - 1);
    expect(restored?.strokes).toHaveLength(1);
  });

  it('clears a failed restart message when keeping the drawing', async () => {
    const { store } = setup();
    advanceToStep(CAT_LESSON.steps.at(-1)!.id);
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    store.deleteSession = vi.fn().mockRejectedValue(new Error('delete failed'));
    act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
    act(() => screen.getByRole('button', { name: 'Ya, mulai gambar baru' }).click());
    expect(await screen.findByText(/Belum bisa mulai gambar baru/)).toBeTruthy();

    act(() => screen.getByRole('button', { name: 'Gambar lama tetap ada' }).click());
    act(() => screen.getByRole('button', { name: /Selesai/ }).click());
    expect(screen.queryByText(/Belum bisa mulai gambar baru/)).toBeNull();
  });

  it('shows a fresh temporary guide after restarting', async () => {
    vi.useFakeTimers();
    try {
      const { view } = setup();
      act(() => screen.getByRole('radio', { name: /Petunjuk sementara/ }).click());
      expect(canvasGuides(view.container).length).toBeGreaterThan(0);
      await act(() => vi.advanceTimersByTime(5000));
      expect(canvasGuides(view.container)).toHaveLength(0);
      vi.useRealTimers();

      advanceToStep(CAT_LESSON.steps.at(-1)!.id);
      act(() => screen.getByRole('button', { name: /Selesai/ }).click());
      act(() => screen.getByRole('button', { name: /Gambar lagi/ }).click());
      act(() => screen.getByRole('button', { name: 'Ya, mulai gambar baru' }).click());

      await waitFor(() => expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy());
      expect(canvasGuides(view.container).length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
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
        restorePending={false}
        preferencesPending={false}
        pendingSave={null}
        surfaceRef={{ current: null }}
        onActivity={() => undefined}
        onControlChange={() => undefined}
        onChoosePicture={() => undefined}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    act(() =>
      drawStroke(canvas, [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ]),
    );

    const banner = await screen.findByText(/Karya terbaru mungkin belum tersimpan/);
    expect(banner.className).toContain('banner--warning');
    expect(screen.queryByText(/disk gone/)).toBeNull();
  });
});

/**
 * "Hapus semua" on the drawing screen (the eraser's whole-drawing clear).
 *
 * The button only exists while the eraser is the chosen tool, it never clears
 * on one tap, and Batalkan puts the cleared drawing back while the canvas is
 * still empty. "Hapus semua" disables itself once there is nothing left to clear,
 * so it doubles as the readout for "the canvas is empty".
 */
describe('clearing the whole drawing', () => {
  const clearAll = () => screen.getByRole('button', { name: /Hapus semua/ });
  const question = () => screen.queryByRole('heading', { name: 'Mau mulai dengan gambar kosong?' });
  const undoButton = () => screen.getByRole('button', { name: /Batalkan/ });

  function chooseEraser(): void {
    act(() => screen.getByRole('button', { name: /Penghapus/ }).click());
  }

  async function committedIds(store: MemorySessionStore): Promise<readonly string[]> {
    const restored = await store.loadSession('test-session');
    return restored?.checkpoint.committedStrokeIds ?? [];
  }

  it('offers the clear with the eraser only, and not as a fourth tool', () => {
    const { view } = setup();
    expect(screen.queryByRole('button', { name: /Hapus semua/ })).toBeNull();

    chooseEraser();
    // Inside the tool group, below the three tools, so it reads as the
    // eraser's own action rather than as another tool to choose.
    const group = view.container.querySelector<HTMLFieldSetElement>('.toolbar__group--tools')!;
    expect(group.contains(clearAll())).toBe(true);
    expect(group.querySelectorAll('[aria-pressed]')).toHaveLength(3);
    expect(clearAll().hasAttribute('aria-pressed')).toBe(false);

    act(() => screen.getByRole('button', { name: /Pen$/ }).click());
    expect(screen.queryByRole('button', { name: /Hapus semua/ })).toBeNull();
  });

  it('stays unavailable until there is something to clear', () => {
    const { canvas } = setup();
    chooseEraser();
    expect(clearAll().hasAttribute('disabled')).toBe(true);

    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    expect(clearAll().hasAttribute('disabled')).toBe(false);
  });

  it('stays unavailable when the canvas only holds undone strokes', () => {
    const { canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    act(() => undoButton().click());
    chooseEraser();
    expect(clearAll().hasAttribute('disabled')).toBe(true);
  });

  it('asks first, and backing out changes nothing', async () => {
    const { store, canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    act(() => drawStroke(canvas, [{ x: 300, y: 120 }, { x: 360, y: 200 }]));
    await waitFor(async () => expect(await committedIds(store)).toHaveLength(2));

    chooseEraser();
    expect(question()).toBeNull();
    act(() => clearAll().click());

    // One tap only asks, and backing out is what the focus lands on, so a
    // stray tap keeps the drawing.
    expect(question()).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Gambar lama tetap ada' }));
    expect(await committedIds(store)).toHaveLength(2);

    act(() => screen.getByRole('button', { name: 'Gambar lama tetap ada' }).click());
    expect(question()).toBeNull();
    // Still everything to clear, and still everything to undo: nothing moved.
    expect(clearAll().hasAttribute('disabled')).toBe(false);
    expect(undoButton().hasAttribute('disabled')).toBe(false);
    expect(await committedIds(store)).toHaveLength(2);
  });

  it('removes every stroke once confirmed, and Batalkan brings them all back', async () => {
    const { store, canvas, view } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    // A second step, so the clear is proved to reach past the active one.
    act(() => screen.getByRole('button', { name: /Lanjut/ }).click());
    act(() => drawStroke(stageCanvas(view.container), [{ x: 300, y: 300 }, { x: 360, y: 340 }]));
    const saved = await waitFor(async () => {
      const ids = await committedIds(store);
      expect(ids).toHaveLength(2);
      return ids;
    });

    chooseEraser();
    act(() => clearAll().click());
    act(() => screen.getByRole('button', { name: 'Ya, mulai gambar baru' }).click());

    expect(question()).toBeNull();
    // Nothing left to clear: both steps' strokes are gone.
    expect(clearAll().hasAttribute('disabled')).toBe(true);

    expect(undoButton().hasAttribute('disabled')).toBe(false);
    act(() => undoButton().click());

    // One Batalkan put the whole drawing back, in its original replay order.
    expect(clearAll().hasAttribute('disabled')).toBe(false);
    await waitFor(async () => expect(await committedIds(store)).toEqual(saved));
    // Including the earlier step's stroke, which is undoable there again.
    act(() => screen.getByRole('button', { name: /Kembali/ }).click());
    expect(undoButton().hasAttribute('disabled')).toBe(false);
  });

  it('never lets the emptied canvas overwrite the stored drawing', async () => {
    const { store, canvas } = setup();
    act(() => drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 160 }]));
    await waitFor(async () => expect(await committedIds(store)).toHaveLength(1));

    chooseEraser();
    act(() => clearAll().click());
    act(() => screen.getByRole('button', { name: 'Ya, mulai gambar baru' }).click());

    // Force the save the autosave would make on its own cadence.
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    try {
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });
    } finally {
      if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
    }

    // The store refuses an empty session over a saved drawing, so the work the
    // child can still undo to is also still on disk.
    expect(await committedIds(store)).toHaveLength(1);
  });
});
