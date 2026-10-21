import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BUNDLED_LESSONS } from '../lesson-data';
import { LessonPicker } from './LessonPicker';

const css = readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

function renderPicker() {
  render(
    <LessonPicker
      onSelect={() => {}}
      notice={null}
      offlineReady={false}
      updatePhase="hidden"
      onApplyUpdate={() => {}}
      onDismissUpdate={() => {}}
    />,
  );
}

describe('lesson picker', () => {
  it('lists every bundled lesson, including the ten-picture catalogue', () => {
    renderPicker();
    const choices = screen.getAllByRole('button');
    expect(choices).toHaveLength(BUNDLED_LESSONS.length);
    expect(BUNDLED_LESSONS).toHaveLength(10);
    for (const title of ['Kucing Duduk', 'Rumah', 'Mobil', 'Kupu-kupu', 'Bintang']) {
      expect(screen.getByRole('button', { name: new RegExp(title) })).toBeTruthy();
    }
    expect(document.querySelector('.lesson-picker__choices')?.children).toHaveLength(10);
  });

  it('scrolls a grid that stays two columns on a portrait phone', () => {
    expect(css).toMatch(/\.shell:not\(:has\(> \.pad\)\)\s*\{[^}]*overflow:\s*auto/);
    expect(css).toMatch(/\.lesson-picker__choices\s*\{[^}]*display:\s*grid/);
    expect(css).toMatch(
      /\.shell\[data-layout='phone-portrait'\] \.lesson-picker__choices\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
  });
});
