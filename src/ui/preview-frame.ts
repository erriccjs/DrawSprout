/**
 * A viewBox that frames the example on the drawing, not the empty lesson canvas.
 *
 * The card is 4:3. A picture that uses the whole 1000×750 space leaves a small
 * subject floating in the middle. Framing the paths, then restoring the lesson
 * aspect, makes the drawing fill that card.
 */

export interface PreviewSpace {
  readonly width: number;
  readonly height: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function addPoint(bounds: Bounds, x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function arcBounds(
  bounds: Bounds,
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  phiDeg: number,
  large: number,
  sweep: number,
  x2: number,
  y2: number,
): void {
  addPoint(bounds, x1, y1);
  addPoint(bounds, x2, y2);
  if (rx === 0 || ry === 0) return;
  const radiusX = Math.abs(rx);
  const radiusY = Math.abs(ry);
  rx = radiusX;
  ry = radiusY;
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  let rxsq = rx * rx;
  let rysq = ry * ry;
  const lambda = (x1p * x1p) / rxsq + (y1p * y1p) / rysq;
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
    rxsq = rx * rx;
    rysq = ry * ry;
  }
  const denom = rxsq * y1p * y1p + rysq * x1p * x1p;
  const numer = Math.max(0, rxsq * rysq - rxsq * y1p * y1p - rysq * x1p * x1p);
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(denom === 0 ? 0 : numer / denom);
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * -((ry * x1p) / rx);
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

  const vectorAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let angle = Math.acos(Math.min(1, Math.max(-1, length === 0 ? 0 : dot / length)));
    if (ux * vy - uy * vx < 0) angle = -angle;
    return angle;
  };
  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (sweep === 0 && delta > 0) delta -= Math.PI * 2;
  if (sweep === 1 && delta < 0) delta += Math.PI * 2;

  const onSweep = (theta: number) => {
    let offset = theta - theta1;
    if (delta >= 0) {
      while (offset < 0) offset += Math.PI * 2;
      while (offset >= Math.PI * 2) offset -= Math.PI * 2;
      return offset <= delta + 1e-4;
    }
    while (offset > 0) offset -= Math.PI * 2;
    while (offset <= -Math.PI * 2) offset += Math.PI * 2;
    return offset >= delta - 1e-4;
  };

  for (const theta of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    if (!onSweep(theta)) continue;
    const localX = rx * Math.cos(theta);
    const localY = ry * Math.sin(theta);
    addPoint(bounds, cx + cos * localX - sin * localY, cy + sin * localX + cos * localY);
  }
}

/** Includes every coordinate a path can reach. Beziers stay inside their control points. */
export function pathBounds(d: string): Bounds | null {
  const bounds = emptyBounds();
  const tokens = d.match(/[MmLlHhVvCcQqAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  if (!tokens) return null;
  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const read = () => Number(tokens[index++]);
  const absolute = (value: number, origin: number) => (command === command.toUpperCase() ? value : origin + value);

  while (index < tokens.length) {
    if (/[A-Za-z]/.test(tokens[index]!)) command = tokens[index++]!;
    if (!command) break;
    const op = command.toUpperCase();
    if (op === 'Z') {
      x = startX;
      y = startY;
      continue;
    }
    if (index >= tokens.length || /[A-Za-z]/.test(tokens[index]!)) continue;
    if (op === 'M' || op === 'L') {
      const nextX = absolute(read(), x);
      const nextY = absolute(read(), y);
      addPoint(bounds, nextX, nextY);
      x = nextX;
      y = nextY;
      if (op === 'M') {
        startX = x;
        startY = y;
        command = command === 'm' ? 'l' : 'L';
      }
    } else if (op === 'H') {
      x = absolute(read(), x);
      addPoint(bounds, x, y);
    } else if (op === 'V') {
      y = absolute(read(), y);
      addPoint(bounds, x, y);
    } else if (op === 'C') {
      const x1 = absolute(read(), x);
      const y1 = absolute(read(), y);
      const x2 = absolute(read(), x);
      const y2 = absolute(read(), y);
      const nextX = absolute(read(), x);
      const nextY = absolute(read(), y);
      addPoint(bounds, x1, y1);
      addPoint(bounds, x2, y2);
      addPoint(bounds, nextX, nextY);
      x = nextX;
      y = nextY;
    } else if (op === 'Q') {
      const cx = absolute(read(), x);
      const cy = absolute(read(), y);
      const nextX = absolute(read(), x);
      const nextY = absolute(read(), y);
      addPoint(bounds, cx, cy);
      addPoint(bounds, nextX, nextY);
      x = nextX;
      y = nextY;
    } else if (op === 'A') {
      const rx = read();
      const ry = read();
      const phi = read();
      const large = read();
      const sweep = read();
      const nextX = absolute(read(), x);
      const nextY = absolute(read(), y);
      arcBounds(bounds, x, y, rx, ry, phi, large, sweep, nextX, nextY);
      x = nextX;
      y = nextY;
    } else {
      break;
    }
  }

  return Number.isFinite(bounds.minX) ? bounds : null;
}

/**
 * `viewBox` for an example SVG. The frame keeps the lesson's aspect ratio and
 * stays inside the coordinate space, with a small pad so strokes are not cut.
 */
export function previewViewBox(space: PreviewSpace, paths: readonly string[]): string {
  const full = `0 0 ${space.width} ${space.height}`;
  const bounds = emptyBounds();
  for (const d of paths) {
    const next = pathBounds(d);
    if (!next) continue;
    addPoint(bounds, next.minX, next.minY);
    addPoint(bounds, next.maxX, next.maxY);
  }
  if (!Number.isFinite(bounds.minX) || space.width <= 0 || space.height <= 0) return full;

  const pad = 16;
  let x = bounds.minX - pad;
  let y = bounds.minY - pad;
  let width = bounds.maxX - bounds.minX + pad * 2;
  let height = bounds.maxY - bounds.minY + pad * 2;
  const aspect = space.width / space.height;
  if (width / height < aspect) {
    const next = height * aspect;
    x -= (next - width) / 2;
    width = next;
  } else if (width / height > aspect) {
    const next = width / aspect;
    y -= (next - height) / 2;
    height = next;
  }
  if (width >= space.width) {
    x = 0;
    width = space.width;
  } else {
    x = Math.min(Math.max(0, x), space.width - width);
  }
  if (height >= space.height) {
    y = 0;
    height = space.height;
  } else {
    y = Math.min(Math.max(0, y), space.height - height);
  }
  const trim = (value: number) => Math.round(value * 10) / 10;
  return `${trim(x)} ${trim(y)} ${trim(width)} ${trim(height)}`;
}
