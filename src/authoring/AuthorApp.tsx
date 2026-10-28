/**
 * Dev-only page for drafting a category lesson.
 * The model call goes to the dev server. This file never sees the API key.
 */

import { useMemo, useState } from 'react';
import { previewStrokeWidth, PREVIEW_INK, stepPreview } from '../lesson-data/step-preview';
import { previewViewBox } from '../ui/preview-frame';
import { compileDraft, lessonModuleSource, parseDraft, type DraftLesson, type DraftStep } from './model';
import { pathCenter, scalePath, translatePath } from './paths';
import { styleProblems } from './rules';
import { BOAT_DRAFT, CAKE_DRAFT, DINOSAUR_DRAFT } from './samples';

const SAMPLES = [DINOSAUR_DRAFT, BOAT_DRAFT, CAKE_DRAFT];

export function AuthorApp() {
  const [draft, setDraft] = useState<DraftLesson | null>(null);
  const [name, setName] = useState('dinosaurus');
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lesson = useMemo(() => (draft ? compileDraft(draft) : null), [draft]);
  const problems = useMemo(() => (lesson ? styleProblems(lesson) : []), [lesson]);
  const step = draft?.steps[Math.min(stepIndex, (draft?.steps.length ?? 1) - 1)];

  const load = (next: DraftLesson) => {
    setDraft(structuredClone(next));
    setStepIndex(0);
    setError('');
  };

  const askModel = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/__author/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || !('lesson' in payload)) {
        const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'The draft failed.';
        setError(message);
        return;
      }
      load(parseDraft(payload.lesson));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The draft failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="author">
      <header className="author__bar">
        <h1>Lesson drafts</h1>
        <p>A model proposes the parts. You check the steps, nudge a shape, then export. Nothing here is in the app the child opens.</p>
        <form className="author__ask" onSubmit={(event) => { event.preventDefault(); void askModel(); }}>
          <label>
            What should we draw?
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button type="submit" className="button button--primary" disabled={busy || name.trim() === ''}>
            {busy ? 'Drafting…' : 'Draft with the model'}
          </button>
        </form>
        <div className="author__samples" role="group" aria-label="Sample drafts">
          {SAMPLES.map((sample) => (
            <button key={sample.id} type="button" className="button" onClick={() => load(sample)}>
              {sample.title}
            </button>
          ))}
        </div>
        {error && <p className="author__error" role="alert">{error}</p>}
      </header>

      {draft && lesson && step && (
        <div className="author__work">
          <Preview lesson={lesson} index={Math.min(stepIndex, draft.steps.length - 1)} onIndex={setStepIndex} />
          <StepEditor
            draft={draft}
            index={Math.min(stepIndex, draft.steps.length - 1)}
            problems={problems}
            onChange={setDraft}
          />
        </div>
      )}
    </main>
  );
}

function Preview({
  lesson,
  index,
  onIndex,
}: {
  readonly lesson: ReturnType<typeof compileDraft>;
  readonly index: number;
  readonly onIndex: (index: number) => void;
}) {
  const step = lesson.steps[index];
  if (!step) return null;
  const preview = stepPreview(lesson, index);
  const viewBox = previewViewBox(lesson.coordinateSpace, [
    ...lesson.targetPreview.paths.map((path) => path.d),
    ...lesson.colorRegions.map((region) => region.d),
  ]);
  return (
    <section className="author__preview" aria-label="Step preview">
      <div className="author__play">
        <button type="button" className="button" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0}>Back</button>
        <p>Step {index + 1} of {lesson.steps.length}</p>
        <button type="button" className="button button--primary" onClick={() => onIndex(Math.min(lesson.steps.length - 1, index + 1))} disabled={index === lesson.steps.length - 1}>Next part</button>
      </div>
      <svg viewBox={viewBox} role="img" aria-label={step.instruction}>
        {preview.fills.map((fill) => (
          <path key={fill.id} d={fill.d} fill={fill.fill === 'paper' ? '#fffdf8' : fill.fill} />
        ))}
        {preview.strokes.map((stroke) => (
          <path
            key={`${stroke.kind}-${stroke.id}`}
            d={stroke.d}
            fill="none"
            stroke={PREVIEW_INK[stroke.kind]}
            strokeWidth={previewStrokeWidth(stroke.kind)}
            strokeDasharray={stroke.kind === 'construction' ? '12 14' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {preview.activeOutlines.map((stroke) => (
          <path key={stroke.id} d={stroke.d} fill="none" stroke={PREVIEW_INK.new} strokeWidth={7} />
        ))}
      </svg>
      <h2>{step.instruction}</h2>
      {step.hint && <p>{step.hint}</p>}
    </section>
  );
}

function StepEditor({
  draft,
  index,
  problems,
  onChange,
}: {
  readonly draft: DraftLesson;
  readonly index: number;
  readonly problems: readonly string[];
  readonly onChange: (draft: DraftLesson) => void;
}) {
  const step = draft.steps[index];
  if (!step) return null;

  const updateStep = (next: DraftStep) => {
    onChange({ ...draft, steps: draft.steps.map((item, itemIndex) => itemIndex === index ? next : item) });
  };

  const moveGuide = (guideId: string, dx: number, dy: number) => {
    onChange(mapPaths(draft, guideId, (d) => translatePath(d, dx, dy)));
  };

  const resizeGuide = (guideId: string, factor: number, d: string) => {
    const center = pathCenter(d);
    onChange(mapPaths(draft, guideId, (path) => scalePath(path, factor, center.x, center.y)));
  };

  const download = (filename: string, contents: string, type: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="author__editor">
      <h2>{draft.title}</h2>
      <p>{draft.subtitle}</p>
      <label>
        Instruction
        <input
          value={step.instruction}
          onChange={(event) => updateStep({ ...step, instruction: event.target.value })}
        />
      </label>
      <label>
        Hint
        <input value={step.hint} onChange={(event) => updateStep({ ...step, hint: event.target.value })} />
      </label>
      {(step.instructionEn || step.hintEn) && (
        <p className="author__english">{step.instructionEn} {step.hintEn}</p>
      )}
      {step.guides.map((guide) => (
        <fieldset key={guide.id}>
          <legend>{guide.id}</legend>
          <div className="author__nudge" role="group" aria-label={`Move ${guide.id}`}>
            <button type="button" className="button" onClick={() => moveGuide(guide.id, 0, -12)}>Up</button>
            <button type="button" className="button" onClick={() => moveGuide(guide.id, -12, 0)}>Left</button>
            <button type="button" className="button" onClick={() => moveGuide(guide.id, 12, 0)}>Right</button>
            <button type="button" className="button" onClick={() => moveGuide(guide.id, 0, 12)}>Down</button>
            <button type="button" className="button" onClick={() => resizeGuide(guide.id, 1.08, guide.d)}>Bigger</button>
            <button type="button" className="button" onClick={() => resizeGuide(guide.id, 0.92, guide.d)}>Smaller</button>
          </div>
          <label>
            Path
            <textarea
              value={guide.d}
              rows={3}
              onChange={(event) => updateStep({
                ...step,
                guides: step.guides.map((item) => item.id === guide.id ? { ...item, d: event.target.value } : item),
              })}
            />
          </label>
        </fieldset>
      ))}
      <div className={problems.length === 0 ? 'author__ok' : 'author__problems'} role="status">
        {problems.length === 0
          ? 'This draft matches the lesson rules.'
          : (
            <ul>
              {problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          )}
      </div>
      <div className="author__export">
        <button
          type="button"
          className="button button--primary"
          onClick={() => download(`${draft.id}.ts`, lessonModuleSource(draft), 'text/typescript')}
        >
          Export lesson file
        </button>
        <button
          type="button"
          className="button"
          onClick={() => download(`${draft.id}.json`, `${JSON.stringify(draft, null, 2)}\n`, 'application/json')}
        >
          Export JSON
        </button>
      </div>
    </section>
  );
}

function mapPaths(draft: DraftLesson, guideId: string, change: (d: string) => string): DraftLesson {
  return {
    ...draft,
    steps: draft.steps.map((step) => ({
      ...step,
      guides: step.guides.map((guide) => guide.id === guideId ? { ...guide, d: change(guide.d) } : guide),
    })),
    regions: draft.regions.map((region) => region.id === guideId ? { ...region, d: change(region.d) } : region),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
