import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TraceSession } from './types';
import { TraceControls } from './TraceControls';

function session(source?: TraceSession['source']): TraceSession {
  return {
    image: new Image(),
    url: 'blob:trace',
    placement: { x: 0, y: 0, width: 100, height: 80 },
    opacity: 0.4,
    visible: true,
    locked: true,
    includeInExport: false,
    ...(source ? { source } : {}),
  };
}

describe('trace controls', () => {
  it('keeps the photo words for a photo', () => {
    render(
      <TraceControls trace={session()} spaceWidth={1000} spaceHeight={750} onChange={() => {}} />,
    );
    expect(screen.getByText('Ketebalan foto')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sembunyikan foto' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Geser foto' })).toBeTruthy();
    expect(screen.getByText('Simpan bersama foto')).toBeTruthy();
  });

  it('says doodle while a doodle is under the paper', () => {
    render(
      <TraceControls trace={session('doodle')} spaceWidth={1000} spaceHeight={750} onChange={() => {}} />,
    );
    expect(screen.getByText('Ketebalan doodle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sembunyikan doodle' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Geser doodle' })).toBeTruthy();
    expect(screen.getByText('Simpan bersama doodle')).toBeTruthy();
  });
});
