/**
 * Reflect an SVG path across a vertical line.
 *
 * Lessons are authored facing right or front. A photo that faces the other
 * way flips x in the lesson's coordinate space. Arcs reverse their sweep,
 * because a reflection reverses clockwise and counterclockwise.
 */

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

export function mirrorPath(d: string, width: number): string {
  const tokens = d.match(TOKEN) ?? [];
  let index = 0;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let controlX = 0;
  let controlY = 0;
  let previous = '';
  const out: string[] = [];

  const read = () => Number(tokens[index++]);
  const mirrorX = (value: number) => fmt(width - value);
  const isCommand = (token: string | undefined) => token !== undefined && /[A-Za-z]/.test(token);

  while (index < tokens.length) {
    let command = tokens[index] ?? '';
    if (!isCommand(command)) {
      if (previous === 'M') command = 'L';
      else if (previous === 'm') command = 'l';
      else command = previous;
    } else {
      index += 1;
    }
    if (!command) break;

    const relative = command === command.toLowerCase();
    const op = command.toUpperCase();
    const at = (value: number, origin: number) => (relative ? origin + value : value);

    if (op === 'Z') {
      out.push('Z');
      x = startX;
      y = startY;
      previous = command;
      continue;
    }
    if (!isCommand(tokens[index]) && tokens[index] === undefined) break;

    if (op === 'M' || op === 'L') {
      const nextX = at(read(), x);
      const nextY = at(read(), y);
      out.push(`${op} ${mirrorX(nextX)} ${fmt(nextY)}`);
      if (op === 'M') {
        startX = nextX;
        startY = nextY;
      }
      x = nextX;
      y = nextY;
      controlX = nextX;
      controlY = nextY;
      previous = command;
      continue;
    }

    if (op === 'H') {
      const nextX = at(read(), x);
      out.push(`L ${mirrorX(nextX)} ${fmt(y)}`);
      x = nextX;
      controlX = nextX;
      controlY = y;
      previous = command;
      continue;
    }

    if (op === 'V') {
      const nextY = at(read(), y);
      out.push(`L ${mirrorX(x)} ${fmt(nextY)}`);
      y = nextY;
      controlX = x;
      controlY = nextY;
      previous = command;
      continue;
    }

    if (op === 'C') {
      const c1x = at(read(), x);
      const c1y = at(read(), y);
      const c2x = at(read(), x);
      const c2y = at(read(), y);
      const nextX = at(read(), x);
      const nextY = at(read(), y);
      out.push(`C ${mirrorX(c1x)} ${fmt(c1y)} ${mirrorX(c2x)} ${fmt(c2y)} ${mirrorX(nextX)} ${fmt(nextY)}`);
      controlX = c2x;
      controlY = c2y;
      x = nextX;
      y = nextY;
      previous = command;
      continue;
    }

    if (op === 'S') {
      const c2x = at(read(), x);
      const c2y = at(read(), y);
      const nextX = at(read(), x);
      const nextY = at(read(), y);
      const smooth = previous.toUpperCase() === 'C' || previous.toUpperCase() === 'S';
      const c1x = smooth ? 2 * x - controlX : x;
      const c1y = smooth ? 2 * y - controlY : y;
      out.push(`C ${mirrorX(c1x)} ${fmt(c1y)} ${mirrorX(c2x)} ${fmt(c2y)} ${mirrorX(nextX)} ${fmt(nextY)}`);
      controlX = c2x;
      controlY = c2y;
      x = nextX;
      y = nextY;
      previous = command;
      continue;
    }

    if (op === 'Q') {
      const c1x = at(read(), x);
      const c1y = at(read(), y);
      const nextX = at(read(), x);
      const nextY = at(read(), y);
      out.push(`Q ${mirrorX(c1x)} ${fmt(c1y)} ${mirrorX(nextX)} ${fmt(nextY)}`);
      controlX = c1x;
      controlY = c1y;
      x = nextX;
      y = nextY;
      previous = command;
      continue;
    }

    if (op === 'T') {
      const nextX = at(read(), x);
      const nextY = at(read(), y);
      const smooth = previous.toUpperCase() === 'Q' || previous.toUpperCase() === 'T';
      const c1x = smooth ? 2 * x - controlX : x;
      const c1y = smooth ? 2 * y - controlY : y;
      out.push(`Q ${mirrorX(c1x)} ${fmt(c1y)} ${mirrorX(nextX)} ${fmt(nextY)}`);
      controlX = c1x;
      controlY = c1y;
      x = nextX;
      y = nextY;
      previous = command;
      continue;
    }

    if (op === 'A') {
      const rx = read();
      const ry = read();
      const rotation = read();
      const large = read();
      const sweep = read();
      const nextX = at(read(), x);
      const nextY = at(read(), y);
      out.push(`A ${fmt(Math.abs(rx))} ${fmt(Math.abs(ry))} ${fmt(-rotation)} ${large} ${sweep === 0 ? 1 : 0} ${mirrorX(nextX)} ${fmt(nextY)}`);
      x = nextX;
      y = nextY;
      controlX = nextX;
      controlY = nextY;
      previous = command;
      continue;
    }

    break;
  }

  return out.join(' ');
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}
