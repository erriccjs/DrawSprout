/**
 * Vertical brush-size control, sitting on the left edge of the paper.
 *
 * Wide enough for a child's finger. The value is still a lesson-coordinate
 * width: moving it sets or clears the step's width override (FR-03).
 */

import type { ToolPreset } from '../lesson-data/schema';
import type { SessionAction, ToolKind } from '../lesson-engine/types';
import { brushWidthRange, sliderFollowsStep, snapWidth } from './brush-size';

interface BrushSliderProps {
  readonly stepWidth: number;
  readonly tool: ToolKind;
  readonly preset: ToolPreset;
  readonly dispatch: (action: SessionAction) => void;
}

export function BrushSlider({ stepWidth, tool, preset, dispatch }: BrushSliderProps) {
  const range = brushWidthRange(stepWidth);
  const value = snapWidth(preset.widthViewbox, range);

  return (
    <div className="brush-slider">
      <input
        type="range"
        className="brush-slider__input"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        aria-label="Ketebalan"
        aria-valuetext={sliderFollowsStep(stepWidth, tool, value) ? 'Ukuran langkah' : 'Ukuran pilihanku'}
        onChange={(event) => {
          const next = snapWidth(Number(event.target.value), range);
          if (sliderFollowsStep(stepWidth, tool, next)) {
            dispatch({ type: 'clear-custom-width' });
            return;
          }
          dispatch({ type: 'set-custom-width', width: next });
        }}
      />
    </div>
  );
}
