import { useRef, useState } from 'react';
import type { ArtworkSurface } from './renderer/artwork-surface';
import { getLesson } from './lesson-data';
import type { LessonPackage } from './lesson-data/schema';
import { DEFAULT_PREFERENCES, createSession } from './lesson-engine/session';
import type { SessionPreferences, SessionState, ToolPreferences } from './lesson-engine/types';
import { fromRestoredSession } from './persistence/mapping';
import type { SessionCheckpoint } from './persistence/types';
import { DrawingPad } from './ui/DrawingPad';
import { LessonPicker } from './ui/LessonPicker';
import { newId } from './ui/ids';
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
  const bootstrap = useSessionBootstrap();
  const [openLesson, setOpenLesson] = useState<OpenLesson | null>(null);
  const selectionRef = useRef(0);
  const touchedRef = useRef(false);
  const controlsRef = useRef<ControlOverrides>({ preferences: {}, tools: {} });
  const surfaceRef = useRef<ArtworkSurface | null>(null);
  const handoffRef = useRef<{ state: SessionState; saved: Promise<boolean> } | null>(null);
  const [exitNotice, setExitNotice] = useState<string | null>(null);

  if (bootstrap.status === 'loading') {
    return (
      <main className="shell shell--centered">
        <p role="status">Menyiapkan pelajaran…</p>
      </main>
    );
  }

  if (bootstrap.status === 'error') {
    return (
      <main className="shell shell--centered">
        <h1>Pelajaran tidak dapat dibuka</h1>
        <p className="banner banner--warning">{BOOTSTRAP_FAILURE_NOTICE}</p>
      </main>
    );
  }

  const selectLesson = (lessonId: string) => {
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
      if (selected && (Object.keys(controlsRef.current.preferences).length || Object.keys(controlsRef.current.tools).length)) {
        void bootstrap.store.savePreferences(selected);
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
              notice = 'Karya terakhirmu dilanjutkan dari tempat kamu berhenti.';
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

  return (
    <main className="shell">
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
          onChoosePicture={(saved, state) => {
            const handoff = { state, saved };
            handoffRef.current = openLesson.restorePending && (!touchedRef.current || state === openLesson.initialState) ? null : handoff;
            selectionRef.current += 1;
            setOpenLesson(null);
            setExitNotice(null);
            void saved.then((wasSaved) => {
              if (wasSaved && handoffRef.current === handoff) handoffRef.current = null;
              if (!wasSaved) {
                setExitNotice(
                  'Gambar tadi mungkin belum tersimpan. Tidak apa-apa, kamu bisa menggambar lagi.',
                );
              }
            });
          }}
        />
      ) : (
        <LessonPicker
          onSelect={selectLesson}
          notice={exitNotice}
        />
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
