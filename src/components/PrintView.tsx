import React, { useEffect, useState } from 'react';
import { waitForImages } from '../utils/pdfExport';
import { Ico } from './Icons';

export interface PrintDocState {
  title: string;
  sub: string;
  html: string;
  filename: string;
}

export const PrintView: React.FC<{ html: string }> = ({ html }) => (
  <div id="print" dangerouslySetInnerHTML={{ __html: html }} />
);

export const PrintPreviewModal: React.FC<{
  doc: PrintDocState | null;
  pdfBusy: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
}> = ({ doc, pdfBusy, onClose, onDownloadPdf }) => {
  const [printHint, setPrintHint] = useState(false);

  useEffect(() => {
    setPrintHint(false);
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, onClose]);

  if (!doc) return null;

  const handleBrowserPrint = async () => {
    setPrintHint(false);
    const el = document.getElementById('print');
    await waitForImages(el);
    let beforeFired = false;
    const onBeforePrint = () => {
      beforeFired = true;
    };
    window.addEventListener('beforeprint', onBeforePrint, { once: true });
    const t0 = Date.now();
    try {
      window.print();
    } catch {
      setPrintHint(true);
    }
    const elapsed = Date.now() - t0;
    setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!beforeFired && elapsed < 80) {
        setPrintHint(true);
      }
    }, 250);
  };

  return (
    <div
      className="ov pmodal-ov"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pmodal">
        <div className="pmodal-bar">
          <div className="pmodal-ttl">
            <b>{doc.title}</b>
            <span>{doc.sub}</span>
          </div>
          <div className="pmodal-acts">
            <button
              type="button"
              className="btn ghost sm"
              disabled={pdfBusy}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={onDownloadPdf}
            >
              <Ico name="pdf" /> {pdfBusy ? 'Generating PDF…' : 'Download PDF'}
            </button>
            <button
              type="button"
              className="btn gold sm"
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={handleBrowserPrint}
            >
              <Ico name="print" /> Print
            </button>
            <button type="button" className="btn ghost sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {printHint && (
          <div className="pmodal-note">
            Browser print is restricted inside this embedded preview. Use <b>Download PDF</b> above to save or print the A4 PDF file directly.
          </div>
        )}
        <div className="pmodal-body">
          <div className="pmodal-paper" dangerouslySetInnerHTML={{ __html: doc.html }} />
        </div>
      </div>
    </div>
  );
};
