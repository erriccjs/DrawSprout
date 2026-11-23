import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordedCalls } from '../test/fake-canvas';
import { canShareFile, shareOrDownload } from './file';
import { renderShareFrame } from './frame';

function artwork(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 30;
  return canvas;
}

describe('framed share file', () => {
  const originalShare = navigator.share;
  const originalCanShare = navigator.canShare;
  const originalCreate = URL.createObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;

  afterEach(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: originalShare });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: originalCanShare });
    URL.createObjectURL = originalCreate;
    HTMLAnchorElement.prototype.click = originalClick;
    vi.restoreAllMocks();
  });

  it('draws the lesson name, the date, and the DrawSprout mark around the picture', () => {
    const framed = renderShareFrame(artwork(), { title: 'Bintang', dateLabel: '23 Nov 2026', pixelWidth: 400 });
    const calls = recordedCalls(framed);
    const text = calls.filter((call) => call.op === 'fillText').map((call) => call.args[0]);
    expect(text).toEqual(['Bintang', '23 Nov 2026', 'DrawSprout']);
    expect(calls.some((call) => call.op === 'drawImage')).toBe(true);
    expect(calls.some((call) => call.op === 'strokeRect')).toBe(true);
    expect(framed.width).toBe(400);
  });

  it('calls the share sheet with the PNG and does not also download', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    const clicks = vi.fn();
    HTMLAnchorElement.prototype.click = clicks;
    const file = new File([new Uint8Array([1, 2, 3])], 'bintang.png', { type: 'image/png' });
    await expect(shareOrDownload(file, 'Bintang', 'Bintang — 23 Nov 2026')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Bintang', text: 'Bintang — 23 Nov 2026' });
    expect(canShareFile(file)).toBe(true);
    expect(clicks).not.toHaveBeenCalled();
  });

  it('treats a cancelled sheet as a cancel, and downloads when sharing is missing', async () => {
    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.reject(abort) });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    const clicks = vi.fn();
    HTMLAnchorElement.prototype.click = clicks;
    URL.createObjectURL = () => 'blob:share';
    const file = new File([new Uint8Array([1])], 'bintang.png', { type: 'image/png' });
    await expect(shareOrDownload(file, 'Bintang', 'Bintang')).resolves.toBe('cancelled');
    expect(clicks).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    await expect(shareOrDownload(file, 'Bintang', 'Bintang')).resolves.toBe('downloaded');
    expect(clicks).toHaveBeenCalledTimes(1);
  });
});
