import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, FileText, FileSpreadsheet, FileDown, RefreshCw, AlertCircle, Building2 } from 'lucide-react';
import { usePayrollPeriodOptions, EMPTY_PERIOD_OPTION, useEstablishment, useReportLetterheadWrap } from '../../lib/reports';
import {
  loadStatutoryReturn, generateEcrText, downloadEcr, groupTotals,
  type StatKind, type ReturnGroup, type ReturnRow,
} from '../../lib/statutoryReturns';
import { downloadCSV, downloadExcel, printStatementPDF, type StatementColumn, type StatementDoc } from '../../lib/exportStatement';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s: string) => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); if (isNaN(d.getTime())) return s; const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${String(d.getDate()).padStart(2,'0')}/${m[d.getMonth()]}/${d.getFullYear()}`; };

// Column sets per statutory kind (drive both the on-screen table and the exports).
function columnsFor(kind: StatKind): StatementColumn[] {
  const base: StatementColumn[] = [
    { key: 'sno', label: 'S.No', align: 'right' },
    { key: 'code', label: 'Emp Code' },
    { key: 'name', label: 'Employee' },
  ];
  if (kind === 'pf') return [...base,
    { key: 'uan', label: 'UAN', text: true }, { key: 'grossWages', label: 'Gross', align: 'right', isAmount: true },
    { key: 'epfWages', label: 'EPF Wages', align: 'right', isAmount: true }, { key: 'eePF', label: 'EE PF', align: 'right', isAmount: true },
    { key: 'epsContrib', label: 'EPS (ER)', align: 'right', isAmount: true }, { key: 'erPF', label: 'ER PF', align: 'right', isAmount: true },
    { key: 'total', label: 'Total', align: 'right', isAmount: true }, { key: 'ncpDays', label: 'NCP', align: 'right' }];
  if (kind === 'esi') return [...base,
    { key: 'esiNo', label: 'ESI/IP No.', text: true }, { key: 'presentDays', label: 'Days', align: 'right' },
    { key: 'grossWages', label: 'Wages', align: 'right', isAmount: true }, { key: 'esiEE', label: 'EE ESI', align: 'right', isAmount: true },
    { key: 'esiER', label: 'ER ESI', align: 'right', isAmount: true }, { key: 'total', label: 'Total', align: 'right', isAmount: true }];
  if (kind === 'pt') return [...base,
    { key: 'grossWages', label: 'Gross', align: 'right', isAmount: true }, { key: 'pt', label: 'Professional Tax', align: 'right', isAmount: true }];
  return [...base,
    { key: 'pan', label: 'PAN', text: true }, { key: 'grossWages', label: 'Gross', align: 'right', isAmount: true },
    { key: 'tds', label: 'TDS', align: 'right', isAmount: true }];
}

function rowToCells(kind: StatKind, r: ReturnRow, i: number): Record<string, string | number> {
  const f2 = (n: number) => n.toFixed(2);
  const total = kind === 'pf' ? r.eePF + r.epsContrib + r.erPF : kind === 'esi' ? r.esiEE + r.esiER : kind === 'pt' ? r.pt : r.tds;
  return {
    sno: i + 1, code: r.code, name: r.name, uan: r.uan || '—', esiNo: r.esiNo || '—', pan: r.pan || '—',
    grossWages: f2(r.grossWages), epfWages: f2(r.epfWages), eePF: f2(r.eePF), epsContrib: f2(r.epsContrib), erPF: f2(r.erPF),
    esiEE: f2(r.esiEE), esiER: f2(r.esiER), pt: f2(r.pt), tds: f2(r.tds), total: f2(total),
    presentDays: r.presentDays, ncpDays: r.ncpDays,
  };
}

interface PanelProps { report: StatKind; mode: 'registers' | 'returns'; }

export default function StatutoryPeriodPanel({ report, mode }: PanelProps) {
  const periods = usePayrollPeriodOptions();
  const establishment = useEstablishment();
  const lhWrap = useReportLetterheadWrap();
  const [periodId, setPeriodId] = useState('');
  const [data, setData] = useState<{ hasRun: boolean; groups: ReturnGroup[] }>({ hasRun: false, groups: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!periodId && periods.length) {
      const today = new Date().toISOString().slice(0, 10);
      setPeriodId((periods.find(p => p.fromDate <= today && today <= p.toDate) ?? periods[0]).id);
    }
  }, [periods, periodId]);
  const period = periods.find(p => p.id === periodId) ?? EMPTY_PERIOD_OPTION;
  const periodLabel = period.name;
  const subtitle = `${period.name} · ${fmtDate(period.fromDate)} – ${fmtDate(period.toDate)}`;

  const reload = useCallback(async () => {
    if (!periodId) { setData({ hasRun: false, groups: [] }); return; }
    setLoading(true);
    setData(await loadStatutoryReturn(report, periodId));
    setLoading(false);
  }, [report, periodId]);
  useEffect(() => { void reload(); }, [reload]);

  const columns = useMemo(() => columnsFor(report), [report]);
  const codeLabel = data.groups[0]?.statCodeLabel ?? (report === 'pf' ? 'PF Code No.' : report === 'esi' ? 'ESI Code No.' : report === 'pt' ? 'PT Reg. No.' : 'TAN');

  const docFor = (g: ReturnGroup): StatementDoc => ({
    title: `${report.toUpperCase()} ${mode === 'returns' ? 'Return' : 'Register'} — ${codeLabel} ${g.statCode}`,
    establishment: establishment.name, subtitle: `${subtitle} · ${g.location}`,
    columns, rows: g.rows.map((r, i) => rowToCells(report, r, i)),
    totals: (() => {
      const t = groupTotals(report, g);
      const o: Record<string, string | number> = { name: `Total — ${g.rows.length} employees` };
      columns.filter(c => c.isAmount).forEach(c => {
        const sum = g.rows.reduce((s, r) => s + (parseFloat(String(rowToCells(report, r, 0)[c.key])) || 0), 0);
        o[c.key] = sum.toFixed(2);
      });
      void t; return o;
    })(),
    note: report === 'pf' ? 'PF ECR figures (EPF/EPS/EDLI). EPS = 8.33% of EPS wages (capped ₹15,000).' : 'Computer-generated statutory return.',
  });

  const allRows = useMemo(() => data.groups.flatMap(g => g.rows), [data.groups]);

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Payroll Period</span>
        <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-card text-sm outline-none">
          {periods.length === 0 && <option>No periods</option>}
          {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
        {mode === 'returns' && <span className="ml-auto text-xs text-muted-foreground">{data.groups.length} {codeLabel} group(s)</span>}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground"><RefreshCw size={16} className="inline animate-spin mr-2" />Loading…</div>
      ) : !data.hasRun ? (
        <div className="py-12 text-center bg-card rounded-xl border border-border"><AlertCircle size={20} className="inline text-amber-500 mr-2" /><span className="text-sm text-muted-foreground">No payroll run for this period — run payroll to generate {report.toUpperCase()} {mode}.</span></div>
      ) : data.groups.length === 0 ? (
        <div className="py-12 text-center bg-card rounded-xl border border-border text-sm text-muted-foreground">No {report.toUpperCase()} contributions for this period.</div>
      ) : mode === 'registers' ? (
        // ── REGISTER: one flat per-employee table for the period ──
        <RegisterTable columns={columns} rows={allRows.map((r, i) => rowToCells(report, r, i))}
          doc={() => ({ title: `${report.toUpperCase()} Register`, establishment: establishment.name, subtitle, columns,
            rows: allRows.map((r, i) => rowToCells(report, r, i)),
            totals: (() => { const o: Record<string, string | number> = { name: `Total — ${allRows.length} employees` }; columns.filter(c => c.isAmount).forEach(c => { o[c.key] = allRows.reduce((s, r) => s + (parseFloat(String(rowToCells(report, r, 0)[c.key])) || 0), 0).toFixed(2); }); return o; })() })} />
      ) : (
        // ── RETURNS: grouped by statutory code, with downloads (ECR for PF) ──
        <div className="space-y-5">
          {data.groups.map(g => {
            const totals = groupTotals(report, g);
            return (
              <div key={g.statCode} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-accent/20 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <Building2 size={16} className="text-emerald-600" />
                    <div>
                      <p className="font-bold text-sm">{codeLabel}: <span className="font-mono">{g.statCode}</span></p>
                      <p className="text-[11px] text-muted-foreground">{g.location} · {g.rows.length} employees · Remittance {inr(totals.total)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report === 'pf' && (
                      <button onClick={() => downloadEcr(g, periodLabel)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"><FileDown size={13} /> ECR Text File</button>
                    )}
                    <button onClick={() => printStatementPDF(docFor(g), lhWrap)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileText size={13} /> PDF</button>
                    <button onClick={() => downloadExcel(docFor(g))} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileSpreadsheet size={13} /> Excel</button>
                    <button onClick={() => downloadCSV(docFor(g))} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><Download size={13} /> CSV</button>
                  </div>
                </div>
                {g.statCode === '—' && (
                  <div className="px-5 py-2 text-[11px] text-amber-700 bg-amber-50 border-b border-amber-200 flex items-center gap-1.5"><AlertCircle size={12} /> No {codeLabel} set on these employees' work location — set it in Work Location Master for a valid return.</div>
                )}
                <StatementTable columns={columns} rows={g.rows.map((r, i) => rowToCells(report, r, i))}
                  totals={(() => { const o: Record<string, string | number> = { name: 'Total' }; columns.filter(c => c.isAmount).forEach(c => { o[c.key] = g.rows.reduce((s, r) => s + (parseFloat(String(rowToCells(report, r, 0)[c.key])) || 0), 0).toFixed(2); }); return o; })()} />
                {report === 'pf' && (
                  <details className="px-5 py-2 border-t border-border">
                    <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">Preview ECR text (#~# delimited)</summary>
                    <pre className="mt-2 p-3 bg-accent/30 rounded-lg text-[10px] overflow-x-auto whitespace-pre-wrap">{generateEcrText(g) || '(no members)'}</pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatementTable({ columns, rows, totals }: { columns: StatementColumn[]; rows: Array<Record<string, string | number>>; totals?: Record<string, string | number> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-accent/40 text-muted-foreground text-[10px] uppercase tracking-wider">
          <tr>{columns.map(c => <th key={c.key} className={`px-3 py-2 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-accent/20">
              {columns.map(c => <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : ''} ${c.text ? 'font-mono' : ''}`}>{c.isAmount ? `₹${Number(r[c.key] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(r[c.key] ?? '')}</td>)}
            </tr>
          ))}
          {totals && (
            <tr className="bg-accent/30 font-bold">
              {columns.map(c => <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : ''}`}>{totals[c.key] !== undefined ? (c.isAmount ? `₹${Number(totals[c.key] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(totals[c.key])) : ''}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RegisterTable({ columns, rows, doc }: { columns: StatementColumn[]; rows: Array<Record<string, string | number>>; doc: () => StatementDoc }) {
  const lhWrap = useReportLetterheadWrap();
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-b border-border">
        <button onClick={() => printStatementPDF(doc(), lhWrap)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileText size={13} /> PDF</button>
        <button onClick={() => downloadExcel(doc())} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileSpreadsheet size={13} /> Excel</button>
        <button onClick={() => downloadCSV(doc())} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><Download size={13} /> CSV</button>
      </div>
      <StatementTable columns={columns} rows={rows} totals={doc().totals} />
    </div>
  );
}
