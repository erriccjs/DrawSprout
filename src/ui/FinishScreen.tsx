/**
 * The finish screen: look at the artwork, save it, or go back and keep drawing.
 *
 * The preview and the PNG come from the same `renderArtworkToCanvas` call the
 * export uses, so what the child sees here is exactly what gets saved — guides
 * and the target illustration included in neither (FR-14, AT-01).
 */

import { useEffect, useRef, useState } from 'react';
import type { LessonPackage } from '../lesson-data/schema';
import type { SessionState } from '../lesson-engine/types';
import { artworkFileName, exportArtworkPng, renderArtworkToCanvas } from '../renderer/export';
import { toRenderStrokes } from './render-adapter';

interface FinishScreenProps {
  readonly lesson: LessonPackage;
  readonly state: SessionState;
  readonly clipPaths: Record<string, string>;
  readonly onKeepDrawing: () => void;
  readonly onChoosePicture: () => void;
  readonly onStartFresh: () => void;
  readonly restartError: string | null;
  readonly restarting: boolean;
}

/** Small enough to render instantly, large enough to look right on a tablet. */
const PREVIEW_WIDTH_PX = 900;

export function FinishScreen({ lesson, state, clipPaths, onKeepDrawing, onChoosePicture, onStartFresh, restartError, restarting }: FinishScreenProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [askingToClear, setAskingToClear] = useState(false);

  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    const canvas = renderArtworkToCanvas({
      space: lesson.coordinateSpace,
      strokes: toRenderStrokes(state.strokes),
      clipPaths,
      pixelWidth: PREVIEW_WIDTH_PX,
    });
    canvas.className = 'finish__canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Karyamu: ${lesson.title}`);
    host.replaceChildren(canvas);
  }, [lesson, state.strokes, clipPaths]);

  const save = async () => {
    setExportError(null);
    try {
      const blob = await exportArtworkPng({
        space: lesson.coordinateSpace,
        strokes: toRenderStrokes(state.strokes),
        clipPaths,
      });
      const fileName = artworkFileName(lesson.title);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      // Revoked on the next frame: revoking immediately can cancel the download
      // on some browsers.
      requestAnimationFrame(() => URL.revokeObjectURL(url));
      // Deliberately not phrased as "saved to Photos": PRD section 11 says not
      // to promise where a browser download ends up.
      setSavedName(fileName);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="finish">
      <h1 className="finish__title">Selesai! Ini karyamu.</h1>
      <p className="finish__lead">
        Gambar ini milikmu. Garis panduan dan contoh tidak ikut tersimpan.
      </p>

      <div className="finish__preview" ref={previewRef} />

      {askingToClear ? (
        <div className="finish__choice" role="group" aria-label="Pilihan gambar lagi">
          <h2>Mau mulai dengan gambar kosong?</h2>
          <div className="finish__actions">
            <button type="button" className="button" onClick={onKeepDrawing} disabled={restarting} autoFocus>
              Gambar lama tetap ada
            </button>
            <button type="button" className="button" onClick={onStartFresh} disabled={restarting}>
              Ya, mulai gambar baru
            </button>
          </div>
        </div>
      ) : (
        <div className="finish__actions">
          <button type="button" className="button button--primary" onClick={() => void save()}>
            Simpan gambar (PNG)
          </button>
          <button type="button" className="button" onClick={() => setAskingToClear(true)}>
            ← Gambar lagi
          </button>
          <button type="button" className="button" onClick={onChoosePicture}>
            Pilih gambar lain
          </button>
        </div>
      )}

      {savedName !== null && (
        <p className="banner" role="status">
          File {savedName} dikirim ke unduhan browser. Tempat penyimpanannya diatur oleh
          browser dan sistem, bukan oleh aplikasi ini.
        </p>
      )}
      {exportError !== null && (
        <p className="banner banner--warning">Gagal menyimpan gambar: {exportError}</p>
      )}
      {restartError !== null && <p className="banner banner--warning">{restartError}</p>}
    </div>
  );
}
