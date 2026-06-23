import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, X, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-toastify';
import { parseCsv, toCsv, downloadCsv } from '../../utils/csv';

export interface CsvColumn {
  /** CSV header text (matched case-insensitively, trimmed). */
  header: string;
  /** Whether the column must be present and non-empty on every row. */
  required?: boolean;
  /** Example value placed in the downloadable template's sample row. */
  example?: string;
  /** Short hint shown under the template (e.g. allowed values). */
  hint?: string;
}

export interface BulkImportProps {
  /** Singular master name, e.g. "Designation". */
  title: string;
  /** Column definitions — also drive the template headers and example row. */
  columns: CsvColumn[];
  /**
   * Map one parsed CSV row (header → cell value) to a DB insert object, or
   * return `{ error }` to reject that row with a message. Runs per row.
   */
  toRecord: (cells: Record<string, string>) => Record<string, unknown> | { error: string };
  /** Insert one mapped record. Resolve with an error message, or null on success. */
  insertRecord: (record: Record<string, unknown>) => Promise<string | null>;
  /** Called after an import finishes (e.g. to refetch). */
  onDone?: () => void;
}

interface RowError { line: number; message: string; }

export default function BulkImport({ title, columns, toRecord, insertRecord, onDone }: BulkImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number; errors: RowError[] } | null>(null);

  const downloadTemplate = () => {
    const headers = columns.map(c => c.header);
    const example = columns.map(c => c.example ?? '');
    downloadCsv(`${title.replace(/\s+/g, '_').toLowerCase()}_template`, toCsv(headers, [example]));
    toast.info('Template downloaded — fill it in and upload.');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ''; // allow re-selecting the same file
    if (!file) return;

    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { toast.error('The CSV has no data rows.'); setBusy(false); return; }

      const headerRow = rows[0].map(h => h.trim());
      const headerLc = headerRow.map(h => h.toLowerCase());

      // Verify all required columns are present.
      const missing = columns.filter(c => c.required && !headerLc.includes(c.header.toLowerCase()));
      if (missing.length) {
        toast.error(`Missing required column(s): ${missing.map(m => m.header).join(', ')}`);
        setBusy(false);
        return;
      }

      const errors: RowError[] = [];
      let imported = 0;

      for (let r = 1; r < rows.length; r++) {
        const cells: Record<string, string> = {};
        headerRow.forEach((h, idx) => { cells[h] = (rows[r][idx] ?? '').trim(); });

        // Required-field check (match by header, case-insensitive).
        const missingField = columns.find(c => {
          if (!c.required) return false;
          const key = headerRow.find(h => h.toLowerCase() === c.header.toLowerCase());
          return !key || !cells[key];
        });
        if (missingField) { errors.push({ line: r + 1, message: `Missing required value for "${missingField.header}"` }); continue; }

        // Normalize keys to the declared header casing so toRecord can read them reliably.
        const normalized: Record<string, string> = {};
        columns.forEach(c => {
          const key = headerRow.find(h => h.toLowerCase() === c.header.toLowerCase());
          normalized[c.header] = key ? cells[key] : '';
        });

        const mapped = toRecord(normalized);
        if ('error' in mapped) { errors.push({ line: r + 1, message: mapped.error as string }); continue; }

        const err = await insertRecord(mapped);
        if (err) errors.push({ line: r + 1, message: err });
        else imported++;
      }

      setResult({ imported, failed: errors.length, errors });
      if (imported > 0) {
        toast.success(`Imported ${imported} ${title.toLowerCase()} row${imported !== 1 ? 's' : ''}.`);
        onDone?.();
      }
      if (imported === 0 && errors.length) toast.error('No rows imported — see details.');
    } catch (err) {
      toast.error(`Could not read file: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={downloadTemplate}
        className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground rounded-lg hover:bg-accent transition-colors text-sm font-medium"
        title="Download a CSV template for this master"
      >
        <Download size={15} /> Template
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground rounded-lg hover:bg-accent transition-colors text-sm font-medium disabled:opacity-60"
        title="Bulk import rows from a CSV file"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Import CSV
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

      <AnimatePresence>
        {result && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet size={18} className="text-primary" />
                  <h2 className="text-lg font-bold">Import Results — {title}</h2>
                </div>
                <button onClick={() => setResult(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-center">
                    <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                    <p className="text-xs font-medium text-green-600 uppercase tracking-wide mt-1">Imported</p>
                  </div>
                  <div className={`p-4 rounded-xl text-center border ${result.failed ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    <p className={`text-2xl font-bold ${result.failed ? 'text-red-600' : 'text-gray-500'}`}>{result.failed}</p>
                    <p className={`text-xs font-medium uppercase tracking-wide mt-1 ${result.failed ? 'text-red-500' : 'text-gray-400'}`}>Skipped</p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                        <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                        <span><strong>Row {e.line}:</strong> {e.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.failed === 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <CheckCircle2 size={15} /> All rows imported successfully.
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end bg-accent/10">
                <button onClick={() => setResult(null)} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Done</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
