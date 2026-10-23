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

import { useI18n } from '../i18n/context';
import type { ColorRegion, CoordinateSpace, GuidePath, LessonStep } from '../lesson-data/schema';
import { previewStrokeWidth, PREVIEW_INK, stepPreview } from '../lesson-data/step-preview';
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
  const { t } = useI18n();
  const preview = stepPreview({ steps, colorRegions }, Math.max(0, steps.indexOf(step)));
  const viewBox = previewViewBox(space, [
    ...paths.map((path) => path.d),
    ...colorRegions.map((region) => region.d),
    ...preview.strokes.map((stroke) => stroke.d),
  ]);
  return (
    <svg
      className="target-preview"
      viewBox={viewBox}
      role="img"
      aria-label={t('targetPreview', { title })}
    >
      {preview.fills.map((fill) => (
        <path key={fill.id} d={fill.d} fill={fill.fill === 'paper' ? 'var(--paper)' : fill.fill} />
      ))}
      {preview.strokes.map((stroke) => (
        <path
          key={`${stroke.kind}-${stroke.id}`}
          d={stroke.d}
          fill="none"
          stroke={PREVIEW_INK[stroke.kind]}
          strokeWidth={previewStrokeWidth(stroke.kind)}
          strokeDasharray={stroke.kind === 'construction' ? '12 14' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {preview.activeOutlines.map((stroke) => (
        <path
          key={stroke.id}
          d={stroke.d}
          fill="none"
          stroke={PREVIEW_INK.new}
          strokeWidth={7}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
