/**
 * The active colour, as one circle. Opening it shows the palette, colours
 * used recently, and the way back to the step's guide colour (FR-04).
 */

import { useEffect, useRef, useState } from 'react';
import type { ToolPreset } from '../lesson-data/schema';
import type { SessionAction, SessionState } from '../lesson-engine/types';
import { rememberColor } from './color-history';
import { PALETTE, paletteLabel } from './palette';

interface ColorWellProps {
  readonly state: SessionState;
  readonly preset: ToolPreset;
  readonly dispatch: (action: SessionAction) => void;
  /** Incremented by the dock palette chip to open this popover. */
  readonly openSignal?: number;
  readonly onOpenHelp?: () => void;
}

export function ColorWell({ state, preset, dispatch, openSignal = 0, onOpenHelp }: ColorWellProps) {
  const [open, setOpen] = useState(false);
  const [appliedSignal, setAppliedSignal] = useState(openSignal);
  const [recents, setRecents] = useState<readonly string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const { colorSource, customColor } = state.toolPreferences;

  if (openSignal !== appliedSignal) {
    setAppliedSignal(openSignal);
    if (openSignal > 0) setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (color: string) => {
    setRecents((current) => rememberColor(current, color));
    dispatch({ type: 'set-custom-color', color });
  };

  const activeLabel = paletteLabel(preset.color) ?? 'campuran';

  return (
    <div className="color-well" ref={rootRef}>
      <button
        type="button"
        className="color-well__orb"
        style={{ backgroundColor: preset.color }}
        aria-label={`Pilih warna, ${activeLabel}`}
        aria-expanded={open}
        aria-pressed={colorSource === 'custom'}
        onClick={() => setOpen((current) => !current)}
      />
      <div className="color-well__popover" data-open={open}>
        <button
          type="button"
          className="chip"
          aria-pressed={colorSource === 'guide'}
          onClick={() => dispatch({ type: 'use-guide-color' })}
        >
          Ikuti panduan
        </button>
        <div className="swatches" role="group" aria-label="Palet">
          {PALETTE.map((entry) => {
            const active = colorSource === 'custom' && customColor.toLowerCase() === entry.color.toLowerCase();
            return (
              <button
                key={entry.color}
                type="button"
                className="swatch"
                style={{ backgroundColor: entry.color }}
                aria-label={`Warna ${entry.label}`}
                aria-pressed={active}
                onClick={() => choose(entry.color)}
              />
            );
          })}
        </div>
        {recents.length > 0 && (
          <div className="swatches color-well__recents" role="group" aria-label="Warna terakhir">
            {recents.map((color) => {
              const label = paletteLabel(color) ?? color;
              const active = colorSource === 'custom' && customColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  className="swatch"
                  style={{ backgroundColor: color }}
                  aria-label={`Warna terakhir ${label}`}
                  aria-pressed={active}
                  onClick={() => choose(color)}
                />
              );
            })}
          </div>
        )}
        <p className="toolbar__readout">
          Warna sekarang: <span className="dot" style={{ backgroundColor: preset.color }} />
          {colorSource === 'custom' ? ' warna pilihanku' : ' warna panduan'}
        </p>
        {onOpenHelp && (
          <button
            type="button"
            className="chip"
            onClick={() => {
              setOpen(false);
              onOpenHelp();
            }}
          >
            Bantuan
          </button>
        )}
      </div>
    </div>
  );
}
