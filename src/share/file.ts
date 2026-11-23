/**
 * Hand a PNG to the system share sheet, or download it.
 *
 * iOS Safari and Android Chrome can share a file, which is how WhatsApp shows
 * up. The file has to be built before `navigator.share`, in the same tap:
 * an `await` first (a database read, `toBlob`) drops the user gesture and
 * iOS answers NotAllowedError.
 *
 * Limits that stay true on iOS Safari:
 * - `canShare({ files })` is required. A browser that says no gets a download.
 * - With a file attached, iOS often ignores `title` and `text`. The name and
 *   the date are drawn on the PNG for that reason.
 * - Cancelling the sheet is not a failure and does not also download.
 * - A blob download on iOS may open the image instead of saving a file. The
 *   share sheet is the path that reaches WhatsApp.
 * - After the sheet, the chosen app has the file. DrawSprout does not upload it.
 */

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

export function canShareFile(file: File): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function shareOrDownload(file: File, title: string, text: string): Promise<ShareResult> {
  if (canShareFile(file)) {
    return navigator.share({ files: [file], title, text }).then(
      () => 'shared' as const,
      (error: unknown) => {
        if (isAbort(error)) return 'cancelled' as const;
        downloadBlob(file, file.name);
        return 'downloaded' as const;
      },
    );
  }
  downloadBlob(file, file.name);
  return Promise.resolve('downloaded');
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
