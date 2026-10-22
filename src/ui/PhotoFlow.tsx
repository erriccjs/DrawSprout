/**
 * Parent photo spike (FR-15, FR-17, FR-19). Hidden unless the beta flag is on.
 *
 * The prepared PNG lives in component state until the parent leaves. It is not
 * written to IndexedDB. Approval saves only the lesson package and its hash.
 */

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { LessonPackage } from '../lesson-data/schema';
import { requestPhotoLesson, type PhotoLessonApiResult, type PhotoLessonRequest } from '../photo/client';
import { clampCrop, DEFAULT_CROP, preparePhotoFile, type NormalizedCrop } from '../photo/prepare';
import type { PhotoVariant } from '../photo/prompts';
import { requestDocumentFullscreen } from './fullscreen';

interface PhotoFlowProps {
  readonly onCancel: () => void;
  readonly onUse: (lesson: LessonPackage, targetHash: string) => Promise<void>;
  readonly prepare?: (file: File, crop: NormalizedCrop) => Promise<Uint8Array>;
  readonly request?: (input: PhotoLessonRequest) => Promise<PhotoLessonApiResult>;
}

type Stage = 'pick' | 'crop' | 'consent' | 'working' | 'preview';

export function PhotoFlow({
  onCancel,
  onUse,
  prepare = preparePhotoFile,
  request = requestPhotoLesson,
}: PhotoFlowProps) {
  const [stage, setStage] = useState<Stage>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<NormalizedCrop>(DEFAULT_CROP);
  const [prepared, setPrepared] = useState<Uint8Array | null>(null);
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoLessonApiResult | null>(null);
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState<{ key: string; variant: PhotoVariant } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const urls = useRef<string[]>([]);

  useEffect(() => () => {
    abortRef.current?.abort();
    for (const url of urls.current) URL.revokeObjectURL(url);
  }, []);

  const rememberUrl = (url: string) => {
    urls.current.push(url);
    return url;
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0];
    event.target.value = '';
    if (!next) return;
    setFile(next);
    setFileUrl(rememberUrl(URL.createObjectURL(next)));
    setCrop(DEFAULT_CROP);
    setPrepared(null);
    setResult(null);
    setError(null);
    setStage('crop');
  };

  const confirmCrop = async () => {
    if (!file || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const png = await prepare(file, crop);
      setPrepared(png);
      setPreparedUrl(rememberUrl(blobUrl(png)));
      setStage('consent');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Foto tidak dapat dibaca. Pilih gambar lain.');
    } finally {
      busy.current = false;
    }
  };

  const generate = async (variant: PhotoVariant, reuse: boolean) => {
    if (!prepared || busy.current) return;
    busy.current = true;
    const key = reuse && attempt ? attempt.key : crypto.randomUUID();
    setAttempt({ key, variant });
    setError(null);
    setStage('working');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const next = await request({ png: prepared, idempotencyKey: key, variant, signal: controller.signal });
      setIllustrationUrl(rememberUrl(blobUrl(next.illustrationPng)));
      setResult(next);
      setStage('preview');
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : '';
      if (name === 'AbortError') setError('Permintaan dibatalkan.');
      else if (name === 'TimeoutError') setError('Waktunya habis. Coba lagi.');
      else setError(cause instanceof Error ? cause.message : 'Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.');
      setStage(result ? 'preview' : 'consent');
    } finally {
      busy.current = false;
    }
  };

  const approve = async () => {
    if (!result) return;
    requestDocumentFullscreen();
    setSaving(true);
    setError(null);
    try {
      await onUse(result.lesson, result.targetHash);
    } catch (cause) {
      setSaving(false);
      setError(cause instanceof Error ? cause.message : 'Pelajaran belum tersimpan di perangkat ini.');
    }
  };

  return (
    <section className="photo-flow" aria-labelledby="photo-flow-title">
      <h1 id="photo-flow-title">Buat dari foto</h1>
      {error && <p className="banner banner--warning" role="alert">{error}</p>}

      {stage === 'pick' && (
        <>
          <p>Pilih foto benda utamanya. Ini untuk orang tua, bukan untuk anak.</p>
          <div className="photo-flow__actions">
            <button type="button" className="button button--primary" onClick={() => document.getElementById('photo-camera')?.click()}>
              Ambil foto
            </button>
            <button type="button" className="button" onClick={() => document.getElementById('photo-gallery')?.click()}>
              Pilih dari galeri
            </button>
            <button type="button" className="button" onClick={onCancel}>Batal</button>
          </div>
          <input id="photo-camera" className="photo-flow__file" type="file" accept="image/*" capture="environment" aria-label="Kamera" onChange={onFile} />
          <input id="photo-gallery" className="photo-flow__file" type="file" accept="image/*" aria-label="Galeri" onChange={onFile} />
        </>
      )}

      {stage === 'crop' && fileUrl && (
        <>
          <p>Pilih bagian utamanya, lalu lanjut.</p>
          <CropBox crop={crop} imageUrl={fileUrl} onChange={setCrop} />
          <div className="photo-flow__actions">
            <button type="button" className="button button--primary" onClick={() => void confirmCrop()}>Pakai bagian ini</button>
            <button type="button" className="button" onClick={() => setStage('pick')}>Ganti foto</button>
            <button type="button" className="button" onClick={onCancel}>Batal</button>
          </div>
        </>
      )}

      {(stage === 'consent' || stage === 'working') && preparedUrl && (
        <>
          <h2>Sebelum foto dikirim</h2>
          <p>
            Foto ini dikirim ke server DrawSprout dan ke OpenAI supaya bisa dibuat menjadi gambar garis.
            Foto tidak disimpan setelah diproses. Pelajaran yang dihasilkan tersimpan di perangkat ini,
            dan menghapusnya menghapus gambar turunan itu juga.
          </p>
          <img className="photo-flow__still" src={preparedUrl} alt="Foto yang akan dikirim" />
          {stage === 'working' ? (
            <p role="status">Membuat garis…</p>
          ) : null}
          <div className="photo-flow__actions">
            {stage === 'consent' && (
              <button type="button" className="button button--primary" onClick={() => void generate(attempt?.variant ?? 'default', attempt !== null)}>
                {attempt ? 'Coba lagi' : 'Saya setuju, lanjut'}
              </button>
            )}
            {stage === 'working' && (
              <button type="button" className="button" onClick={() => abortRef.current?.abort()}>Batalkan</button>
            )}
            {stage === 'consent' && <button type="button" className="button" onClick={onCancel}>Batal</button>}
          </div>
        </>
      )}

      {stage === 'preview' && result && preparedUrl && illustrationUrl && (
        <>
          <h2>Cek dulu</h2>
          {result.needsReview && result.reviewReason && (
            <p className="banner banner--warning" role="status">{result.reviewReason}</p>
          )}
          <div className="photo-flow__compare">
            <figure>
              <img src={preparedUrl} alt="Foto yang dipilih" />
              <figcaption>Foto</figcaption>
            </figure>
            <figure>
              <img src={illustrationUrl} alt="Ilustrasi garis" />
              <figcaption>Ilustrasi</figcaption>
            </figure>
          </div>
          <div className="photo-flow__actions">
            <button type="button" className="button button--primary" disabled={saving} onClick={() => void approve()}>Gunakan</button>
            {error && attempt && (
              <button type="button" className="button" disabled={saving} onClick={() => void generate(attempt.variant, true)}>Coba lagi</button>
            )}
            <button type="button" className="button" disabled={saving} onClick={() => void generate('faithful', false)}>Lebih mirip foto</button>
            <button type="button" className="button" disabled={saving} onClick={() => void generate('simple', false)}>Lebih sederhana</button>
            <button type="button" className="button" disabled={saving} onClick={() => setStage('pick')}>Ganti foto</button>
          </div>
        </>
      )}
    </section>
  );
}

function CropBox({
  crop,
  imageUrl,
  onChange,
}: {
  readonly crop: NormalizedCrop;
  readonly imageUrl: string;
  readonly onChange: (crop: NormalizedCrop) => void;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; crop: NormalizedCrop } | null>(null);

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    const node = frame.current;
    if (!state || !node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = (event.clientX - state.x) / rect.width;
    const dy = (event.clientY - state.y) / rect.height;
    if (state.mode === 'move') {
      onChange(clampCrop({ ...state.crop, x: state.crop.x + dx, y: state.crop.y + dy }));
    } else {
      onChange(clampCrop({ ...state.crop, width: state.crop.width + dx, height: state.crop.height + dy }));
    }
  };

  const down = (event: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, y: event.clientY, crop };
  };

  return (
    <div className="photo-crop" ref={frame}>
      <img src={imageUrl} alt="Foto untuk dipotong" />
      <div
        className="photo-crop__box"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
        onPointerDown={(event) => down(event, 'move')}
        onPointerMove={move}
        onPointerUp={() => { drag.current = null; }}
      >
        <button
          type="button"
          className="photo-crop__handle"
          aria-label="Ubah ukuran bagian"
          onPointerDown={(event) => down(event, 'resize')}
          onPointerMove={move}
          onPointerUp={() => { drag.current = null; }}
        />
      </div>
    </div>
  );
}

function blobUrl(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return URL.createObjectURL(new Blob([copy], { type: 'image/png' }));
}
