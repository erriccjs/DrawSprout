import { fireEvent, screen } from '@testing-library/react';

/** Answers the sum that is on screen. Used by tests that trip the parent gate. */
export function answerParentGate(): void {
  const heading = screen.getByText(/Berapa/);
  const numbers = heading.textContent?.match(/\d+/g)?.map(Number) ?? [];
  const sum = (numbers[0] ?? 0) + (numbers[1] ?? 0);
  fireEvent.change(screen.getByLabelText('Jawaban'), { target: { value: String(sum) } });
  fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
}
