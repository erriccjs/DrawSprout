# Drafting a category lesson

The child-facing app ships hand-checked lessons. This tool is how a person gets from a category name to a lesson they can review, without drawing every path from a blank page.

It is available while `npm run dev` is running, at [http://localhost:5173/author](http://localhost:5173/author). It is not in the production build.

## Draft

1. Start the dev server with `REPLICATE_API_KEY` set in that process. The page never asks for the key and the key is not sent to the browser.
2. Type a category name and choose **Draft with the model**. The call uses Replicate's `openai/gpt-4.1-mini`, the same model as photo match.
3. Or skip the model and open a sample: **Dinosaurus**, **Perahu**, or **Kue**. Those three are proof of the draft format. They are not in the lesson library.

From a terminal, the same call is:

```bash
REPLICATE_API_KEY=... npx tsx scripts/author-lesson/draft.ts dinosaur
```

That writes `drafts/<id>.json`. The `drafts/` directory is not committed.

## Review

The preview plays one step at a time. The new part is red, earlier lines are dark, and helpers are dashed. The last steps are flat colour. That is the same preview the drawing screen uses.

Each drawing step should add one part. The first step is one closed shape. The page lists any rule the draft breaks.

Nudge the selected part with Up, Left, Right, Down, Bigger, and Smaller, or edit the path text. The instruction and hint are editable too. Indonesian is what a child would read. The English line is there so it can be copied into `src/i18n/lessons-category.ts` when the lesson is accepted.

## Export

**Export lesson file** downloads a TypeScript module in the library's format (`packageLesson`, `outline`, `colorStep`). **Export JSON** downloads the draft.

A lesson joins the app only after a person is happy with the drawing:

1. Put the module in `src/categories/lessons/`.
2. Register it in `src/categories/library.ts` and `docs/CATEGORY_LESSONS.md`.
3. Add the English lines to the i18n catalogue.
4. Run the tests. They check the lesson schema and these style rules.

The sample drafts stay out of that list until someone has reviewed them that way.
