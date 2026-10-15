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
| **M1 — Vertical slice** | Tahap A prototype; section 16 phase 1 | One hand-authored cat lesson, end to end: canvas, pencil/finger modes, assistance modes, tool presets, undo/redo, manual navigation, colouring with optional boundaries, IndexedDB autosave/resume, PNG export | **This milestone** |
| M2 — Pilot usability | section 16 phase 2 | Observe 5–8 children on real tablets, fix the main obstacles, close the AT-16..AT-22 device gap | Next |
| M3 — MVP foundations | section 16 phase 3 | Lesson catalogue (~10 templates), local gallery, service worker and offline packaging, project backup import/export, audio instructions, automatic step completion, full error handling | Deferred |
| M4 — Photo spike | section 16 phase 4 | Photo → illustration candidates, geometry extraction, step sequencing, 30-photo rubric evaluation | Deferred |
| M5 — Beta integration | section 16 phase 5 | Backend, job queue, privacy and retention, parent area, device test matrix | Deferred |

Anything the ask did not require — a second lesson, a generalised authoring
pipeline, a hardening pass — is M2+ work listed here rather than scope added to
M1.

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
| FR-12 | Free creation after the lesson | M3 | **Deferred** | The session state machine has no `free_creation` state yet. Reopening a finished artwork to keep drawing *is* supported. |
| FR-13 | IndexedDB autosave and resume | M1 | **Done** | `src/persistence/indexeddb-store.ts`: strokes and checkpoint in one transaction; no localStorage anywhere. |
| FR-14 | Local gallery and PNG export without hints | M1 **partial** | **Partial** | PNG export done and tested. A gallery of past artworks is M3. |
| FR-15 | Camera / photo picker | M4/M5 | **Deferred** | Out of scope by instruction. |
| FR-16 | Photo transformation | M4/M5 | **Deferred** | Out of scope by instruction. |
| FR-17 | Photo preview and approval | M4/M5 | **Deferred** | Out of scope by instruction. |
| FR-18 | AI job lifecycle | M5 | **Deferred** | Out of scope by instruction. |
| FR-19 | Privacy and parent controls | M5 | **Deferred** | No photos, no accounts and no network calls exist in M1, so there is nothing yet to control. |
| FR-20 | Audio instructions | M3 | **Deferred** | Text and icons only. |
| FR-21 | Cloud sync | M5 | **Deferred** | Out of scope by instruction. |
| FR-22 | Pencil / finger input modes | M1 | **Done** (behaviour on real hardware is **Device**) | `src/input/pointer-mode.ts`. Pencil mode accepts `pointerType === 'pen'` only. **No palm rejection is claimed.** |
| FR-23 | PWA manifest, service worker, offline | M3 | **Partial** | A manifest ships so the app can be added to the Home Screen. **There is no service worker**, so the app is not offline-capable and does not claim to be. |
| FR-24 | Project backup export/import | M3 | **Deferred** | PNG export only. The stroke log plus checkpoint is already a serialisable project, so this is a file format and a UI, not a redesign. |
| FR-25 | Update safety and data migration | M3 | **Partial** | `PERSISTENCE_SCHEMA_VERSION` and `LESSON_SCHEMA_VERSION` are checked, and a checkpoint from an unknown version is refused rather than misread. No migration path is written yet, and no service-worker update flow exists. |

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
| AT-08 | Photo keeps distinctive features | **Deferred** | No photo pipeline (M4). |
| AT-09 | All steps of a photo lesson render | **Deferred** | No photo pipeline (M4). |
| AT-10 | Job/approval retry is idempotent | **Deferred** | No backend (M5). |
| AT-11 | Network drops after download | **Deferred** | No service worker, so there is no offline claim to test (M3). |
| AT-12 | Cross-tenant asset access denied | **Deferred** | No backend (M5). |
| AT-13 | Photo deletion and expiry | **Deferred** | No photos stored (M5). |
| AT-14 | Storage full during autosave | **Partial, not verified** | `StorageFullError` is a distinct type and the UI shows a recovery message; the single-transaction write means a failure cannot corrupt the previous checkpoint (`round-trip.test.ts` proves an aborted save leaves nothing behind). **A genuinely full device was never tested.** |
| AT-15 | Auto-next waits for pen-up plus a pause | **Deferred** | FR-10 not built (M3). |
| AT-16 | Pencil with the palm resting on the glass | **Device — unverified** | Needs a real iPad + Apple Pencil and an Android tablet + active stylus. Nothing here can establish it. |
| AT-17 | Fast, short, repeated strokes; pointercancel; fps and p95 latency | **Partly structural, mostly Device — unverified** | The single-active-pointer rule and cancel handling are covered in `DrawingPad.test.tsx` and `artwork-surface.test.ts`, and a `Profiler` test shows forty pointermove samples cost zero React commits — so the *logic* that could produce a connecting line or a stall is tested. **fps and p95 latency are not measured and must be on real hardware.** |
| AT-18 | No-pressure input and capacitive stylus | **Device — unverified** | Width is preset-driven with no pressure dependency, and a capacitive stylus reports as `touch` so finger mode covers it — but this has not been tried on a device. |
| AT-19 | Cold launch of the installed PWA offline | **Deferred** | No service worker (M3). |
| AT-20 | Project export, clear site data, import | **Deferred** | FR-24 not built (M3). |
| AT-21 | App update during a live session | **Deferred** | FR-25 update flow not built (M3). |
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
| Storage eviction and a genuinely full device | AT-14 | Browser quota policy under real pressure. |

Suggested next action, from PRD section 20 item 1: choose the two pilot devices,
record model, OS and browser versions, then run AT-01..AT-07, AT-14 and
AT-16..AT-22 on both and record the results per device.

## 6. Follow-up work this milestone deliberately left out

Noted here rather than built, per the scope given:

1. **Automatic step completion** (FR-10, AT-15) — the policy field exists and is
   off everywhere.
2. **Service worker, offline packaging, cold offline launch** (FR-23, AT-19).
3. **Project backup export/import** (FR-24, AT-20) — the stroke log and
   checkpoint are already a complete, serialisable project.
4. **Local gallery** (FR-14 gallery half) — the picture-choosing screen
   (`src/ui/LessonPicker.tsx`) reads `BUNDLED_LESSONS`; a gallery of past
   artworks is what is missing.
5. **Audio instructions** (FR-20).
6. **Free-creation phase** (FR-12) and "repeat this step" / "start over"
   (PRD section 7 edit behaviours).
7. **Update flow and data migration** (FR-25, AT-21) — versions are checked and
   refused, but nothing migrates yet.
8. **Parent area and privacy controls** (FR-19) — nothing to govern until photos
   or a backend exist.
9. **Photo pipeline and backend** (FR-15..FR-18, FR-21; AT-08..AT-13).
10. **Lesson authoring tooling** — the data format is deliberately plain so an
    authoring step or the photo pipeline can emit it, but no authoring tool is
    part of this milestone.
