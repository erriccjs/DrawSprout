# DrawSprout growth and monetization

English notes for sequencing. The app stays Indonesian-first. Do not turn on
payments until retention is real: Phase A, Phase B, and the anonymous counts,
with about 10–20 families, come first.

Counts used below are the anonymous events in `docs/analytics.md`
(`lesson_start`, `lesson_complete`, `free_draw_start`, `stamp_earned`,
`album_open`, `share_picture`, `print_sheet`, and the weekly returning flag).
They are not a list of people.

## Phase A — Habit and learning structure

**Goal.** A child can start in the right place, finish a few easy pictures,
and find them again.

**Features.**

- A “Mulai di sini” path of about eight easy lessons, in order.
- The lesson list grouped by theme, with Mudah / Sedang / Sulit badges.
- One stamp per finished lesson, on the tile and in a stamp collection.
- “Buku Gambarku”: every saved picture, more than one per lesson. Starting
  again keeps the earlier picture. Delete stays behind the existing confirm.
- A prominent “Gambar bebas” entry on the home list.

**Near-duplicate pairs, for Eric to decide. Do not delete them in this phase.**

| Keep both until reviewed | Why they look alike |
| --- | --- |
| Kucing (`cat`) and Kucing Duduk (`cat-sitting`) | Two cats |
| Bunga (`flower`) and Bunga Ceria (`flower-cheerful`) | Two flowers |
| Ikan (`fish`) and Ikan Lucu (`fish-cheerful`) | Two fish |
| Pohon (`tree`) and Pohon Apel (`apple-tree`) | Two trees |
| Mobil Mainan (`toy-car`) and Mobil (`car`) | Two cars |

The older bundled Rumah and Kupu-kupu are already hidden when the category
tile has the same title. Old saves of those ids still open.

**Success.** Among families in a trial, beginner-path `lesson_complete`
divided by `lesson_start` is visible week to week; `stamp_earned` grows;
`album_open` and `free_draw_start` are non-zero; the returning-this-week
flag is 1 for some later `app_open` events.

**Effort.** Medium. This phase is the one in the app now.

**Depends on.** The existing lesson catalogue, gallery, and usage events.

## Phase B — Daily challenge and a mascot

**Goal.** A reason to open the app on a day when nobody picks a lesson.

**Features.** One featured lesson per day, chosen from the date so it is the
same offline. A friendly mascot that speaks the step with the existing
browser voice. No paid or server voice.

**Success.** `lesson_start` on the featured lesson on days with an `app_open`,
and returning-this-week opens over a few weeks.

**Effort.** Small to medium. This phase is in the app: one lesson per local
day, a quiet streak, and Tunas, who speaks only after a tap.

**Depends on.** The lesson list and the current read-aloud.

## Phase C — Parent trust

**Goal.** A grown-up can see what happened and stop a photo or a delete
without standing over the tablet the whole time.

**Features.** A simple adult check before a photo upload, before gallery
delete, and before settings. A preview of the picture before doodle
generation. A parent page: counts per week, lessons finished, and the
gallery. Privacy copy that matches what the app actually does (trace stays
on the device; doodle from a photo is made on a server; counts have no name
and no photo).

**Success.** `doodle_start` only after the gate; delete still requires the
confirm; parent page reads the same events as the analytics queries.

**Effort.** Medium. This phase is in the app: a sum before photos, delete, and the parent page; a preview before a photo is used; a local read-only page.

**Depends on.** Phase A album, and the usage events. Not on payments.

## Phase D — Share and print

**Goal.** A picture can leave the tablet as a file a family already knows
how to send.

**Features.** PNG (already on the finish screen) and an A4 PDF, plus a
colouring-sheet PDF of a lesson’s outlines. Web Share API, aimed at
WhatsApp. One greeting-card template.

**Success.** `share_picture` and `print_sheet`, next to `lesson_complete`.
The greeting-card template is still open.

**Effort.** Medium.

**Depends on.** Phase A pictures in the album. Printables are a premium
candidate in Phase F, so the free path should keep one PNG save.

## Phase E — Gambar jadi hidup

**Goal.** The finished picture does something small and delightful.

**Features.** A client-side wiggle, blink, or move of the finished drawing.
No video upload, no server render. Honour reduced motion with a still picture.

**Success.** Used after `lesson_complete`. Add an event when the phase is
built if the count would change a decision.

**Effort.** Medium.

**Depends on.** A finished picture with stable outlines. Premium in Phase F.

## Phase F — Monetization (freemium)

**Goal.** A family that stays can pay, and a family that does not pay can
still learn.

**Free.** About 15–20 core lessons (the beginner path plus the next easy
set), trace a photo, and free draw.

**Premium.** Theme packs, including local Indonesian sets (hewan Nusantara,
simple batik, wayang). Unlimited doodle-from-photo, which has a server cost.
Animation (Phase E). Printables (Phase D). Seasonal packs later. A
school/PAUD licence after the family product is clear.

**Payments.** Research only. Do not implement. Options to compare for
Indonesia: Midtrans, Xendit, QRIS, and Google Play billing if the app is
wrapped. Entitlement has to work offline: a signed or locally stored
“this device may open these packs” flag, so a paid child is not stuck
without a network.

**Success.** After payments exist: starts and completes inside premium packs,
and doodle success versus the free cap. Before payments: do not block Phase
A–B on this.

**Effort.** Large, mostly because of packs, entitlement, and the payment choice.

**Depends on.** Retention from Phase A–B. Do not start the charge before
that trial.

## Phase G — Distribution

**Goal.** A family can install DrawSprout from a store they already use.

**Features.** Play Store via TWA / Bubblewrap. App Store only with a clear
eye on PWA-wrapper rules. Listing screenshots and a short description.
Ideas for short videos: one lesson in thirty seconds, the stamp, the album.

**Success.** Store installs are outside the anonymous events. Pair them
later with `app_open` by week, not by person.

**Effort.** Medium, plus store accounts and review time.

**Depends on.** Phase A being the first screen a new install sees. A store
listing before the path exists will advertise a flat grid.

## Suggested order

1. Enable Analytics Engine so production can ship the counts.
2. Phase A (in the app) and Phase B.
3. Watch 10–20 families.
4. Phase C in parallel with that trial if parents ask for a gate.
5. Phase D and E only if families ask to take pictures out or to see them move.
6. Phase F after the trial, research notes first.
7. Phase G when the first screen and the free set are stable.
