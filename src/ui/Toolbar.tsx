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

function PencilIcon() {
  return (
    <svg className="chip-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      />
    </svg>
  );
}

function FingerIcon() {
  return (
    <svg className="chip-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 11.5V5.2a1.7 1.7 0 0 1 3.4 0V12h.3V7.2a1.6 1.6 0 0 1 3.2 0V13h.2v-2.2a1.5 1.5 0 0 1 3 0V15c0 3.3-2.4 6-6.2 6H11c-2.2 0-3.6-1-4.4-2.2L4.2 14a1.6 1.6 0 0 1 2.5-2l2.3 1.6V11.5z"
      />
    </svg>
  );
}

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
      <fieldset className="toolbar__group toolbar__group--mode">
        <legend>Cara menggambar</legend>
        <button
          type="button"
          className="chip chip--mode"
          aria-label="Mode jari"
          aria-pressed={state.inputMode === 'finger'}
          onClick={() => dispatch({ type: 'set-input-mode', mode: 'finger' })}
        >
          <FingerIcon />
          <span className="chip__label">Jari</span>
        </button>
        <button
          type="button"
          className="chip chip--mode"
          aria-label="Mode pensil"
          aria-pressed={state.inputMode === 'pencil'}
          onClick={() => dispatch({ type: 'set-input-mode', mode: 'pencil' })}
        >
          <PencilIcon />
          <span className="chip__label">Pensil</span>
        </button>
      </fieldset>

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
        <p className="toolbar__readout toolbar__readout--muted">
          Ganti mode di tombol Jari atau Pensil. Mode pensil hanya menerima stylus.
          Sentuhan yang sangat lebar diabaikan di mode jari, tetapi penolakan telapak
          tangan dari sistem tidak dijamin.
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
