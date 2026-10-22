import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LessonPackage } from '../lesson-data/schema';
import { PhotoMatch } from './PhotoMatch';
import type { ClientMatch } from './photo-match-client';

function match(partial: Partial<ClientMatch>): ClientMatch {
  return {
    matched: false,
    category: 'none',
    confidence: 0,
    facing: 'unknown',
    pose: '',
    colours: [],
    suggestions: [
      { category: 'cat', title: 'Kucing' },
      { category: 'dog', title: 'Anjing' },
    ],
    message: 'Belum bisa digambar. Coba salah satu ini.',
    ...partial,
  };
}

describe('photo match screen', () => {
  it('shows the friendly list and opens a suggested lesson', async () => {
    const opened: LessonPackage[] = [];
    const requestMatch = vi.fn(() => Promise.resolve(match({})));
    render(<PhotoMatch onCancel={() => {}} onOpenLesson={(lesson) => opened.push(lesson)} requestMatch={requestMatch} />);
    const input = screen.getByLabelText('Pilih foto');
    const file = new File([new Uint8Array([1, 2, 3])], 'cat.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Buat pelajarannya' }));
    expect(await screen.findByText(/Belum bisa digambar/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kucing' }));
    expect(opened[0]?.id).toBe('cat');
    expect(opened[0]?.title).toBe('Kucing');
  });

  it('opens the recoloured lesson when the photo matches', async () => {
    const opened: LessonPackage[] = [];
    const requestMatch = vi.fn(() => Promise.resolve(match({
      matched: true,
      category: 'cup',
      confidence: 0.8,
      facing: 'left',
      colours: [{ part: 'cup', color: '#2244aa' }],
      suggestions: [],
      message: '',
    })));
    render(<PhotoMatch onCancel={() => {}} onOpenLesson={(lesson) => opened.push(lesson)} requestMatch={requestMatch} />);
    fireEvent.change(screen.getByLabelText('Pilih foto'), {
      target: { files: [new File([new Uint8Array([1])], 'cup.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buat pelajarannya' }));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0]?.id).toBe('cup');
    expect(opened[0]?.steps.find((step) => step.id === 'color-cup')?.toolPreset.color).toBe('#2244aa');
    expect(screen.queryByText(/Belum bisa digambar/)).toBeNull();
  });
});
