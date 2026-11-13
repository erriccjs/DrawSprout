import { useEffect, useRef, useState } from 'react';
import type { ArtworkSurface } from './renderer/artwork-surface';
import { getPlayableLesson } from './categories/library';
import type { LessonPackage } from './lesson-data/schema';
import { readPhotoBeta } from './photo/beta';
import { DoodleFlow } from './doodle/DoodleFlow';
import { fitPhoto } from './trace/placement';
import { TRACE_LESSON } from './trace/lesson';
import { TraceSetup } from './trace/TraceSetup';
import type { TraceSession } from './trace/types';
import type { DoodleLessonRecord } from './persistence/doodle-lesson-store';
import { IndexedDbDoodleLessonStore } from './persistence/doodle-lesson-store';
import type { PhotoLessonRecord } from './persistence/photo-lesson-store';
import { IndexedDbPhotoLessonStore } from './persistence/photo-lesson-store';
import { DEFAULT_PREFERENCES, createSession } from './lesson-engine/session';
import type { SessionPreferences, SessionState, ToolPreferences } from './lesson-engine/types';
import { fromRestoredSession } from './persistence/mapping';
import type { SessionCheckpoint } from './persistence/types';
import { gateUpdate } from './offline/update-policy';
import { useOfflineSupport } from './offline/useOffline';
import { useI18n } from './i18n/context';
import { ArtworkGallery } from './ui/ArtworkGallery';
import { ResumeChoice } from './ui/ResumeChoice';
import { DrawingPad } from './ui/DrawingPad';
import { requestDocumentFullscreen } from './ui/fullscreen';
import { RESUME_NOTICE } from './ui/resume-notice';
import { LessonPicker } from './ui/LessonPicker';
import { PhotoFlow } from './ui/PhotoFlow';
import { TabletNotice } from './ui/TabletNotice';
import { newId } from './ui/ids';
import { dismissTabletNotice, isTabletNoticeDismissed } from './ui/tablet-notice';
import { useLayoutTier } from './ui/useLayoutTier';
import { useSessionBootstrap } from './ui/useSessionBootstrap';
import { recordUsage } from './usage/client';

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

const LOAD_FAILURE_NOTICE = 'Karya sebelumnya tidak dapat dibuka. Kamu bisa mulai menggambar lagi.';

export function App() {
  const { t } = useI18n();
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
  const [galleryReload, setGalleryReload] = useState(0);
  const [tabletNoticeDismissed, setTabletNoticeDismissed] = useState(isTabletNoticeDismissed);
  const [photoBeta] = useState(() => readPhotoBeta());
  const photoStoreRef = useRef<IndexedDbPhotoLessonStore | null>(null);
  const photoLessonsRef = useRef<readonly PhotoLessonRecord[]>([]);
  const [photoLessons, setPhotoLessons] = useState<readonly PhotoLessonRecord[]>([]);
  const [photoFlow, setPhotoFlow] = useState(false);
  const [traceDraft, setTraceDraft] = useState<{ image: HTMLImageElement; url: string; placement: TraceSession['placement'] } | null>(null);
  const [traceLive, setTraceLive] = useState<TraceSession | null>(null);
  const [doodleOpen, setDoodleOpen] = useState(false);
  const doodleStoreRef = useRef<IndexedDbDoodleLessonStore | null>(null);
  const doodleRecordsRef = useRef<DoodleLessonRecord[]>([]);
  const [doodleLessons, setDoodleLessons] = useState<LessonPackage[]>([]);
  const [resumeOffer, setResumeOffer] = useState<{
    lesson: LessonPackage;
    state: SessionState;
    finished: boolean;
    pendingSave: Promise<boolean> | null;
  } | null>(null);
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

  useEffect(() => {
    if (!photoBeta) return;
    const store = new IndexedDbPhotoLessonStore();
    photoStoreRef.current = store;
    let cancelled = false;
    void store.list().then((rows) => {
      if (cancelled) return;
      photoLessonsRef.current = rows;
      setPhotoLessons(rows);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      store.close();
      if (photoStoreRef.current === store) photoStoreRef.current = null;
    };
  }, [photoBeta]);

  useEffect(() => {
    const store = new IndexedDbDoodleLessonStore();
    doodleStoreRef.current = store;
    let cancelled = false;
    void store.list().then((rows) => {
      if (cancelled) return;
      doodleRecordsRef.current = [...rows];
      setDoodleLessons(rows.map((row) => row.lesson));
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      store.close();
      if (doodleStoreRef.current === store) doodleStoreRef.current = null;
    };
  }, []);

  if (bootstrap.status === 'loading') {
    return (
      <main className="shell shell--centered" data-layout={layout}>
        <p role="status">{t('preparing')}</p>
      </main>
    );
  }

  if (bootstrap.status === 'error') {
    return (
      <main className="shell shell--centered" data-layout={layout}>
        <h1>{t('lessonUnavailable')}</h1>
        <p className="banner banner--warning">{t('bootstrapFailure')}</p>
      </main>
    );
  }

  const rememberDoodle = (lesson: LessonPackage, png: Uint8Array, traced: boolean) => {
    const record: DoodleLessonRecord = { id: lesson.id, createdAt: Date.now(), lesson, png, traced };
    doodleRecordsRef.current = [record, ...doodleRecordsRef.current.filter((row) => row.id !== lesson.id)];
    setDoodleLessons(doodleRecordsRef.current.map((row) => row.lesson));
    void doodleStoreRef.current?.put(record).catch(() => undefined);
  };

  const resolveLesson = (lessonId: string): LessonPackage => {
    if (lessonId === TRACE_LESSON.id) return TRACE_LESSON;
    const doodle = doodleRecordsRef.current.find((row) => row.lesson.id === lessonId);
    if (doodle) return doodle.lesson;
    const photo = photoLessonsRef.current.find((row) => row.lesson.id === lessonId);
    if (photo) return photo.lesson;
    return getPlayableLesson(lessonId);
  };

  const releaseTrace = () => {
    setTraceLive((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setTraceDraft((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const chooseTrace = (file: File | null) => {
    if (!file) {
      setExitNotice('Tidak ada foto yang dipilih.');
      return;
    }
    if (file.type !== '' && !file.type.startsWith('image/')) {
      setExitNotice('Pilih foto JPG atau PNG ya.');
      return;
    }
    setExitNotice('Membuka foto…');
    let url: string;
    try {
      url = URL.createObjectURL(file);
    } catch {
      setExitNotice('Foto tidak dapat dibaca. Pilih gambar lain.');
      return;
    }
    const image = new Image();
    const fail = () => {
      URL.revokeObjectURL(url);
      setExitNotice('Foto tidak dapat dibaca. Pilih gambar lain.');
    };
    image.addEventListener('load', () => {
      if (image.naturalWidth < 1 || image.naturalHeight < 1) {
        fail();
        return;
      }
      const space = TRACE_LESSON.coordinateSpace;
      setExitNotice(null);
      setTraceDraft({
        image,
        url,
        placement: fitPhoto(space.width, space.height, image.naturalWidth || image.width, image.naturalHeight || image.height),
      });
    });
    image.addEventListener('error', fail);
    image.src = url;
  };

  const selectLesson = (lessonId: string) => {
    const lesson = resolveLesson(lessonId);
    const selection = ++selectionRef.current;
    setResumeOffer(null);
    // The picture they just left may still be saving. Offer that one immediately
    // so a slow read cannot open a blank page over it.
    const handoff = handoffRef.current?.state.lessonId === lesson.id ? handoffRef.current : null;
    if (handoff && sessionHasProgress(handoff.state)) {
      setResumeOffer({
        lesson,
        state: handoff.state,
        finished: handoff.state.finished,
        pendingSave: handoff.saved,
      });
      return;
    }
    void bootstrap.store.loadLatestSessionForLesson(lesson.id).then(async (latest) => {
      if (selectionRef.current !== selection) return;
      let restored = latest;
      // A blank visit must not hide an older finished or in-progress picture.
      if (restored && !hasProgress(restored.checkpoint)) {
        const artworks = await bootstrap.store.listSavedArtworks().catch(() => []);
        const earlier = artworks.find((artwork) => artwork.lessonId === lesson.id);
        if (selectionRef.current !== selection) return;
        if (earlier) restored = await bootstrap.store.loadSession(earlier.sessionId);
      }
      if (selectionRef.current !== selection) return;
      const versionMatches = !restored || restored.checkpoint.lessonContentVersion === lesson.contentVersion;
      if (!restored || !hasProgress(restored.checkpoint) || !versionMatches) {
        startLesson(lesson, Boolean(restored) && !versionMatches);
        return;
      }
      try {
        const state = fromRestoredSession(restored);
        setResumeOffer({ lesson, state, finished: state.finished, pendingSave: null });
      } catch {
        startLesson(lesson, false, LOAD_FAILURE_NOTICE);
      }
    }).catch(() => {
      if (selectionRef.current === selection) startLesson(lesson, false, LOAD_FAILURE_NOTICE);
    });
  };

  const openPrepared = (lesson: LessonPackage, state: SessionState, notice: string | null, pendingSave: Promise<boolean> | null = null) => {
    requestDocumentFullscreen();
    setPhotoFlow(false);
    setUpdateDismissed(false);
    selectionRef.current += 1;
    touchedRef.current = true;
    controlsRef.current = { preferences: {}, tools: {} };
    handoffRef.current = null;
    setExitNotice(null);
    setResumeOffer(null);
    setOpenLesson({
      lesson,
      initialState: state,
      notice,
      restorePending: false,
      preferencesPending: false,
      pendingSave,
      revision: 0,
    });
    recordUsage('lesson_start', lesson.id);
  };

  const startLesson = (lesson: LessonPackage, resume: boolean, failureNotice: string | null = null) => {
    // This runs inside the click that opens the drawing screen. Fullscreen has
    // to be asked for here, not on the first stroke: the resize would smear
    // that line (D-57). A photo match calls this from the button that accepts
    // the lesson, which is still that gesture.
    requestDocumentFullscreen();
    setPhotoFlow(false);
    setUpdateDismissed(false);
    const selection = ++selectionRef.current;
    const handoff = resume && handoffRef.current?.state.lessonId === lesson.id ? handoffRef.current : null;
    touchedRef.current = handoff !== null;
    controlsRef.current = { preferences: {}, tools: {} };
    setExitNotice(null);
    const initialState = handoff?.state ?? createSession(lesson, newId(), DEFAULT_PREFERENCES);
    setOpenLesson({ lesson, initialState, notice: failureNotice, restorePending: resume && handoff === null, preferencesPending: true,
      pendingSave: handoff?.saved ?? null, revision: 0 });
    recordUsage('lesson_start', lesson.id);

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

    if (!resume || handoff) return;

    void bootstrap.store.loadLatestSessionForLesson(lesson.id).then((restored) => {
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

    void bootstrap.store.loadSession(sessionId).then(async (restored) => {
      if (selectionRef.current !== selection) return;
      if (!restored) {
        setExitNotice('Karya itu tidak dapat dibuka.');
        return;
      }
      let lesson: LessonPackage;
      try {
        lesson = resolveLesson(restored.checkpoint.lessonId);
      } catch {
        const loaded = await doodleStoreRef.current?.list().catch(() => [] as readonly DoodleLessonRecord[]);
        if (loaded && loaded.length > 0) {
          doodleRecordsRef.current = [...loaded];
          setDoodleLessons(loaded.map((row) => row.lesson));
        }
        try {
          lesson = resolveLesson(restored.checkpoint.lessonId);
        } catch {
          setExitNotice('Pelajaran untuk karya ini sudah tidak ada.');
          return;
        }
      }
      if (selectionRef.current !== selection) return;
      releaseTrace();
      const doodle = doodleRecordsRef.current.find((row) => row.id === lesson.id && row.traced);
      if (doodle) {
        try {
          const overlay = await doodleOverlay(doodle.lesson, doodle.png);
          if (selectionRef.current !== selection) {
            URL.revokeObjectURL(overlay.url);
            return;
          }
          setTraceLive(overlay);
        } catch {
          /* The steps still open when the line drawing cannot be shown. */
        }
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
        recordUsage('lesson_start', lesson.id);
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
        recordUsage('lesson_start', lesson.id);
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
          {...(traceLive ? { trace: traceLive } : {})}
          onTraceChange={(patch) => setTraceLive((current) => current ? { ...current, ...patch } : current)}
          onChoosePicture={(saved, state) => {
            releaseTrace();
            const handoff = { state, saved };
            handoffRef.current = openLesson.restorePending && (!touchedRef.current || state === openLesson.initialState) ? null : handoff;
            selectionRef.current += 1;
            setOpenLesson(null);
            setExitNotice(null);
            setSaveInFlight(true);
            void saved.then((wasSaved) => {
              setSaveInFlight(false);
              setGalleryReload((current) => current + 1);
              if (wasSaved && handoffRef.current === handoff) handoffRef.current = null;
              if (!wasSaved) {
                setExitNotice(
                  'Gambar tadi mungkin belum tersimpan. Tidak apa-apa, kamu bisa menggambar lagi.',
                );
              }
            }, () => {
              setSaveInFlight(false);
              setGalleryReload((current) => current + 1);
              setExitNotice(
                'Gambar tadi mungkin belum tersimpan. Tidak apa-apa, kamu bisa menggambar lagi.',
              );
            });
          }}
        />
      ) : traceDraft ? (
        <TraceSetup
          image={traceDraft.image}
          placement={traceDraft.placement}
          spaceWidth={TRACE_LESSON.coordinateSpace.width}
          spaceHeight={TRACE_LESSON.coordinateSpace.height}
          onPlacement={(placement) => setTraceDraft((current) => current ? { ...current, placement } : current)}
          onStart={() => {
            const draft = traceDraft;
            setTraceLive({
              image: draft.image,
              url: draft.url,
              placement: draft.placement,
              opacity: 0.35,
              visible: true,
              locked: true,
              includeInExport: false,
            });
            setTraceDraft(null);
            recordUsage('trace_photo_start', TRACE_LESSON.id);
            startLesson(TRACE_LESSON, false);
          }}
          onCancel={releaseTrace}
        />
      ) : doodleOpen ? (
        <DoodleFlow
          onCancel={() => setDoodleOpen(false)}
          onFollow={(lesson, png) => {
            rememberDoodle(lesson, png, false);
            recordUsage('doodle_success', lesson.id);
            setDoodleOpen(false);
            startLesson(lesson, false);
          }}
          onTrace={(lesson, previewUrl, png) => {
            rememberDoodle(lesson, png, true);
            const image = new Image();
            image.onload = () => {
              const space = lesson.coordinateSpace;
              setTraceLive({
                image,
                url: previewUrl,
                placement: fitPhoto(space.width, space.height, image.naturalWidth || image.width, image.naturalHeight || image.height),
                opacity: 0.4,
                visible: true,
                locked: true,
                includeInExport: false,
                source: 'doodle',
              });
              recordUsage('doodle_success', lesson.id);
              setDoodleOpen(false);
              startLesson(lesson, false);
            };
            image.src = previewUrl;
          }}
        />
      ) : photoFlow ? (
        <PhotoFlow
          onCancel={() => setPhotoFlow(false)}
          onUse={async (lesson, targetHash) => {
            const store = photoStoreRef.current;
            if (!store) throw new Error('Pelajaran belum tersimpan di perangkat ini.');
            const record: PhotoLessonRecord = { id: lesson.id, targetHash, createdAt: Date.now(), lesson };
            await store.put(record);
            const next = [record, ...photoLessonsRef.current.filter((row) => row.id !== record.id)];
            photoLessonsRef.current = next;
            setPhotoLessons(next);
            setPhotoFlow(false);
            selectLesson(lesson.id);
          }}
        />
      ) : resumeOffer ? (
        <ResumeChoice
          lesson={resumeOffer.lesson}
          finished={resumeOffer.finished}
          onContinue={() => {
            const offer = resumeOffer;
            openPrepared(
              offer.lesson,
              offer.state,
              offer.finished ? null : RESUME_NOTICE,
              offer.pendingSave,
            );
          }}
          onStartNew={() => {
            const lesson = resumeOffer.lesson;
            setResumeOffer(null);
            startLesson(lesson, false);
          }}
          onBack={() => setResumeOffer(null)}
        />
      ) : (
        <>
          <LessonPicker
            onSelect={selectLesson}
            onTrace={chooseTrace}
            onDoodle={() => setDoodleOpen(true)}
            notice={exitNotice}
            offlineReady={offlineReady}
            updatePhase={updateGate.showPrompt ? (applyRequested ? 'applying' : 'prompt') : 'hidden'}
            onApplyUpdate={requestApply}
            onDismissUpdate={() => { setUpdateDismissed(true); }}
            photoBeta={photoBeta}
            photoLessons={photoLessons}
            onCreatePhoto={() => setPhotoFlow(true)}
            onDeletePhoto={async (id) => {
              await photoStoreRef.current?.delete(id);
              await bootstrap.store.deleteSessionsForLesson(id);
              const next = photoLessonsRef.current.filter((row) => row.id !== id);
              photoLessonsRef.current = next;
              setPhotoLessons(next);
            }}
          />
          <ArtworkGallery
            store={bootstrap.store}
            actionsDisabled={updateGate.showPrompt && applyRequested}
            reloadToken={galleryReload}
            onOpen={openArtwork}
            extraLessons={[TRACE_LESSON, ...doodleLessons, ...photoLessons.map((row) => row.lesson)]}
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
function doodleOverlay(lesson: LessonPackage, png: Uint8Array): Promise<TraceSession> {
  const copy = new Uint8Array(png.byteLength);
  copy.set(png);
  const url = URL.createObjectURL(new Blob([copy], { type: 'image/png' }));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const space = lesson.coordinateSpace;
      resolve({
        image,
        url,
        placement: fitPhoto(space.width, space.height, image.naturalWidth || image.width, image.naturalHeight || image.height),
        opacity: 0.4,
        visible: true,
        locked: true,
        includeInExport: false,
        source: 'doodle',
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Doodle tidak dapat dibuka.'));
    };
    image.src = url;
  });
}

function sessionHasProgress(state: SessionState): boolean {
  return state.finished || state.strokes.length > 0 || state.redoStack.length > 0 || state.currentStepIndex > 0;
}

function hasProgress(checkpoint: SessionCheckpoint): boolean {
  return (
    checkpoint.finished ||
    checkpoint.committedStrokeIds.length > 0 ||
    checkpoint.redoStrokeIds.length > 0 ||
    checkpoint.currentStepIndex > 0
  );
}
