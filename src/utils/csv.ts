// Minimal, dependency-free CSV helpers shared by the master bulk-import flows.

/** Parse CSV text into rows of string cells. Handles quoted fields, escaped
 *  quotes (""), commas and newlines inside quotes, and CRLF line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // Strip a leading UTF-8 BOM if present (Excel adds it).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  // Flush the trailing field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // Drop fully-empty rows (e.g. trailing blank lines).
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

/** Escape and join a single CSV cell value. */
function escapeCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize a header row + data rows into CSV text. */
export function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const r of rows) lines.push(r.map(escapeCell).join(','));
  return lines.join('\r\n');
}

/** Trigger a browser download of CSV text as a .csv file. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
