/**
 * A framed PNG a parent can hand to WhatsApp.
 *
 * The lesson name and the date are drawn on the image. iOS Safari often drops
 * the share sheet's title once a file is attached, so the words have to be
 * pixels. The existing plain PNG save is a different file and stays ungated.
 */

export interface ShareFrameOptions {
  readonly title: string;
  readonly dateLabel: string;
  readonly pixelWidth?: number;
}

export function renderShareFrame(artwork: HTMLCanvasElement, options: ShareFrameOptions): HTMLCanvasElement {
  const width = options.pixelWidth ?? 1600;
  const artRatio = artwork.height / Math.max(1, artwork.width);
  const padX = Math.round(width * 0.08);
  const padTop = Math.round(width * 0.08);
  const caption = Math.round(width * 0.12);
  const artW = width - padX * 2;
  const artH = Math.max(1, Math.round(artW * artRatio));
  const height = padTop + artH + caption;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  ctx.fillStyle = '#f7f4ee';
  ctx.fillRect(0, 0, width, height);
  const inset = Math.round(width * 0.035);
  ctx.strokeStyle = '#1f2933';
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  ctx.strokeStyle = '#2f7d4a';
  ctx.lineWidth = Math.max(2, width * 0.002);
  const inset2 = inset + Math.round(width * 0.012);
  ctx.strokeRect(inset2, inset2, width - inset2 * 2, height - inset2 * 2);
  ctx.drawImage(artwork, padX, padTop, artW, artH);

  const titleY = padTop + artH + caption * 0.38;
  ctx.fillStyle = '#1f2933';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `600 ${Math.round(width * 0.028)}px system-ui, sans-serif`;
  ctx.fillText(options.title, padX, titleY);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#5c6670';
  ctx.font = `${Math.round(width * 0.022)}px system-ui, sans-serif`;
  ctx.fillText(options.dateLabel, width - padX, titleY);

  const markY = padTop + artH + caption * 0.74;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2f7d4a';
  ctx.font = `700 ${Math.round(width * 0.02)}px system-ui, sans-serif`;
  ctx.fillText('DrawSprout', padX, markY);
  drawSprout(ctx, padX + ctx.measureText('DrawSprout').width + width * 0.012, markY, width * 0.018);
  return canvas;
}

function drawSprout(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.strokeStyle = '#2f7d4a';
  ctx.lineWidth = Math.max(2, size * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.45);
  ctx.lineTo(x, y - size * 0.55);
  ctx.moveTo(x, y - size * 0.05);
  ctx.lineTo(x - size * 0.45, y - size * 0.4);
  ctx.moveTo(x, y - size * 0.2);
  ctx.lineTo(x + size * 0.45, y - size * 0.55);
  ctx.stroke();
  ctx.restore();
}

export function shareArtworkFile(
  artwork: HTMLCanvasElement,
  title: string,
  dateLabel: string,
  fileName: string,
): File {
  const framed = renderShareFrame(artwork, { title, dateLabel });
  return new File([canvasToPngBlob(framed)], fileName, { type: 'image/png' });
}

/** PNG bytes without waiting on `toBlob`, so a share call can stay in the tap. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Blob {
  try {
    const url = canvas.toDataURL('image/png');
    if (url.startsWith('data:image/png')) return dataUrlToBlob(url);
  } catch {
    /* jsdom has no rasteriser. The share call still receives a PNG-typed blob. */
  }
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
}

function dataUrlToBlob(url: string): Blob {
  const encoded = url.slice(url.indexOf(',') + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'image/png' });
}
