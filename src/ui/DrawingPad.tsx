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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
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
import {
  CENTERED_PLACEMENT,
  FIT_VIEW,
  pinchView,
  placementForTop,
  sameView,
  viewTransformCss,
  type CanvasView,
  type PaperPlacement,
} from '../renderer/view';
import { acceptsPointerType, rejectionMessage } from '../input/pointer-mode';
import { useStrokeInput } from '../input/useStrokeInput';
import { FinishScreen } from './FinishScreen';
import { GuideOverlay } from './GuideOverlay';
import { StepControls, StepNavigation, StepPanel } from './StepPanel';
import { BrushSlider } from './BrushSlider';
import { ColorWell } from './ColorWell';
import { Toolbar, ToolbarSettings } from './Toolbar';
import { drawingChrome } from './drawing-chrome';
import { clipPathsFromLesson, toRenderStrokes } from './render-adapter';
import { useLayoutTier } from './useLayoutTier';
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
  readonly pendingSave: Promise<boolean> | null;
  readonly surfaceRef: RefObject<ArtworkSurface | null>;
  readonly onActivity: () => void;
  readonly onControlChange: (action: SessionAction, state: SessionState) => void;
  readonly onChoosePicture: (saved: Promise<boolean>, state: SessionState) => void;
  /** The phone "best on a tablet" note is covering the top of this screen. */
  readonly tabletNoticeOpen?: boolean;
}

/** What the pointer began drawing, frozen at pointer-down (FR-03). */
interface PendingStroke {
  readonly spec: LiveStrokeSpec;
  readonly stepId: string;
  readonly tool: Stroke['tool'];
}

export function DrawingPad({ lesson, store, initialState, durable, notice, restorePending, preferencesPending, pendingSave, surfaceRef, onActivity, onControlChange, onChoosePicture, tabletNoticeOpen = false }: DrawingPadProps) {
  const layout = useLayoutTier();
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const preferencesDirtyRef = useRef(false);
  const dispatch = useCallback(
    (action: SessionAction) => {
      const previous = stateRef.current;
      const next = reduceSession(lesson, previous, action);
      if (next === previous) return;
      stateRef.current = next;
      if (isPreferenceAction(action)) {
        preferencesDirtyRef.current = true;
        onControlChange(action, next);
      } else {
        onActivity();
      }
      setState(next);
    },
    [lesson, onActivity, onControlChange],
  );

  const { status: saveStatus, flush, clearSession } = useAutosave(store, state, !restorePending, pendingSave);
  const [restartError, setRestartError] = useState<string | null>(null);
  const restartingRef = useRef(false);
  // Leaving never waits on storage: the child reaches the picker immediately
  // and the save result follows it there.
  const choosePicture = () => {
    if (restartingRef.current) return;
    onChoosePicture(restorePending ? Promise.resolve(true) : flush(), stateRef.current);
  };
  const step = activeStep(lesson, state);
  const preset = effectiveToolPreset(lesson, state);
  const isColorStep = step.phase === 'color';

  const { assistanceMode, hintDurationMs, inputMode, toolPreferences } = state;
  const preferences = useMemo<SessionPreferences>(
    () => ({ assistanceMode, hintDurationMs, inputMode, toolPreferences }),
    [assistanceMode, hintDurationMs, inputMode, toolPreferences],
  );
  useEffect(() => {
    if (preferencesPending || !preferencesDirtyRef.current) return;
    preferencesDirtyRef.current = false;
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
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CanvasView>(FIT_VIEW);
  const pinchOriginRef = useRef<CanvasView | null>(null);
  const stageSizeRef = useRef({ width: 0, height: 0 });
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<CanvasView>(FIT_VIEW);
  const placementRef = useRef<PaperPlacement>(CENTERED_PLACEMENT);
  const placement = useMemo(() => {
    if (!viewport || stageBox.height <= 0) return CENTERED_PLACEMENT;
    return placementForTop(stageBox.height, viewport.cssHeight, drawingChrome(layout, tabletNoticeOpen).top);
  }, [layout, viewport, stageBox.height, tabletNoticeOpen]);

  const applyView = useCallback((next: CanvasView, commit: boolean) => {
    viewRef.current = next;
    const frame = frameRef.current;
    if (frame) frame.style.transform = viewTransformCss(next, placementRef.current);
    if (commit) setView((current) => (sameView(current, next) ? current : next));
  }, []);

  useLayoutEffect(() => {
    placementRef.current = placement;
  }, [placement]);

  useEffect(() => () => { surfaceRef.current = null; }, [surfaceRef]);

  const clipPaths = useMemo(() => clipPathsFromLesson(lesson), [lesson]);
  const renderStrokes = useMemo(() => toRenderStrokes(state.strokes), [state.strokes]);

  useEffect(() => {
    if (!stage) return;

    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const nextBox = { width: rect.width, height: rect.height };
      stageSizeRef.current = nextBox;
      setStageBox((current) => (
        current.width === nextBox.width && current.height === nextBox.height ? current : nextBox
      ));
      const chrome = drawingChrome(layout, tabletNoticeOpen);
      setViewport(
        fitViewport(
          lesson.coordinateSpace,
          rect.width,
          Math.max(1, rect.height - chrome.top - chrome.bottom),
          window.devicePixelRatio,
        ),
      );
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage, lesson.coordinateSpace, layout, tabletNoticeOpen]);

  const paint = useCallback(() => {
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;
    const ctx = canvas.getContext('2d');
    if (ctx) surface.compositeTo(ctx);
  }, [canvas, surfaceRef]);

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
  }, [canvas, viewport, renderStrokes, clipPaths, lesson.coordinateSpace, paint, surfaceRef]);

  // --- pointer input ---------------------------------------------------------

  const pendingRef = useRef<PendingStroke | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [controlTab, setControlTab] = useState<'drawing' | 'help'>('drawing');

  const discardLiveStroke = () => {
    // A multi-finger gesture must not leave the dot the first finger started.
    // Replay the committed strokes only — no session update, so this stays off
    // the React path the same way a pointermove does.
    const surface = surfaceRef.current;
    pendingRef.current = null;
    if (!surface) return;
    surface.endStroke();
    surface.replay(toRenderStrokes(stateRef.current.strokes));
    paint();
  };

  useStrokeInput(canvas, lesson.coordinateSpace, {
    accepts: (pointerType) => acceptsPointerType(state.inputMode, pointerType),
    inputMode: state.inputMode,
    rejected: (pointerType) => setRejection(rejectionMessage(state.inputMode, pointerType)),
    clearRejection: () => setRejection(null),
    discard: discardLiveStroke,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    pinch: (gesture) => {
      const fitted = viewport;
      if (!fitted || fitted.cssWidth <= 0 || fitted.cssHeight <= 0) return;
      if (pinchOriginRef.current === null) pinchOriginRef.current = viewRef.current;
      const { width, height } = stageSizeRef.current;
      applyView(
        pinchView({
          stageWidth: width,
          stageHeight: height,
          fittedWidth: fitted.cssWidth,
          fittedHeight: fitted.cssHeight,
          startView: pinchOriginRef.current,
          startMidX: gesture.startMidX,
          startMidY: gesture.startMidY,
          startDistance: gesture.startDistance,
          midX: gesture.midX,
          midY: gesture.midY,
          distance: gesture.distance,
          placement: placementRef.current,
        }),
        false,
      );
    },
    settle: () => {
      pinchOriginRef.current = null;
      applyView(viewRef.current, true);
    },

    begin: (point) => {
      const surface = surfaceRef.current;
      if (!surface) return;
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
        onKeepDrawing={() => {
          if (restartingRef.current) return;
          setRestartError(null);
          dispatch({ type: 'reopen' });
        }}
        onChoosePicture={choosePicture}
        onStartFresh={() => {
          if (restartingRef.current) return;
          restartingRef.current = true;
          setRestartError(null);
          void clearSession(reduceSession(lesson, state, { type: 'restart' }))
            .then(() => {
              setHintWindow({ key: '', open: false, nonce: 0 });
              dispatch({ type: 'restart' });
            })
            .catch(() => setRestartError('Belum bisa mulai gambar baru. Coba lagi.'))
            .finally(() => {
              restartingRef.current = false;
            });
        }}
        restartError={restartError}
      />
    );
  }

  return (
    <div className="pad">
      {/* The stage is the whole screen. Controls overlay it; they do not
          reserve a column, so the paper can use every pixel (D-49). */}
      <div className="pad__stage" ref={setStage}>
        <div
          className="stage__frame"
          ref={frameRef}
          style={
            viewport
              ? {
                  width: `${viewport.cssWidth}px`,
                  height: `${viewport.cssHeight}px`,
                  transform: viewTransformCss(view, placement),
                }
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

      <div className="pad__chrome">
        <header className="float-header">
          <button type="button" className="button float-header__back" onClick={choosePicture}>
            <span aria-hidden="true">← </span>
            <span className="button__text">Pilih gambar</span>
          </button>
          <div className="float-header__titles">
            <h1 className="pad__title">{lesson.title}</h1>
            <p className="pad__subtitle">{lesson.subtitle}</p>
          </div>
          <p className="pad__status" role="status">
            {statusLabel(saveStatus, durable)}
          </p>
          <ColorWell state={state} preset={preset} dispatch={dispatch} />
        </header>

        <div className="float-notices">
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
        </div>

        <BrushSlider
          stepWidth={lesson.steps[state.currentStepIndex]?.toolPreset.widthViewbox ?? preset.widthViewbox}
          tool={preset.tool}
          preset={preset}
          dispatch={dispatch}
        />

        <div className="step-card">
          <StepPanel lesson={lesson} state={state} step={step} startCollapsed={layout !== 'tablet'} />
        </div>
        <div className="step-nav">
          <StepNavigation
            lesson={lesson}
            state={state}
            onFinish={() => dispatch({ type: 'finish' })}
            dispatch={dispatch}
          />
        </div>

        <aside className="float-dock">
          <div className="pad__control-panel" data-active="true">
            <Toolbar
              state={state}
              canUndo={canUndo(lesson, state)}
              canRedo={canRedo(state)}
              dispatch={dispatch}
            />
          </div>
          <button
            type="button"
            className="chip float-dock__help"
            aria-label="Bantuan"
            aria-pressed={controlTab === 'help'}
            aria-expanded={controlTab === 'help'}
            onClick={() => setControlTab((tab) => (tab === 'help' ? 'drawing' : 'help'))}
          >
            <span aria-hidden="true">?</span>
          </button>
          <button
            type="button"
            className="chip float-dock__fit"
            aria-label="Sesuai layar"
            disabled={view.zoom === 1 && view.panX === 0 && view.panY === 0}
            onClick={() => applyView(FIT_VIEW, true)}
          >
            <span aria-hidden="true">⛶</span>
          </button>
          <div className="pad__control-panel float-help" data-active={controlTab === 'help'}>
            <ToolbarSettings
              state={state}
              isColorStep={isColorStep}
              dispatch={dispatch}
            />
            <StepControls
              state={state}
              guidesVisible={guidesVisible}
              onShowHint={showHint}
              dispatch={dispatch}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function isPreferenceAction(action: SessionAction): boolean {
  switch (action.type) {
    case 'set-assistance-mode':
    case 'set-hint-duration':
    case 'set-input-mode':
    case 'set-tool':
    case 'set-custom-color':
    case 'use-guide-color':
    case 'set-custom-width':
    case 'clear-custom-width':
    case 'set-boundary-assist':
      return true;
    default:
      return false;
  }
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
