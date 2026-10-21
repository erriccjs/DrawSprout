# Implementation plan — PRD requirements mapped to milestones

Source of requirements: [`PRD_Aplikasi_Belajar_Menggambar_Anak.md`](./PRD_Aplikasi_Belajar_Menggambar_Anak.md)
(version 1.1, 10 October 2026).

This document maps every requirement ID (FR-01 to FR-25) and every acceptance
test (AT-01 to AT-22) in that PRD to a milestone, and states for each one
whether milestone 1 satisfies it, defers it, or cannot verify it without real
hardware.

Two cautions carried over from the PRD itself:

- The PRD is a draft. Its performance numbers, durations and thresholds
  (60 fps, p95 ≤50 ms input latency, 800 ms auto-advance delay, 2 s checkpoint
  interval, the 80% similarity gate) are **design targets, not measurements**.
  Nothing in this repository has measured any of them.
- "Verified" below always means *verified by an automated check in this
  repository*. Browser emulation is not device testing, and no result here was
  produced on an iPad or an Android tablet.

## 1. Milestones

| Milestone | PRD phase | Content | Status |
| --- | --- | --- | --- |
| **M1 — Vertical slice** | Tahap A prototype; section 16 phase 1 | One hand-authored cat lesson, end to end: canvas, pencil/finger modes, assistance modes, tool presets, undo/redo, manual navigation, colouring with optional boundaries, IndexedDB autosave/resume, PNG export | **Done** |
| M2 — Pilot usability | section 16 phase 2 | Observe 5–8 children on real tablets, fix the main obstacles, close the AT-16..AT-22 device gap | Next |
| M3 — MVP foundations | section 16 phase 3 | Lesson catalogue (~10 templates), local gallery, service worker and offline packaging, project backup import/export, audio instructions, automatic step completion, full error handling | **In progress** — the service worker, offline packaging, the safe update flow, a ten-lesson catalogue, the local gallery, and free drawing after the last step are in the tree. Backup, audio, automatic completion, and checkpoint migration are still deferred |
| M4 — Photo spike | section 16 phase 4 | Photo → illustration candidates, geometry extraction, step sequencing, 30-photo rubric evaluation | **In progress** — spike behind `?beta=foto` (D-66, D-67, D-68, D-69). Steps are basic shapes. OpenAI is the default image provider; Replicate is optional. A 5-photo live run was not a pass. The 30-photo go/no-go has not been run and is not claimed |
| M5 — Beta integration | section 16 phase 5 | Backend, job queue, privacy and retention, parent area, device test matrix | Deferred |

A generalised authoring pipeline and a hardening pass are M2+ work listed here
rather than scope added to M1.

## 2. Functional requirements

Legend: **Done** = implemented and covered by an automated test in this repo ·
**Partial** = implemented to the extent M1 needs, remainder deferred ·
**Deferred** = not built, by design · **Device** = cannot be judged without a
real tablet.

| ID | Requirement | Milestone | M1 status | Where / why |
| --- | --- | --- | --- | --- |
| FR-01 | Canvas, orientation-stable | M1 | **Done** | Fixed 1000×750 coordinate space; `src/renderer/coordinates.ts`. Resize and rotation only change the viewport, never stored geometry. |
| FR-02 | Pen, eraser, palette, width, ≥50 undo | M1 | **Done** | `src/lesson-engine/session.ts`, `src/ui/Toolbar.tsx`. History is unbounded; an erase is a stroke, so undo restores it. |
| FR-03 | Per-step tool preset, stable during input | M1 | **Done** | `effectiveToolPreset` is resolved once at pointer-down in `DrawingPad.tsx`; nothing can change colour or width mid-stroke. A step change installs that step's authored tool, so an eraser or a width picked for the previous step does not follow the child into this one. |
| FR-04 | "Follow the guide" vs "my colour" | M1 | **Done** | `colorSource` persists across steps until `use-guide-color`. |
| FR-05 | Lesson template with preview, steps, geometry, regions, version | M1 | **Done** | `src/lesson-data/schema.ts`, `cat-lesson.ts`, validated by `validate.ts`. |
| FR-06 | Dashed guide, active part only, not exported | M1 | **Done** | SVG overlay (`GuideOverlay.tsx`) layered over the canvas, so it is in no canvas the exporter can read. |
| FR-07 | Temporary hint, 3/5/10 s or always on, replay button | M1 | **Done** | `DrawingPad.tsx` guide window; default 5 s per the PRD's proposal. |
| FR-08 | Independent mode: example in its own panel | M1 | **Done** | `TargetPreview.tsx`; the canvas overlay stays off until asked. See the colouring example in [README](../README.md). |
| FR-09 | Back/next without similarity checks | M1 | **Done** | Navigation is unconditional; later steps' strokes survive going back. |
| FR-10 | Automatic step completion | M3 | **Deferred** | `completionPolicy.automaticEnabled` is `false` on every step; the field exists so enabling it later is data, not a rewrite. |
| FR-11 | Colouring with optional boundary assist | M1 | **Done** | Colour regions clip paint; the child can switch the boundary off and the clip is frozen per stroke. |
| FR-12 | Free creation after the lesson | M3 | **Done** | After the last step, *Gambar bebas* keeps the strokes and hides the canvas guide. Pen, brush, eraser, and colours stay available (D-64). |
| FR-13 | IndexedDB autosave and resume | M1 | **Done** | `src/persistence/indexeddb-store.ts`: strokes and checkpoint in one transaction; no localStorage anywhere. |
| FR-14 | Local gallery and PNG export without hints | M1 **partial** | **Done** | PNG export and Karyaku, the gallery on the picture-choosing screen. Thumbnails and PNG files are painted from committed strokes only (D-63). |
| FR-15 | Camera / photo picker | M4/M5 | **Partial** | Beta only (`?beta=foto`). File input for camera (`capture`) and gallery, crop, orientation, 1024px PNG re-encode that drops EXIF (`src/ui/PhotoFlow.tsx`, `src/photo/prepare.ts`, `src/photo/image-ops.ts`). |
| FR-16 | Photo transformation | M4/M5 | **Partial** | OpenAI line-art edit, marching-squares tracer, 1000×750 lesson, validator (`src/photo/pipeline.ts`). Not a finished photo MVP: the section 8 gate has not been run. |
| FR-17 | Photo preview and approval | M4/M5 | **Partial** | Side-by-side preview, *Gunakan* / *Lebih mirip foto* / *Lebih sederhana* / *Ganti foto*. Approval locks the illustration hash on the lesson. A Dice review banner does not block approval (D-66). |
| FR-18 | AI job lifecycle | M5 | **Partial** | Idempotency key, 120s timeout, cancel, 6 requests / 10 minutes per IP, in-memory per isolate plus the OpenAI `Idempotency-Key` header. Not a durable queue. |
| FR-19 | Privacy and parent controls | M5 | **Partial** | Indonesian consent before upload. Photos are not stored after processing and are not logged. Deleting a photo lesson deletes the package and its sessions. No accounts and no expiry job. |
| FR-20 | Audio instructions | M3 | **Deferred** | Text and icons only. |
| FR-21 | Cloud sync | M5 | **Deferred** | Out of scope by instruction. |
| FR-22 | Pencil / finger input modes | M1 | **Done** (behaviour on real hardware is **Device**) | `src/input/pointer-mode.ts`. Pencil mode accepts `pointerType === 'pen'` only. **No palm rejection is claimed.** |
| FR-23 | PWA manifest, service worker, offline | M3 | **Partial** | Production builds emit `sw.js` (`src/offline/`). It precaches the shell, checks SHA-256 before writing the cache, and the page says the app can open without internet only when the worker reports every bundled lesson at the running content version. The dev server does not register a worker. A cold launch with the network off on iPad or Android is AT-19 and has not been run. |
| FR-24 | Project backup export/import | M3 | **Deferred** | PNG export only. The stroke log plus checkpoint is already a serialisable project, so this is a file format and a UI, not a redesign. |
| FR-25 | Update safety and data migration | M3 | **Partial** | A waiting worker is offered only on the picture-choosing screen, after an in-flight save settles, and reloads only after someone asks (`src/offline/update-policy.ts`, `register.ts`). The worker never opens IndexedDB. Still missing: migrating an older checkpoint or lesson package. An unknown schema is still refused, and a changed `contentVersion` still starts a new session (D-33). |

## 3. Acceptance tests

| ID | Scenario | M1 verdict | Evidence or reason |
| --- | --- | --- | --- |
| AT-01 | Finish a template, save; PNG holds only the artwork | **Verified (automated)** | `src/renderer/export.test.ts` — with zero strokes the export issues no path draws at all even though the lesson has guides; `src/ui/DrawingPad.test.tsx` walks every step to the finish screen. |
| AT-02 | Change colour, continue; preference persists | **Verified (automated)** | `session.test.ts` "keeps a chosen colour across steps"; `DrawingPad.test.tsx` "keeps a chosen colour when the step changes". |
| AT-03 | Hint disappears, is requested back | **Verified (automated)** | `DrawingPad.test.tsx` "brings the hint back without touching the strokes or the step". |
| AT-04 | Advance before drawing anything | **Verified (automated)** | `session.test.ts` "moves forward and back without asking how the drawing looks". Every advance is recorded as manual; nothing claims the step was done correctly. |
| AT-05 | Close the tab after a checkpoint, resume | **Verified (automated)** | `src/persistence/round-trip.test.ts` restores step, assistance, tools and committed strokes through a real IndexedDB transaction (`fake-indexeddb`). A genuine tab close on a tablet is still untested. |
| AT-06 | Zoom / rotate / resize keeps geometry aligned | **Verified (automated)**, device behaviour open | `coordinates.test.ts` maps the same touch to the same lesson point at two very different box sizes; `artwork-surface.test.ts` replays on resize. Real orientation change on a tablet is untested. |
| AT-07 | Undo, redo, then a new stroke | **Verified (automated)** | `history.test.ts` "invalidates the redo chain once a new stroke is drawn". |
| AT-08 | Photo keeps distinctive features | **Not passed** | The prompt and the rubric exist (D-66). The 30-photo set has not been scored. `claimedPass` is always false. Do not read a harness run as this test. |
| AT-09 | All steps of a photo lesson render | **Partial, automated only** | A traced rectangle becomes a package `findLessonProblems` accepts, and approval opens it in the existing engine. Not a device result, and not the 30-photo set. |
| AT-10 | Job/approval retry is idempotent | **Partial, automated** | `src/photo/api.test.ts`: two requests with one key make one edit; a later retry is served from the in-memory result. The cache is per isolate. OpenAI also receives `Idempotency-Key`. |
| AT-11 | Network drops after download | **Partial, not a device result** | The precache is what would serve drawing, resume, and export after the shell is cached. A headless Chrome simulation opened one lesson with the network off (section 7). A network drop on the pilot tablets has not been tested. There is no photo-lesson AI status to show. |
| AT-12 | Cross-tenant asset access denied | **Deferred** | No backend (M5). |
| AT-13 | Photo deletion and expiry | **Partial** | Deleting a photo lesson removes its IndexedDB record and every session for that lesson. The source photo is not stored, so there is no server copy to expire. No 30-day job. |
| AT-14 | Storage full during autosave | **Partial, not verified** | `StorageFullError` is a distinct type and the UI shows a recovery message; the single-transaction write means a failure cannot corrupt the previous checkpoint (`round-trip.test.ts` proves an aborted save leaves nothing behind). **A genuinely full device was never tested.** |
| AT-15 | Auto-next waits for pen-up plus a pause | **Deferred** | FR-10 not built (M3). |
| AT-16 | Pencil with the palm resting on the glass | **Device — unverified** | Needs a real iPad + Apple Pencil and an Android tablet + active stylus. Nothing here can establish it. |
| AT-17 | Fast, short, repeated strokes; pointercancel; fps and p95 latency | **Partly structural, mostly Device — unverified** | The single-active-pointer rule and cancel handling are covered in `DrawingPad.test.tsx` and `artwork-surface.test.ts`, and a `Profiler` test shows forty pointermove samples cost zero React commits — so the *logic* that could produce a connecting line or a stall is tested. **fps and p95 latency are not measured and must be on real hardware.** |
| AT-18 | No-pressure input and capacitive stylus | **Device — unverified** | Width is preset-driven with no pressure dependency, and a capacitive stylus reports as `touch` so finger mode covers it — but this has not been tried on a device. |
| AT-19 | Cold launch of the installed PWA offline | **Device — unverified** | Automated tests cover the manifest (a bundled lesson missing from the precached scripts fails the build), checksum validation, the navigation fallback, and the ready gate. Section 7 records a headless Chrome simulation. Cold launch of an installed PWA on iPad and Android has not been run, so this acceptance test is not passed. |
| AT-20 | Project export, clear site data, import | **Deferred** | FR-24 not built (M3). |
| AT-21 | App update during a live session | **Partial** | Automated: the gate refuses to apply on the drawing screen and while a save is in flight; registration reloads only after an explicit apply; the first install is not treated as an update; the worker calls `skipWaiting` only for that message and does not reference IndexedDB. Not done: validating a data migration before the new version is used, and repeating the flow on a device. |
| AT-22 | Browser tab and Home Screen both pass | **Device — unverified** | Needs both launch modes on a real tablet, including the separate-storage case. |

## 4. What milestone 1 verified, and how

Automated, reproducible in this repo (`npm run build`, `npm test`, `npm run lint`):

- Lesson package validation, including rejection of path data outside the
  allowed geometry subset (PRD section 13 "Konten vektor").
- Step navigation and the session state machine, including that later steps'
  strokes survive going back.
- Undo/redo, redo invalidation after a new stroke, step-scoped undo, and
  undoing an erase.
- Tool preset resolution: step preset by default, a chosen colour that outlives
  a step change, a tool choice and a width override that do not — while a
  different tool is still free to be picked within a step.
- Persistence round trip through real IndexedDB transactions, including the
  undone-stroke case, session isolation, and a rolled-back save leaving nothing
  behind.
- Coordinate mapping across two very different viewport sizes and pixel ratios.
- Export containing stroke geometry only, and never dashing anything.
- A component-level pass over the whole slice: draw, undo, redo, refuse a touch
  in pencil mode, hide and replay the hint, walk all nine steps, switch the
  colour boundary off, finish, and save.
- That a pointer-down and forty pointermove samples produce **zero** React
  commits, measured with a `Profiler` — PRD section 11's "render stroke tidak
  bergantung pada rerender ... per pointermove" as a check rather than a claim.
- That an interrupted pointer (`pointercancel`) keeps the ink it drew and the
  next stroke starts at its own pointer-down, so no connecting line can form.

Browser check (Chrome via devtools, **a simulation**): the app boots, renders
the first step, accepts a synthetic pointer stroke, paints it, reports
`Tersimpan`, and resumes the session on reload. This says nothing about pen
input, palm behaviour, frame rate or latency.

## 5. The device gap

These must be run on real hardware before any claim is made about them. PRD
section 21 makes passing AT-16..AT-22 on both target combinations the gate for
announcing PWA support.

| What | Acceptance test | Why a simulation cannot answer it |
| --- | --- | --- |
| Apple Pencil input | AT-16, AT-18 | `pointerType: 'pen'`, pressure, tilt and hover reporting are digitiser and OS behaviour. |
| Palm and gesture conflict | AT-16 | Depends on the panel, the OS and Safari/Chrome gesture arbitration. |
| Frame rate (target 60 fps) | AT-17, PRD section 13 | GPU, compositor and thermal behaviour of the actual tablet. |
| Input-to-ink latency (target p95 ≤50 ms) | AT-17, PRD section 13 | Includes digitiser sampling and display pipeline, neither of which exists in a desktop browser. |
| Capacitive stylus as touch | AT-18 | Hardware-dependent. |
| Home Screen PWA vs browser tab storage | AT-22 | WebKit treats the two as separate storage; only a device shows it. |
| Cold launch with no network | AT-19 | Needs the installed PWA, and the browser tab, on the pilot iPad and Android tablet after a successful first visit. The headless Chrome note in section 7 is not that test. |
| Storage eviction and a genuinely full device | AT-14 | Browser quota policy under real pressure. |

Suggested next action, from PRD section 20 item 1: choose the two pilot devices,
record model, OS and browser versions, then run AT-01..AT-07, AT-14 and
AT-16..AT-22 on both and record the results per device.

The parent-facing checklist for that run is
[`DEVICE_TEST_CHECKLIST.md`](DEVICE_TEST_CHECKLIST.md) (Indonesian). It covers
the two combinations in PRD section 21 (iPad + Safari and the Home Screen icon;
Android tablet + Chrome and the installed PWA), the acceptance tests named
above, and the recent playtest checks (edge gestures, fullscreen, resume toast,
mode box, sample card, Karyaku, free drawing, repeat step, offline cold launch).
Copy [`device-results/TEMPLATE.md`](device-results/TEMPLATE.md) to
`device-results/<device>-<date>.md` for each device. Filling the checklist does
not by itself pass the section 21 gate.

## 6. Follow-up work still open

Noted here rather than treated as done. Items 2 and 7 started with the offline
slice. The lesson catalogue of about ten templates is done (D-62). Item 4,
the local gallery, is done (D-63). Item 6, free creation and the in-lesson
edit controls, is done (D-64). Items 8 and 9 record the photo spike, which is
not a finished photo MVP. The other open items are unchanged from milestone 1.

1. **Automatic step completion** (FR-10, AT-15) — the policy field exists and is
   off everywhere.
2. **Cold offline launch on the pilot devices** (AT-19) — the service worker
   and the precache exist and are covered by automated tests. The device run
   does not.
3. **Project backup export/import** (FR-24, AT-20) — the stroke log and
   checkpoint are already a complete, serialisable project.
4. **Local gallery** (FR-14) — done (D-63). Karyaku, on the picture-choosing
   screen, lists saved sessions from IndexedDB with a thumbnail, the lesson
   name, and the date. A card can be opened, exported as PNG, or deleted
   after confirmation. Thumbnails do not include guides.
5. **Audio instructions** (FR-20).
6. **Free-creation phase** (FR-12) and "repeat this step" / "start over"
   (PRD section 7) — done (D-64). *Gambar bebas* is on the last step's help
   sheet and on the finish screen. *Ulangi langkah ini* clears only that
   step and can be undone. *Mulai ulang* asks before wiping the picture.
   Both sit in the help sheet, so the dock stays the same width.
7. **Data migration** (the rest of FR-25, AT-21) — versions are checked and
   refused, and a service-worker update no longer reloads a live drawing.
   Nothing migrates an old checkpoint onto a new schema yet.
8. **Parent area and privacy controls** (FR-19) — the photo spike has a consent
   screen and delete-with-derived-data. A full parent area, accounts, and an
   expiry job are still deferred.
9. **Photo pipeline and backend** (FR-15..FR-18, FR-21; AT-08..AT-13) — a beta
   spike exists (D-65, D-66). Cloud sync does not. The 30-photo go/no-go has
   not been run and is not claimed. Until that gate is actually passed, this
   is not a finished photo MVP.
10. **Lesson authoring tooling** — the data format is deliberately plain so an
    authoring step or the photo pipeline can emit it, but no authoring tool is
    part of this milestone.

## 7. Milestone 3 offline slice — what was verified

Automated, in this repository (`npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`):

- The precache manifest lists the shell and excludes the worker script. A
  bundled lesson whose id and title are missing from the precached scripts
  fails the build (`src/offline/vite-plugin.test.ts`). The production build
  therefore refuses to emit `sw.js` if a lesson was tree-shaken out.
- Install stores files only after every response is HTTP 200 and the SHA-256
  matches the manifest. A mismatch writes nothing. The Web Crypto digest matches
  Node's SHA-256, including the empty-input test vector.
- A revalidating fetch (`cache: 'reload'`) and the worker script itself are not
  answered from the old cache, so a new version can install. Navigations fall
  back to `/index.html`. Cache cleanup deletes only names with the precache
  prefix.
- The worker source calls `skipWaiting` only when the page sends `SKIP_WAITING`,
  and the source does not mention IndexedDB. The bundled `dist/sw.js` inlines
  the manifest, including every bundled lesson id and content version.
- Registration is production-only, reloads only after an explicit apply, and
  does not treat the first install as a waiting update.
- The update gate stays closed on the drawing screen, while a save is in
  flight, and after *Nanti saja*. The picture-choosing screen shows the prompt
  and, once accepted, disables the lesson choices until the reload.
- The offline-ready sentence is absent until the status store is told the shell
  is ready.

Browser simulation (headless Chrome on the development machine, 20 October 2026,
**not a device test**): `npm run preview` was loaded once online. The worker
activated, the picture-choosing screen showed *Bisa dibuka tanpa internet*, and
no update prompt appeared. A new tab with the network disabled was then served
by the worker (HTTP 200, `fromServiceWorker`). The cat lesson opened at step 1
and the screen said *Tersimpan*. No update prompt appeared on the drawing
screen.

This simulation does not pass AT-19 or AT-21. It was not an installed Home
Screen icon, not Safari, and not an iPad or an Android tablet. Nobody measured
frame rate, input latency, or storage eviction.
