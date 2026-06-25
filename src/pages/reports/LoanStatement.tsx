import { formatDate } from '../../utils/date';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, ScrollText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import {
  useLoanStatement, usePayrollPeriodOptions, useEstablishment, EMPTY_PERIOD_OPTION,
  type LoanStatementRow,
} from '../../lib/reports';
import { useCurrency } from '../../context/CurrencyContext';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

type GroupBy = 'none' | 'loanType' | 'department' | 'location' | 'employeeType' | 'establishment';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'loanType', label: 'Loan Type Wise' },
  { value: 'department', label: 'Department Wise' },
  { value: 'location', label: 'Work Location Wise' },
  { value: 'employeeType', label: 'Employee Type Wise' },
  { value: 'establishment', label: 'Establishment Wise' },
  { value: 'none', label: 'No Grouping' },
];

export default function LoanStatement() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { formatAmount } = useCurrency();
  const periods = usePayrollPeriodOptions();
  const [periodId, setPeriodId] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('loanType');
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  useEffect(() => {
    if (periodId || !periods.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const cur = periods.find(p => p.fromDate <= today && today <= p.toDate);
    setPeriodId((cur ?? periods[0]).id);
  }, [periods, periodId]);
  const period = periods.find(p => p.id === periodId) ?? EMPTY_PERIOD_OPTION;

  const { rows, loading } = useLoanStatement(period.fromDate, period.toDate);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => !q || r.name.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q) || r.loanType.toLowerCase().includes(q));
  }, [rows, search]);

  const groups = useMemo(() => {
    const keyOf = (r: LoanStatementRow) => (groupBy === 'none' ? 'All Loan Activity' : (r[groupBy] || '—'));
    const m = new Map<string, LoanStatementRow[]>();
    filtered.forEach(r => { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const subtotal = (items: LoanStatementRow[]) => items.reduce((t, r) => ({
    disbursed: t.disbursed + r.disbursedInPeriod, due: t.due + r.emiDueAmount, recovered: t.recovered + r.emiPaidAmount, outstanding: t.outstanding + r.outstanding,
  }), { disbursed: 0, due: 0, recovered: 0, outstanding: 0 });
  const grand = useMemo(() => subtotal(filtered), [filtered]);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'type', label: 'Loan Type', text: true },
      { key: 'disbursed', label: 'Disbursed', align: 'right' as const },
      { key: 'due', label: 'EMI Due', align: 'right' as const },
      { key: 'recovered', label: 'Recovered', align: 'right' as const },
      { key: 'outstanding', label: 'Outstanding', align: 'right' as const },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const st = subtotal(g.items);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', type: '', disbursed: st.disbursed, due: st.due, recovered: st.recovered, outstanding: st.outstanding });
      }
      g.items.forEach(r => rowsOut.push({
        employee: r.name, code: r.employeeCode, type: r.loanType, disbursed: r.disbursedInPeriod,
        due: r.emiDueAmount, recovered: r.emiPaidAmount, outstanding: r.outstanding,
      }));
    });
    return {
      title: 'Loan & Advance Statement',
      establishment: est.name,
      subtitle: `${period.name}${period.fromDate ? ` · ${formatDate(period.fromDate)} – ${formatDate(period.toDate)}` : ''}${groupBy !== 'none' ? ` · ${GROUP_OPTIONS.find(o => o.value === groupBy)?.label}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', disbursed: grand.disbursed, due: grand.due, recovered: grand.recovered, outstanding: grand.outstanding },
      note: 'Loan & advance activity for the period — disbursements and EMI recovery (scheduled vs recovered).',
    };
  }, [groups, groupBy, est.name, period, grand]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/loan')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-indigo-100 rounded-lg"><ScrollText size={22} className="text-indigo-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Loan & Advance Statement</h1>
                <p className="text-xs text-muted-foreground">Disbursements and EMI recovery within a pay period, grouped by any dimension.</p>
              </div>
            </div>
            <button onClick={() => setShowView(true)} disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50">
              <Eye size={15} /> View / Print
            </button>
          </div>
        </div>

        <div className="p-8 space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Pay Period</label>
              <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card min-w-[180px]">
                {periods.length === 0 && <option value="">No periods</option>}
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Group By</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card min-w-[170px]">
                {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee, ID or loan type…" className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-left">Loan Type</th>
                    <th className="px-3 py-2.5 text-right">Disbursed</th>
                    <th className="px-3 py-2.5 text-right">EMI Due</th>
                    <th className="px-3 py-2.5 text-right">Recovered</th>
                    <th className="px-3 py-2.5 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No loan activity in this period.</td></tr>
                  ) : groups.map(g => {
                    const st = subtotal(g.items);
                    return (
                      <Fragment key={g.label}>
                        {groupBy !== 'none' && (
                          <tr className="bg-accent/40">
                            <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide" colSpan={2}>{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length}</span></td>
                            <td className="px-3 py-2 text-right font-bold">{formatAmount(st.disbursed)}</td>
                            <td className="px-3 py-2 text-right font-bold">{formatAmount(st.due)}</td>
                            <td className="px-3 py-2 text-right font-bold">{formatAmount(st.recovered)}</td>
                            <td className="px-3 py-2 text-right font-bold">{formatAmount(st.outstanding)}</td>
                          </tr>
                        )}
                        {g.items.map(r => (
                          <tr key={r.id} className="hover:bg-accent/20">
                            <td className="px-3 py-2.5"><div className="font-semibold">{r.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</div></td>
                            <td className="px-3 py-2.5">{r.loanType}</td>
                            <td className="px-3 py-2.5 text-right">{r.disbursedInPeriod ? formatAmount(r.disbursedInPeriod) : '—'}</td>
                            <td className="px-3 py-2.5 text-right">{r.emiDueAmount ? formatAmount(r.emiDueAmount) : '—'}<span className="text-[10px] text-muted-foreground ml-1">{r.emiDueCount ? `(${r.emiDueCount})` : ''}</span></td>
                            <td className="px-3 py-2.5 text-right text-green-700">{r.emiPaidAmount ? formatAmount(r.emiPaidAmount) : '—'}</td>
                            <td className="px-3 py-2.5 text-right font-medium">{formatAmount(r.outstanding)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-accent/30 font-bold border-t-2 border-border">
                      <td className="px-3 py-2.5" colSpan={2}>GRAND TOTAL</td>
                      <td className="px-3 py-2.5 text-right">{formatAmount(grand.disbursed)}</td>
                      <td className="px-3 py-2.5 text-right">{formatAmount(grand.due)}</td>
                      <td className="px-3 py-2.5 text-right">{formatAmount(grand.recovered)}</td>
                      <td className="px-3 py-2.5 text-right">{formatAmount(grand.outstanding)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}
