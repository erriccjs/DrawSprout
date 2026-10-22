import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CAT_LESSON } from '../lesson-data';
import type { PhotoLessonApiResult, PhotoLessonRequest } from '../photo/client';
import { PhotoFlow } from './PhotoFlow';

const prepared = Uint8Array.from([1, 2, 3, 4]);

function result(id = 'photo-lesson-1'): PhotoLessonApiResult {
  return {
    illustrationPng: Uint8Array.from([9, 9, 9]),
    dominantColors: ['#333333'],
    lesson: { ...CAT_LESSON, id, title: 'Dari foto', subtitle: 'Dari foto' },
    targetHash: 'abc123hashvalue',
    needsReview: true,
    reviewReason: 'Garis pelajaran terlalu berbeda dari ilustrasi. Cek dulu sebelum dipakai.',
    model: 'gpt-image-1.5',
  };
}

describe('photo flow', () => {
  it('asks for consent before upload and locks the hash on approval', async () => {
    const prepare = vi.fn(() => Promise.resolve(prepared));
    const calls: PhotoLessonRequest[] = [];
    const request = vi.fn((input: PhotoLessonRequest) => {
      calls.push(input);
      return Promise.resolve(result());
    });
    const onUse = vi.fn(() => Promise.resolve());
    render(<PhotoFlow onCancel={() => undefined} onUse={onUse} prepare={prepare} request={request} />);

    fireEvent.change(screen.getByLabelText('Galeri'), { target: { files: [new File(['photo'], 'cat.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Pakai bagian ini' }));
    expect(await screen.findByRole('heading', { name: 'Sebelum foto dikirim' })).toBeTruthy();
    expect(screen.getByText(/OpenAI/)).toBeTruthy();
    expect(request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Saya setuju, lanjut' }));
    expect(await screen.findByRole('button', { name: 'Gunakan' })).toBeTruthy();
    expect(screen.getByText(/Cek dulu sebelum dipakai/)).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.variant).toBe('default');

    fireEvent.click(screen.getByRole('button', { name: 'Lebih sederhana' }));
    await screen.findByRole('button', { name: 'Gunakan' });
    expect(calls[1]?.variant).toBe('simple');
    expect(calls[1]?.idempotencyKey).not.toBe(calls[0]?.idempotencyKey);

    fireEvent.click(screen.getByRole('button', { name: 'Gunakan' }));
    await waitFor(() => expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ id: 'photo-lesson-1' }), 'abc123hashvalue'));
  });
});
