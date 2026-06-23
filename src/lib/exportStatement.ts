// Dependency-free statement exporters — PDF (browser print), Excel (.xls HTML that Excel
// opens as a real spreadsheet), and CSV. Shared by Salary Payment, Arrears and the
// Pay-Run Statements hub so every statement downloads consistently.

export interface StatementColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  /** Force Excel to keep the value as text (account numbers, IFSC, UAN, PAN…). */
  text?: boolean;
  /** Display hint for the on-screen table (prefix ₹). Exports keep the raw value. */
  isAmount?: boolean;
}

export interface StatementDoc {
  title: string;            // e.g. "Bank Transfer Statement"
  establishment?: string;   // company name shown in the header
  subtitle?: string;        // e.g. "June 2026 · 01/Jun/2026 – 30/Jun/2026"
  columns: StatementColumn[];
  rows: Array<Record<string, string | number>>;
  /** Optional totals row rendered bold at the foot (values keyed by column key). */
  totals?: Record<string, string | number>;
  note?: string;            // small footnote (e.g. "Computer-generated statement")
}

/**
 * Letterhead print wrapper for reports. Carries the pre-rendered header/footer HTML and
 * the paper geometry (from the Work Location letterhead settings) so the report prints on a
 * full paper-sized sheet (A4/Letter/Legal) with the configured margins. Produced by
 * `letterheadPrintConfig()` in lib/letters.ts; consumed by `buildStatementHtml`/`printStatementPDF`.
 */
export interface LetterheadWrap {
  header: string;
  footer: string;
  paperSize: string;   // CSS @page size keyword: 'A4' | 'Letter' | 'Legal'
  widthMm: number;
  heightMm: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeFile = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────
export function downloadCSV(doc: StatementDoc) {
  const csvCell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  if (doc.establishment) lines.push(csvCell(doc.establishment));
  lines.push(csvCell(doc.title));
  if (doc.subtitle) lines.push(csvCell(doc.subtitle));
  lines.push('');
  lines.push(doc.columns.map(c => csvCell(c.label)).join(','));
  for (const r of doc.rows) lines.push(doc.columns.map(c => csvCell(r[c.key])).join(','));
  if (doc.totals) lines.push(doc.columns.map(c => csvCell(doc.totals![c.key] ?? '')).join(','));
  triggerDownload(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), `${safeFile(doc.title)}.csv`);
}

// ─── Excel (.xls — HTML table Excel opens natively) ─────────────────────────────
export function downloadExcel(doc: StatementDoc) {
  const th = doc.columns.map(c =>
    `<th style="background:#1e293b;color:#fff;border:1px solid #334155;padding:6px 8px;text-align:${c.align ?? 'left'};">${esc(c.label)}</th>`
  ).join('');
  const bodyRows = doc.rows.map(r =>
    `<tr>${doc.columns.map(c => {
      const fmt = c.text ? ` style="mso-number-format:'\\@';border:1px solid #cbd5e1;padding:4px 8px;text-align:${c.align ?? 'left'};"`
                         : ` style="border:1px solid #cbd5e1;padding:4px 8px;text-align:${c.align ?? 'left'};"`;
      return `<td${fmt}>${esc(r[c.key])}</td>`;
    }).join('')}</tr>`
  ).join('');
  const totalsRow = doc.totals
    ? `<tr>${doc.columns.map(c => `<td style="border:1px solid #cbd5e1;padding:4px 8px;font-weight:bold;background:#f1f5f9;text-align:${c.align ?? 'left'};">${esc(doc.totals![c.key] ?? '')}</td>`).join('')}</tr>`
    : '';
  const meta = [doc.establishment, doc.title, doc.subtitle].filter(Boolean)
    .map(t => `<tr><td colspan="${doc.columns.length}" style="font-weight:bold;">${esc(t)}</td></tr>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${esc(doc.title).slice(0, 31)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1">${meta}<tr></tr><thead><tr>${th}</tr></thead><tbody>${bodyRows}${totalsRow}</tbody></table></body></html>`;
  triggerDownload(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), `${safeFile(doc.title)}.xls`);
}

// ─── Print-ready report HTML (shared by the in-app Report View and the print window) ──
/** Build a clean, A4 print-ready HTML document for a report. `withToolbar` adds an
 *  on-screen Print/Close bar (used by the new-tab window; the in-app viewer omits it). */
// Auto-shrink: after layout, step the table font-size down until the table fits within the
// available content width (paper/page width minus the margins). Keeps wide reports inside the
// printing area on every path (plain .page and on-letterhead .lh-report-body).
const FIT_SCRIPT = `<script>(function(){function fit(){var body=document.querySelector('.lh-report-body')||document.querySelector('.page');if(!body)return;var t=body.querySelector('table');if(!t)return;t.style.fontSize='';t.style.zoom='';var cs=getComputedStyle(body);var avail=body.clientWidth-parseFloat(cs.paddingLeft||'0')-parseFloat(cs.paddingRight||'0');var fs=11,guard=0;while(t.scrollWidth>avail+1&&fs>7&&guard<24){fs-=0.5;t.style.fontSize=fs+'px';guard++;}if(t.scrollWidth>avail+1){t.style.zoom=String(Math.max(0.3,avail/t.scrollWidth));}}if(document.readyState==='complete')fit();else window.addEventListener('load',fit);})();</script>`;

// Reports render in Garamond (EB Garamond web font, with local Garamond / Times fallbacks).
const REPORT_FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com" /><link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />`;
const REPORT_FONT = `'EB Garamond', Garamond, 'Times New Roman', serif`;

export function buildStatementHtml(doc: StatementDoc, withToolbar = true, lh?: LetterheadWrap | null): string {
  const th = doc.columns.map(c => `<th style="text-align:${c.align ?? 'left'}">${esc(c.label)}</th>`).join('');
  const body = doc.rows.map(r =>
    `<tr>${doc.columns.map(c => `<td style="text-align:${c.align ?? 'left'}">${esc(r[c.key])}</td>`).join('')}</tr>`
  ).join('');
  const totals = doc.totals
    ? `<tr class="totals">${doc.columns.map(c => `<td style="text-align:${c.align ?? 'left'}">${esc(doc.totals![c.key] ?? '')}</td>`).join('')}</tr>`
    : '';
  const toolbar = withToolbar
    ? `<div class="toolbar no-print"><span>${esc(doc.title)}</span>
        <button onclick="window.print()">Print / Save as PDF</button>
        <button onclick="window.close()">Close</button></div>`
    : '';
  const inner = `
    ${doc.establishment ? `<div class="est">${esc(doc.establishment)}</div>` : ''}
    <h1>${esc(doc.title)}</h1>
    ${doc.subtitle ? `<div class="sub">${esc(doc.subtitle)}</div>` : ''}
    <table><thead><tr>${th}</tr></thead><tbody>${body}${totals}</tbody></table>
    ${doc.note ? `<div class="note">${esc(doc.note)}</div>` : ''}`;

  const tableCss = `
  h1{font-size:18px;margin:0} .est{font-size:14px;font-weight:700;color:#334155} .sub{font-size:12px;color:#64748b;margin:2px 0 16px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#1e293b;color:#fff;padding:6px 8px;text-align:left;font-size:.9em;text-transform:uppercase;letter-spacing:.04em}
  td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:1em}
  tr:nth-child(even) td{background:#f8fafc}
  tr.totals td{font-weight:700;background:#f1f5f9;border-top:2px solid #cbd5e1}
  .note{margin-top:14px;font-size:10px;color:#94a3b8}`;

  // ── On-letterhead: paper-sized sheet (A4/Letter/Legal) with the configured margins ──
  if (lh) {
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(doc.title)}</title>${REPORT_FONT_LINK}
<style>
  *{box-sizing:border-box} body{font-family:${REPORT_FONT};margin:0;color:#0f172a;background:#e2e8f0}
  .toolbar{position:sticky;top:0;background:#1e293b;color:#fff;padding:10px 16px;display:flex;gap:10px;align-items:center;justify-content:flex-end;z-index:5}
  .toolbar span{margin-right:auto;font-weight:600}
  .toolbar button{background:#fff;color:#1e293b;border:0;border-radius:6px;padding:6px 14px;font-weight:600;cursor:pointer}
  /* Header flush to the top edge, footer flush to the bottom edge; the configured
     margins inset the body content only (classic pre-printed letterhead layout). */
  .sheet{width:${lh.widthMm}mm;min-height:${lh.heightMm}mm;margin:14px auto;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.12);
         padding:0;display:flex;flex-direction:column}
  .lh-report-body{flex:1 0 auto;min-width:0;padding:${lh.marginTop}mm ${lh.marginRight}mm ${lh.marginBottom}mm ${lh.marginLeft}mm}
  .lh-header{margin:0} .lh-footer{margin:0}
  ${tableCss}
  @media print{
    body{background:#fff} .toolbar{display:none}
    .sheet{width:auto;margin:0;box-shadow:none;padding:0}
    @page{size:${lh.paperSize};margin:0}
  }
</style></head>
<body>
  ${toolbar}
  <div class="sheet">
    ${lh.header || ''}
    <div class="lh-report-body">${inner}</div>
    ${lh.footer || ''}
  </div>
  ${FIT_SCRIPT}
</body></html>`;
  }

  // ── Plain (no letterhead) ──
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(doc.title)}</title>${REPORT_FONT_LINK}
<style>
  *{box-sizing:border-box} body{font-family:${REPORT_FONT};margin:0;color:#0f172a;background:#e2e8f0}
  .toolbar{position:sticky;top:0;background:#1e293b;color:#fff;padding:10px 16px;display:flex;gap:10px;align-items:center;justify-content:flex-end;z-index:5}
  .toolbar span{margin-right:auto;font-weight:600}
  .toolbar button{background:#fff;color:#1e293b;border:0;border-radius:6px;padding:6px 14px;font-weight:600;cursor:pointer}
  /* A true A4 sheet (12mm printing margin) — so on-screen width matches the printable width
     and the auto-shrink keeps the table inside the margins on print. */
  .page{width:210mm;min-height:297mm;margin:14px auto;padding:12mm;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.12)}
  ${tableCss}
  @media print{.toolbar{display:none} body{background:#fff} .page{width:auto;min-height:auto;margin:0;box-shadow:none} @page{size:A4;margin:0}}
</style></head>
<body>
  ${toolbar}
  <div class="page">${inner}</div>
  ${FIT_SCRIPT}
</body></html>`;
}

// ─── PDF (open a print-ready window; user prints / saves as PDF) ────────────────
export function printStatementPDF(doc: StatementDoc, lh?: LetterheadWrap | null) {
  const html = buildStatementHtml(doc, true, lh);
  const w = window.open('', '_blank');
  if (!w) { triggerDownload(new Blob([html], { type: 'text/html' }), `${safeFile(doc.title)}.html`); return false; }
  w.document.write(html); w.document.close();
  return true;
}
