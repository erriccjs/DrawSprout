# Technical decisions and assumptions

Decisions taken while building milestone 1, with the reason for each. Where the
PRD left something open, that is called out explicitly.

Context: [`PRD_Aplikasi_Belajar_Menggambar_Anak.md`](./PRD_Aplikasi_Belajar_Menggambar_Anak.md)
v1.1. Scope: [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

## Build and language

### D-01 — Vite as the build tool

PRD section 11 fixes React + TypeScript as the UI baseline but leaves build
tooling to implementation. Vite was chosen: it is the default for a React + TS
SPA, its dev server is reachable on the LAN with one flag (which matters, since
every real check has to happen on a tablet on the same network), and Vitest
reuses the same config and transform pipeline so tests need no second toolchain.

### D-02 — Strict TypeScript, including `noUncheckedIndexedAccess`

The app indexes into step and stroke arrays constantly. `strict` plus
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` turns "step 10 of a
9-step lesson" into a compile error instead of a blank screen in front of a
child.

### D-03 — Dependencies kept to React and React DOM

No state library, no canvas library, no IndexedDB wrapper. PRD section 19 says a
drawing library should be chosen *after* an input spike on real devices, so
committing to one now would prejudge that. `npm audit` reports 0 vulnerabilities.

## Architecture

### D-04 — Four separated layers

The ask requires lesson data, lesson engine, renderer and persistence to be
separable. The boundaries actually enforced:

| Layer | Directory | May import | Must not know about |
| --- | --- | --- | --- |
| Lesson data | `src/lesson-data/` | nothing | engine, renderer, storage, DOM |
| Lesson engine | `src/lesson-engine/` | lesson data | DOM, canvas, IndexedDB |
| Renderer | `src/renderer/` | nothing but its own types | steps, assistance, completion, lessons |
| Persistence | `src/persistence/` | engine *types* only | React, canvas |
| UI | `src/ui/`, `src/input/` | all of the above | — |

`src/ui/render-adapter.ts` is the only place engine concepts are translated into
renderer concepts, and `src/ui/DrawingPad.tsx` is the only file that knows about
more than one layer. The renderer receives clip paths as an opaque
`Record<id, pathData>`, so it has no idea the ids describe cat fur.

### D-05 — Lesson data is plain versioned data

`LessonPackage` carries `schemaVersion` (the shape) and `contentVersion` (this
lesson's geometry). Lessons are authored as data in `src/lesson-data/`, so the
future authoring step or the photo pipeline in PRD section 11 can emit the same
JSON without the app changing. `BUNDLED_LESSONS` is the list the picker reads;
adding a lesson is a data addition.

### D-06 — The engine is a pure reducer

`reduceSession(lesson, state, action)` is total and side-effect free. Every rule
the PRD cares about — redo invalidation, a colour preference outliving a step,
input-mode switching not resetting artwork — is one testable function rather
than behaviour spread across components. This is also what makes PRD section 11's
"reusable if we go native" claim concrete.

## Drawing and rendering

### D-07 — Fixed 1000×750 coordinate space, widths in the same units

PRD section 12 allows either normalised coordinates or a fixed viewBox. A fixed
viewBox was chosen because authored path data (`d` strings) is readable and
hand-editable in it, and because stroke widths then have an obvious unit.
4:3 landscape matches both target tablets. Resize, rotation and pixel-ratio
changes only alter the viewport transform; stored geometry never moves (AT-06).

### D-08 — Two offscreen layers (colour under ink), composited to one visible canvas

PRD section 9 requires child strokes and colour to be stored separately. Keeping
them as two offscreen canvases means the outline stays readable over paint, and
an eraser in a colouring step takes back paint without touching the lines.

### D-09 — A pointermove costs one segment draw and one composite, never a React render

PRD section 11 forbids depending on a React re-render per pointermove. The live
stroke is baked into its layer one segment at a time; the visible canvas is
refreshed with two `drawImage` calls coalesced into one `requestAnimationFrame`.
React state is only touched when the pointer lifts and the finished stroke is
committed. Cost per move is therefore independent of stroke length.

**Assumption, unverified:** that this is fast enough for the 60 fps / p95 ≤50 ms
targets in PRD section 13. Those are design targets and have not been measured
on any device.

### D-10 — After a committed stroke, the layers are repainted from the session

Rather than tracking which pixels belong to which stroke, every committed change
replays the whole stroke log. It happens once per pointer-up (not per move), it
makes undo of a stroke in the middle of the log correct for free, and it
guarantees the pixels can never drift from the stored state.

### D-11 — Light smoothing through sample midpoints

The path runs through the midpoints between samples with each sample as the
quadratic control point. It takes the jitter off raw pointer data without moving
the line away from where the child drew — PRD section 9.8 forbids quietly
improving the child's shapes.

### D-12 — Union clipping by drawing once per region, not by building a union path

Canvas `clip()` intersects, and a multi-sub-path `Path2D` with `nonzero` winding
only unions if every sub-path is wound the same way — fragile to get right by
hand and silently wrong when it isn't. Instead a clipped stroke is drawn once per
region. With opaque paint and round caps, a twice-drawn overlap is pixel-identical
to one pass.

**Consequence, accepted:** semi-transparent paint would darken where regions
overlap. Milestone 1 ships only opaque colours. If translucent paint is ever
added, this must become a mask composite.

### D-13 — Guides are SVG, not canvas

PRD section 11 asks for a separate guide overlay but does not say what it is made
of. Rendering guides as an SVG element layered over the canvas makes FR-06's
"guides are not exported" **structural**: they are not in any canvas, so no
export path can read them, and `ExportOptions` has no field a guide could arrive
in. It also keeps dashes crisp at any zoom and costs nothing per frame, because
guides change only on a step or assistance change.

### D-14 — Backing stores capped at device pixel ratio 2

A 3x tablet would allocate 2.25× the pixels for no visible gain on line art.
PRD section 13 prioritises 60 fps on the pilot devices. **Assumption, unverified:**
that 2× is visually sufficient on the chosen pilot hardware.

### D-15 — `touch-action: none` on the canvas only

PRD section 11 is explicit that page-level accessibility gestures must not be
disabled. Only the canvas surface opts out of browser gestures; the viewport
meta tag does not lock scaling, and the rest of the page scrolls and zooms
normally.

## Input

### D-16 — Pencil mode is `pen` only; finger mode is `touch` and `mouse`

FR-22 as written. Mouse is accepted in finger mode so a desktop browser can run
the whole flow for QA (PRD section 21 lists desktop as basic QA). Finger mode is
the default, because PRD section 10 says a stylus is not required.

**This is an input filter, not palm rejection, and the product must not claim
otherwise.** A palm that the digitiser reports as `touch` simply does not draw in
pencil mode; whether the OS or the panel suppresses it at all is AT-16 and needs
a real tablet.

### D-17 — Exactly one active stroke pointer

PRD section 11. A second finger or a palm landing mid-stroke is ignored outright
rather than starting a second line or stealing the first.

### D-18 — A cancelled pointer keeps the ink it already produced

`pointercancel` and `lostpointercapture` end the stroke exactly like a lift, and
what was drawn is committed. AT-17 forbids a *connecting line* when input
returns, not the partial stroke itself; discarding the ink would also mean a
child losing work to an OS interruption. Because the live stroke is always
cleared on end, the next pointer-down cannot be joined to it.

### D-19 — Pointer capture is attempted but not required

`setPointerCapture` can throw when the pointer is already gone. Capture only
matters for a stroke that wanders off the canvas, so a failure is swallowed and
drawing continues rather than the stroke being refused.

### D-20 — Coalesced events are used when available

`getCoalescedEvents()` recovers every digitiser sample between frames, which
matters for fast strokes on a high-rate pen. Treated strictly as an optimisation,
with the event itself used when it is unavailable (PRD section 11).

## Lesson content

### D-21 — Seven line steps plus two colour steps

PRD section 5 and section 20 item 2 ask for 6–8 shape/detail steps plus a colour
phase. The cat is: head → ears → body → paws → tail → eyes and nose → mouth and
whiskers, then fur, then inner ears and nose. Three `outline` steps before four
`detail` steps follows PRD section 9.1 (big shapes first). Each step has one
speakable goal.

### D-22 — Colour regions are one closed sub-path each

Because clipping unions per region (D-12), a region never has to describe more
than one simple shape and winding direction never matters. Fur is therefore
seven regions (head, two ears, body, two paws, tail) that a single colour step
unions.

### D-23 — Lesson path data is validated against an allow-list

PRD section 13 permits only a geometry subset and forbids script, external URLs
or active markup from lesson content; PRD section 14 says an invalid path must
stop the package opening. `validate.ts` enforces the SVG path command subset and
refuses the package rather than rendering it partially. This matters more later
than now — today's lessons are local literals, but the photo pipeline is
meant to generate these.

### D-24 — Manual advance only

`completionPolicy.automaticEnabled` is `false` everywhere. FR-10 is P1 and PRD
section 19 says manual should be the default until auto-advance is validated with
children. The field exists so turning it on later is a data change.

## History

### D-25 — Undo and redo are scoped to the active step

Undo takes back the last stroke *of the step the child is looking at*. A global
undo would let a child who went back to step 2 silently delete their step 7 work,
which FR-09 and PRD section 7 exist to prevent. Changing step clears the redo
stack, so redo can never resurrect a stroke the child cannot see.

### D-26 — An erase is a stroke

The eraser writes a `destination-out` stroke into the active layer. Undo is then
uniform over one list, and FR-02's "undo restores deletions" is free rather than
a special case.

### D-27 — History is unbounded

FR-02 asks for at least 50 undoable operations. The strokes *are* the artwork, so
dropping old ones to cap memory would destroy work. A typical lesson is tens of
strokes.

## Persistence

### D-28 — Append-only stroke log plus a checkpoint, in one transaction

FR-13 asks for finished strokes and checkpoints through IndexedDB transactions.
The log is append-only and keyed by `[sessionId, strokeId]`; the checkpoint holds
the ordered stroke ids plus the undone ones. Restoring is "replay the log in the
order the checkpoint remembers", so an undone stroke can never come back as
artwork, and redo survives a reload. Both stores are written in a single
transaction, so a failure leaves the previous valid checkpoint intact (AT-14) and
a checkpoint can never name strokes the log does not have.

### D-29 — Strokes save immediately, other changes every 2 s

PRD section 13: commit after a finished stroke; checkpoint at most every two
seconds while active. A flush on `visibilitychange` is best effort only — the
same section says not to rely on `beforeunload` or background execution.

### D-30 — Re-saving an existing stroke uses `put`, not `add`

A retried save must not abort the transaction and take the checkpoint down with
it. Stroke ids are stable, so `put` is idempotent.

### D-31 — The store interface leaks no IndexedDB types

`SessionStore` mentions only engine types. `MemorySessionStore` implements the
same interface for tests and as the fallback when IndexedDB is unavailable — and
that fallback reports `durable: false`, so the UI warns rather than pretending
the work is saved.

### D-32 — A checkpoint from an unknown schema version is refused

PRD section 13 "Integritas". A stroke id with no log entry is also refused:
better to start a clean session than to restore artwork with holes in it.

### D-33 — A changed `contentVersion` starts a fresh session

If the lesson geometry moved, old strokes no longer line up with the guides. M1
starts a new session and says so in the UI. Real migration is FR-25 work.

## Export

### D-34 — The export signature is the guarantee

`exportArtworkPng({ space, strokes, clipPaths })` — there is no parameter a
guide, a hint or the target illustration could arrive in. Combined with guides
being SVG (D-13), FR-06/FR-14/AT-01 hold structurally rather than by remembering
to exclude something.

### D-35 — 2000 px wide, white background

Wide enough to print or share, not wasteful on a tablet. White because the PNG is
paper; the preview on the finish screen is produced by the same function, so what
the child sees is what is saved.

### D-36 — Download, with no promise about where the file lands

PRD section 11 forbids promising automatic saving to Photos. The UI says the
browser and the system decide.

## PWA

### D-37 — Manifest now, service worker later

A manifest ships so the lesson can be added to the Home Screen, which is the part
of "web/PWA" the first milestone needs. **There is no service worker, so the app
is not offline-capable** and nothing in the UI claims it is. FR-23 and AT-19 are
M3.

### D-38 — Persistent storage is requested, never assumed

`navigator.storage.persist()` is called once at startup and nothing waits on the
answer, per PRD section 13.

## Accessibility and UX

### D-39 — 48 px minimum touch targets, state never signalled by colour alone

PRD section 10. Pressed controls carry a thicker border and a checkmark as well
as a fill, so the state survives a colour-vision difference. Landscape is the
primary layout; portrait stacks rather than shrinking the canvas away.

### D-40 — Indonesian UI copy

PRD section 3 proposes Bahasa Indonesia first. No i18n framework was added for a
single-locale prototype; strings are inline.

### D-41 — No wording that judges the drawing

PRD section 9.5. Navigation never mentions similarity, the finish screen says the
drawing is the child's own, and a refused pointer explains the input mode instead
of implying a mistake.

## Testing

### D-42 — Unit and component level only

No end-to-end harness, as instructed. The component tests mount `DrawingPad` with
an in-memory store and drive it with synthetic pointer events, which covers the
whole slice without a browser driver.

### D-43 — Real IndexedDB semantics in tests via `fake-indexeddb`

The round trip exercises actual transactions, compound keys and index cursors, so
the transaction-boundary bug class is caught in CI rather than on a tablet.

### D-44 — A recording canvas instead of a rasteriser

jsdom has no 2D context. Recording the draw calls allows a stronger assertion
than pixels would: *which geometry the renderer was asked to draw at all*. That
is how "no guide reaches the export" is tested directly.

### D-45 — Browser checks are labelled as simulations

A Chrome DevTools pass confirmed the app boots, draws, autosaves and resumes.
That is browser emulation. It is never reported as a device test, and every
device-dependent acceptance test is listed as unverified in the plan.
