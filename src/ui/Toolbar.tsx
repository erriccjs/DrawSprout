/**
 * Tools, colours and history controls (FR-02, FR-03, FR-04, FR-11, FR-22).
 *
 * The step prepares the tool before the child starts, and every control here
 * overrides that preparation rather than replacing it, so switching steps goes
 * back to a sensible preset without losing a deliberate colour choice.
 */

import type { LessonPackage, ToolPreset } from '../lesson-data/schema';
import type { SessionAction, SessionState, ToolKind } from '../lesson-engine/types';

/** A small, high-contrast palette; names matter for colour-blind users. */
export const PALETTE = [
  { color: '#3a3a3a', label: 'Hitam' },
  { color: '#e8552d', label: 'Merah' },
  { color: '#e8a33d', label: 'Oranye' },
  { color: '#f2d14b', label: 'Kuning' },
  { color: '#4a9b5c', label: 'Hijau' },
  { color: '#3f7ad6', label: 'Biru' },
  { color: '#8a5bd6', label: 'Ungu' },
  { color: '#f2a6b3', label: 'Pink' },
  { color: '#8a5a2b', label: 'Coklat' },
  { color: '#ffffff', label: 'Putih' },
] as const;

/** Multipliers on the step's prepared width, so "tipis" scales with the step. */
const WIDTH_CHOICES = [
  { label: 'Tipis', factor: 0.5 },
  { label: 'Sedang', factor: 1 },
  { label: 'Tebal', factor: 2 },
] as const;

const TOOLS: readonly { kind: ToolKind; label: string; icon: string }[] = [
  { kind: 'pen', label: 'Pen', icon: '✏️' },
  { kind: 'brush', label: 'Kuas', icon: '🖌️' },
  { kind: 'eraser', label: 'Penghapus', icon: '🧽' },
];

interface ToolbarProps {
  readonly lesson: LessonPackage;
  readonly state: SessionState;
  readonly preset: ToolPreset;
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
  lesson,
  state,
  preset,
  canUndo,
  canRedo,
  dispatch,
}: ToolbarProps) {
  const { toolPreferences } = state;
  const stepWidth = lesson.steps[state.currentStepIndex]?.toolPreset.widthViewbox ?? 1;

  return (
    <div className="toolbar">
      <fieldset className="toolbar__group">
        <legend>Alat</legend>
        {TOOLS.map((tool) => (
          <button
            key={tool.kind}
            type="button"
            className="chip"
            aria-pressed={toolPreferences.activeTool === tool.kind}
            onClick={() => dispatch({ type: 'set-tool', tool: tool.kind })}
          >
            <span aria-hidden="true">{tool.icon}</span> {tool.label}
          </button>
        ))}
      </fieldset>

      <fieldset className="toolbar__group">
        <legend>Warna</legend>
        <button
          type="button"
          className="chip"
          aria-pressed={toolPreferences.colorSource === 'guide'}
          onClick={() => dispatch({ type: 'use-guide-color' })}
        >
          Ikuti panduan
        </button>
        <div className="swatches">
          {PALETTE.map((entry) => {
            const active =
              toolPreferences.colorSource === 'custom' && toolPreferences.customColor === entry.color;
            return (
              <button
                key={entry.color}
                type="button"
                className="swatch"
                style={{ backgroundColor: entry.color }}
                aria-label={`Warna ${entry.label}`}
                aria-pressed={active}
                onClick={() => dispatch({ type: 'set-custom-color', color: entry.color })}
              />
            );
          })}
        </div>
        <p className="toolbar__readout">
          Warna sekarang: <span className="dot" style={{ backgroundColor: preset.color }} />
          {toolPreferences.colorSource === 'custom' ? ' warna pilihanku' : ' warna panduan'}
        </p>
      </fieldset>

      <fieldset className="toolbar__group">
        <legend>Ketebalan</legend>
        {WIDTH_CHOICES.map((choice) => {
          const width = round(stepWidth * choice.factor);
          const active =
            toolPreferences.customWidth === null
              ? choice.factor === 1
              : toolPreferences.customWidth === width;
          return (
            <button
              key={choice.label}
              type="button"
              className="chip"
              aria-pressed={active}
              onClick={() =>
                choice.factor === 1
                  ? dispatch({ type: 'clear-custom-width' })
                  : dispatch({ type: 'set-custom-width', width })
              }
            >
              {choice.label}
            </button>
          );
        })}
      </fieldset>

      <fieldset className="toolbar__group">
        <legend>Riwayat</legend>
        <button
          type="button"
          className="chip"
          disabled={!canUndo}
          onClick={() => dispatch({ type: 'undo' })}
        >
          ↶ Batalkan
        </button>
        <button
          type="button"
          className="chip"
          disabled={!canRedo}
          onClick={() => dispatch({ type: 'redo' })}
        >
          ↷ Ulangi
        </button>
      </fieldset>
    </div>
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
          Mode pensil hanya menerima stylus pen. Telapak tangan yang terbaca sebagai sentuhan
          tidak menggambar, tetapi aplikasi tidak menjanjikan palm rejection.
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
            Batas area menahan warna di dalam bentuk contoh. Kalau garismu berbeda, matikan saja.
          </p>
        </fieldset>
      )}
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
