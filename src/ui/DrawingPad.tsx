/**
 * The drawing screen: where the engine, the renderer, the input layer and
 * persistence meet. All four stay replaceable because this is the only file
 * that knows about more than one of them.
 *
 * The hot path deliberately bypasses React. A pointermove calls into
 * `ArtworkSurface` and schedules one composite on the next animation frame; no
 * state is set and no component re-renders until the pointer lifts and the
 * finished stroke is committed to the session (PRD section 11).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LessonPackage } from '../lesson-data/schema';
import {
  activeClipRegionIds,
  activeLayerId,
  activeStep,
  canRedo,
  canUndo,
  effectiveToolPreset,
  guideOverlayMode,
  reduceSession,
} from '../lesson-engine/session';
import type {
  SessionAction,
  SessionPreferences,
  SessionState,
  Stroke,
} from '../lesson-engine/types';
import type { SessionStore } from '../persistence/types';
import { ArtworkSurface } from '../renderer/artwork-surface';
import { backingSize, fitViewport } from '../renderer/coordinates';
import type { LiveStrokeSpec, Viewport } from '../renderer/types';
import { acceptsPointerType, rejectionMessage } from '../input/pointer-mode';
import { useStrokeInput } from '../input/useStrokeInput';
import { FinishScreen } from './FinishScreen';
import { GuideOverlay } from './GuideOverlay';
import { StepPanel } from './StepPanel';
import { Toolbar } from './Toolbar';
import { clipPathsFromLesson, toRenderStrokes } from './render-adapter';
import { newId } from './ids';
import { useAutosave, type SaveStatus } from './useAutosave';

interface DrawingPadProps {
  readonly lesson: LessonPackage;
  readonly store: SessionStore;
  readonly initialState: SessionState;
  readonly durable: boolean;
  readonly notice: string | null;
  readonly restorePending: boolean;
  readonly preferencesPending: boolean;
  readonly onActivity: () => void;
  readonly onChoosePicture: (saved: Promise<boolean>) => void;
}

/** What the pointer began drawing, frozen at pointer-down (FR-03). */
interface PendingStroke {
  readonly spec: LiveStrokeSpec;
  readonly stepId: string;
  readonly tool: Stroke['tool'];
}

export function DrawingPad({ lesson, store, initialState, durable, notice, restorePending, preferencesPending, onActivity, onChoosePicture }: DrawingPadProps) {
  const [state, setState] = useState(initialState);
  const dispatch = useCallback(
    (action: SessionAction) => {
      onActivity();
      setState((previous) => reduceSession(lesson, previous, action));
    },
    [lesson, onActivity],
  );

  const { status: saveStatus, flush } = useAutosave(store, state, !restorePending);
  // Leaving never waits on storage: the child reaches the picker immediately
  // and the save result follows it there.
  const choosePicture = () => onChoosePicture(restorePending ? Promise.resolve(true) : flush());
  const step = activeStep(lesson, state);
  const preset = effectiveToolPreset(lesson, state);
  const isColorStep = step.phase === 'color';

  const { assistanceMode, hintDurationMs, inputMode, toolPreferences } = state;
  const preferences = useMemo<SessionPreferences>(
    () => ({ assistanceMode, hintDurationMs, inputMode, toolPreferences }),
    [assistanceMode, hintDurationMs, inputMode, toolPreferences],
  );
  const preferencesReadyRef = useRef(!preferencesPending);
  useEffect(() => {
    if (preferencesPending) return;
    if (!preferencesReadyRef.current) {
      preferencesReadyRef.current = true;
      return;
    }
    // Preferences outlive the session, so they are stored on their own and on
    // their own cadence — not once per stroke (FR-04, FR-07, FR-22).
    void store.savePreferences(preferences);
  }, [store, preferences, preferencesPending]);

  // --- canvas plumbing -------------------------------------------------------

  // Held as state, not refs: the finish screen unmounts the whole stage, and
  // every effect below owns a DOM element, so each one has to re-run against
  // the element that is actually on screen.
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<ArtworkSurface | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  const clipPaths = useMemo(() => clipPathsFromLesson(lesson), [lesson]);
  const renderStrokes = useMemo(() => toRenderStrokes(state.strokes), [state.strokes]);

  useEffect(() => {
    if (!stage) return;

    const measure = () => {
      const rect = stage.getBoundingClientRect();
      setViewport(
        fitViewport(lesson.coordinateSpace, rect.width, rect.height, window.devicePixelRatio),
      );
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage, lesson.coordinateSpace]);

  const paint = useCallback(() => {
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;
    const ctx = canvas.getContext('2d');
    if (ctx) surface.compositeTo(ctx);
  }, [canvas]);

  const paintScheduledRef = useRef(false);
  const schedulePaint = useCallback(() => {
    // One composite per animation frame, however many samples arrived.
    if (paintScheduledRef.current) return;
    paintScheduledRef.current = true;
    requestAnimationFrame(() => {
      paintScheduledRef.current = false;
      paint();
    });
  }, [paint]);

  useEffect(() => {
    if (!canvas || !viewport) return;

    sizeCanvas(canvas, viewport);

    let surface = surfaceRef.current;
    if (!surface) {
      surface = new ArtworkSurface(lesson.coordinateSpace, viewport);
      surface.setClipPaths(clipPaths);
      surfaceRef.current = surface;
    } else {
      surface.resize(viewport);
    }
    // Replaying from the session after every committed stroke keeps the pixels
    // and the stroke log in step, including after an undo in the middle of the
    // log, and costs nothing on the pointermove path.
    surface.replay(renderStrokes);
    paint();
  }, [canvas, viewport, renderStrokes, clipPaths, lesson.coordinateSpace, paint]);

  // --- pointer input ---------------------------------------------------------

  const pendingRef = useRef<PendingStroke | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  useStrokeInput(canvas, lesson.coordinateSpace, {
    accepts: (pointerType) => acceptsPointerType(state.inputMode, pointerType),
    rejected: (pointerType) => setRejection(rejectionMessage(state.inputMode, pointerType)),

    begin: (point) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      onActivity();
      // Guarded: calling setState with the value it already holds still costs a
      // render before React bails out, and pointer-down is on the hot path.
      if (rejection !== null) setRejection(null);

      // FR-03: the tool is resolved once, here. Nothing can change colour or
      // width for the rest of this stroke.
      const resolved = effectiveToolPreset(lesson, state);
      const spec: LiveStrokeSpec = {
        color: resolved.color,
        width: resolved.widthViewbox,
        layer: activeLayerId(lesson, state),
        erase: resolved.tool === 'eraser',
        // An eraser is never confined to a colour region: the child has to be
        // able to take back anything they drew.
        clipPathIds: resolved.tool === 'eraser' ? [] : activeClipRegionIds(lesson, state),
      };
      pendingRef.current = { spec, stepId: step.id, tool: resolved.tool };
      surface.beginStroke(spec, point);
      schedulePaint();
    },

    extend: (point) => {
      surfaceRef.current?.extendStroke(point);
      schedulePaint();
    },

    end: () => {
      const points = surfaceRef.current?.endStroke();
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!points || points.length === 0 || !pending) return;

      // A cancelled pointer commits what it actually drew. Nothing is carried
      // over to the next pointerdown, so the connecting line AT-17 warns about
      // cannot form.
      dispatch({
        type: 'commit-stroke',
        stroke: {
          id: newId(),
          stepId: pending.stepId,
          layerId: pending.spec.layer,
          points: [...points],
          color: pending.spec.color,
          width: pending.spec.width,
          tool: pending.tool,
          clipRegionIds: pending.spec.clipPathIds,
        },
      });
    },
  });

  // --- guide visibility ------------------------------------------------------

  const overlayMode = guideOverlayMode(state.assistanceMode);

  /**
   * Guide visibility is derived rather than reset.
   *
   * `hintWindow` records which step and mode a deliberate show/hide applied to.
   * When the child moves to another step or changes the assistance mode the key
   * stops matching, so the default for the new situation applies on its own:
   * always on for `visible`, on until it times out for `temporary`, off until
   * asked for `independent` (FR-06, FR-07, FR-08).
   */
  const guideKey = `${state.currentStepIndex}:${overlayMode}`;
  const [hintWindow, setHintWindow] = useState({ key: '', open: false, nonce: 0 });

  const guidesVisible =
    overlayMode === 'persistent'
      ? true
      : hintWindow.key === guideKey
        ? hintWindow.open
        : overlayMode === 'timed';

  useEffect(() => {
    if (overlayMode === 'persistent' || !guidesVisible) return;
    const timer = setTimeout(
      () => setHintWindow({ key: guideKey, open: false, nonce: 0 }),
      state.hintDurationMs,
    );
    return () => clearTimeout(timer);
    // `nonce` restarts the countdown when the child asks again while the guide
    // is still on screen.
  }, [overlayMode, guidesVisible, guideKey, state.hintDurationMs, hintWindow.nonce]);

  const showHint = useCallback(() => {
    // AT-03: pure overlay state. No stroke is touched and the step does not
    // change.
    setHintWindow((previous) => ({ key: guideKey, open: true, nonce: previous.nonce + 1 }));
  }, [guideKey]);

  if (state.finished) {
    return (
      <FinishScreen
        lesson={lesson}
        state={state}
        clipPaths={clipPaths}
        onKeepDrawing={() => dispatch({ type: 'reopen' })}
        onChoosePicture={choosePicture}
      />
    );
  }

  return (
    <div className="pad">
      <header className="pad__header">
        <button type="button" className="button" onClick={choosePicture}>
          ← Pilih gambar
        </button>
        <div>
          <h1 className="pad__title">{lesson.title}</h1>
          <p className="pad__subtitle">{lesson.subtitle}</p>
        </div>
        <p className="pad__status" role="status">
          {statusLabel(saveStatus, durable)}
        </p>
      </header>

      {notice !== null && <p className="banner">{notice}</p>}
      {!durable && (
        <p className="banner banner--warning">
          Penyimpanan permanen tidak tersedia di browser ini, jadi karya ini hanya bertahan
          selama tab terbuka.
        </p>
      )}
      {saveStatus.kind === 'storage-full' && (
        <p className="banner banner--warning">
          Penyimpanan penuh. Karya yang sudah tersimpan tetap aman, tetapi goresan terbaru belum
          tersimpan. Kosongkan ruang, lalu coba lagi.
        </p>
      )}
      {saveStatus.kind === 'failed' && (
        <p className="banner banner--warning">Karya terbaru mungkin belum tersimpan.</p>
      )}
      {rejection !== null && <p className="banner">{rejection}</p>}

      <div className="pad__body">
        <div className="pad__stage" ref={setStage}>
          <div
            className="stage__frame"
            style={
              viewport
                ? { width: `${viewport.cssWidth}px`, height: `${viewport.cssHeight}px` }
                : undefined
            }
          >
            <canvas
              ref={setCanvas}
              className="stage__canvas"
              role="img"
              aria-label={`Kanvas gambar. ${step.instruction}`}
            />
            {viewport && (
              <GuideOverlay
                space={lesson.coordinateSpace}
                paths={step.guidePaths}
                visible={guidesVisible}
                widthCss={viewport.cssWidth}
                heightCss={viewport.cssHeight}
              />
            )}
          </div>
        </div>

        <aside className="pad__side">
          <StepPanel
            lesson={lesson}
            state={state}
            step={step}
            guidesVisible={guidesVisible}
            onShowHint={showHint}
            onFinish={() => dispatch({ type: 'finish' })}
            dispatch={dispatch}
          />
          <Toolbar
            lesson={lesson}
            state={state}
            preset={preset}
            isColorStep={isColorStep}
            canUndo={canUndo(lesson, state)}
            canRedo={canRedo(state)}
            dispatch={dispatch}
          />
        </aside>
      </div>
    </div>
  );
}

function sizeCanvas(canvas: HTMLCanvasElement, viewport: Viewport): void {
  const { width, height } = backingSize(viewport);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${viewport.cssWidth}px`;
  canvas.style.height = `${viewport.cssHeight}px`;
}

function statusLabel(status: SaveStatus, durable: boolean): string {
  if (!durable) return 'Tidak tersimpan permanen';
  switch (status.kind) {
    case 'idle':
      return 'Siap';
    case 'saving':
      return 'Menyimpan…';
    case 'saved':
      return 'Tersimpan';
    case 'storage-full':
      return 'Penyimpanan penuh';
    case 'failed':
      return 'Gagal menyimpan';
  }
}
