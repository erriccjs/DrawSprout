/**
 * Nudge and scale the absolute points in a lesson path.
 * Relative offsets are left in place for a move, and multiplied for a scale,
 * so a path the model wrote with mixed commands still holds together.
 */

interface Mapper {
  point(x: number, y: number, absolute: boolean): [number, number];
  arc?(rx: number, ry: number): [number, number];
}

const TOKEN = /[a-zA-Z]|[-+]?(?:\d+\.\d+|\d+|\.\d+)/g;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function fmt(value: number): string {
  const rounded = round(value);
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export function rewritePath(d: string, mapper: Mapper): string {
  const tokens = d.match(TOKEN);
  if (!tokens) return d;
  let index = 0;
  const out: string[] = [];

  const read = (): number => {
    const token = tokens[index];
    index += 1;
    return Number(token);
  };

  const nextIsNumber = (): boolean => {
    const token = tokens[index];
    return Boolean(token && !/[a-zA-Z]/.test(token));
  };

  const emitPoint = (x: number, y: number, absolute: boolean) => {
    const [nextX, nextY] = mapper.point(x, y, absolute);
    out.push(fmt(nextX), fmt(nextY));
  };

  const emit = (kind: string, absolute: boolean) => {
    const op = kind.toUpperCase();
    if (op === 'H') {
      out.push(fmt(mapper.point(read(), 0, absolute)[0]));
      return;
    }
    if (op === 'V') {
      out.push(fmt(mapper.point(0, read(), absolute)[1]));
      return;
    }
    if (op === 'A') {
      const rx = read();
      const ry = read();
      const angle = read();
      const large = read();
      const sweep = read();
      const [nextRx, nextRy] = mapper.arc ? mapper.arc(rx, ry) : [rx, ry];
      out.push(fmt(nextRx), fmt(nextRy), fmt(angle), fmt(large), fmt(sweep));
      emitPoint(read(), read(), absolute);
      return;
    }
    if (op === 'C') {
      emitPoint(read(), read(), absolute);
      emitPoint(read(), read(), absolute);
      emitPoint(read(), read(), absolute);
      return;
    }
    if (op === 'Q' || op === 'S') {
      emitPoint(read(), read(), absolute);
      emitPoint(read(), read(), absolute);
      return;
    }
    emitPoint(read(), read(), absolute);
  };

  while (index < tokens.length) {
    const command = tokens[index];
    if (!command || !/[a-zA-Z]/.test(command)) break;
    index += 1;
    out.push(command);
    const absolute = command === command.toUpperCase();
    const op = command.toUpperCase();
    if (op === 'Z') continue;
    let first = true;
    while (nextIsNumber()) {
      const kind = first ? op : op === 'M' ? 'L' : op;
      first = false;
      emit(kind, absolute);
    }
  }

  return out.join(' ');
}

export function translatePath(d: string, dx: number, dy: number): string {
  return rewritePath(d, {
    point(x, y, absolute) {
      return absolute ? [x + dx, y + dy] : [x, y];
    },
  });
}

export function scalePath(d: string, factor: number, originX: number, originY: number): string {
  return rewritePath(d, {
    point(x, y, absolute) {
      if (!absolute) return [x * factor, y * factor];
      return [originX + (x - originX) * factor, originY + (y - originY) * factor];
    },
    arc(rx, ry) {
      return [rx * factor, ry * factor];
    },
  });
}

/** Centre of the absolute points, used as the scale handle. */
export function pathCenter(d: string): { readonly x: number; readonly y: number } {
  const points: Array<[number, number]> = [];
  rewritePath(d, {
    point(x, y, absolute) {
      if (absolute) points.push([x, y]);
      return [x, y];
    },
  });
  if (points.length === 0) return { x: 500, y: 375 };
  const x = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const y = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return { x, y };
}
