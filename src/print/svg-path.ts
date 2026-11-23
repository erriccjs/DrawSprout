/**
 * SVG path data to absolute move, line, and cubic commands.
 *
 * Lessons only use the path subset in `lesson-data/validate.ts`. Arcs and
 * quadratics become cubics so a PDF page can stroke them without a canvas.
 */

export interface MoveOp {
  readonly op: 'M';
  readonly x: number;
  readonly y: number;
}

export interface LineOp {
  readonly op: 'L';
  readonly x: number;
  readonly y: number;
}

export interface CubicOp {
  readonly op: 'C';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly x: number;
  readonly y: number;
}

export interface CloseOp {
  readonly op: 'Z';
}

export type DrawOp = MoveOp | LineOp | CubicOp | CloseOp;

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

/** Parses `d`. An empty list means the string had no usable geometry. */
export function svgToOps(d: string): DrawOp[] {
  const tokens = d.match(TOKEN) ?? [];
  const ops: DrawOp[] = [];
  let index = 0;
  let command = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastCubic: { x: number; y: number } | null = null;
  let lastQuad: { x: number; y: number } | null = null;

  const read = (): number => {
    const token = tokens[index++] ?? '0';
    return Number(token);
  };

  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    ops.push({ op: 'C', x1, y1, x2, y2, x, y });
    lastCubic = { x: x2, y: y2 };
    lastQuad = null;
    cx = x;
    cy = y;
  };

  const quad = (qx: number, qy: number, x: number, y: number) => {
    const x1 = cx + (2 / 3) * (qx - cx);
    const y1 = cy + (2 / 3) * (qy - cy);
    const x2 = x + (2 / 3) * (qx - x);
    const y2 = y + (2 / 3) * (qy - y);
    ops.push({ op: 'C', x1, y1, x2, y2, x, y });
    lastQuad = { x: qx, y: qy };
    lastCubic = null;
    cx = x;
    cy = y;
  };

  const reflect = (point: { x: number; y: number } | null): { x: number; y: number } => {
    if (!point) return { x: cx, y: cy };
    return { x: 2 * cx - point.x, y: 2 * cy - point.y };
  };

  while (index < tokens.length) {
    const token = tokens[index] ?? '';
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      index += 1;
    } else if (command === '') {
      break;
    }

    const relative = command === command.toLowerCase();
    switch (command) {
      case 'M':
      case 'm': {
        const x = read() + (relative ? cx : 0);
        const y = read() + (relative ? cy : 0);
        ops.push({ op: 'M', x, y });
        cx = x;
        cy = y;
        sx = x;
        sy = y;
        lastCubic = null;
        lastQuad = null;
        command = relative ? 'l' : 'L';
        break;
      }
      case 'L':
      case 'l': {
        const x = read() + (relative ? cx : 0);
        const y = read() + (relative ? cy : 0);
        ops.push({ op: 'L', x, y });
        cx = x;
        cy = y;
        lastCubic = null;
        lastQuad = null;
        break;
      }
      case 'H':
      case 'h': {
        const x = read() + (relative ? cx : 0);
        ops.push({ op: 'L', x, y: cy });
        cx = x;
        lastCubic = null;
        lastQuad = null;
        break;
      }
      case 'V':
      case 'v': {
        const y = read() + (relative ? cy : 0);
        ops.push({ op: 'L', x: cx, y });
        cy = y;
        lastCubic = null;
        lastQuad = null;
        break;
      }
      case 'C':
      case 'c': {
        const x1 = read() + (relative ? cx : 0);
        const y1 = read() + (relative ? cy : 0);
        const x2 = read() + (relative ? cx : 0);
        const y2 = read() + (relative ? cy : 0);
        const x = read() + (relative ? cx : 0);
        const y = read() + (relative ? cy : 0);
        cubic(x1, y1, x2, y2, x, y);
        break;
      }
      case 'S':
      case 's': {
        const reflected = reflect(lastCubic);
        const x2 = read() + (relative ? cx : 0);
        const y2 = read() + (relative ? cy : 0);
        const x = read() + (relative ? cx : 0);
        const y = read() + (relative ? cy : 0);
        cubic(reflected.x, reflected.y, x2, y2, x, y);
        break;
      }
      case 'Q':
      case 'q': {
        const qx = read() + (relative ? cx : 0);
        const qy = read() + (relative ? cy : 0);
        const x = read() + (relative ? cx : 0);
        const y = read() + (relative ? cy : 0);
        quad(qx, qy, x, y);
        break;
      }
      case 'T':
      case 't': {
        const reflected = reflect(lastQuad);
        const x = read() + (relative ? cx : 0);
        const y = read() + (relative ? cy : 0);
        quad(reflected.x, reflected.y, x, y);
        break;
      }
      case 'A':
      case 'a': {
        const rx = read();
        const ry = read();
        const angle = read();
        const large = read();
        const sweep = read();
        const x = read() + (relative ? cx : 0);
        const y = read() + (relative ? cy : 0);
        const curves = arcToCubics(cx, cy, rx, ry, angle, large, sweep, x, y);
        if (curves.length === 0) {
          ops.push({ op: 'L', x, y });
          cx = x;
          cy = y;
          lastCubic = null;
          lastQuad = null;
        } else {
          curves.forEach((curve, curveIndex) => {
            const endX = curveIndex === curves.length - 1 ? x : curve.x;
            const endY = curveIndex === curves.length - 1 ? y : curve.y;
            cubic(curve.x1, curve.y1, curve.x2, curve.y2, endX, endY);
          });
        }
        break;
      }
      case 'Z':
      case 'z': {
        ops.push({ op: 'Z' });
        cx = sx;
        cy = sy;
        lastCubic = null;
        lastQuad = null;
        break;
      }
      default:
        return ops;
    }
  }
  return ops;
}

interface Cubic {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly x: number;
  readonly y: number;
}

function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  angleDeg: number,
  large: number,
  sweep: number,
  x2: number,
  y2: number,
): Cubic[] {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [{ x1: x2, y1: y2, x2, y2, x: x2, y: y2 }];

  const phi = (angleDeg * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  let rxAbs = rx;
  let ryAbs = ry;
  const lambda = (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lambda > 1) {
    const grown = Math.sqrt(lambda);
    rxAbs *= grown;
    ryAbs *= grown;
  }

  const rx2 = rxAbs * rxAbs;
  const ry2 = ryAbs * ryAbs;
  const numerator = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const denominator = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let coef = denominator === 0 ? 0 : Math.sqrt(Math.max(0, numerator / denominator));
  if (large === sweep) coef = -coef;
  const cxp = coef * ((rxAbs * y1p) / ryAbs);
  const cyp = coef * (-(ryAbs * x1p) / rxAbs);
  const centerX = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const centerY = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const start = vectorAngle(1, 0, (x1p - cxp) / rxAbs, (y1p - cyp) / ryAbs);
  let delta = vectorAngle(
    (x1p - cxp) / rxAbs,
    (y1p - cyp) / ryAbs,
    (-x1p - cxp) / rxAbs,
    (-y1p - cyp) / ryAbs,
  );
  if (sweep === 0 && delta > 0) delta -= Math.PI * 2;
  if (sweep === 1 && delta < 0) delta += Math.PI * 2;

  const curves: Cubic[] = [];
  const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  for (let piece = 0; piece < pieces; piece += 1) {
    const theta1 = start + (delta * piece) / pieces;
    const theta2 = start + (delta * (piece + 1)) / pieces;
    curves.push(segmentToCubic(centerX, centerY, rxAbs, ryAbs, cosPhi, sinPhi, theta1, theta2));
  }
  return curves;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const mag = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  const cosine = mag === 0 ? 1 : Math.min(1, Math.max(-1, dot / mag));
  const angle = Math.acos(cosine);
  return ux * vy - uy * vx < 0 ? -angle : angle;
}

function segmentToCubic(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  cosPhi: number,
  sinPhi: number,
  theta1: number,
  theta2: number,
): Cubic {
  const alpha = (Math.sin(theta2 - theta1) * (Math.sqrt(4 + 3 * Math.tan((theta2 - theta1) / 2) ** 2) - 1)) / 3;
  const point = (theta: number): [number, number] => {
    const x = rx * Math.cos(theta);
    const y = ry * Math.sin(theta);
    return [cx + cosPhi * x - sinPhi * y, cy + sinPhi * x + cosPhi * y];
  };
  const derivative = (theta: number): [number, number] => {
    const dx = -rx * Math.sin(theta);
    const dy = ry * Math.cos(theta);
    return [cosPhi * dx - sinPhi * dy, sinPhi * dx + cosPhi * dy];
  };
  const p1 = point(theta1);
  const p2 = point(theta2);
  const d1 = derivative(theta1);
  const d2 = derivative(theta2);
  return {
    x1: p1[0] + alpha * d1[0],
    y1: p1[1] + alpha * d1[1],
    x2: p2[0] - alpha * d2[0],
    y2: p2[1] - alpha * d2[1],
    x: p2[0],
    y: p2[1],
  };
}
