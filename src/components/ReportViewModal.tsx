import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Printer, FileSpreadsheet, FileText, ExternalLink, X, Eye, Stamp, Mail } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  buildStatementHtml, printStatementPDF, downloadExcel, downloadCSV, type StatementDoc, type LetterheadWrap,
} from '../lib/exportStatement';
import { loadReportLetterhead, letterheadPrintConfig } from '../lib/letters';
import { sendEmployeeEmail } from '../lib/email';

/**
 * In-app, popup-proof Report View. Renders a report (StatementDoc) in an iframe and
 * lets the user Print / Save-as-PDF straight from the view, or export Excel/CSV.
 * Used across report pages for a consistent "View → Print/PDF" experience.
 * Offers an "On Letterhead" toggle that prints the report on the org letterhead, sized
 * to the configured paper (A4/Letter/Legal) with the configured margins; wide tables
 * auto-shrink to fit. The toggle defaults ON when a letterhead is configured.
 */
export default function ReportViewModal({ doc, onClose }: { doc: StatementDoc; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [letterhead, setLetterhead] = useState<LetterheadWrap | null>(null);
  const [useLetterhead, setUseLetterhead] = useState(false);

  useEffect(() => {
    let active = true;
    loadReportLetterhead().then(lh => {
      if (!active) return;
      const wrap = letterheadPrintConfig(lh);
      setLetterhead(wrap);
      setUseLetterhead(!!wrap); // default ON when a letterhead exists
    });
    return () => { active = false; };
  }, []);

  const activeWrap = useLetterhead ? letterhead : null;
  const html = buildStatementHtml(doc, false, activeWrap);

  const printNow = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  const [emailing, setEmailing] = useState(false);
  const emailReport = async () => {
    const to = window.prompt('Email this report to (recipient address):', '');
    if (!to || !to.trim()) return;
    setEmailing(true);
    const res = await sendEmployeeEmail({
      toEmail: to.trim(), category: 'report', documentTitle: doc.title,
      subject: doc.subtitle ? `${doc.title} — ${doc.subtitle}` : doc.title,
      message: `<p>Please find the report <strong>${doc.title}</strong> attached.</p>`,
      documentHtml: buildStatementHtml(doc, false, activeWrap),
    });
    setEmailing(false);
    if (res.error) toast.error(`Email failed: ${res.error}`);
    else if (res.status === 'Simulated') toast.success('Logged as Simulated (configure SMTP in Establishment Master to send for real).');
    else toast.success(`Report emailed (status: ${res.status}).`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border bg-gradient-to-r from-slate-50 to-indigo-50 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Eye size={18} className="text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-indigo-900 truncate">{doc.title}</h2>
              {doc.subtitle && <p className="text-[11px] text-indigo-600 truncate">{doc.subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${letterhead ? 'cursor-pointer border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700' : 'border-border bg-muted text-muted-foreground cursor-not-allowed'}`}
              title={letterhead ? 'Print on the organisation letterhead, sized to the configured paper' : 'No active letterhead configured (Work Location → Letterhead)'}
            >
              <input type="checkbox" disabled={!letterhead} checked={useLetterhead} onChange={e => setUseLetterhead(e.target.checked)} className="accent-indigo-600" />
              <Stamp size={13} /> On Letterhead
            </label>
            <button onClick={printNow} className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <Printer size={15} /> Print / Save PDF
            </button>
            <button onClick={() => downloadExcel(doc)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg hover:bg-accent text-sm font-medium" title="Export Excel (.xls)">
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button onClick={() => downloadCSV(doc)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg hover:bg-accent text-sm font-medium" title="Export CSV">
              <FileText size={15} /> CSV
            </button>
            <button onClick={() => void emailReport()} disabled={emailing} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg hover:bg-accent text-sm font-medium disabled:opacity-50" title="Email this report (with tracking)">
              <Mail size={15} /> {emailing ? 'Emailing…' : 'Email'}
            </button>
            <button onClick={() => { if (!printStatementPDF(doc, activeWrap)) toast.error('Popup blocked — use Print / Save PDF here.'); }} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg hover:bg-accent text-sm font-medium" title="Open in a new browser tab">
              <ExternalLink size={15} /> Tab
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
          </div>
        </div>
        <iframe title="report-view" ref={frameRef} srcDoc={html} className="flex-1 w-full bg-white" />
      </motion.div>
    </div>
  );
}
