// HTML → PDF for email attachments (payslips, letters, reports).
//
// Two paths, best-first:
//   1. Electron desktop — window.sakthiDesktop.htmlToPdf() renders via Chromium's
//      printToPDF in the main process → a crisp, true-vector PDF that matches print.
//   2. Web / preview — a client-side rasteriser (html2canvas → jsPDF) that works
//      anywhere. One-page documents like payslips come out clean at 2× scale.

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface DesktopBridge {
  isDesktop?: boolean;
  htmlToPdf?: (html: string) => Promise<string>;
}
function desktop(): DesktopBridge | undefined {
  return (window as unknown as { sakthiDesktop?: DesktopBridge }).sakthiDesktop;
}

/** True when the native (Electron) PDF renderer is available. */
export function hasNativePdf(): boolean {
  return typeof desktop()?.htmlToPdf === 'function';
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

/** Render a full HTML document to a PDF Blob (native when available, else raster). */
export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const d = desktop();
  if (d?.htmlToPdf) {
    try {
      const b64 = await d.htmlToPdf(html);
      if (b64) return base64ToBlob(b64, 'application/pdf');
    } catch {
      /* fall through to the client-side rasteriser */
    }
  }
  return rasterHtmlToPdf(html);
}

// A4 at 96dpi ≈ 794 × 1123 px.
const A4_PX_WIDTH = 794;

async function rasterHtmlToPdf(html: string): Promise<Blob> {
  // Render the document inside an off-screen iframe so its own <style>/letterhead
  // applies, then snapshot the body.
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_PX_WIDTH}px;height:1123px;border:0;background:#fff;`;
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = html;
    });
    const doc = iframe.contentDocument;
    const body = doc?.body;
    if (!doc || !body) throw new Error('could not render HTML for PDF');
    // Grow the iframe to the full content height so nothing is clipped in the capture.
    const fullHeight = Math.max(body.scrollHeight, 1123);
    iframe.style.height = `${fullHeight}px`;

    const canvas = await html2canvas(body, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: A4_PX_WIDTH });
    const img = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    // Slice the tall capture across A4 pages.
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(img, 'JPEG', 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, 'JPEG', 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}
