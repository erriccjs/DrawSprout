/** Contact-sheet pixels for photo-eval. Labels live in the HTML, not this bitmap. */

import type { RgbaImage } from './png';

const CELL_WIDTH = 320;
const CELL_HEIGHT = 240;
const GAP = 8;

export function composeContactSheet(rows: readonly (readonly RgbaImage[])[]): RgbaImage {
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const width = columns * CELL_WIDTH + (columns + 1) * GAP;
  const height = Math.max(1, rows.length) * CELL_HEIGHT + (Math.max(1, rows.length) + 1) * GAP;
  const data = new Uint8Array(width * height * 4);
  data.fill(255);
  rows.forEach((row, rowIndex) => {
    row.forEach((image, column) => {
      blitFit(
        data,
        width,
        image,
        GAP + column * (CELL_WIDTH + GAP),
        GAP + rowIndex * (CELL_HEIGHT + GAP),
        CELL_WIDTH,
        CELL_HEIGHT,
      );
    });
  });
  return { width, height, data };
}

function blitFit(
  dest: Uint8Array,
  destWidth: number,
  image: RgbaImage,
  originX: number,
  originY: number,
  cellWidth: number,
  cellHeight: number,
): void {
  if (image.width <= 0 || image.height <= 0) return;
  const scale = Math.min(cellWidth / image.width, cellHeight / image.height);
  const drawWidth = Math.max(1, Math.round(image.width * scale));
  const drawHeight = Math.max(1, Math.round(image.height * scale));
  const offsetX = originX + Math.floor((cellWidth - drawWidth) / 2);
  const offsetY = originY + Math.floor((cellHeight - drawHeight) / 2);
  for (let y = 0; y < drawHeight; y += 1) {
    const sy = Math.min(image.height - 1, Math.floor((y * image.height) / drawHeight));
    for (let x = 0; x < drawWidth; x += 1) {
      const sx = Math.min(image.width - 1, Math.floor((x * image.width) / drawWidth));
      const from = (sy * image.width + sx) * 4;
      const to = ((offsetY + y) * destWidth + (offsetX + x)) * 4;
      const alpha = image.data[from + 3] ?? 255;
      const scale = alpha / 255;
      dest[to] = Math.round((image.data[from] ?? 255) * scale + 255 * (1 - scale));
      dest[to + 1] = Math.round((image.data[from + 1] ?? 255) * scale + 255 * (1 - scale));
      dest[to + 2] = Math.round((image.data[from + 2] ?? 255) * scale + 255 * (1 - scale));
      dest[to + 3] = 255;
    }
  }
}
