/**
 * Dashed guide overlay.
 *
 * Rendered as an SVG element layered over the artwork canvas, not painted into
 * it. That makes FR-06's "tidak ikut ekspor" structural rather than something
 * the export code has to remember: the guides are not in any canvas, so no PNG
 * can contain them.
 *
 * Only the active step's geometry is drawn, and the layer never takes pointer
 * events, so a guide can never swallow a stroke.
 */

import type { CoordinateSpace, GuidePath } from '../lesson-data/schema';

interface GuideOverlayProps {
  readonly space: CoordinateSpace;
  readonly paths: readonly GuidePath[];
  readonly visible: boolean;
  readonly widthCss: number;
  readonly heightCss: number;
}

/**
 * Dash lengths are in coordinate units. Construction geometry is finer and
 * fainter than final outline geometry so the two are told apart by pattern and
 * weight, not only colour (PRD section 10).
 */
const STYLE_BY_ROLE = {
  'final-outline': { dash: '20 14', width: 4, opacity: 0.75, color: '#e23b3b' },
  construction: { dash: '4 14', width: 3, opacity: 0.9, color: '#b5b5b5' },
} as const;

export function GuideOverlay({ space, paths, visible, widthCss, heightCss }: GuideOverlayProps) {
  return (
    <svg
      className="guide-overlay"
      viewBox={`0 0 ${space.width} ${space.height}`}
      width={widthCss}
      height={heightCss}
      // The instruction text carries the meaning; the dashes are a visual aid.
      aria-hidden="true"
      data-visible={visible}
    >
      {visible &&
        paths.map((path) => {
          const style = STYLE_BY_ROLE[path.role];
          return (
            <path
              key={path.id}
              d={path.d}
              fill="none"
              stroke={style.color}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              strokeLinecap="round"
              opacity={style.opacity}
            />
          );
        })}
    </svg>
  );
}
