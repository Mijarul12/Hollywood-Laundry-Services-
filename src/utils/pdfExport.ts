import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';

export async function waitForImages(root: HTMLElement | null, timeoutMs = 2500): Promise<void> {
  if (!root) return;
  const imgs = Array.from(root.querySelectorAll('img'));
  if (!imgs.length) return;
  await Promise.race([
    Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      })
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, fitOnePage: boolean, isFirstPage: boolean): boolean {
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  if (!canvas.width || !canvas.height) return isFirstPage;

  const imgH = (canvas.height * usableW) / canvas.width;

  if (fitOnePage && imgH <= usableH * 1.2) {
    if (!isFirstPage) pdf.addPage();
    const scale = Math.min(usableW / canvas.width, usableH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    const x = margin + (usableW - drawW) / 2;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', x, margin, drawW, drawH, undefined, 'FAST');
    return false;
  }

  const pageSlicePx = Math.floor((usableH * canvas.width) / usableW);
  let offsetPx = 0;
  let first = isFirstPage;

  while (offsetPx < canvas.height) {
    const sliceH = Math.min(pageSlicePx, canvas.height - offsetPx);
    if (sliceH <= 4) break;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (!first) pdf.addPage();
    first = false;

    const drawH = (sliceH * usableW) / canvas.width;
    pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.94), 'JPEG', margin, margin, usableW, drawH, undefined, 'FAST');
    offsetPx += sliceH;
  }

  return first;
}

function splitSectionsByPageBreak(container: HTMLElement): HTMLElement[] {
  const rdoc = container.querySelector('.pdoc > .rdoc');
  if (!rdoc) return [container];
  const pbreaks = Array.from(rdoc.querySelectorAll('.pbreak'));
  if (!pbreaks.length) return [container];

  const pdoc = container.querySelector('.pdoc')!;
  const header = pdoc.querySelector('.phead')?.outerHTML || '';
  const signs = pdoc.querySelector('.signs')?.outerHTML || '';
  const foot = pdoc.querySelector('.pfoot')?.outerHTML || '';
  const cls = pdoc.className;

  const chunksHtml = rdoc.innerHTML.split(/<div class="pbreak"[^>]*><\/div>/i).filter((s) => s.trim().length > 0);
  if (chunksHtml.length <= 1) return [container];

  return chunksHtml.map((chunk) => {
    const wrap = document.createElement('div');
    wrap.className = 'pdf-export-host';
    wrap.innerHTML = `<div class="${cls}">${header}<div class="rdoc">${chunk}</div>${signs}${foot}</div>`;
    return wrap;
  });
}

export async function exportHtmlToPdf(html: string, filename: string): Promise<void> {
  const host = document.createElement('div');
  host.className = 'pdf-export-host';
  host.setAttribute('data-theme', document.body.dataset.theme || 'hollywood');
  host.innerHTML = html;

  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: '794px',
    background: '#ffffff',
    color: '#1d2522',
    padding: '18px 22px',
    zIndex: '-1',
    pointerEvents: 'none',
  });

  document.body.appendChild(host);
  const extraHosts: HTMLElement[] = [];

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const sections = splitSectionsByPageBreak(host);
    for (const sec of sections) {
      if (sec !== host) {
        sec.setAttribute('data-theme', document.body.dataset.theme || 'hollywood');
        Object.assign(sec.style, {
          position: 'fixed',
          left: '-12000px',
          top: '0',
          width: '794px',
          background: '#ffffff',
          color: '#1d2522',
          padding: '18px 22px',
          zIndex: '-1',
          pointerEvents: 'none',
        });
        document.body.appendChild(sec);
        extraHosts.push(sec);
      }
      sec.querySelectorAll<HTMLElement>('.tw').forEach((el) => {
        el.style.overflow = 'visible';
      });
      await waitForImages(sec);
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    let isFirst = true;

    for (const sec of sections) {
      const isOne = !!sec.querySelector('.pdoc.one');
      const canvas = await html2canvas(sec, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
      });
      isFirst = addCanvasToPdf(pdf, canvas, isOne, isFirst);
    }

    const blob = pdf.output('blob');
    triggerBlobDownload(blob, filename);
  } finally {
    host.remove();
    extraHosts.forEach((h) => h.remove());
  }
}
