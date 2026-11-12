/**
 * Tools, colours and history controls (FR-02, FR-03, FR-04, FR-11, FR-22).
 *
 * The step prepares the tool before the child starts, and every control here
 * overrides that preparation rather than replacing it, so switching steps goes
 * back to a sensible preset without losing a deliberate colour choice.
 */

import { useState } from 'react';
import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/messages';
import { canClearAll } from '../lesson-engine/session';
import type { SessionAction, SessionState, ToolKind } from '../lesson-engine/types';
import { ClearArtworkPrompt } from './ClearArtworkPrompt';
import { StepControls } from './StepPanel';

const TOOLS: readonly { kind: ToolKind; label: MessageKey; icon: string }[] = [
  { kind: 'pen', label: 'pen', icon: '✏️' },
  { kind: 'brush', label: 'brush', icon: '🖌️' },
  { kind: 'eraser', label: 'eraser', icon: '🧽' },
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
  /** The step's own tool. The dock shows one drawing tool; the other waits under More. */
  readonly stepTool: ToolKind;
  readonly moreOpen: boolean;
  readonly onToggleMore: () => void;
  readonly isColorStep: boolean;
  readonly guidesVisible: boolean;
  readonly onShowHint: () => void;
}

export function Toolbar({
  state,
  canUndo,
  canRedo,
  dispatch,
  stepTool,
  moreOpen,
  onToggleMore,
  isColorStep,
  guidesVisible,
  onShowHint,
}: ToolbarProps) {
  const { t } = useI18n();
  const { toolPreferences } = state;
  const prepared: 'pen' | 'brush' = stepTool === 'pen' ? 'pen' : 'brush';
  const dockTool: 'pen' | 'brush' = toolPreferences.activeTool === 'pen' || toolPreferences.activeTool === 'brush'
    ? toolPreferences.activeTool
    : prepared;
  const otherTool: 'pen' | 'brush' = dockTool === 'pen' ? 'brush' : 'pen';
  const dock = TOOLS.find((tool) => tool.kind === dockTool) ?? TOOLS[1]!;
  const other = TOOLS.find((tool) => tool.kind === otherTool) ?? TOOLS[0]!;

  return (
    <div className="toolbar">
      <fieldset className="toolbar__group toolbar__group--tools">
        <legend className="sr-only">{t('tools')}</legend>
        <button
          type="button"
          className="chip"
          aria-label={t(dock.label)}
          aria-pressed={toolPreferences.activeTool === dock.kind}
          onClick={() => dispatch({ type: 'set-tool', tool: dock.kind })}
        >
          <span aria-hidden="true">{dock.icon}</span>
          <span className="chip__label">{t(dock.label)}</span>
        </button>
        <button
          type="button"
          className="chip"
          aria-label={t('eraser')}
          aria-pressed={toolPreferences.activeTool === 'eraser'}
          onClick={() => dispatch({ type: 'set-tool', tool: 'eraser' })}
        >
          <span aria-hidden="true">🧽</span>
          <span className="chip__label">{t('eraser')}</span>
        </button>
      </fieldset>

      <fieldset className="toolbar__group toolbar__group--history">
        <legend>{t('history')}</legend>
        <button
          type="button"
          className="chip chip--icon"
          aria-label={t('undo')}
          disabled={!canUndo}
          onClick={() => dispatch({ type: 'undo' })}
        >
          <span aria-hidden="true">↶</span>
        </button>
        <button
          type="button"
          className="chip chip--icon"
          aria-label={t('redo')}
          disabled={!canRedo}
          onClick={() => dispatch({ type: 'redo' })}
        >
          <span aria-hidden="true">↷</span>
        </button>
      </fieldset>

      <button
        type="button"
        className="chip toolbar__more"
        aria-expanded={moreOpen}
        aria-controls="more-tools"
        onClick={onToggleMore}
      >
        {t('moreTools')}
      </button>

      {moreOpen && (
        <div className="toolbar-more" id="more-tools" role="group" aria-label={t('moreTools')}>
          <button
            type="button"
            className="chip"
            aria-label={t(other.label)}
            aria-pressed={toolPreferences.activeTool === other.kind}
            onClick={() => dispatch({ type: 'set-tool', tool: other.kind })}
          >
            <span aria-hidden="true">{other.icon}</span>
            <span className="chip__label">{t(other.label)}</span>
          </button>
          <fieldset className="toolbar__group toolbar__group--mode">
            <legend>{t('drawMode')}</legend>
            <button
              type="button"
              className="chip chip--mode"
              aria-label={t('pencilMode')}
              title={t('pencil')}
              aria-pressed={state.inputMode === 'pencil'}
              onClick={() => dispatch({ type: 'set-input-mode', mode: 'pencil' })}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className="chip chip--mode"
              aria-label={t('fingerMode')}
              title={t('finger')}
              aria-pressed={state.inputMode === 'finger'}
              onClick={() => dispatch({ type: 'set-input-mode', mode: 'finger' })}
            >
              <FingerIcon />
            </button>
          </fieldset>
          <EraserClearAll state={state} dispatch={dispatch} />
          <StepControls state={state} guidesVisible={guidesVisible} onShowHint={onShowHint} dispatch={dispatch} />
          {isColorStep && (
            <fieldset className="toolbar__group">
              <legend>{t('colorHelp')}</legend>
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
                {toolPreferences.colorBoundaryAssist ? t('boundaryOn') : t('boundaryOff')}
              </button>
            </fieldset>
          )}
        </div>
      )}
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
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <ClearArtworkPrompt
        label={t('clearAllChoice')}
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
      <span aria-hidden="true">🧽</span> {t('sponge')}
    </button>
  );
}
