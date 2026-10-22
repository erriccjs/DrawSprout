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
import { previewViewBox } from './preview-frame';

interface TargetPreviewProps {
  readonly space: CoordinateSpace;
  readonly paths: readonly GuidePath[];
  readonly title: string;
  readonly step: LessonStep;
  readonly steps: readonly LessonStep[];
  readonly colorRegions: readonly ColorRegion[];
}

export function TargetPreview({ space, paths, title, step, steps, colorRegions }: TargetPreviewProps) {
  const stepIndex = Math.max(0, steps.indexOf(step));
  const currentIds = new Set(step.guidePaths.map((path) => path.id));
  const drawnIds = new Set(
    steps.slice(0, stepIndex + 1).flatMap((item) => item.guidePaths.map((path) => path.id)),
  );
  const activeRegions = new Set(step.colorRegionIds);
  const completedColors = steps.slice(0, stepIndex + 1).filter((item) => item.phase === 'color');
  const futureRegions = new Set(
    steps.slice(stepIndex + 1).flatMap((item) => item.colorRegionIds),
  );
  const reached = paths.filter((path) => drawnIds.has(path.id) || currentIds.has(path.id));
  const guides = step.guidePaths.filter((path) => !reached.some((item) => item.id === path.id));
  const lines = [...reached, ...guides];
  const viewBox = previewViewBox(space, [
    ...paths.map((path) => path.d),
    ...colorRegions.map((region) => region.d),
  ]);
  return (
    <svg
      className="target-preview"
      viewBox={viewBox}
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
      {lines.map((path) => {
        const current = currentIds.has(path.id);
        const construction = path.role === 'construction';
        const stroke = construction ? '#b5b5b5' : current ? '#e23b3b' : '#2c2c2c';
        const width = current && !construction ? 10 : construction ? 5 : 6;
        return (
          <path
            key={path.id}
            d={path.d}
            fill="none"
            stroke={stroke}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...(construction ? { strokeDasharray: '8 10' } : {})}
          />
        );
      })}
      {step.phase === 'color' &&
        colorRegions
          .filter((region) => activeRegions.has(region.id))
          .map((region) => (
            <path key={`active-${region.id}`} d={region.d} fill="none" stroke="#4b6bfb" strokeWidth={7} />
          ))}
    </svg>
  );
}
