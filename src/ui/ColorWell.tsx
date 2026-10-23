/**
 * The active colour, as one circle. Opening it shows the palette, colours
 * used recently, and the way back to the step's guide colour (FR-04).
 */

import { useEffect, useRef, useState } from 'react';
import type { ToolPreset } from '../lesson-data/schema';
import type { SessionAction, SessionState } from '../lesson-engine/types';
import { rememberColor } from './color-history';
import { useI18n } from '../i18n/context';
import { paletteName } from '../i18n/messages';
import { PALETTE, paletteLabel } from './palette';

interface ColorWellProps {
  readonly state: SessionState;
  readonly preset: ToolPreset;
  readonly dispatch: (action: SessionAction) => void;
}

export function ColorWell({ state, preset, dispatch }: ColorWellProps) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<readonly string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const { colorSource, customColor } = state.toolPreferences;

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

  const { t, locale } = useI18n();
  const activeLabel = paletteName(locale, paletteLabel(preset.color) ?? t('mixed'));

  return (
    <div className="color-well" ref={rootRef}>
      <button
        type="button"
        className="color-well__orb"
        style={{ backgroundColor: preset.color }}
        aria-label={t('pickColor', { name: activeLabel })}
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
          {t('followGuide')}
        </button>
        <div className="swatches" role="group" aria-label={t('palette')}>
          {PALETTE.map((entry) => {
            const active = colorSource === 'custom' && customColor.toLowerCase() === entry.color.toLowerCase();
            return (
              <button
                key={entry.color}
                type="button"
                className="swatch"
                style={{ backgroundColor: entry.color }}
                aria-label={t('colorSwatch', { name: paletteName(locale, entry.label) })}
                aria-pressed={active}
                onClick={() => choose(entry.color)}
              />
            );
          })}
        </div>
        {recents.length > 0 && (
          <div className="swatches color-well__recents" role="group" aria-label={t('recentColors')}>
            {recents.map((color) => {
              const label = paletteLabel(color) ?? color;
              const active = colorSource === 'custom' && customColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  className="swatch"
                  style={{ backgroundColor: color }}
                  aria-label={t('recentColor', { name: paletteName(locale, label) })}
                  aria-pressed={active}
                  onClick={() => choose(color)}
                />
              );
            })}
          </div>
        )}
        <p className="toolbar__readout">
          {t('currentColor')} <span className="dot" style={{ backgroundColor: preset.color }} />
          {colorSource === 'custom' ? t('myColor') : t('guideColor')}
        </p>
      </div>
    </div>
  );
}
