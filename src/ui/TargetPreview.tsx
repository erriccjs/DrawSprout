/**
 * The finished drawing, shown as reference.
 *
 * PRD section 9 is explicit that the target illustration is never exported as
 * the child's artwork, and section 9.3 that the example must not cover the area
 * being drawn. Keeping it as its own small SVG panel satisfies both.
 */

import type { ColorRegion, CoordinateSpace, GuidePath, LessonStep } from '../lesson-data/schema';

interface TargetPreviewProps {
  readonly space: CoordinateSpace;
  readonly paths: readonly GuidePath[];
  readonly title: string;
  readonly step: LessonStep;
  readonly colorRegions: readonly ColorRegion[];
}

export function TargetPreview({ space, paths, title, step, colorRegions }: TargetPreviewProps) {
  const highlighted = new Set(step.guidePaths.map((path) => path.id));
  const activeRegions = new Set(step.colorRegionIds);
  return (
    <svg
      className="target-preview"
      viewBox={`0 0 ${space.width} ${space.height}`}
      role="img"
      aria-label={`Contoh hasil akhir: ${title}`}
    >
      {step.phase === 'color' &&
        colorRegions
          .filter((region) => activeRegions.has(region.id))
          .map((region) => <path key={region.id} d={region.d} fill={step.toolPreset.color} />)}
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
    </svg>
  );
}
