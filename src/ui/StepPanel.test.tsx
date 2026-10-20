import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { activeStep, createSession } from '../lesson-engine/session';
import { StepNavigation, StepPanel } from './StepPanel';

describe('the step card', () => {
  function renderCard(index = 0) {
    const state = createSession(CAT_LESSON, 'step-card');
    return render(
      <div className="step-card">
        <StepPanel lesson={CAT_LESSON} state={{ ...state, currentStepIndex: index }} step={activeStep(CAT_LESSON, { ...state, currentStepIndex: index })} />
        <StepNavigation
          lesson={CAT_LESSON}
          state={{ ...state, currentStepIndex: index }}
          onFinish={() => undefined}
          dispatch={() => undefined}
        />
      </div>,
    );
  }

  it('shows the instruction, one dot per step, and a large next button', () => {
    const { container } = renderCard(2);
    expect(screen.getByRole('heading', { name: CAT_LESSON.steps[2]!.instruction })).toBeTruthy();
    expect(screen.getByText('Tahap 3 dari 9', { exact: false })).toBeTruthy();
    const dots = container.querySelectorAll('.step-dots__dot');
    expect(dots).toHaveLength(CAT_LESSON.steps.length);
    expect(dots[2]?.getAttribute('data-state')).toBe('current');
    expect(dots[1]?.getAttribute('data-state')).toBe('done');
    expect(dots[3]?.getAttribute('data-state')).toBe('ahead');
    const next = screen.getByRole('button', { name: /Lanjut/ });
    expect(next.className).toContain('button--primary');
  });

  it('collapses to the dots and opens the example larger', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Sembunyikan langkah' }));
    expect(screen.queryByRole('heading', { name: CAT_LESSON.steps[0]!.instruction })).toBeNull();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Lanjut/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan langkah' }));
    expect(screen.getByRole('heading', { name: CAT_LESSON.steps[0]!.instruction })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Perbesar contoh' }));
    const dialog = screen.getByRole('dialog', { name: 'Contoh besar' });
    expect(dialog.querySelector('svg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tutup contoh' }));
    expect(screen.queryByRole('dialog', { name: 'Contoh besar' })).toBeNull();
  });

  it('starts folded when asked, with the step count and next button still there', () => {
    const state = createSession(CAT_LESSON, 'step-card-phone');
    render(
      <div className="step-card">
        <StepPanel
          lesson={CAT_LESSON}
          state={state}
          step={activeStep(CAT_LESSON, state)}
          startCollapsed
        />
        <StepNavigation
          lesson={CAT_LESSON}
          state={state}
          onFinish={() => undefined}
          dispatch={() => undefined}
        />
      </div>,
    );
    expect(screen.queryByRole('heading', { name: CAT_LESSON.steps[0]!.instruction })).toBeNull();
    expect(screen.getByText('Tahap 1 dari 9', { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Lanjut/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan langkah' }));
    expect(screen.getByRole('heading', { name: CAT_LESSON.steps[0]!.instruction })).toBeTruthy();
  });
});
