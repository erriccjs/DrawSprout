/**
 * Undo/redo (FR-02, AT-07).
 *
 * History is scoped to the active step: undo takes back the last stroke of the
 * step the child is looking at, so going back a step and tapping undo can never
 * quietly delete work from a later step.
 */

import { describe, expect, it } from 'vitest';
import { canClearAll, canRedo, canUndo, reduceSession, sessionPhase, strokesForStep } from './session';
import { applyAll, draw, lesson, newSessionState, stepIdAt } from '../test/factories';

describe('undo and redo', () => {
  it('takes strokes back one at a time and puts them back in order', () => {
    const drawn = draw(draw(newSessionState(), stepIdAt(0)), stepIdAt(0));
    const ids = drawn.strokes.map((stroke) => stroke.id);

    const once = reduceSession(lesson, drawn, { type: 'undo' });
    expect(once.strokes.map((s) => s.id)).toEqual([ids[0]]);
    expect(once.redoStack.map((s) => s.id)).toEqual([ids[1]]);

    const twice = reduceSession(lesson, once, { type: 'undo' });
    expect(twice.strokes).toEqual([]);
    expect(twice.redoStack.map((s) => s.id)).toEqual([ids[1], ids[0]]);

    const redone = reduceSession(lesson, twice, { type: 'redo' });
    expect(redone.strokes.map((s) => s.id)).toEqual([ids[0]]);

    const bothBack = reduceSession(lesson, redone, { type: 'redo' });
    expect(bothBack.strokes.map((s) => s.id)).toEqual(ids);
    expect(bothBack.redoStack).toEqual([]);
  });

  it('invalidates the redo chain once a new stroke is drawn (AT-07)', () => {
    const drawn = draw(draw(newSessionState(), stepIdAt(0)), stepIdAt(0));
    const undone = reduceSession(lesson, drawn, { type: 'undo' });
    expect(canRedo(undone)).toBe(true);

    const afterNewStroke = draw(undone, stepIdAt(0));
    expect(canRedo(afterNewStroke)).toBe(false);
    expect(afterNewStroke.redoStack).toEqual([]);
    expect(afterNewStroke.strokes).toHaveLength(2);

    // Redo on an empty stack is a no-op rather than an error.
    expect(reduceSession(lesson, afterNewStroke, { type: 'redo' })).toBe(afterNewStroke);
  });

  it('restores a stroke into its original place in the replay order', () => {
    // Draw A then B, undo A (by going nowhere — undo targets the last stroke of
    // the step), so prove the reinsertion path with two steps instead.
    const first = draw(newSessionState(), stepIdAt(0));
    const onStepTwo = reduceSession(lesson, first, { type: 'next-step' });
    const second = draw(onStepTwo, stepIdAt(1));
    const backToOne = reduceSession(lesson, second, { type: 'prev-step' });

    const undone = reduceSession(lesson, backToOne, { type: 'undo' });
    expect(undone.strokes.map((s) => s.stepId)).toEqual([stepIdAt(1)]);

    const redone = reduceSession(lesson, undone, { type: 'redo' });
    // Sequence order is restored, not append order, so the earlier stroke is
    // painted under the later one again.
    expect(redone.strokes.map((s) => s.sequence)).toEqual([1, 2]);
  });

  it('only ever undoes a stroke from the step the child is on (FR-09)', () => {
    const first = draw(newSessionState(), stepIdAt(0));
    const onStepTwo = reduceSession(lesson, first, { type: 'next-step' });
    const second = draw(onStepTwo, stepIdAt(1));

    const undone = reduceSession(lesson, second, { type: 'undo' });
    expect(strokesForStep(undone, stepIdAt(0))).toHaveLength(1);
    expect(strokesForStep(undone, stepIdAt(1))).toHaveLength(0);

    // Nothing left to undo on this step, even though an earlier step has work.
    expect(canUndo(lesson, undone)).toBe(false);
    expect(reduceSession(lesson, undone, { type: 'undo' })).toBe(undone);
  });

  it('clears the redo stack when the step changes, so redo cannot resurrect an unseen stroke', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const undone = reduceSession(lesson, drawn, { type: 'undo' });
    expect(canRedo(undone)).toBe(true);

    const moved = reduceSession(lesson, undone, { type: 'next-step' });
    expect(canRedo(moved)).toBe(false);
  });

  it('undoes an erase like any other operation (FR-02)', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const erased = draw(drawn, stepIdAt(0), { tool: 'eraser' });
    expect(erased.strokes.map((s) => s.tool)).toEqual(['pen', 'eraser']);

    const undone = reduceSession(lesson, erased, { type: 'undo' });
    expect(undone.strokes.map((s) => s.tool)).toEqual(['pen']);
  });

  it('keeps more than 50 operations undoable (FR-02)', () => {
    const many = applyAll(
      newSessionState(),
      Array.from({ length: 60 }, () => ({ type: 'next-step' }) as const).slice(0, 0),
    );
    let state = many;
    for (let i = 0; i < 60; i += 1) state = draw(state, stepIdAt(0));
    expect(state.strokes).toHaveLength(60);

    for (let i = 0; i < 60; i += 1) state = reduceSession(lesson, state, { type: 'undo' });
    expect(state.strokes).toHaveLength(0);
    expect(state.redoStack).toHaveLength(60);
  });
});

/**
 * "Hapus semua" (the eraser's whole-drawing clear).
 *
 * The clear covers the whole drawing, not just the active step, and it is one
 * operation: a single Batalkan puts every stroke back where it was.
 */
describe('clearing the whole drawing', () => {
  it('removes every stroke from every step, and one undo brings them all back', () => {
    const first = draw(newSessionState(), stepIdAt(0));
    const onStepTwo = reduceSession(lesson, first, { type: 'next-step' });
    const second = draw(draw(onStepTwo, stepIdAt(1)), stepIdAt(1));
    const sequences = second.strokes.map((stroke) => stroke.sequence);
    expect(sequences).toHaveLength(3);

    const cleared = reduceSession(lesson, second, { type: 'clear-all' });
    expect(cleared.strokes).toEqual([]);
    expect(strokesForStep(cleared, stepIdAt(0))).toEqual([]);
    expect(strokesForStep(cleared, stepIdAt(1))).toEqual([]);
    // The child stays on the step they were on; only the artwork goes.
    expect(cleared.currentStepIndex).toBe(1);

    expect(canUndo(lesson, cleared)).toBe(true);
    const restored = reduceSession(lesson, cleared, { type: 'undo' });
    expect(restored.strokes.map((stroke) => stroke.sequence)).toEqual(sequences);
    expect(restored.strokes).toEqual(second.strokes);
    expect(canUndo(lesson, restored)).toBe(canUndo(lesson, second));
  });

  it('takes undone strokes with it and gives them back to redo', () => {
    const drawn = draw(draw(newSessionState(), stepIdAt(0)), stepIdAt(0));
    const undone = reduceSession(lesson, drawn, { type: 'undo' });
    expect(canRedo(undone)).toBe(true);

    const cleared = reduceSession(lesson, undone, { type: 'clear-all' });
    // Redo must not resurrect one stroke onto a canvas the child just emptied.
    expect(canRedo(cleared)).toBe(false);
    expect(cleared.redoStack).toEqual([]);

    const restored = reduceSession(lesson, cleared, { type: 'undo' });
    expect(restored.strokes).toEqual(undone.strokes);
    expect(restored.redoStack).toEqual(undone.redoStack);
  });

  it('is a no-op when there is nothing drawn', () => {
    const empty = newSessionState();
    expect(canClearAll(empty)).toBe(false);
    expect(reduceSession(lesson, empty, { type: 'clear-all' })).toBe(empty);
    expect(canUndo(lesson, empty)).toBe(false);
  });

  it('counts as real content, so the session has started (FR-13)', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const cleared = reduceSession(lesson, drawn, { type: 'clear-all' });
    expect(cleared.strokes).toEqual([]);
    expect(sessionPhase(lesson, cleared)).not.toBe('not_started');
  });

  it('keeps new work drawn after the clear, and undoes it first', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const cleared = reduceSession(lesson, drawn, { type: 'clear-all' });
    const afterClear = draw(cleared, stepIdAt(0));
    expect(afterClear.strokes).toHaveLength(1);

    // The newest stroke goes first: the clear is older than it.
    const once = reduceSession(lesson, afterClear, { type: 'undo' });
    expect(once.strokes).toEqual([]);
    const twice = reduceSession(lesson, once, { type: 'undo' });
    expect(twice.strokes.map((stroke) => stroke.id)).toEqual(drawn.strokes.map((s) => s.id));
  });

  it('does not survive a restart', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const cleared = reduceSession(lesson, drawn, { type: 'clear-all' });
    const restarted = reduceSession(lesson, cleared, { type: 'restart' });
    expect(restarted.clearedArtwork).toBeNull();
    expect(canUndo(lesson, restarted)).toBe(false);
  });
});
