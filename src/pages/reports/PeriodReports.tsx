import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarRange, FileText, FileSpreadsheet, Download, RefreshCw, AlertCircle, BarChart2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import { usePayrollPeriodOptions, EMPTY_PERIOD_OPTION, useEstablishment, useReportLetterheadWrap } from '../../lib/reports';
import {
  loadPeriodReport, PERIOD_METRICS, GROUP_BY_OPTIONS, ALL_METRICS,
  type GroupBy, type PeriodReportResult,
} from '../../lib/periodReports';
import { downloadCSV, downloadExcel, printStatementPDF, type StatementColumn, type StatementDoc } from '../../lib/exportStatement';

const fmtVal = (n: number, isAmount: boolean) =>
  isAmount ? `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : String(n % 1 === 0 ? n : n.toFixed(1));

export default function PeriodReports() {
  const periods = usePayrollPeriodOptions(); // newest-first
  const establishment = useEstablishment();
  const lhWrap = useReportLetterheadWrap();
  const [metricKey, setMetricKey] = useState('lop');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('location');
  const [data, setData] = useState<PeriodReportResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Default: from = 6th-latest (or oldest), to = latest.
  useEffect(() => {
    if (!toId && periods.length) {
      setToId(periods[0].id);
      setFromId(periods[Math.min(periods.length - 1, 5)].id);
    }
  }, [periods, toId]);

  const metric = ALL_METRICS.find(m => m.key === metricKey);
  const fromP = periods.find(p => p.id === fromId) ?? EMPTY_PERIOD_OPTION;
  const toP = periods.find(p => p.id === toId) ?? EMPTY_PERIOD_OPTION;

  const generate = useCallback(async () => {
    if (!metricKey || !fromId || !toId) return;
    setLoading(true);
    setData(await loadPeriodReport(metricKey, fromId, toId, groupBy));
    setLoading(false);
  }, [metricKey, fromId, toId, groupBy]);
  useEffect(() => { void generate(); }, [generate]);

  const subtitle = `${metric?.label ?? ''} · ${fromP.name} → ${toP.name}${groupBy !== 'none' ? ` · grouped by ${GROUP_BY_OPTIONS.find(g => g.key === groupBy)?.label}` : ''}`;

  // Build the export document (flat rows + grand total).
  const buildDoc = (): StatementDoc => {
    const d = data!;
    const cols: StatementColumn[] = [
      { key: 'sno', label: 'S.No', align: 'right' },
      { key: 'code', label: 'Emp Code' },
      { key: 'name', label: 'Employee' },
      ...(groupBy !== 'none' ? [{ key: 'group', label: GROUP_BY_OPTIONS.find(g => g.key === groupBy)!.label } as StatementColumn] : []),
      ...d.periods.map(p => ({ key: p.id, label: p.name, align: 'right', isAmount: d.isAmount } as StatementColumn)),
      { key: 'total', label: 'Total', align: 'right', isAmount: d.isAmount },
    ];
    const f = (n: number) => (d.isAmount ? Number(n || 0).toFixed(2) : String(n));
    let i = 0;
    const rows = d.groups.flatMap(g => g.rows.map(r => {
      const o: Record<string, string | number> = { sno: ++i, code: r.code, name: r.name, group: r.group, total: f(r.total) };
      d.periods.forEach(p => { o[p.id] = f(r.values[p.id] ?? 0); });
      return o;
    }));
    const totals: Record<string, string | number> = { name: 'Grand Total', total: f(d.grandTotal) };
    d.periods.forEach(p => { totals[p.id] = f(d.grandTotals[p.id] ?? 0); });
    return { title: `Period Report — ${d.metricLabel}`, establishment: establishment.name, subtitle, columns: cols, rows, totals, note: 'Computer-generated period report.' };
  };
  const canExport = !!data?.hasData;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg"><BarChart2 size={22} className="text-indigo-600" /></div>
            <div>
              <h1 className="text-xl font-bold">Period Reports</h1>
              <p className="text-xs text-muted-foreground">Tabulate an attendance or wage metric across a range of payroll periods, grouped by org dimension.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Controls */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Report / Metric</label>
              <select value={metricKey} onChange={e => setMetricKey(e.target.value)} className="w-full p-2.5 bg-accent/50 border border-border rounded-lg text-sm outline-none">
                {PERIOD_METRICS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">From Period</label>
              <select value={fromId} onChange={e => setFromId(e.target.value)} className="w-full p-2.5 bg-accent/50 border border-border rounded-lg text-sm outline-none">
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">To Period</label>
              <select value={toId} onChange={e => setToId(e.target.value)} className="w-full p-2.5 bg-accent/50 border border-border rounded-lg text-sm outline-none">
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Group By</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)} className="w-full p-2.5 bg-accent/50 border border-border rounded-lg text-sm outline-none">
                {GROUP_BY_OPTIONS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
          </div>

          {/* Result */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <h2 className="font-bold text-sm">{metric?.label}</h2>
                <p className="text-[11px] text-muted-foreground">{subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={!canExport} onClick={() => printStatementPDF(buildDoc(), lhWrap)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent disabled:opacity-40"><FileText size={13} /> PDF</button>
                <button disabled={!canExport} onClick={() => downloadExcel(buildDoc())} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent disabled:opacity-40"><FileSpreadsheet size={13} /> Excel</button>
                <button disabled={!canExport} onClick={() => downloadCSV(buildDoc())} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent disabled:opacity-40"><Download size={13} /> CSV</button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground"><RefreshCw size={16} className="inline animate-spin mr-2" />Loading…</div>
            ) : !data || !data.hasData ? (
              <div className="py-12 text-center"><AlertCircle size={20} className="inline text-amber-500 mr-2" /><span className="text-sm text-muted-foreground">No data for this metric in the selected period range.</span></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-accent/50 text-muted-foreground text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Employee</th>
                      {data.periods.map(p => <th key={p.id} className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">{p.name}</th>)}
                      <th className="px-3 py-2.5 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.groups.map(g => (
                      <React.Fragment key={g.key}>
                        {groupBy !== 'none' && (
                          <tr className="bg-indigo-50/60"><td colSpan={data.periods.length + 2} className="px-3 py-1.5 font-bold text-indigo-700 text-[11px]">{g.label} <span className="font-normal text-muted-foreground">({g.rows.length})</span></td></tr>
                        )}
                        {g.rows.map(r => (
                          <tr key={r.employeeId} className="hover:bg-accent/20">
                            <td className="px-3 py-2"><p className="font-medium">{r.name}</p><p className="text-[10px] text-muted-foreground">{r.code}</p></td>
                            {data.periods.map(p => <td key={p.id} className="px-3 py-2 text-right">{fmtVal(r.values[p.id] ?? 0, data.isAmount)}</td>)}
                            <td className="px-3 py-2 text-right font-semibold">{fmtVal(r.total, data.isAmount)}</td>
                          </tr>
                        ))}
                        {groupBy !== 'none' && (
                          <tr className="bg-accent/40 font-semibold">
                            <td className="px-3 py-2 text-right text-muted-foreground">Subtotal — {g.label}</td>
                            {data.periods.map(p => <td key={p.id} className="px-3 py-2 text-right">{fmtVal(g.subtotals[p.id] ?? 0, data.isAmount)}</td>)}
                            <td className="px-3 py-2 text-right">{fmtVal(g.subtotal, data.isAmount)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    <tr className="bg-indigo-100 font-bold">
                      <td className="px-3 py-2.5">Grand Total</td>
                      {data.periods.map(p => <td key={p.id} className="px-3 py-2.5 text-right">{fmtVal(data.grandTotals[p.id] ?? 0, data.isAmount)}</td>)}
                      <td className="px-3 py-2.5 text-right text-indigo-700">{fmtVal(data.grandTotal, data.isAmount)}</td>
                    </tr>
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
