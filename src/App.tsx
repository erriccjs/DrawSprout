import { useEffect, useRef, useState } from 'react';
import type { ArtworkSurface } from './renderer/artwork-surface';
import { getLesson } from './lesson-data';
import type { LessonPackage } from './lesson-data/schema';
import { DEFAULT_PREFERENCES, createSession } from './lesson-engine/session';
import type { SessionPreferences, SessionState, ToolPreferences } from './lesson-engine/types';
import { fromRestoredSession } from './persistence/mapping';
import type { SessionCheckpoint } from './persistence/types';
import { gateUpdate } from './offline/update-policy';
import { useOfflineSupport } from './offline/useOffline';
import { ArtworkGallery } from './ui/ArtworkGallery';
import { DrawingPad } from './ui/DrawingPad';
import { requestDocumentFullscreen } from './ui/fullscreen';
import { RESUME_NOTICE } from './ui/resume-notice';
import { LessonPicker } from './ui/LessonPicker';
import { TabletNotice } from './ui/TabletNotice';
import { newId } from './ui/ids';
import { dismissTabletNotice, isTabletNoticeDismissed } from './ui/tablet-notice';
import { useLayoutTier } from './ui/useLayoutTier';
import { useSessionBootstrap } from './ui/useSessionBootstrap';

interface OpenLesson {
  readonly lesson: LessonPackage;
  readonly initialState: SessionState;
  readonly notice: string | null;
  readonly restorePending: boolean;
  readonly preferencesPending: boolean;
  readonly pendingSave: Promise<boolean> | null;
  readonly revision: number;
}

interface ControlOverrides {
  preferences: { -readonly [K in keyof SessionPreferences]?: SessionPreferences[K] };
  tools: { -readonly [K in keyof ToolPreferences]?: ToolPreferences[K] };
}

const BOOTSTRAP_FAILURE_NOTICE = 'Maaf, pelajaran belum bisa dibuka sekarang. Coba lagi nanti ya.';
const LOAD_FAILURE_NOTICE = 'Karya sebelumnya tidak dapat dibuka. Kamu bisa mulai menggambar lagi.';

export function App() {
  const layout = useLayoutTier();
  const bootstrap = useSessionBootstrap();
  const {
    ready: offlineReady,
    updateWaiting,
    applyRequested,
    requestApply,
    applyUpdate,
  } = useOfflineSupport();
  const [openLesson, setOpenLesson] = useState<OpenLesson | null>(null);
  const selectionRef = useRef(0);
  const touchedRef = useRef(false);
  const controlsRef = useRef<ControlOverrides>({ preferences: {}, tools: {} });
  const surfaceRef = useRef<ArtworkSurface | null>(null);
  const handoffRef = useRef<{ state: SessionState; saved: Promise<boolean> } | null>(null);
  const [exitNotice, setExitNotice] = useState<string | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [saveInFlight, setSaveInFlight] = useState(false);
  const [tabletNoticeDismissed, setTabletNoticeDismissed] = useState(isTabletNoticeDismissed);
  const showTabletNotice = layout !== 'tablet' && !tabletNoticeDismissed;

  const dismissTabletHint = () => {
    dismissTabletNotice();
    setTabletNoticeDismissed(true);
  };

  const updateGate = gateUpdate({
    surface: openLesson ? 'drawing' : 'picker',
    updateWaiting,
    saveInFlight,
    applyRequested,
    dismissed: updateDismissed,
  });

  useEffect(() => {
    if (updateGate.mayApply) applyUpdate();
  }, [updateGate.mayApply, applyUpdate]);

  if (bootstrap.status === 'loading') {
    return (
      <main className="shell shell--centered" data-layout={layout}>
        <p role="status">Menyiapkan pelajaran…</p>
      </main>
    );
  }

  if (bootstrap.status === 'error') {
    return (
      <main className="shell shell--centered" data-layout={layout}>
        <h1>Pelajaran tidak dapat dibuka</h1>
        <p className="banner banner--warning">{BOOTSTRAP_FAILURE_NOTICE}</p>
      </main>
    );
  }

  const selectLesson = (lessonId: string) => {
    // This runs inside the picker's click. Fullscreen has to be asked for
    // here, not on the first stroke: the resize would smear that line (D-57).
    requestDocumentFullscreen();
    setUpdateDismissed(false);
    const selection = ++selectionRef.current;
    const handoff = handoffRef.current?.state.lessonId === lessonId ? handoffRef.current : null;
    touchedRef.current = handoff !== null;
    controlsRef.current = { preferences: {}, tools: {} };
    setExitNotice(null);
    const lesson = getLesson(lessonId);
    const initialState = handoff?.state ?? createSession(lesson, newId(), DEFAULT_PREFERENCES);
    setOpenLesson({ lesson, initialState, notice: null, restorePending: handoff === null, preferencesPending: true,
      pendingSave: handoff?.saved ?? null, revision: 0 });

    void bootstrap.store.loadPreferences().then((preferences) => {
      if (selectionRef.current !== selection) return;
      const selected = preferences && applyControls(preferences, controlsRef.current);
      if (Object.keys(controlsRef.current.preferences).length || Object.keys(controlsRef.current.tools).length) {
        void bootstrap.store.savePreferences(selected ?? applyControls(DEFAULT_PREFERENCES, controlsRef.current));
      }
      setOpenLesson((current) => {
        if (!current) return current;
        if (touchedRef.current || surfaceRef.current?.hasLiveStroke() || !selected || current.initialState.sessionId !== initialState.sessionId) {
          return { ...current, preferencesPending: false };
        }
        return { ...current, preferencesPending: false,
          initialState: createSession(lesson, initialState.sessionId, selected), revision: current.revision + 1 };
      });
    }).catch(() => {
      if (selectionRef.current === selection) {
        if (Object.keys(controlsRef.current.preferences).length || Object.keys(controlsRef.current.tools).length) {
          void bootstrap.store.savePreferences(applyControls(DEFAULT_PREFERENCES, controlsRef.current));
        }
        setOpenLesson((current) => current ? { ...current, preferencesPending: false } : current);
      }
    });

    if (handoff) return;

    void bootstrap.store.loadLatestSessionForLesson(lessonId).then((restored) => {
      if (selectionRef.current !== selection) return;
      let state: SessionState | null = null;
      let notice: string | null = null;
      if (restored) {
        if (restored.checkpoint.lessonContentVersion !== lesson.contentVersion) {
          if (hasProgress(restored.checkpoint)) {
            notice = 'Pelajaran sudah diperbarui, jadi karya lama dibuka sebagai karya baru.';
          }
        } else {
          try {
            state = fromRestoredSession(restored);
            if (hasProgress(restored.checkpoint)) {
              notice = RESUME_NOTICE;
            }
          } catch {
            notice = LOAD_FAILURE_NOTICE;
          }
        }
      }
      setOpenLesson((current) => {
        if (!current || selectionRef.current !== selection) return current;
        if (surfaceRef.current?.hasLiveStroke()) {
          return notice === LOAD_FAILURE_NOTICE ? { ...current, notice } : current;
        }
        if (touchedRef.current) {
          return notice === LOAD_FAILURE_NOTICE
            ? { ...current, notice, restorePending: false }
            : current;
        }
        const restoredState = state ? applyControls(state, controlsRef.current) : current.initialState;
        return { ...current, initialState: restoredState, notice, restorePending: false,
          revision: state ? current.revision + 1 : current.revision };
      });
    }).catch(() => {
      if (selectionRef.current !== selection) return;
      setOpenLesson((current) => current && selectionRef.current === selection
        ? { ...current, notice: LOAD_FAILURE_NOTICE, restorePending: false }
        : current);
    });
  };

  const openArtwork = (sessionId: string) => {
    // Same gesture rule as choosing a picture: fullscreen is asked for on the
    // tap, not on the first stroke (D-57).
    requestDocumentFullscreen();
    setUpdateDismissed(false);
    const selection = ++selectionRef.current;
    touchedRef.current = true;
    controlsRef.current = { preferences: {}, tools: {} };
    handoffRef.current = null;
    setExitNotice(null);

    void bootstrap.store.loadSession(sessionId).then((restored) => {
      if (selectionRef.current !== selection) return;
      if (!restored) {
        setExitNotice('Karya itu tidak dapat dibuka.');
        return;
      }
      let lesson: LessonPackage;
      try {
        lesson = getLesson(restored.checkpoint.lessonId);
      } catch {
        setExitNotice('Pelajaran untuk karya ini sudah tidak ada.');
        return;
      }
      if (restored.checkpoint.lessonContentVersion !== lesson.contentVersion) {
        setOpenLesson({
          lesson,
          initialState: createSession(lesson, newId(), DEFAULT_PREFERENCES),
          notice: 'Pelajaran sudah diperbarui, jadi karya lama dibuka sebagai karya baru.',
          restorePending: false,
          preferencesPending: false,
          pendingSave: null,
          revision: 0,
        });
        return;
      }
      try {
        const state = fromRestoredSession(restored);
        setOpenLesson({
          lesson,
          initialState: state,
          notice: state.finished || !hasProgress(restored.checkpoint) ? null : RESUME_NOTICE,
          restorePending: false,
          preferencesPending: false,
          pendingSave: null,
          revision: 0,
        });
      } catch {
        setExitNotice(LOAD_FAILURE_NOTICE);
      }
    }).catch(() => {
      if (selectionRef.current === selection) setExitNotice(LOAD_FAILURE_NOTICE);
    });
  };

  return (
    <main className="shell" data-layout={layout} data-tablet-notice={showTabletNotice ? 'open' : 'closed'}>
      {showTabletNotice && <TabletNotice onDismiss={dismissTabletHint} />}
      {openLesson ? (
        <DrawingPad
          key={`${openLesson.initialState.sessionId}:${openLesson.revision}`}
          lesson={openLesson.lesson}
          store={bootstrap.store}
          initialState={openLesson.initialState}
          durable={bootstrap.durable}
          notice={openLesson.notice}
          restorePending={openLesson.restorePending}
          preferencesPending={openLesson.preferencesPending}
          pendingSave={openLesson.pendingSave}
          surfaceRef={surfaceRef}
          onActivity={() => {
            touchedRef.current = true;
            setOpenLesson((current) => current && current.restorePending
              ? { ...current, restorePending: false }
              : current);
          }}
          onControlChange={(action, state) => {
            const controls = controlsRef.current;
            switch (action.type) {
              case 'set-assistance-mode': controls.preferences.assistanceMode = state.assistanceMode; break;
              case 'set-hint-duration': controls.preferences.hintDurationMs = state.hintDurationMs; break;
              case 'set-input-mode': controls.preferences.inputMode = state.inputMode; break;
              case 'set-tool': controls.tools.activeTool = state.toolPreferences.activeTool; break;
              case 'set-custom-color':
              case 'use-guide-color':
                controls.tools.colorSource = state.toolPreferences.colorSource;
                controls.tools.customColor = state.toolPreferences.customColor;
                break;
              case 'set-custom-width':
              case 'clear-custom-width': controls.tools.customWidth = state.toolPreferences.customWidth; break;
              case 'set-boundary-assist': controls.tools.colorBoundaryAssist = state.toolPreferences.colorBoundaryAssist; break;
            }
          }}
          tabletNoticeOpen={showTabletNotice}
          onChoosePicture={(saved, state) => {
            const handoff = { state, saved };
            handoffRef.current = openLesson.restorePending && (!touchedRef.current || state === openLesson.initialState) ? null : handoff;
            selectionRef.current += 1;
            setOpenLesson(null);
            setExitNotice(null);
            setSaveInFlight(true);
            void saved.then((wasSaved) => {
              setSaveInFlight(false);
              if (wasSaved && handoffRef.current === handoff) handoffRef.current = null;
              if (!wasSaved) {
                setExitNotice(
                  'Gambar tadi mungkin belum tersimpan. Tidak apa-apa, kamu bisa menggambar lagi.',
                );
              }
            }, () => {
              setSaveInFlight(false);
              setExitNotice(
                'Gambar tadi mungkin belum tersimpan. Tidak apa-apa, kamu bisa menggambar lagi.',
              );
            });
          }}
        />
      ) : (
        <>
          <LessonPicker
            onSelect={selectLesson}
            notice={exitNotice}
            offlineReady={offlineReady}
            updatePhase={updateGate.showPrompt ? (applyRequested ? 'applying' : 'prompt') : 'hidden'}
            onApplyUpdate={requestApply}
            onDismissUpdate={() => { setUpdateDismissed(true); }}
          />
          <ArtworkGallery
            store={bootstrap.store}
            actionsDisabled={updateGate.showPrompt && applyRequested}
            onOpen={openArtwork}
          />
        </>
      )}
    </main>
  );
}

function applyControls<T extends SessionPreferences>(state: T, controls: ControlOverrides): T {
  return { ...state, ...controls.preferences, toolPreferences: { ...state.toolPreferences, ...controls.tools } };
}

/** Whether a checkpoint holds work a child would recognise as their own. */
function hasProgress(checkpoint: SessionCheckpoint): boolean {
  return (
    checkpoint.committedStrokeIds.length > 0 ||
    checkpoint.redoStrokeIds.length > 0 ||
    checkpoint.currentStepIndex > 0
  );
}
