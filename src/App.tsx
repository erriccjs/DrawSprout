import { useRef, useState } from 'react';
import { getLesson } from './lesson-data';
import type { LessonPackage } from './lesson-data/schema';
import { DEFAULT_PREFERENCES, createSession } from './lesson-engine/session';
import type { SessionState } from './lesson-engine/types';
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
  readonly revision: number;
}

const BOOTSTRAP_FAILURE_NOTICE = 'Maaf, pelajaran belum bisa dibuka sekarang. Coba lagi nanti ya.';
const LOAD_FAILURE_NOTICE = 'Karya sebelumnya tidak dapat dibuka. Kamu bisa mulai menggambar lagi.';

export function App() {
  const bootstrap = useSessionBootstrap();
  const [openLesson, setOpenLesson] = useState<OpenLesson | null>(null);
  const selectionRef = useRef(0);
  const touchedRef = useRef(false);
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
    setExitNotice(null);
    const lesson = getLesson(lessonId);
    const initialState = handoff?.state ?? createSession(lesson, newId(), DEFAULT_PREFERENCES);
    setOpenLesson({ lesson, initialState, notice: null, restorePending: handoff === null, preferencesPending: true, revision: 0 });

    void bootstrap.store.loadPreferences().then((preferences) => {
      if (selectionRef.current !== selection) return;
      setOpenLesson((current) => {
        if (!current) return current;
        if (touchedRef.current || !preferences || current.initialState.sessionId !== initialState.sessionId) {
          return { ...current, preferencesPending: false };
        }
        return { ...current, preferencesPending: false,
          initialState: createSession(lesson, initialState.sessionId, preferences), revision: current.revision + 1 };
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
        if (touchedRef.current) {
          return notice === LOAD_FAILURE_NOTICE
            ? { ...current, notice, restorePending: false }
            : current;
        }
        return { ...current, initialState: state ?? current.initialState, notice, restorePending: false,
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
          pendingSave={handoffRef.current?.state.sessionId === openLesson.initialState.sessionId
            ? handoffRef.current.saved
            : null}
          onActivity={() => {
            touchedRef.current = true;
            setOpenLesson((current) => current && current.restorePending
              ? { ...current, restorePending: false }
              : current);
          }}
          onChoosePicture={(saved, state) => {
            const handoff = { state, saved };
            handoffRef.current = openLesson.restorePending && !touchedRef.current ? null : handoff;
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

/** Whether a checkpoint holds work a child would recognise as their own. */
function hasProgress(checkpoint: SessionCheckpoint): boolean {
  return (
    checkpoint.committedStrokeIds.length > 0 ||
    checkpoint.redoStrokeIds.length > 0 ||
    checkpoint.currentStepIndex > 0
  );
}
