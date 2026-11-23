/**
 * A4 portrait PDF, built in the browser.
 *
 * Practice and colouring pages are vectors. The finished picture, when there
 * is one, is the pixels already on the device. No request leaves the page.
 */

import type { CoordinateSpace } from '../lesson-data/schema';
import type { SheetPath, SheetView } from './sheets';
import { svgToOps, type DrawOp } from './svg-path';

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
export const PAGE_MARGIN = 36;

export interface RgbImage {
  readonly width: number;
  readonly height: number;
  readonly rgb: Uint8Array;
}

export interface PdfBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PdfFit {
  readonly scale: number;
  readonly originX: number;
  readonly originY: number;
}

const encoder = new TextEncoder();

const WIN_ANSI: Readonly<Record<number, number>> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
};

export function pdfString(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const byte = code <= 255 ? code : WIN_ANSI[code];
    if (byte === undefined) {
      out += '?';
      continue;
    }
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte >= 32 && byte <= 126) out += String.fromCharCode(byte);
    else out += `\\${byte.toString(8).padStart(3, '0')}`;
  }
  return `(${out})`;
}

export function fitDrawing(space: CoordinateSpace, box: PdfBox): PdfFit {
  const scale = Math.min(box.w / space.width, box.h / space.height);
  const drawnW = space.width * scale;
  const drawnH = space.height * scale;
  return {
    scale,
    originX: box.x + (box.w - drawnW) / 2,
    originY: box.y + (box.h - drawnH) / 2 + drawnH,
  };
}

export function toPdfPoint(x: number, y: number, fit: PdfFit): { x: number; y: number } {
  return { x: fit.originX + x * fit.scale, y: fit.originY - y * fit.scale };
}

export function contentBox(): PdfBox {
  const top = 78;
  const bottom = 46;
  return {
    x: PAGE_MARGIN,
    y: bottom,
    w: A4_WIDTH - PAGE_MARGIN * 2,
    h: A4_HEIGHT - top - bottom,
  };
}

function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Object.is(rounded, -0)) return '0';
  return String(rounded);
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && next.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== '') lines.push(line);
  return lines.slice(0, 3);
}

/** Content stream for one page. The picture image is painted as `/Im1` when present. */
export function pageOperators(
  page: SheetView,
  space: CoordinateSpace,
  image: { readonly width: number; readonly height: number } | null,
): string {
  const lines: string[] = ['1 J 1 j'];
  lines.push(`BT /F1 11 Tf 0 0 0 rg ${num(PAGE_MARGIN)} ${num(A4_HEIGHT - 28)} Td (DrawSprout) Tj ET`);
  lines.push(`BT /F1 16 Tf ${num(PAGE_MARGIN)} ${num(A4_HEIGHT - 50)} Td ${pdfString(page.heading)} Tj ET`);
  lines.push(`BT /F1 12 Tf ${num(PAGE_MARGIN)} ${num(A4_HEIGHT - 68)} Td ${pdfString(page.lessonTitle)} Tj ET`);
  const dateWidth = page.dateLabel.length * 6;
  lines.push(`BT /F1 10 Tf 0.35 0.35 0.35 rg ${num(A4_WIDTH - PAGE_MARGIN - dateWidth)} ${num(A4_HEIGHT - 28)} Td ${pdfString(page.dateLabel)} Tj ET`);

  const box = contentBox();
  if (page.kind === 'picture') {
    if (image) {
      const fitted = fitImage(box, image);
      lines.push(`q ${num(fitted.w)} 0 0 ${num(fitted.h)} ${num(fitted.x)} ${num(fitted.y)} cm /Im1 Do Q`);
    }
  } else if (page.kind === 'practice') {
    lines.push(...practiceOperators(page, space, box));
  } else {
    lines.push(...strokePaths(page.outlines, space, box, false));
  }

  if (page.note !== '') {
    lines.push(`BT /F1 9 Tf 0.35 0.35 0.35 rg ${num(PAGE_MARGIN)} 28 Td ${pdfString(page.note)} Tj ET`);
  }
  return lines.join('\n');
}

function fitImage(box: PdfBox, image: { readonly width: number; readonly height: number }): PdfBox {
  const scale = Math.min(box.w / image.width, box.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

function practiceOperators(page: SheetView, space: CoordinateSpace, box: PdfBox): string[] {
  const count = page.steps.length;
  if (count === 0) return [];
  const grid = count <= 1 ? { cols: 1, rows: 1 } : count === 2 ? { cols: 1, rows: 2 } : count <= 4 ? { cols: 2, rows: 2 } : { cols: 2, rows: 3 };
  const gap = 10;
  const cellW = (box.w - gap * (grid.cols - 1)) / grid.cols;
  const cellH = (box.h - gap * (grid.rows - 1)) / grid.rows;
  const ops: string[] = [];
  page.steps.forEach((step, index) => {
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    const x = box.x + col * (cellW + gap);
    const top = box.y + box.h - row * (cellH + gap);
    const font = 10;
    const maxChars = Math.max(12, Math.floor(cellW / (font * 0.52)));
    const text = wrap(`${step.number}. ${step.instruction}`, maxChars);
    text.forEach((line, lineIndex) => {
      const baseline = top - 12 - lineIndex * 12;
      ops.push(`BT /F1 ${font} Tf 0 0 0 rg ${num(x)} ${num(baseline)} Td ${pdfString(line)} Tj ET`);
    });
    const textBlock = 16 + text.length * 12;
    const drawTop = top - textBlock;
    const drawBottom = top - cellH + 4;
    const drawBox: PdfBox = {
      x,
      y: drawBottom,
      w: cellW,
      h: Math.max(16, drawTop - drawBottom),
    };
    ops.push(...strokePaths(step.paths, space, drawBox, true));
  });
  return ops;
}

function strokePaths(paths: readonly SheetPath[], space: CoordinateSpace, box: PdfBox, dashed: boolean): string[] {
  const fit = fitDrawing(space, box);
  const ops: string[] = [];
  for (const path of paths) {
    const drawn = strokeOne(svgToOps(path.d), fit, path.role === 'construction', dashed);
    if (drawn !== '') ops.push(drawn);
  }
  return ops;
}

function strokeOne(commands: readonly DrawOp[], fit: PdfFit, construction: boolean, dashed: boolean): string {
  if (commands.length === 0) return '';
  const parts: string[] = [];
  const point = (x: number, y: number) => {
    const mapped = toPdfPoint(x, y, fit);
    return `${num(mapped.x)} ${num(mapped.y)}`;
  };
  for (const command of commands) {
    if (command.op === 'M') parts.push(`${point(command.x, command.y)} m`);
    else if (command.op === 'L') parts.push(`${point(command.x, command.y)} l`);
    else if (command.op === 'C') {
      parts.push(
        `${point(command.x1, command.y1)} ${point(command.x2, command.y2)} ${point(command.x, command.y)} c`,
      );
    } else parts.push('h');
  }
  if (parts.length === 0) return '';
  const gray = construction ? '0.55' : '0';
  const width = Math.max(0.6, (construction ? 3 : 4) * fit.scale);
  const dash = dashed ? (construction ? [4, 14] : [20, 14]).map((length) => num(length * fit.scale)).join(' ') : '';
  const dashOp = dashed ? `[${dash}] 0 d` : '[] 0 d';
  return `${gray} G ${num(width)} w ${dashOp} ${parts.join(' ')} S`;
}

interface Piece {
  readonly ascii?: string;
  readonly binary?: Uint8Array;
}

export async function buildSheetPdf(
  pages: readonly SheetView[],
  space: CoordinateSpace,
  picture: RgbImage | null,
): Promise<Uint8Array> {
  const slots: Array<Piece[] | undefined> = [];
  const reserve = (): number => {
    slots.push(undefined);
    return slots.length;
  };
  const fill = (id: number, parts: Piece[]) => {
    slots[id - 1] = parts;
  };
  const catalogId = reserve();
  const pagesId = reserve();
  const fontId = reserve();
  fill(fontId, [{ ascii: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' }]);

  let imageId = 0;
  if (picture && pages.some((page) => page.kind === 'picture')) {
    imageId = reserve();
    const compressed = await deflate(picture.rgb);
    fill(imageId, streamPieces(
      `<< /Type /XObject /Subtype /Image /Width ${picture.width} /Height ${picture.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
      compressed,
    ));
  }

  const pageIds: number[] = [];
  for (const page of pages) {
    const showImage = page.kind === 'picture' && picture && imageId !== 0;
    const contentId = reserve();
    const stream = encoder.encode(pageOperators(page, space, showImage ? picture : null));
    fill(contentId, streamPieces('<<', stream));
    const resources = showImage
      ? `<< /Font << /F1 ${fontId} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >>`
      : `<< /Font << /F1 ${fontId} 0 R >> >>`;
    const pageId = reserve();
    fill(pageId, [{
      ascii: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(A4_WIDTH)} ${num(A4_HEIGHT)}] /Resources ${resources} /Contents ${contentId} 0 R >>`,
    }]);
    pageIds.push(pageId);
  }

  fill(pagesId, [{
    ascii: `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
  }]);
  fill(catalogId, [{ ascii: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` }]);

  return serialize(slots);
}

function streamPieces(openDict: string, data: Uint8Array): Piece[] {
  return [
    { ascii: `${openDict} /Length ${data.length} >>\nstream\n` },
    { binary: data },
    { ascii: '\nendstream' },
  ];
}

function serialize(slots: Array<Piece[] | undefined>): Uint8Array {
  const chunks: Uint8Array[] = [encoder.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  let length = chunks[0]?.length ?? 0;
  const offsets = [0];
  slots.forEach((parts, index) => {
    offsets.push(length);
    const head = encoder.encode(`${index + 1} 0 obj\n`);
    chunks.push(head);
    length += head.length;
    for (const part of parts ?? []) {
      const bytes = part.binary ?? encoder.encode(part.ascii ?? '');
      chunks.push(bytes);
      length += bytes.length;
    }
    const tail = encoder.encode('\nendobj\n');
    chunks.push(tail);
    length += tail.length;
  });
  const xrefAt = length;
  let xref = `xref\n0 ${slots.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= slots.length; id += 1) {
    xref += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${slots.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  chunks.push(encoder.encode(xref));
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate');
  const writer = stream.writable.getWriter();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  await writer.write(copy);
  await writer.close();
  const compressed = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(compressed);
}

/** RGBA canvas pixels on white, or null when this canvas cannot be read. */
export function readCanvasRgb(source: HTMLCanvasElement, maxWidth = 1400): RgbImage | null {
  const context = source.getContext('2d');
  if (!context || typeof context.getImageData !== 'function') return null;
  const scale = Math.min(1, maxWidth / Math.max(1, source.width));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  try {
    const pixels = readPixels(source, context, width, height);
    if (!pixels) return null;
    const rgb = new Uint8Array(width * height * 3);
    const data = pixels.data;
    for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 3) {
      const alpha = (data[index + 3] ?? 255) / 255;
      rgb[pixel] = Math.round((data[index] ?? 255) * alpha + 255 * (1 - alpha));
      rgb[pixel + 1] = Math.round((data[index + 1] ?? 255) * alpha + 255 * (1 - alpha));
      rgb[pixel + 2] = Math.round((data[index + 2] ?? 255) * alpha + 255 * (1 - alpha));
    }
    return { width, height, rgb };
  } catch {
    return null;
  }
}

function readPixels(
  source: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): ImageData | null {
  if (width === source.width && height === source.height) return context.getImageData(0, 0, width, height);
  const copy = document.createElement('canvas');
  copy.width = width;
  copy.height = height;
  const copyContext = copy.getContext('2d');
  if (!copyContext || typeof copyContext.getImageData !== 'function') return null;
  copyContext.fillStyle = '#ffffff';
  copyContext.fillRect(0, 0, width, height);
  copyContext.drawImage(source, 0, 0, width, height);
  return copyContext.getImageData(0, 0, width, height);
}
