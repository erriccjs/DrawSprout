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

### D-03 — Runtime dependencies kept to React and React DOM

No state library, no canvas library, no IndexedDB wrapper. PRD section 19 says a
drawing library should be chosen *after* an input spike on real devices, so
committing to one now would prejudge that. The service worker is bundled with
esbuild, which Vite already required; it is a devDependency, not a runtime one
(D-46). `npm audit` reports 0 vulnerabilities.

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

"Hapus semua" is the one exception: it is not a stroke. The session keeps each
cleared drawing whole in `clearedArtworks` (stacked, so a later clear never
buries an earlier one), and `undo` restores the most recent one only while the
canvas is empty, so two drawings are never laid over each other. It is held in
the session only; the checkpoint shape is unchanged, so a reload cannot undo a
clear.

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

### D-37 — Manifest ships with the shell

A manifest ships so the lesson can be added to the Home Screen. The icon is the
same SVG the document already used. Whether a given browser accepts an SVG icon
for installation has not been checked on a device. The service worker that makes
the shell available offline is D-46.

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

### D-46 — Hand-written service worker, bundled with esbuild

FR-23 needs the installed app, and an ordinary browser tab, to cold-launch and
run the bundled lessons with no network after the first visit. FR-25, the update
half, needs a new version to wait until the child is back on the
picture-choosing screen.

**Choice.** A small service worker in `src/offline/service-worker.ts`, bundled to
`dist/sw.js` by esbuild at the end of `vite build`. The manifest is the list of
files Vite just wrote, minus the worker itself, each with a SHA-256. Install
downloads every file, checks the hash, and only then writes the cache. The page
shows *Bisa dibuka tanpa internet* only when the active worker reports every
bundled lesson at the content version the running page was built with.

Workbox and `vite-plugin-pwa` were the other option. They were not used:

- A runtime dependency would have broken D-03. Workbox's precache runtime would
  ship to the tablet.
- Today's offline set is the app shell. Lessons are compiled into the JavaScript
  bundle; there is no API and no photo package to cache at runtime.
- The update rule is the product rule: do not take over while a drawing is open.
  Workbox recipes often call `skipWaiting` during install. That is the behaviour
  the gate exists to prevent. A short worker makes the forbidden path obvious
  and unit-testable.

**Trade-off, accepted.** We own cache cleanup, the navigation fallback, and the
checksum loop. We do not get Workbox's navigation preload or its runtime caching
strategies. If a later milestone downloads lesson packages at runtime, those
belong in a separate cache with their own validation, not in this precache.

**Update flow.** Install never activates over an open page. The new worker waits.
The page offers it only on the picture-choosing screen, after any save started
on the way there has settled, and only after someone taps *Muat versi baru*.
*Nanti saja* hides the prompt until the next visit to that screen. The reload
happens when the worker we asked for takes control — a first install also claims
the page, and that claim must not reload, so a reload is tied to the explicit
request. A waiting worker is ignored unless a controller is already in place,
because the first install can report `waiting` for a moment before anything
controls the page.

**Drawings survive an update because the worker never opens IndexedDB.** Cache
deletion is limited to names with the precache prefix. The worker source is
tested to contain no `indexedDB`, `localStorage`, or `deleteDatabase`. This is a
structural guarantee in the repository, not a measurement of browser eviction.
D-38 is unchanged: persistent storage is still requested and never assumed.

**Dev server.** The worker is registered only in a production build. A cached
shell in `npm run dev` would hide the edit that was just saved. `npm run preview`
is the local way to exercise it.

**Assumption.** The app is served from the origin root, matching `start_url` and
the worker scope. A subpath deploy is not supported.

**Checked on this machine, not a device result.** On 20 October 2026, headless
Chrome loaded `npm run preview` once online, then opened a new tab with the
network disabled. The navigation was served by the worker (HTTP 200), the
picture-choosing screen showed the offline-ready line and no update prompt, and
the cat lesson opened at step 1 with *Tersimpan*. That is a desktop simulation.
It is not AT-19.

### D-47 — Phones get their own layout tier; tablets keep the measured one

The tablet rules (a 320px side column, a 548px column below 620px of height,
and a colour column sized for five 48px swatches) make a phone unusable. On a
375×667 portrait the canvas collapsed to 1×1, and on a 667×375 landscape the
548px column left an 83×62 canvas. Those viewports were measured in headless
Chrome, not on a device.

`layoutTier()` in `src/ui/layout-tier.ts` classifies the viewport and the shell
sets `data-layout`. Portrait phones are at most 599px wide, just under the
600×960 tablet row. Phone landscape is at most 480px tall and 940px wide, so
1024×430 and 960×600 stay on the tablet rules. The phone CSS is gated on that
attribute and was rechecked against the tablet table in
[`TABLET_LAYOUT_FIT.md`](./TABLET_LAYOUT_FIT.md); the recorded canvas sizes did
not move.

On a phone the dock is capped and scrolls inside itself, the page does not
scroll, and `overscroll-behavior: none` is set on the document so a stroke is
not a pull-to-refresh. The canvas still has the only `touch-action: none`.
Swatches that do not fit scroll sideways and stay 48px. The shell padding uses
`env(safe-area-inset-*)`. Headless Chrome reported 0 for those insets, so a
notch was not verified.

Phone landscape is short, so the example and the dock share a rail no wider
than 320px and the canvas takes the height. The step hint and the colour
readout are visually hidden there; both stay in the accessibility tree, and
the instruction plus the pressed swatch and "Ikuti panduan" checkmark remain
visible. The back control shows the arrow. Tool buttons are icons. None of
that applies to the tablet layout. The 1000×750 space is unchanged: a
phone-sized stage is still a uniform scale (`fitViewport`).

The picture-choosing screen's offline-ready line and update prompt (D-46) sit
in this same shell. On a phone they stay inside the scrolling picker: the two
actions stack full width in portrait and sit side by side in landscape, and
each stays a 48px target. "Hapus semua" (the eraser's whole-drawing clear)
keeps its own row in the phone tool group instead of being squeezed into a
48px tool chip.

### D-48 — Deploy the Vite build as static assets, with no Worker script

The live Worker is `drawsprout`, on `drawsprout.erriccjs.cloud`, deployed by
Workers Builds (`npm run build`, then `npx wrangler deploy`, root `/`, branch
`main`). The first build had no Wrangler config. `wrangler deploy` then
auto-configures a detected Vite app: it writes config and injects
`@cloudflare/vite-plugin` into `vite.config.ts`
([automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/)).
That plugin collects assets during the Vite build. `drawsproutOffline()` (D-46)
writes `dist/sw.js` in `closeBundle`, after that collection, so the upload did
not contain the worker. On the live site `/sw.js` is the single-page fallback,
`index.html`.

**Choice.** Commit `wrangler.jsonc` and depend on Wrangler 4 (`^4`, locked by
`package-lock.json`). A config file on disk is what skips automatic
configuration, so Workers Builds can keep the same two commands and the locked
CLI uploads the directory `npm run build` already produced. `vite.config.ts` is
not an input to deploy.

The file is assets only:

- `name` is `drawsprout`, the existing Worker.
- `compatibility_date` is `2026-10-19`, the date already on the deployed
  Worker. Docs tell a brand-new Worker to use today's date (`2026-10-20`).
  This Worker is not new, and an assets-only deploy has no runtime that needs
  the newer date, so the date stays. Node.js compatibility is already the
  default for dates on or after `2026-08-04`, so `compatibility_flags` is
  omitted.
- `observability.enabled` is `true`, and `observability.traces.enabled` is
  `true`. In Wrangler 4.151 the top-level flag turns logs on and leaves traces
  off. The deployed Worker currently has traces off; this turns them on.
- No `main`, and no assets binding. A binding is only valid alongside a script.
- `assets.directory` is `./dist`. `assets.not_found_handling` is
  `single-page-application`.
- `previews` is `{}`. Workers Builds runs `npx wrangler preview` for a branch,
  and that command exits unless the block is present. An empty object is
  enough. Production `wrangler deploy` does not read it.

Routing follows the static-assets decision diagram: a request that matches a
file is served as that file, and only a miss is rewritten to `/index.html`.
`/sw.js` is a file in `dist/`, so the fallback does not replace it. Wrangler
sets `Content-Type` from the extension at upload, so the response is
JavaScript. `routes` is omitted. Wrangler publishes custom domains only when
the config lists them, so `drawsprout.erriccjs.cloud` is left in place.
`workers_dev` is also omitted. With no routes, Wrangler defaults it to
enabled, which is already the deployed setting, including Preview URLs.

`public/_headers` sets `Cache-Control: no-cache` on `/sw.js` and
`/manifest.webmanifest`. Both URLs are stable: the script is not content-hashed,
and the manifest is the Home Screen metadata (D-37). Hashed files under
`/assets/` keep the platform default (`public, max-age=0, must-revalidate`).
Registration already uses `updateViaCache: 'none'` (D-46). The header is what a
browser or shared cache sees on the fetch itself. Lines starting with `#` are
comments in the Workers `_headers` parser.

`_headers` and `_redirects` are not served assets. `shouldPrecache` skips both.
If install fetched `/_headers`, the single-page fallback would return
`index.html`, the checksum would fail, and the shell would never report itself
ready.

`.wrangler/` is gitignored. It is local dev state.

**Not done.** Checked with `wrangler deploy --dry-run` and a local `wrangler dev`
of the built `dist/`. Not deployed. The live `/sw.js` response stays HTML until
Workers Builds deploys this config.

### D-49 — The drawing screen is full-bleed

The measured column layout (D-47) reserved a side dock for tools, colours,
width chips, and the step panel. On a tablet that dock was the thing that made
the paper smaller than the window.

**Choice.** The fitted 4:3 paper fills the stage. Controls float on top of it,
at the edges, and the overlay ignores pointers except on the controls
themselves, so a stroke can start in the gaps. The shell drops its padding
while the drawing is open, including the phone safe-area padding; those insets
move onto the floating controls. `touch-action: none` stays on the canvas only.

The column measurements in [`TABLET_LAYOUT_FIT.md`](./TABLET_LAYOUT_FIT.md)
describe the layout this replaces. They are not the sizes of the full-bleed
paper.

The paper is fitted into the band under the step reference and above *Lanjut*,
so those bars do not cover the guides (D-53). On a phone the paper is still
the largest 4:3 that fits the width. The brush slider and the tool row sit
beside that band, or in the margin under a short phone paper, and *Bantuan*
is a `?` icon so the word cannot spill past the screen edge.

### D-50 — Brush size is a slider; colour is one circle

The row of width chips and the row of swatches took a band of the old dock.
A child still needs a large target and the per-step preset (FR-03, FR-04).

**Choice.** A vertical range sits on the left edge. Its steps are a fraction of
the step's preset width, from 0.4× to 2.5×, so the preset and the eraser's
double width land on a step. Returning the thumb to that default clears the
custom width, which is the same engine action as before. A new step still
clears a custom width.

The column also shows what the slider is for (D-61): a live dot in the
current colour, sized with the thumb, and a thick mark at the top of the
track with a thin mark at the bottom. The column stays 64px on a tablet and
52px on a portrait phone.

The active colour is a circle. It opens a compact palette plus up to five
recently used colours. Recent colours are component state. They are not saved
in the session. *Ikuti panduan* still switches back to the guide colour. The
popover stays in the document when it is closed, hidden by CSS, so a control
inside it can be reached without a second click in tests. The phone orb is
52px; the tablet orb is 64px.

### D-51 — Two-finger tap undoes, three-finger tap redoes

The undo and redo buttons stay. A tap gesture is an extra way to reach them.

**Choice.** A pure tracker (`src/input/gesture-tracker.ts`) classifies the
pointers. A tap is at most 320ms and 24px of travel, and the fingers must come
down within 180ms of each other. Movement past 36px is a pinch, not a tap.
Two fingers undo. Three redo.

In finger mode a second finger discards the stroke that is in progress, then
replays the committed ink. The discard does not go through React state. A
pinch therefore leaves no dot, and a two-finger tap leaves no connecting line.
The cost is that a long stroke is lost if another finger lands. Palm rejection
is still not claimed (D-16).

In pencil mode a finger never draws and never ends the stylus stroke. It can
undo or redo while the pen is down. An extra pen during a pen stroke is
ignored. A cancelled single pointer still commits the ink already drawn (D-18).
The discard rule applies only to a finger-mode multi-touch gesture.

### D-52 — Pinch zoom and two-finger pan are a view, not new geometry

Stored points stay in the 1000×750 lesson space (D-07). Export replays that
space at a fixed pixel width and does not read the view (D-34, D-35).

**Choice.** Zoom and pan are `translate` then `scale` on `.stage__frame`,
origin at the center, with no rotation. Zoom is clamped from 1 to 4. At zoom 1
the pan is zero, so *Sesuai layar* is one state. The backing store stays at
the fitted size (D-14 still caps DPR at 2), so strokes can look soft past
about 2×. Guides are SVG inside the same frame, so they scale with the paper
and stay aligned. Colour-region clipping uses lesson coordinates, so it is
unchanged by the view.

Pointer mapping in the browser is `getBoundingClientRect`, which includes the
transform. `stagePointToSpace` uses the same rectangle the transform produces.
A pinch does not set React state on each move. The view is committed when the
fingers lift. A pinch is not emitted while a pen stroke is in progress, so
the paper does not jump under the stylus.

### D-53 — The step card folds, and finishing plays a small decoration

The instruction, the example, and *Lanjut* used to share one card. A hand
resting on the lower part of a tablet covers that card while the child is
drawing, which is when they need the instruction.

**Choice.** The instruction and the step dots sit at the top, under the
header, on every layout. *Lanjut* and *Kembali* stay on the bottom edge, and
*Lanjut* stays the large button. Advancing is one deliberate tap at the end
of a step, and the hand is already down there, so the tap does not reach
across the paper or hide the instruction. The paper is fitted into the band
between those two bars (`drawingChrome` in `src/ui/drawing-chrome.ts`), so
the guides are not under the card. The target picture is its own control,
not part of this card (D-61). Collapsing hides the instruction. The dots
stay, and the step count stays available to assistive tech.

The finish screen adds three decorative dots above the existing title. They
animate only when `prefers-reduced-motion` is not reduce. The decoration is
`aria-hidden` and does not judge the drawing (D-41).

On a phone the reference starts folded: dots and the expand control. The
instruction comes back when the child opens it. *Lanjut*
stays on the bottom edge either way. A tablet still starts with the reference
open. The phone note, when it is showing, sits between the header and that
reference so the two do not pile on top of each other.

### D-54 — A phone says a tablet is more comfortable, once

Phones remain usable (D-47). They are not the layout this redesign is built
around.

**Choice.** When `layoutTier()` is a phone and the visitor has not dismissed
the note, the shell shows "DrawSprout paling nyaman di tablet." with
"Di HP tetap bisa menggambar." and *Mengerti*. Dismissal is
`localStorage` key `drawsprout.prefer-tablet.dismissed`. It is not a field of
the session checkpoint and it is not read by the service worker (D-46). A
blocked store fails quietly and the note can appear again. A tablet never
shows it.

### D-55 — Pencil and finger mode are on the toolbar

Switching mode used to mean opening the help sheet. On a tablet that control
was easy to miss, and a child who draws with a finger had no visible way to
say so.

**Choice.** The toolbar has its own rounded box for the mode. Inside it are
two icon buttons, a pencil (*Pensil*) and a hand (*Jari*). The pressed one
is the current mode. One tap switches, and the switch is still
`set-input-mode`, so the preference is saved as before. The names are the
accessible name and the tooltip. They are not drawn as labels, because a
label made the dock wider than the tool buttons.

When the dock is a column (tablet, and phone landscape), the icons stack and
the box is 56px wide, the same as one tool button. On a portrait phone the
toolbar is a row, so the icons sit side by side in a box the width of two
tool buttons, on its own line under that row. Measured against main before
this change, the dock stays 70px wide on a tablet and 310px on a 390px-wide
phone, and the toolbar panel stays 70px and 262px. The help sheet still
explains the modes. It is not the only place the mode can be changed.

The pressed mode button and the pressed tool button are the accent fill and
the border. A check glyph crowded those icons, so the dock does not draw one
(D-60). Text buttons outside that dock can still use the check (D-39).

### D-56 — Continuing a saved drawing is a toast

The sentence "Karya terakhirmu dilanjutkan dari tempat kamu berhenti." was a
banner that stayed on the drawing screen.

**Choice.** That sentence is a small toast. It removes itself after 3 seconds.
It is not a dialog, and a stroke can start while it is visible. The saved
drawing is already on the page, so continuing does not need a tap. *Mulai
ulang* on the toast starts the lesson over: the session is deleted and
`restart` runs, the same fresh start the finish screen uses. A load failure,
a full disk, and a lesson whose content version changed stay banners, because
those are warnings rather than "you are already continuing".

On a portrait phone the toast sits below the tools and above *Lanjut*. It
does not cover the mode box, the sheet, or the other tools (D-60).

### D-57 — Finger mode avoids the screen edge; a page cannot stop Android gestures

On a real Android tablet, a hand resting or drawing at the edge of the screen
in finger mode fires system navigation: back, home, the app switcher, or the
notification shade. The app then closes or goes to the background. Pencil mode
did not do this.

**Choice.** Finger-mode touches only:

- A contact whose `width` or `height` is at least 80 CSS pixels does not
  start a stroke and is not tracked. `0` or `1` means the browser did not
  report a size, and that is not treated as a palm.
- A touch that goes down within 28 CSS pixels of the viewport edge does not
  start a stroke and is not captured. The event is left alone, so the page
  does not also begin a line.
- Mouse input in finger mode is not filtered, so a desktop check can still
  draw at the window edge.

On a tablet and in phone landscape the paper is fitted with that same 28px
inset on the left and right (`drawingChrome.side`). A portrait phone uses an
8px visual margin so the 4:3 sheet can use the screen width. Finger strokes
still do not start within 28px of the screen edge. The top and bottom bars
are already taller than 28px, so the guides sit inside the margin.

The canvas, and `html` and `body` while a drawing is open, use
`touch-action: none` and `overscroll-behavior: none`. Cancelable touch and
pointer events on the canvas call `preventDefault`, except the small touch
in the edge margin. The viewport meta tag still does not set `maximum-scale`
or `user-scalable` (PRD section 10). The picture list is not under those
rules, so it can still scroll.

Opening a picture from the picker calls the Fullscreen API, while that tap
is still a user gesture. A stroke does not. *Layar penuh* asks again, and
leaves fullscreen when it is already on. If fullscreen, rotation, or the
browser chrome changes the screen while a stroke is in progress, that stroke
is discarded and the canvas is measured again before the next one. The
manifest `display` is `fullscreen`, and `display_override` is `fullscreen`
then `standalone`. A browser that does not implement fullscreen display uses
standalone. A copy that is already installed keeps the display mode it was
installed with.

**What the page cannot do.** Android gesture navigation is handled by the
system. `preventDefault`, `touch-action`, and a dead zone do not cancel a
back swipe, a home gesture, the app switcher, or the notification shade when
the system takes that edge before the page does. Fullscreen hides browser
chrome only where the browser allows the request. It does not turn off
system navigation.

This is not the palm rejection D-16 refuses to claim. A large reported
contact is skipped. A palm the digitiser reports as an ordinary finger still
draws. Whether any of this is enough on a particular tablet is something only
that tablet can show.

### D-58 — Bola Basket is a bundled lesson

**Choice.** `basketball`, titled "Bola Basket", is a sixth hand-authored
package in the 1000×750 space. The steps are the circle, the curved seam
down the middle, the two curved seams at the sides, then orange colour on
the ball. The picker preview is those outline paths. The package is
validated with the others and listed on `BUNDLED_LESSONS`.

### D-59 — The dock chip is help

The dock chip was briefly a palette, because people had been opening
*Bantuan* when they wanted a colour (D-49). The colour circle already opens
those choices, so a second palette control was redundant.

**Choice.** The dock chip is a `?` again. Its accessible name is "Bantuan".
One tap opens the help sheet: assistance, the mode explanation, and boundary
assist on a colour step. A second tap closes it. The chip is the same size
as the other dock icons, 56px on a tablet and 48px on a portrait phone, so
the dock does not grow. The colour circle is the only control that opens
colours. The colour popover has no *Bantuan* button.

### D-61 — Brush size is visible, and the example leaves the instruction card

The size slider was a bare range. A child could not tell it changed the
brush. The target picture was an 84×64 thumbnail inside the instruction
card, too small to read the current step.

**Choice.** The slider's accessible name is "Ukuran kuas". Above the track,
a dot uses the active colour and grows with the width. A thick stroke marks
the large end and a thin stroke marks the small end. Neither adds width:
the column stays 64px, and 52px on a portrait phone.

The instruction card keeps the words, the step dots, and the collapse
button. The picture moves out. On a landscape tablet it is a 200×150 card
in the top-left column, above the brush slider. The card is 4:3 with no
padding, and the picture is framed on the artwork so the drawing fills the
card. A tap on the card opens the large preview;
a tap on the preview closes it. The sheet stays the same size and slides
right until its left edge clears the card. On a portrait tablet and on a
phone it is a thumbnail in that same top corner, and a tap opens the same
preview. On a portrait tablet that thumbnail is 128×96, still inside the
band above the paper. The sheet is not made smaller to make room.

### D-60 — Dock icons stay readable, and the phone sheet sits above the tools

The pressed check glyph landed on the hand icon and under the pencil. *Layar
penuh* and *Sesuai layar* were both corner-bracket marks, and the fit control
stayed on screen, greyed, while the paper was already fitted. On a 390×844
phone the resume toast covered the mode box, and the 4:3 sheet was pinned
under the step reference, leaving an empty band above the toolbar.

**Choice.** Pressed dock icons (mode, tools, fullscreen) use the fill and the
border only. *Sesuai layar* is a magnifying glass with a "1" in the lens, and
it is not shown while zoom is 1. *Layar penuh* stays the four corner brackets.

On a portrait phone the sheet is the largest 4:3 that fits the screen width,
with an 8px side margin (D-57). It sits just under the step card. The brush
slider and the dock follow the bottom of the sheet, so the open space is
below the tools rather than around the paper. The toast sits in that lower
band, above *Lanjut*, and does not cover the tools. The sheet does not grow
past 4:3, because cropping the lesson would hide strokes at the sides.

### D-62 — Ten beginner lessons, in a scrolling grid

The picker shipped six pictures. A child who has drawn the cat, the flower,
the fish, the sun, the apple tree, and the basketball had nothing new to
choose, and the tiles were sized for a short list.

**Choice.** Four more hand-authored packages join `BUNDLED_LESSONS`, still in
the 1000×750 space, still outline (and detail) steps before colour regions,
still `automaticEnabled: false`: `house` ("Rumah"), `car` ("Mobil"),
`butterfly` ("Kupu-kupu"), and `star` ("Bintang"). Each has a target preview
the picker draws, and each is validated with the others. Apples stay on the
existing "Pohon Apel" lesson rather than becoming an eleventh picture.

The picture list is a grid (`auto-fill`, about 200px) inside a shell that
scrolls when the list is taller than the screen. A portrait phone uses two
columns. The drawing screen still locks the shell (`:has(> .pad)`), so this
scroll does not change the paper, the dock, or the sample card.

### D-63 — Karyaku lists saved drawings on the picture-choosing screen

PNG export already omitted guides. There was no way to see, reopen, or
delete an earlier drawing except by opening that lesson again, which only
restored the latest session.

**Choice.** `SessionStore.listSavedArtworks` returns checkpoints that have
strokes, a later step, redo history, or a finished flag, newest first. An
opening that was never drawn is not listed. Karyaku sits under the lesson
grid on the picture-choosing screen. Each card shows a thumbnail painted by
the same export path as the PNG (committed strokes and clip paths only — no
guide parameter), the lesson title, and the date. *Buka* restores that
session. *Simpan PNG* downloads it. *Hapus* asks "Hapus karya ini?" before
`deleteSession`. The picture-choosing shell scrolls; the drawing screen does
not, and the dock is unchanged.

### D-64 — Free drawing, repeat this step, and start over

The lesson ended at *Selesai*. There was no way to keep drawing without the
guide, and the only start-over was on the finish screen. Repeating a step
would have had to delete later strokes or be a second *Hapus semua*.

**Choice.** On the last step, *Gambar bebas* (in the help sheet, and again
on the finish screen) sets `freeCreation`. The canvas guide turns off. The
sample card stays, so the paper does not move and the dock does not change
width. Pen draws ink, the brush draws colour, the eraser cuts both layers,
and the colour circle still opens the palette. Nothing is clipped to a
colour region. Strokes from this phase use the step id `free-creation`, so
they are not the last guided step's strokes.

*Ulangi langkah ini*, in the same help sheet, deletes only the active
step's strokes. One *Batalkan* puts them back. Strokes from other steps
stay. It does not ask first, because undo is the way back. *Mulai ulang*
(accessible name "Mulai ulang karya", so it is not the resume toast's
one-tap *Mulai ulang*) asks "Mau mulai dengan gambar kosong?" and then uses
the existing restart, which is not undoable. *Kembali* during free drawing
returns to the last guided step without deleting strokes.

`freeCreation` is stored on the checkpoint as an optional field. Older
checkpoints omit it and are read as not free. The persistence schema version
is unchanged: bumping it would refuse every saved drawing, and migration is
still deferred. The undo record for *Ulangi langkah ini* is session-only,
same as *Hapus semua*. A free-drawing session is an ordinary saved drawing:
Karyaku lists it and *Buka* restores `freeCreation` with the free strokes.
