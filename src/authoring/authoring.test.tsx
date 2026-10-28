import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { circle } from '../categories/shapes';
import { AuthorApp } from './AuthorApp';
import { handleAuthorDraft } from './dev-api';
import { compileDraft } from './model';
import { translatePath } from './paths';
import { draftLessonWithReplicate } from './replicate';
import { styleProblems } from './rules';
import { SAMPLE_DRAFTS } from './samples';

function fieldValue(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value;
  return '';
}

describe('lesson drafts', () => {
  it('keeps the sample drafts inside the lesson rules and out of the library', () => {
    for (const draft of SAMPLE_DRAFTS) {
      expect(styleProblems(compileDraft(draft)), draft.id).toEqual([]);
    }
  });

  it('moves a circle without changing its size', () => {
    const moved = translatePath(circle(100, 80, 20), 15, -5);
    expect(moved.startsWith('M 95 75')).toBe(true);
    expect(moved).toContain('A 20 20');
  });

  it('rejects a first step that is not one shape, and a colour step that arrives early', () => {
    const [dinosaur] = SAMPLE_DRAFTS;
    if (!dinosaur) throw new Error('missing sample');
    const twoShapes = compileDraft({
      ...dinosaur,
      steps: dinosaur.steps.map((step, index) => index === 0
        ? { ...step, guides: [...step.guides, { id: 'extra', d: 'M 0 0 L 10 10', role: 'final-outline' as const }] }
        : step),
    });
    expect(styleProblems(twoShapes).join(' ')).toMatch(/one basic shape/);

    const earlyColour = compileDraft({
      ...dinosaur,
      steps: [dinosaur.steps[7]!, dinosaur.steps[0]!],
    });
    expect(styleProblems(earlyColour).join(' ')).toMatch(/after every drawing step|last steps/);
  });

  it('asks the model from the dev server and never puts the key in the lesson', async () => {
    const fetchMock: typeof fetch = (_url, init) => {
      const header = new Headers(init?.headers).get('authorization') ?? '';
      expect(header).toBe('Bearer secret-key');
      const body = typeof init?.body === 'string' ? init.body : '';
      expect(body).not.toContain('secret-key');
      return Promise.resolve(new Response(JSON.stringify({
        output: '{"id":"moon","title":"Bulan","subtitle":"Bulat","regions":[],"steps":[]}',
      }), { status: 200 }));
    };
    const draft = await draftLessonWithReplicate({
      apiKey: 'secret-key',
      name: 'moon',
      fetch: fetchMock,
    });
    expect(draft.id).toBe('moon');
    expect(JSON.stringify(draft)).not.toContain('secret-key');
  });

  it('refuses a draft when the server has no key, and hides the key if the model fails', async () => {
    const missing = await handleAuthorDraft(new Request('http://local/__author/draft', {
      method: 'POST',
      body: JSON.stringify({ name: 'moon' }),
    }), {});
    expect(missing.status).toBe(503);
    const missingBody = await missing.json() as { error: string };
    expect(missingBody.error).toContain('REPLICATE_API_KEY');

    const failed = await handleAuthorDraft(new Request('http://local/__author/draft', {
      method: 'POST',
      body: JSON.stringify({ name: 'moon' }),
    }), { REPLICATE_API_KEY: 'secret-key' }, () => {
      throw new Error('upstream said secret-key is bad');
    });
    expect(failed.status).toBe(502);
    const body = await failed.json() as { error: string };
    expect(body.error).toContain('[key]');
    expect(body.error).not.toContain('secret-key');
  });

  it('opens a sample, plays the next part, and nudges it', () => {
    render(<AuthorApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Dinosaurus' }));
    expect(screen.getByRole('img', { name: 'Gambar lonjong untuk badan.' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next part' }));
    expect(screen.getByRole('img', { name: 'Gambar ekor ke kiri.' })).toBeTruthy();
    const before = fieldValue(screen.getByRole('textbox', { name: 'Path' }));
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(fieldValue(screen.getByRole('textbox', { name: 'Path' }))).not.toBe(before);
  });
});
