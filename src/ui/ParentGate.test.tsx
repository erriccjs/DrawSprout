import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearParentUnlock, parentUnlocked } from './parent-session';
import { ParentGate } from './ParentGate';

afterEach(() => {
  clearParentUnlock();
});

describe('parent gate', () => {
  it('stays shut on a wrong sum and opens on the right one', () => {
    const onPass = () => undefined;
    let passed = false;
    render(
      <ParentGate
        question={{ left: 6, right: 7, answer: 13 }}
        onPass={() => { passed = true; }}
        onCancel={onPass}
      />,
    );
    fireEvent.change(screen.getByLabelText('Jawaban'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Coba lagi/);
    expect(passed).toBe(false);
    expect(parentUnlocked()).toBe(false);

    fireEvent.change(screen.getByLabelText('Jawaban'), { target: { value: '13' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    expect(passed).toBe(true);
    expect(parentUnlocked()).toBe(true);
  });
});
