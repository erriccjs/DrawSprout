/**
 * A4 pages for one lesson: the finished picture, the dashed practice steps,
 * and an outline colouring page. The PDF and the print dialog are made here.
 * Nothing is uploaded.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/context';
import { presentLesson } from '../i18n/present';
import type { CoordinateSpace, LessonPackage } from '../lesson-data/schema';
import { artworkFileName } from '../renderer/export';
import { buildSheetPdf, readCanvasRgb } from '../print/pdf';
import { buildSheets, type SheetPath, type SheetView } from '../print/sheets';
import { formatShareDate } from '../share/date';
import { downloadBlob } from '../share/file';

interface PrintBookProps {
  readonly lesson: LessonPackage;
  readonly artwork: HTMLCanvasElement | null;
  readonly onClose: () => void;
  readonly onExported: () => void;
}

export function PrintBook({ lesson, artwork, onClose, onExported }: PrintBookProps) {
  const { t, locale } = useI18n();
  const shown = useMemo(() => presentLesson(lesson, locale), [lesson, locale]);
  const dateLabel = useMemo(() => formatShareDate(new Date(), locale), [locale]);
  const pages = useMemo(
    () => buildSheets(shown, {
      includePicture: artwork !== null,
      dateLabel,
      labels: {
        picture: t('printPicture'),
        practice: t('printPractice'),
        colouring: t('printColouring'),
        madeHere: t('printLocal'),
        noLines: t('printNoLines'),
      },
    }),
    [shown, artwork, dateLabel, t],
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    setError(null);
    void (async () => {
      try {
        const rgb = artwork ? readCanvasRgb(artwork) : null;
        const bytes = await buildSheetPdf(pages, shown.coordinateSpace, rgb);
        const fileName = artworkFileName(shown.title).replace(/\.png$/, '.pdf');
        downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), fileName);
        onExported();
        setStatus(t('printDownloaded', { name: fileName }));
      } catch {
        setError(t('printFailed'));
      }
    })();
  };

  const printNow = () => {
    onExported();
    window.print();
  };

  return createPortal(
    <div className="print-root" role="dialog" aria-modal="true" aria-labelledby="print-book-title">
      <div className="print-root__bar">
        <h2 id="print-book-title">{t('printTitle')}</h2>
        <div className="button-row">
          <button type="button" className="button button--primary" onClick={download}>{t('printDownload')}</button>
          <button type="button" className="button" onClick={printNow}>{t('printNow')}</button>
          <button type="button" className="button" onClick={onClose}>{t('printClose')}</button>
        </div>
      </div>
      <p className="print-root__note">{t('printLocal')}</p>
      {status !== null && <p className="banner" role="status">{status}</p>}
      {error !== null && <p className="banner banner--warning" role="alert">{error}</p>}
      <div className="print-root__pages">
        {pages.map((page, index) => (
          <SheetPage
            key={`${page.kind}-${index}`}
            page={page}
            space={shown.coordinateSpace}
            artwork={page.kind === 'picture' ? artwork : null}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}

function SheetPage({
  page,
  space,
  artwork,
}: {
  readonly page: SheetView;
  readonly space: CoordinateSpace;
  readonly artwork: HTMLCanvasElement | null;
}) {
  return (
    <article className="print-sheet" data-sheet={page.kind} aria-label={page.heading}>
      <header className="print-sheet__header">
        <p className="print-sheet__brand">DrawSprout</p>
        <p className="print-sheet__date">{page.dateLabel}</p>
        <h3>{page.heading}</h3>
        <p className="print-sheet__lesson">{page.lessonTitle}</p>
      </header>
      {page.kind === 'picture' && <PictureSlot canvas={artwork} label={page.lessonTitle} />}
      {page.kind === 'practice' && page.steps.length === 0 && <p className="print-sheet__empty">{page.note}</p>}
      {page.kind === 'practice' && page.steps.length > 0 && (
        <div className="print-sheet__steps" data-count={page.steps.length}>
          {page.steps.map((step) => (
            <section key={step.number} className="print-sheet__step">
              <h4>{step.number}. {step.instruction}</h4>
              <GuideSvg space={space} paths={step.paths} dashed />
            </section>
          ))}
        </div>
      )}
      {page.kind === 'colouring' && page.outlines.length === 0 && <p className="print-sheet__empty">{page.note}</p>}
      {page.kind === 'colouring' && page.outlines.length > 0 && (
        <GuideSvg space={space} paths={page.outlines} dashed={false} />
      )}
      <p className="print-sheet__foot">{page.note}</p>
    </article>
  );
}

function PictureSlot({ canvas, label }: { readonly canvas: HTMLCanvasElement | null; readonly label: string }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!host || !canvas) return;
    const view = document.createElement('canvas');
    view.width = canvas.width;
    view.height = canvas.height;
    view.className = 'print-sheet__art';
    view.setAttribute('role', 'img');
    view.setAttribute('aria-label', label);
    const ctx = view.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.drawImage(canvas, 0, 0);
    }
    host.replaceChildren(view);
  }, [host, canvas, label]);
  return <div className="print-sheet__picture" ref={setHost} />;
}

function GuideSvg({
  space,
  paths,
  dashed,
}: {
  readonly space: CoordinateSpace;
  readonly paths: readonly SheetPath[];
  readonly dashed: boolean;
}) {
  return (
    <svg className="print-sheet__svg" viewBox={`0 0 ${space.width} ${space.height}`} aria-hidden="true">
      {paths.map((path, index) => (
        <path
          key={`${index}-${path.d.slice(0, 24)}`}
          d={path.d}
          fill="none"
          stroke={path.role === 'construction' ? '#6b7280' : '#111111'}
          strokeWidth={path.role === 'construction' ? 3 : dashed ? 4 : 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(dashed ? { strokeDasharray: path.role === 'construction' ? '4 14' : '20 14' } : {})}
          data-ink={dashed ? 'dashed' : 'outline'}
        />
      ))}
    </svg>
  );
}
