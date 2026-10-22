# Category lessons

Photo lessons are chosen from a hand-authored library. A photo is not turned
into new geometry. OpenAI image generation (the v9–v14 spike, PR #23) stays
open as a reference and is not on this path.

This spike does **not** claim the 30-photo rubric. `claimedPass` stays false.

## Lesson schema

Packages stay on `LESSON_SCHEMA_VERSION` 1 (`src/lesson-data/schema.ts`).
A category lesson is a `LessonPackage` plus a short record of which colour
regions belong to which part.

| Field | Role |
| --- | --- |
| `LessonStep.id` | Step name, stable and kebab-case. |
| `LessonStep.instruction` | One short line for the child, in Indonesian. |
| `LessonStep.guidePaths` | SVG path strokes for that step. `d` is the usual subset: M, L, C, Q, A, Z and the relative forms. |
| `GuidePath.role` | `final-outline` is ink the child keeps. `construction` is a dashed helper and is not part of the finished drawing. |
| `LessonStep.phase` | `outline` or `detail` for lines, then `color`. |
| `ColorRegion` | A closed path and a default `#rrggbb`. The photo may replace the default. |
| `targetPreview.paths` | The finished line drawing. Construction paths are left out. |

The coordinate space is 1000×750. The drawing screen plays a category lesson
with the same `DrawingPad` as a bundled lesson.

## How a step is drawn

`src/lesson-data/step-preview.ts` is the model for the example card and for
the contact sheets.

- The line added on this step is red (`#e23b3b`).
- Lines from earlier steps are dark (`#2c2c2c`).
- A construction guide is dashed grey (`#b5b5b5`) and only on its own step.
- A colour step fills flat regions. Later regions stay blank. Construction
  guides are already gone.
- The on-canvas guide uses the same red and grey. It is still an overlay, so
  it is not in the PNG export.

Style for a new lesson: a classic how-to-draw page, not a chibi. Step 1 is
one big simple shape (circle, oval, dome, or the house's wall rectangle). Each later line step adds one
meaningful part, large parts before small ones. Do not split one part across
padding steps (five petals are one step). Use about 5–11 line steps. Colour
steps follow the subject's real distinct colours.

## Catalogue

Done lessons can be opened. Planned names are ones the matcher may return;
the app then shows the friendly list instead of inventing a drawing.

| id | name | status |
| --- | --- | --- |
| cat | Kucing | done |
| dog | Anjing | done |
| flower | Bunga | done |
| cup | Cangkir | done |
| toy-car | Mobil Mainan | done |
| fish | Ikan | done |
| house | Rumah | done |
| dinosaur | Dinosaurus | planned |
| robot | Robot | planned |
| person | Orang | planned |
| butterfly | Kupu-kupu | done |
| bird | Burung | done |
| tree | Pohon | done |
| rabbit | Kelinci | done |
| turtle | Kura-kura | done |
| sun | Matahari | planned |
| rocket | Roket | done |
| boat | Perahu | planned |
| apple | Apel | done |
| elephant | Gajah | planned |
| horse | Kuda | planned |
| lion | Singa | planned |
| penguin | Pinguin | planned |
| frog | Katak | planned |
| snail | Siput | planned |
| ice-cream | Es Krim | planned |
| cake | Kue | planned |
| train | Kereta | planned |
| plane | Pesawat | planned |
| truck | Truk | planned |
| bicycle | Sepeda | planned |
| mushroom | Jamur | planned |
| rainbow | Pelangi | planned |
| moon | Bulan | planned |
| crab | Kepiting | planned |
| whale | Paus | planned |
| octopus | Gurita | planned |
| duck | Bebek | planned |
| pig | Babi | planned |
| bear | Beruang | planned |

`toy-car` is the car-shaped lesson for now, including a small model car.
A separate real-car lesson is not in the list, so the matcher is not split
between two car ids.

The picker already has lessons with ids `house` and `butterfly`. Those tiles
stay the original packages. The category drawings use package ids
`house-front` and `butterfly-front`, and the matcher still says `house` and
`butterfly`. A shared id would open the wrong picture from the gallery.

## Matching, recolouring, and facing

`POST /api/photo-match` takes the photo as the body (`image/jpeg`,
`image/png`, `image/webp`, or `image/gif`, up to 6 MB). The Worker calls
OpenAI chat completions once. The model is `gpt-4.1-mini` unless
`OPENAI_TEXT_MODEL` is set. The image is sent at `detail: low`. The reply is
strict JSON:

```json
{ "category": "cat", "confidence": 0.9, "facing": "right", "pose": "sitting", "colours": [{ "part": "fur", "color": "#c47a2a" }] }
```

`category` is one of the ids above, or `none`. The photo bytes are not
logged and are not stored.

The app opens a lesson only when the category is **done** and `confidence`
is at least **0.55**. Otherwise it shows "Belum bisa digambar. Coba salah
satu ini." and every lesson marked done. A confident "dinosaur" is still that
list, because the drawing does not exist yet.

On a match, the client copies the lesson and replaces each colour step's
brush colour, and the matching region's `suggestedColor`, from the part
colours. Outline ink stays dark. Parts the model skips keep the authored
colour. `pose` is kept on the response and does not change the drawing yet.

Lessons authored `facing: left` or `right` are mirrored when the photo faces
the opposite way. `x` becomes `width - x`. Arc sweep flags flip. A `front`
lesson (the flower) is never mirrored. `unknown` facing does not mirror.

The same idempotency key returns the cached JSON. A client is limited to
6 matches in 10 minutes. There is no image generation on this path.

## Cost per photo

One `gpt-4.1-mini` vision call. List price used here, October 2026: **$0.40
per 1M input tokens** and **$1.60 per 1M output tokens**. Image tokens are
input tokens. Nothing is priced as an image edit.

A short reply is a few hundred output tokens. At `detail: low` the photo is
the rest of the input, so a match is typically well under one cent. The
eval harness prints the measured token counts and this list price for each
sample. There is no per-image generation fee. The run that produced the
contact sheets in this spike did not have `OPENAI_API_KEY` in the
environment, so the five sample photos were not sent and no token cost was
measured.

## How to add a lesson

1. Draw it by hand in `src/categories/lessons/<id>.ts` with the helpers in
   `author.ts`. Step 1 is one circle, oval, dome, or rectangle. Then one part per step.
   Put construction strokes only on the step that needs them.
2. Add a `CategoryLesson`: id, Indonesian title, the facing, and the parts
   that map region ids to a colour the photo may replace.
3. Register it in `CATEGORY_LESSONS` inside `src/categories/library.ts`, and
   move its row in the table above from `planned` to `done`.
4. `npm test` validates the package, the step count, and that this document
   still lists the id.

The bundled picker (`BUNDLED_LESSONS`) is a separate catalogue. A category
lesson does not have to replace a picker tile. Both open in `DrawingPad`.

## Samples

`scripts/photo-eval/samples/` holds the five CC0 photos. The harness sends
each one through the matcher and writes a PNG contact sheet of every done
lesson. It does not pass the 30-photo rubric.

## Open questions

- A saved photo lesson resumes by lesson id. The child's ink keeps its
  colour. The guide colours go back to the authored defaults, because the
  recoloured package is not stored on the checkpoint.
- 0.55 is a starting bar. The five-sample run is the first check, not a
  tuned threshold.
- A planned category the model is sure about still uses the generic list.
  Naming the subject ("we know it is a dinosaur") would be a copy change.
- `pose` is returned and unused. Facing is the only variant that changes
  the drawing.
- Real cars share `toy-car` until a real-car lesson exists.
