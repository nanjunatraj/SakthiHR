import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ScrollText, FileText, FileSpreadsheet, Download, RefreshCw, AlertCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import { usePayrollPeriodOptions, EMPTY_PERIOD_OPTION, useEstablishment, useReportLetterheadWrap } from '../../lib/reports';
import { loadStatementContext, buildStatement, STATEMENTS, type StatementKey, type StatementCtx } from '../../lib/statements';
import { downloadCSV, downloadExcel, printStatementPDF } from '../../lib/exportStatement';

const fmtDate = (s: string) => {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00'); if (isNaN(d.getTime())) return s;
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}/${m[d.getMonth()]}/${d.getFullYear()}`;
};

export default function Statements() {
  const periods = usePayrollPeriodOptions();
  const establishment = useEstablishment();
  const lhWrap = useReportLetterheadWrap();
  const [periodId, setPeriodId] = useState('');
  const [activeKey, setActiveKey] = useState<StatementKey>('wage');
  const [ctx, setCtx] = useState<StatementCtx | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!periodId && periods.length) {
      const today = new Date().toISOString().slice(0, 10);
      setPeriodId((periods.find(p => p.fromDate <= today && today <= p.toDate) ?? periods[0]).id);
    }
  }, [periods, periodId]);
  const period = periods.find(p => p.id === periodId) ?? EMPTY_PERIOD_OPTION;
  const subtitle = `${period.name} · ${fmtDate(period.fromDate)} – ${fmtDate(period.toDate)}`;

  const reload = useCallback(async () => {
    if (!periodId) { setCtx(null); return; }
    setLoading(true);
    setCtx(await loadStatementContext(periodId, period.fromDate, period.toDate));
    setLoading(false);
  }, [periodId, period.fromDate, period.toDate]);
  useEffect(() => { void reload(); }, [reload]);

  const doc = useMemo(
    () => (ctx ? buildStatement(activeKey, ctx, { establishment: establishment.name, subtitle }) : null),
    [ctx, activeKey, establishment.name, subtitle]
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg"><ScrollText size={22} className="text-sky-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Pay Run Statements</h1>
                <p className="text-xs text-muted-foreground">Pay-period statements from the processed payroll — view and download as PDF / Excel / CSV.</p>
              </div>
            </div>
            <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-card text-sm outline-none">
              {periods.length === 0 && <option>No periods</option>}
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Statement selector */}
          <div className="flex flex-wrap gap-2">
            {STATEMENTS.map(s => (
              <button key={s.key} onClick={() => setActiveKey(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeKey === s.key ? 'bg-sky-600 text-white border-sky-600 shadow-sm' : 'bg-card text-muted-foreground border-border hover:border-sky-300'}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Statement panel */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <h2 className="font-bold text-sm">{doc?.title ?? '—'}</h2>
                <p className="text-[11px] text-muted-foreground">{subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={!doc || !doc.rows.length} onClick={() => doc && printStatementPDF(doc, lhWrap)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent disabled:opacity-40"><FileText size={13} /> PDF</button>
                <button disabled={!doc || !doc.rows.length} onClick={() => doc && downloadExcel(doc)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent disabled:opacity-40"><FileSpreadsheet size={13} /> Excel</button>
                <button disabled={!doc || !doc.rows.length} onClick={() => doc && downloadCSV(doc)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent disabled:opacity-40"><Download size={13} /> CSV</button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground"><RefreshCw size={16} className="inline animate-spin mr-2" />Loading…</div>
            ) : !ctx?.hasRun ? (
              <div className="py-12 text-center"><AlertCircle size={20} className="inline text-amber-500 mr-2" /><span className="text-sm text-muted-foreground">No payroll run for this period yet. Run payroll to generate statements.</span></div>
            ) : !doc || !doc.rows.length ? (
              <div className="py-12 text-center text-sm text-muted-foreground">{doc?.note ?? 'No data for this statement.'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-accent/50 text-muted-foreground text-[10px] uppercase tracking-wider">
                    <tr>{doc.columns.map(c => <th key={c.key} className={`px-3 py-2.5 font-semibold ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>{c.label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {doc.rows.map((r, ri) => (
                      <tr key={ri} className="hover:bg-accent/30">
                        {doc.columns.map(c => (
                          <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''} ${c.text ? 'font-mono text-xs' : ''}`}>
                            {c.isAmount ? `₹${Number(r[c.key] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(r[c.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {doc.totals && (
                      <tr className="bg-accent/30 font-bold">
                        {doc.columns.map(c => (
                          <td key={c.key} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right' : ''}`}>
                            {doc.totals![c.key] !== undefined ? (c.isAmount ? `₹${Number(doc.totals![c.key] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(doc.totals![c.key])) : ''}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
