/**
 * Tools, colours and history controls (FR-02, FR-03, FR-04, FR-11, FR-22).
 *
 * The step prepares the tool before the child starts, and every control here
 * overrides that preparation rather than replacing it, so switching steps goes
 * back to a sensible preset without losing a deliberate colour choice.
 */

import { useState } from 'react';
import { canClearAll } from '../lesson-engine/session';
import type { SessionAction, SessionState, ToolKind } from '../lesson-engine/types';
import { ClearArtworkPrompt } from './ClearArtworkPrompt';

const TOOLS: readonly { kind: ToolKind; label: string; icon: string }[] = [
  { kind: 'pen', label: 'Pen', icon: '✏️' },
  { kind: 'brush', label: 'Kuas', icon: '🖌️' },
  { kind: 'eraser', label: 'Penghapus', icon: '🧽' },
];

interface ToolbarProps {
  readonly state: SessionState;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly dispatch: (action: SessionAction) => void;
}

interface ToolbarSettingsProps {
  readonly state: SessionState;
  readonly isColorStep: boolean;
  readonly dispatch: (action: SessionAction) => void;
}

export function Toolbar({
  state,
  canUndo,
  canRedo,
  dispatch,
}: ToolbarProps) {
  const { toolPreferences } = state;

  return (
    <div className="toolbar">
      <fieldset className="toolbar__group toolbar__group--tools">
        <legend>Alat</legend>
        {TOOLS.map((tool) => (
          <button
            key={tool.kind}
            type="button"
            className="chip"
            aria-label={tool.label}
            aria-pressed={toolPreferences.activeTool === tool.kind}
            onClick={() => dispatch({ type: 'set-tool', tool: tool.kind })}
          >
            <span aria-hidden="true">{tool.icon}</span>
            <span className="chip__label">{tool.label}</span>
          </button>
        ))}
        {/* Inside the tool group, and only while the eraser is the chosen
            tool, so it reads as the eraser's big version rather than as a
            fourth tool. Unmounting it resets the question. */}
        {toolPreferences.activeTool === 'eraser' && (
          <EraserClearAll state={state} dispatch={dispatch} />
        )}
      </fieldset>

      <fieldset className="toolbar__group toolbar__group--history">
        <legend>Riwayat</legend>
        <button
          type="button"
          className="chip chip--icon"
          aria-label="Batalkan"
          disabled={!canUndo}
          onClick={() => dispatch({ type: 'undo' })}
        >
          <span aria-hidden="true">↶</span>
        </button>
        <button
          type="button"
          className="chip chip--icon"
          aria-label="Ulangi"
          disabled={!canRedo}
          onClick={() => dispatch({ type: 'redo' })}
        >
          <span aria-hidden="true">↷</span>
        </button>
      </fieldset>
    </div>
  );
}

/**
 * "Hapus semua": the eraser applied to the whole drawing at once.
 *
 * It never clears on a single tap. The first tap only asks the question, and
 * the clear it finally dispatches is one operation, and Batalkan puts that
 * whole drawing back as long as nothing has been drawn since.
 */
function EraserClearAll({
  state,
  dispatch,
}: {
  readonly state: SessionState;
  readonly dispatch: (action: SessionAction) => void;
}) {
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <ClearArtworkPrompt
        label="Pilihan hapus semua"
        compact
        onKeep={() => setAsking(false)}
        onClear={() => {
          setAsking(false);
          dispatch({ type: 'clear-all' });
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="chip chip--wide"
      disabled={!canClearAll(state)}
      onClick={() => setAsking(true)}
    >
      <span aria-hidden="true">🧽</span> Hapus semua
    </button>
  );
}

export function ToolbarSettings({ state, isColorStep, dispatch }: ToolbarSettingsProps) {
  const { toolPreferences } = state;
  return (
    <div className="toolbar toolbar--settings">
      <fieldset className="toolbar__group">
        <legend>Cara menggambar</legend>
        <button
          type="button"
          className="chip"
          aria-pressed={state.inputMode === 'finger'}
          onClick={() => dispatch({ type: 'set-input-mode', mode: 'finger' })}
        >
          Mode jari
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={state.inputMode === 'pencil'}
          onClick={() => dispatch({ type: 'set-input-mode', mode: 'pencil' })}
        >
          Mode pensil
        </button>
        <p className="toolbar__readout toolbar__readout--muted">
          Mode pensil: hanya stylus. Telapak tangan tidak menggambar; palm rejection tak dijamin.
        </p>
      </fieldset>

      {isColorStep && (
        <fieldset className="toolbar__group">
          <legend>Bantuan warna</legend>
          <button
            type="button"
            className="chip"
            aria-pressed={toolPreferences.colorBoundaryAssist}
            onClick={() =>
              dispatch({
                type: 'set-boundary-assist',
                enabled: !toolPreferences.colorBoundaryAssist,
              })
            }
          >
            {toolPreferences.colorBoundaryAssist ? 'Batas area: aktif' : 'Batas area: nonaktif'}
          </button>
          <p className="toolbar__readout toolbar__readout--muted">
            Warna tetap di dalam bentuk contoh. Matikan jika garismu berbeda.
          </p>
        </fieldset>
      )}
    </div>
  );
}
