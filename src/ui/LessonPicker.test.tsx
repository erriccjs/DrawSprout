import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CATEGORY_LESSONS, getPlayableLesson, lessonsForPicker } from '../categories/library';
import { LessonPicker } from './LessonPicker';

const css = readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

function choiceNamed(title: string): HTMLElement {
  const choice = screen.getAllByRole('button').find((button) => (
    button.querySelector('.lesson-picker__name')?.textContent === title
  ));
  if (!choice) throw new Error(`No lesson choice named ${title}`);
  return choice;
}

function renderPicker(onSelect: (lessonId: string) => void = () => {}) {
  render(
    <LessonPicker
      onSelect={onSelect}
      onPhoto={() => {}}
      onTrace={() => {}}
      notice={null}
      offlineReady={false}
      updatePhase="hidden"
      onApplyUpdate={() => {}}
      onDismissUpdate={() => {}}
    />,
  );
}

describe('lesson picker', () => {
  it('lists every done category lesson as a coloured picture', () => {
    const onSelect = vi.fn();
    renderPicker(onSelect);
    const choices = document.querySelectorAll('.lesson-picker__choice');
    expect(choices).toHaveLength(lessonsForPicker().length);
    expect(screen.getByRole('button', { name: 'Gambar dari foto' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jiplak foto' })).toBeTruthy();
    const traceInput = screen.getByLabelText('Pilih atau ambil foto');
    expect(traceInput.getAttribute('accept')).toBe('image/*');
    expect(traceInput.hasAttribute('capture')).toBe(false);
    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Indonesia' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(lessonsForPicker().length + 4);

    const names = [...document.querySelectorAll('.lesson-picker__name')].map((node) => node.textContent);
    expect(new Set(names).size).toBe(names.length);

    for (const entry of CATEGORY_LESSONS) {
      expect(entry.status).toBe('done');
      const choice = choiceNamed(entry.lesson.title);
      const fills = [...choice.querySelectorAll('path')].filter((path) => {
        const fill = path.getAttribute('fill');
        return fill !== null && fill !== 'none';
      });
      expect(fills.length).toBeGreaterThan(0);
    }

    fireEvent.click(choiceNamed('Rumah'));
    fireEvent.click(choiceNamed('Kupu-kupu'));
    fireEvent.click(choiceNamed('Kucing Duduk'));
    expect(onSelect).toHaveBeenNthCalledWith(1, 'house-front');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'butterfly-front');
    expect(onSelect).toHaveBeenNthCalledWith(3, 'cat-sitting');
    expect(names.filter((name) => name === 'Rumah')).toHaveLength(1);
    expect(names.filter((name) => name === 'Kupu-kupu')).toHaveLength(1);
    expect(names).toContain('Kucing');
    expect(getPlayableLesson('house').id).toBe('house');
    expect(getPlayableLesson('butterfly').id).toBe('butterfly');
    expect(getPlayableLesson('cat-sitting').id).toBe('cat-sitting');
    expect(getPlayableLesson('house-front').id).toBe('house-front');
  });

  it('scrolls a grid that stays two columns on a portrait phone', () => {
    expect(css).toMatch(/\.shell:not\(:has\(> \.pad\)\)\s*\{[^}]*overflow:\s*auto/);
    expect(css).toMatch(/\.lesson-picker__choices\s*\{[^}]*display:\s*grid/);
    expect(css).toMatch(
      /\.shell\[data-layout='phone-portrait'\] \.lesson-picker__choices\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
  });
});
