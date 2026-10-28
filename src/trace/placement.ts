/**
 * Where a tracing photo sits on the lesson paper.
 * Units are the lesson coordinate space, so a resize does not move the photo
 * relative to the child's lines.
 */

export interface TracePlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const MARGIN = 24;

export function fitPhoto(spaceWidth: number, spaceHeight: number, imageWidth: number, imageHeight: number): TracePlacement {
  const maxWidth = Math.max(1, spaceWidth - MARGIN * 2);
  const maxHeight = Math.max(1, spaceHeight - MARGIN * 2);
  const scale = Math.min(maxWidth / Math.max(1, imageWidth), maxHeight / Math.max(1, imageHeight));
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (spaceWidth - width) / 2,
    y: (spaceHeight - height) / 2,
    width,
    height,
  };
}

export function movePhoto(placement: TracePlacement, dx: number, dy: number, spaceWidth: number, spaceHeight: number): TracePlacement {
  const minX = MARGIN - placement.width;
  const minY = MARGIN - placement.height;
  return {
    ...placement,
    x: clamp(placement.x + dx, minX, spaceWidth - MARGIN),
    y: clamp(placement.y + dy, minY, spaceHeight - MARGIN),
  };
}

/** Scales around the photo's centre. The aspect ratio stays the same. */
export function scalePhoto(placement: TracePlacement, factor: number, spaceWidth: number, spaceHeight: number): TracePlacement {
  const nextWidth = clamp(placement.width * factor, 80, spaceWidth * 2);
  const nextHeight = placement.height * (nextWidth / placement.width);
  const cx = placement.x + placement.width / 2;
  const cy = placement.y + placement.height / 2;
  return movePhoto({
    x: cx - nextWidth / 2,
    y: cy - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  }, 0, 0, spaceWidth, spaceHeight);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
