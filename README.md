# DrawSprout

A tablet-first web app that teaches a child to draw, one small step at a time.

This repository has two hand-authored lessons: "Kucing Duduk" (a sitting cat)
and "Bunga Ceria" (a smiling flower). Each can be played from the first line to
a saved PNG, with autosave and resume and an export containing only the child's
drawing.

- Product requirements: [`docs/PRD_Aplikasi_Belajar_Menggambar_Anak.md`](docs/PRD_Aplikasi_Belajar_Menggambar_Anak.md)
- Requirement and acceptance-test mapping: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- Technical choices and assumptions: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## What works today

- A picture-choosing screen ("Mau gambar apa hari ini?") listing every bundled
  lesson with its preview. Choosing a picture opens it straight away and
  reopens that picture's latest saved drawing; leaving a drawing returns to the
  screen without waiting on storage.
- Canvas drawing with Pointer Events, pen / brush / eraser, undo and redo.
- **Pencil mode** (stylus only) and **finger mode**, switchable at any time
  without losing the drawing.
- Three assistance levels: dashed guides always visible, guides that fade after
  3/5/10 seconds, or example-in-the-panel only — plus a "show the hint" button
  that is always available.
- Tool, colour and pen width prepared per step — each step starts with its own
  tool — with a free colour choice that sticks until the child asks for the
  guide colour back.
- A colouring phase with an **optional** boundary assist the child can switch
  off. The example panel builds up colour across steps: fur appears brown first
  while the inner ears and nose stay blank; the next step adds pink to those
  parts. An outline marks only the current step's regions. These colours are
  suggestions — the child can still pick another colour.
- Autosave and resume through IndexedDB, per picture.
- After finishing, *Gambar lagi* asks whether to keep the current drawing or
  clear it and start again from the first step.
- PNG export of the artwork alone — no guides, no example illustration.

## What does not work yet

- **No offline support.** A web app manifest ships so the app can be added to the
  Home Screen, but there is no service worker.
- No photo-to-lesson transformation, no backend, no accounts, no cloud sync.
- No automatic "step finished" detection — the child presses *Lanjut*.
- No gallery, project backup file, or audio.

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) §6 for the full
follow-up list.

## Requirements

- Node.js 22.12+ (developed on 22.22). Vite 7 would also accept 20.19+, but
  Vitest 5 requires 22.12 or newer, so the test suite sets the floor.
- npm 10+

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The dev server prints a `Local:` and a `Network:` URL. Use the **Network** URL to
open the app on a tablet on the same Wi-Fi — that is the only way to try the
drawing experience as intended.

Production build and a local preview of it:

```bash
npm run build
npm run preview
```

The build output lands in `dist/` and is a static site; any static host will
serve it.

## Test

```bash
npm test          # run the suite once
npm run test:watch
npm run lint
npm run typecheck
```

`npm run build` runs the type check before bundling, so a type error fails the
build.

All four run in GitHub Actions on every push to `main` and on every pull
request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)), each as its
own job so one failure still shows the state of the rest.

### What the tests cover

| Area | File |
| --- | --- |
| Lesson package validation and the authored lessons | `src/lesson-data/validate.test.ts` |
| Step navigation, state machine, tool presets, colour preference | `src/lesson-engine/session.test.ts` |
| Undo / redo, redo invalidation, step-scoped history | `src/lesson-engine/history.test.ts` |
| IndexedDB round trip, transaction atomicity, resume | `src/persistence/round-trip.test.ts` |
| Layers, union clipping, live-stroke painting, resize replay | `src/renderer/artwork-surface.test.ts` |
| Export containing artwork only | `src/renderer/export.test.ts` |
| Coordinate mapping across sizes and orientations | `src/renderer/coordinates.test.ts` |
| Pencil / finger input filter | `src/input/pointer-mode.test.ts` |
| The picker, leaving and reopening a picture, resume notices | `src/App.test.tsx` |
| The drawing screen at component level | `src/ui/DrawingPad.test.tsx` |

### Testing by hand on a tablet

1. `npm run dev`, then open the **Network** URL on the tablet and choose the
   cat picture.
2. Draw step 1 with a finger. In the *Bantuan* tab, switch to pencil mode and confirm a finger no
   longer draws while the stylus does.
3. Walk all nine steps with *Lanjut*, colour the cat, press *Selesai ✓*, then
   *Simpan gambar (PNG)* and confirm the saved file has no dashed guides.
4. Close the tab, reopen it, and confirm the drawing and the step come back.

**What this does not prove.** Apple Pencil behaviour, palm rejection, frame rate
and input latency cannot be judged from a desktop browser, and none of them have
been measured. Acceptance tests AT-16, AT-17, AT-18 and AT-22, plus the rendering
targets in PRD section 13, are open and need a real iPad with an Apple Pencil and
a real Android tablet with an active stylus. Nothing in this repository should be
read as a device test result.

## Project layout

The four layers are kept separate so each can evolve — or be replaced — on its
own (PRD section 11).

```
src/
  lesson-data/    Versioned lesson packages and their validator. Plain data:
                  no DOM, no engine, no storage.
  lesson-engine/  Session reducer and selectors: navigation, state machine,
                  undo/redo, tool presets. Pure; no DOM, no canvas, no storage.
  renderer/       Canvas layers, coordinate mapping, stroke painting, PNG
                  export. Knows geometry and paint, not lessons.
  persistence/    `SessionStore` interface, IndexedDB implementation, in-memory
                  implementation. No IndexedDB type crosses the interface.
  input/          Pointer Events handling and the pencil/finger filter.
  ui/             React components, and the one adapter that translates engine
                  concepts into renderer concepts.
  test/           Fixtures and environment shims.
```

Adding a lesson is a data change in `src/lesson-data/` plus an entry in
`BUNDLED_LESSONS`.

## A note on language

The interface is in Indonesian; the code and documentation are in English.
