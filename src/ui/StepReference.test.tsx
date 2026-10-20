import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { activeStep, createSession } from '../lesson-engine/session';
import { referencePresentation } from './reference-spot';
import { StepReference } from './StepReference';

describe('reference presentation', () => {
  it('uses a card on a landscape tablet and a thumbnail on portrait and phone', () => {
    expect(referencePresentation('tablet', true)).toBe('card');
    expect(referencePresentation('tablet', false)).toBe('thumb');
    expect(referencePresentation('phone-portrait', false)).toBe('thumb');
    expect(referencePresentation('phone-landscape', true)).toBe('thumb');
  });
});

describe('step reference', () => {
  const step = activeStep(CAT_LESSON, createSession(CAT_LESSON, 'reference'));

  it('shows the target on a landscape card without a second tap', () => {
    render(<StepReference lesson={CAT_LESSON} step={step} presentation="card" />);
    expect(screen.getByRole('img', { name: /Contoh hasil akhir/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Perbesar contoh' })).toBeNull();
    expect(document.querySelector('.step-reference--card')).toBeTruthy();
  });

  it('opens a large preview from the thumbnail and closes it on a tap', () => {
    render(<StepReference lesson={CAT_LESSON} step={step} presentation="thumb" />);
    fireEvent.click(screen.getByRole('button', { name: 'Perbesar contoh' }));
    const dialog = screen.getByRole('dialog', { name: 'Contoh besar' });
    expect(dialog.querySelectorAll('svg').length).toBeGreaterThan(0);
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog', { name: 'Contoh besar' })).toBeNull();
  });
});
