import { useState } from 'react';
import { getLesson } from './lesson-data';
import type { LessonPackage } from './lesson-data/schema';
import { createSession } from './lesson-engine/session';
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
}

export function App() {
  const bootstrap = useSessionBootstrap();
  const [openLesson, setOpenLesson] = useState<OpenLesson | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
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
        <p className="banner banner--warning">{bootstrap.message}</p>
      </main>
    );
  }

  const selectLesson = async (lessonId: string) => {
    if (opening) return;
    setOpening(true);
    setOpenError(null);
    setExitNotice(null);
    try {
      const lesson = getLesson(lessonId);
      const restored = await bootstrap.store.loadLatestSessionForLesson(lessonId);
      const preferences = (await bootstrap.store.loadPreferences()) ?? bootstrap.preferences;
      let initialState = createSession(lesson, newId(), preferences);
      let notice: string | null = null;

      if (restored) {
        if (restored.checkpoint.lessonContentVersion !== lesson.contentVersion) {
          notice = 'Pelajaran sudah diperbarui, jadi karya lama dibuka sebagai karya baru.';
        } else {
          try {
            initialState = fromRestoredSession(restored);
            notice = 'Karya terakhirmu dilanjutkan dari tempat kamu berhenti.';
          } catch (error) {
            notice = `Karya tersimpan tidak dapat dibuka: ${describe(error)}`;
          }
        }
      }

      setOpenLesson({
        lesson,
        initialState,
        notice: restored && hasProgress(restored.checkpoint) ? notice : null,
      });
    } catch (error) {
      setOpenError(`Gagal membuka gambar: ${describe(error)}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <main className="shell">
      {openLesson ? (
        <DrawingPad
          key={openLesson.initialState.sessionId}
          lesson={openLesson.lesson}
          store={bootstrap.store}
          initialState={openLesson.initialState}
          durable={bootstrap.durable}
          notice={openLesson.notice}
          onChoosePicture={(saved) => {
            setOpenLesson(null);
            setExitNotice(
              saved
                ? null
                : 'Gambar tadi mungkin belum tersimpan. Tidak apa-apa, kamu bisa menggambar lagi.',
            );
          }}
        />
      ) : (
        <LessonPicker
          onSelect={(lessonId) => void selectLesson(lessonId)}
          opening={opening}
          error={openError}
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

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
