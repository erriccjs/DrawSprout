/**
 * Drag-and-resize crop frame over a chosen photo.
 *
 * Shared by the photo lesson flow and the doodle flow: both need the parent to
 * point at the one subject before anything leaves the device. The crop is
 * normalised (0..1) so it survives any display size.
 */

import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useI18n } from '../i18n/context';
import { clampCrop, type NormalizedCrop } from '../photo/prepare';

export function CropBox({
  crop,
  imageUrl,
  onChange,
}: {
  readonly crop: NormalizedCrop;
  readonly imageUrl: string;
  readonly onChange: (crop: NormalizedCrop) => void;
}) {
  const { t } = useI18n();
  const frame = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; crop: NormalizedCrop } | null>(null);

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    const node = frame.current;
    if (!state || !node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = (event.clientX - state.x) / rect.width;
    const dy = (event.clientY - state.y) / rect.height;
    if (state.mode === 'move') {
      onChange(clampCrop({ ...state.crop, x: state.crop.x + dx, y: state.crop.y + dy }));
    } else {
      onChange(clampCrop({ ...state.crop, width: state.crop.width + dx, height: state.crop.height + dy }));
    }
  };

  const down = (event: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, y: event.clientY, crop };
  };

  return (
    <div className="photo-crop" ref={frame}>
      <img src={imageUrl} alt={t('photoToCrop')} />
      <div
        className="photo-crop__box"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
        onPointerDown={(event) => down(event, 'move')}
        onPointerMove={move}
        onPointerUp={() => { drag.current = null; }}
      >
        <button
          type="button"
          className="photo-crop__handle"
          aria-label={t('resizePart')}
          onPointerDown={(event) => down(event, 'resize')}
          onPointerMove={move}
          onPointerUp={() => { drag.current = null; }}
        />
      </div>
    </div>
  );
}
