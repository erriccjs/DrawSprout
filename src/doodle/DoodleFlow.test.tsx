import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAT_LESSON } from '../lesson-data';
import { DEFAULT_CROP, type NormalizedCrop } from '../photo/prepare';
import type * as PrepareModule from './prepare';
import { DoodleFlow } from './DoodleFlow';

const prepare = vi.hoisted(() => vi.fn());
const request = vi.hoisted(() => vi.fn());

vi.mock('./prepare', async () => {
  const actual = await vi.importActual<typeof PrepareModule>('./prepare');
  return { ...actual, prepareDoodlePhoto: prepare };
});
vi.mock('./client', () => ({ requestDoodle: request }));
vi.mock('./steps', () => ({ buildDoodleLesson: () => CAT_LESSON }));
vi.mock('../photo/png', () => ({ encodePng: () => Promise.resolve(Uint8Array.from([137, 80])) }));

let originalCreate: typeof URL.createObjectURL;
let originalRevoke: typeof URL.revokeObjectURL;

beforeEach(() => {
  originalCreate = URL.createObjectURL;
  originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:doodle');
  URL.revokeObjectURL = vi.fn();
  prepare.mockReset();
  request.mockReset();
  prepare.mockResolvedValue({
    jpeg: Uint8Array.from([0xff, 0xd8]),
    photo: { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4) },
  });
  request.mockResolvedValue({ width: 8, height: 8, data: new Uint8Array(8 * 8 * 4) });
});

afterEach(() => {
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

function pick() {
  const input = screen.getByLabelText('Pilih atau ambil foto', { selector: 'input' });
  fireEvent.change(input, { target: { files: [new File(['photo'], 'dog.jpg', { type: 'image/jpeg' })] } });
}

describe('doodle flow', () => {
  it('lets the parent frame the subject before anything is sent', async () => {
    render(<DoodleFlow onCancel={() => undefined} onFollow={() => undefined} onTrace={() => undefined} />);

    pick();
    expect(await screen.findByRole('button', { name: 'Ubah ukuran bagian' })).toBeTruthy();
    // The crop is a decision point: nothing has left the device yet.
    expect(prepare).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Pakai bagian ini' }));
    await screen.findByRole('button', { name: 'Ikuti langkahnya' });
    expect(request).toHaveBeenCalledTimes(1);
    const crop = prepare.mock.calls[0]?.[1] as NormalizedCrop;
    expect(crop).toMatchObject(DEFAULT_CROP);
  });

  it('offers the frame again when the drawing could not be made', async () => {
    request.mockRejectedValue(new Error('Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.'));
    render(<DoodleFlow onCancel={() => undefined} onFollow={() => undefined} onTrace={() => undefined} />);

    pick();
    fireEvent.click(await screen.findByRole('button', { name: 'Pakai bagian ini' }));
    expect(await screen.findByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('button', { name: 'Ubah ukuran bagian' })).toBeTruthy();
  });
});
