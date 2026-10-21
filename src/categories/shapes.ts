/** Circle as two arcs. The colour fill adds Z. */
export function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
}

/** Ellipse as two arcs, axis-aligned. */
export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`;
}

/**
 * Dome from the left point to the right point, bulging toward smaller y.
 * Sweep 0 is the upper arc in SVG's y-down space.
 */
export function dome(x1: number, y: number, x2: number, rx: number, ry: number): string {
  return `M ${x1} ${y} A ${rx} ${ry} 0 0 0 ${x2} ${y}`;
}
