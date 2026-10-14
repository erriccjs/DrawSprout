/**
 * The drawing reference, shown as a step-by-step example.
 *
 * PRD section 9 is explicit that the target illustration is never exported as
 * the child's artwork, and section 9.3 that the example must not cover the area
 * being drawn. Keeping it as its own small SVG panel satisfies both.
 *
 * During a `color` step the panel shows completed colour steps and outlines
 * the current step's regions. Later regions stay blank even when they overlap
 * an earlier fill. The fill is a suggestion,
 * not a constraint — the child's own colour choice stays available (FR-04).
 */

import type { ColorRegion, CoordinateSpace, GuidePath, LessonStep } from '../lesson-data/schema';

interface TargetPreviewProps {
  readonly space: CoordinateSpace;
  readonly paths: readonly GuidePath[];
  readonly title: string;
  readonly step: LessonStep;
  readonly steps: readonly LessonStep[];
  readonly colorRegions: readonly ColorRegion[];
}

export function TargetPreview({ space, paths, title, step, steps, colorRegions }: TargetPreviewProps) {
  const highlighted = new Set(step.guidePaths.map((path) => path.id));
  const activeRegions = new Set(step.colorRegionIds);
  const stepIndex = steps.indexOf(step);
  const completedColors = steps.slice(0, stepIndex + 1).filter((item) => item.phase === 'color');
  const futureRegions = new Set(
    steps.slice(stepIndex + 1).flatMap((item) => item.colorRegionIds),
  );
  return (
    <svg
      className="target-preview"
      viewBox={`0 0 ${space.width} ${space.height}`}
      role="img"
      aria-label={`Contoh hasil akhir: ${title}`}
    >
      {step.phase === 'color' && (
        <>
          {completedColors.flatMap((item) =>
            colorRegions
              .filter((region) => item.colorRegionIds.includes(region.id))
              .map((region) => (
                <path key={`${item.id}-${region.id}`} d={region.d} fill={item.toolPreset.color} />
              )),
          )}
          {colorRegions
            .filter((region) => futureRegions.has(region.id))
            .map((region) => <path key={`future-${region.id}`} d={region.d} fill="var(--paper)" />)}
        </>
      )}
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill="none"
          stroke={highlighted.has(path.id) ? '#4b6bfb' : '#8a9099'}
          strokeWidth={highlighted.has(path.id) ? 10 : 5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {step.phase === 'color' &&
        colorRegions
          .filter((region) => activeRegions.has(region.id))
          .map((region) => (
            <path key={`active-${region.id}`} d={region.d} fill="none" stroke="#4b6bfb" strokeWidth={7} />
          ))}
    </svg>
  );
}
