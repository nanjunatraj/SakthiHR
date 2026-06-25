import { formatDate } from '../../utils/date';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import {
  useAttendanceRegister, useWageRegister, usePayrollPeriodOptions, useEstablishment, EMPTY_PERIOD_OPTION,
  type AttendanceRegisterEmp,
} from '../../lib/reports';
import { useCurrency } from '../../context/CurrencyContext';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

type GroupBy = 'none' | 'department' | 'designation' | 'location' | 'grade' | 'employeeType' | 'establishment';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'department', label: 'Department Wise' },
  { value: 'designation', label: 'Designation Wise' },
  { value: 'location', label: 'Work Location Wise' },
  { value: 'grade', label: 'Grade Wise' },
  { value: 'employeeType', label: 'Employee Type Wise' },
  { value: 'establishment', label: 'Establishment Wise' },
  { value: 'none', label: 'No Grouping' },
];

interface Row {
  emp: AttendanceRegisterEmp;
  working: number; present: number; leave: number; lop: number; absent: number; unpaid: number; amount: number;
}

function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + 'T00:00:00'); const end = new Date(to + 'T00:00:00');
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return out;
}

export default function LossOfPayReport() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { formatAmount } = useCurrency();
  const periods = usePayrollPeriodOptions();
  const [periodId, setPeriodId] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('department');
  const [search, setSearch] = useState('');
  const [onlyLop, setOnlyLop] = useState(true);
  const [showView, setShowView] = useState(false);

  useEffect(() => {
    if (periodId || !periods.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const cur = periods.find(p => p.fromDate <= today && today <= p.toDate);
    setPeriodId((cur ?? periods[0]).id);
  }, [periods, periodId]);
  const period = periods.find(p => p.id === periodId) ?? EMPTY_PERIOD_OPTION;

  const { employees, holidaysByDate, loading } = useAttendanceRegister(period.fromDate, period.toDate);
  const wage = useWageRegister(period.id || null);
  const grossById = useMemo(() => {
    const m = new Map<string, number>();
    wage.forEach((w: any) => m.set(w.id, Number(w.gross) || 0));
    return m;
  }, [wage]);

  // Per-employee LOP from the attendance register; indicative amount = per-day rate × unpaid days.
  const allRows = useMemo<Row[]>(() => {
    if (!period.fromDate || !period.toDate) return [];
    const dates = datesInRange(period.fromDate, period.toDate);
    const today = new Date().toISOString().slice(0, 10);
    return employees.map(emp => {
      let working = 0, present = 0, leave = 0, lop = 0, absent = 0;
      dates.forEach(date => {
        const rec = emp.daily[date];
        const hol = holidaysByDate[date];
        const code = rec?.status ?? (hol ?? (date <= today ? 'A' : '-'));
        switch (code) {
          case 'L': leave++; working++; break;
          case 'LOP': lop++; working++; break;
          case 'A': absent++; working++; break;
          case 'HD': case 'LT': case 'P': present++; working++; break;
          default: break;
        }
      });
      const unpaid = lop + absent;
      const gross = grossById.get(emp.id) ?? 0;
      const amount = working > 0 ? Math.round((gross / working) * unpaid) : 0;
      return { emp, working, present, leave, lop, absent, unpaid, amount };
    });
  }, [employees, holidaysByDate, period.fromDate, period.toDate, grossById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(r =>
      (!onlyLop || r.unpaid > 0) &&
      (!q || r.emp.name.toLowerCase().includes(q) || r.emp.employeeCode.toLowerCase().includes(q)));
  }, [allRows, search, onlyLop]);

  const groups = useMemo(() => {
    const keyOf = (r: Row) => (groupBy === 'none' ? 'All Employees' : (r.emp[groupBy] || '—'));
    const m = new Map<string, Row[]>();
    filtered.forEach(r => { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const subtotal = (items: Row[]) => items.reduce((t, r) => ({
    lop: t.lop + r.lop, absent: t.absent + r.absent, unpaid: t.unpaid + r.unpaid, amount: t.amount + r.amount,
  }), { lop: 0, absent: 0, unpaid: 0, amount: 0 });
  const grand = useMemo(() => subtotal(filtered), [filtered]);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'working', label: 'Working', align: 'right' as const },
      { key: 'lop', label: 'LOP', align: 'right' as const },
      { key: 'absent', label: 'Absent', align: 'right' as const },
      { key: 'unpaid', label: 'Unpaid Days', align: 'right' as const },
      { key: 'amount', label: 'LOP Amount (est.)', align: 'right' as const },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const st = subtotal(g.items);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', working: '', lop: st.lop, absent: st.absent, unpaid: st.unpaid, amount: st.amount });
      }
      g.items.forEach(r => rowsOut.push({
        employee: r.emp.name, code: r.emp.employeeCode, working: r.working, lop: r.lop, absent: r.absent, unpaid: r.unpaid, amount: r.amount,
      }));
    });
    return {
      title: 'Loss of Pay (LOP) Report',
      establishment: est.name,
      subtitle: `${period.name}${period.fromDate ? ` · ${formatDate(period.fromDate)} – ${formatDate(period.toDate)}` : ''}${groupBy !== 'none' ? ` · ${GROUP_OPTIONS.find(o => o.value === groupBy)?.label}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', lop: grand.lop, absent: grand.absent, unpaid: grand.unpaid, amount: grand.amount },
      note: 'LOP days from attendance (unauthorised absence + LOP). Amount is indicative: per-day rate (period gross ÷ working days) × unpaid days.',
    };
  }, [groups, groupBy, est.name, period, grand]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/leave')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-rose-100 rounded-lg"><TrendingDown size={22} className="text-rose-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Loss of Pay (LOP) Report</h1>
                <p className="text-xs text-muted-foreground">Unpaid days (unauthorised absence + LOP) per employee for a period, with indicative deduction.</p>
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
            <label className="flex items-center gap-2 text-sm px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={onlyLop} onChange={e => setOnlyLop(e.target.checked)} className="rounded border-border" />
              Only employees with LOP
            </label>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee or ID…" className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-right">Working</th>
                    <th className="px-3 py-2.5 text-right">LOP</th>
                    <th className="px-3 py-2.5 text-right">Absent</th>
                    <th className="px-3 py-2.5 text-right">Unpaid Days</th>
                    <th className="px-3 py-2.5 text-right">LOP Amount (est.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">{onlyLop ? 'No LOP for this period.' : 'No attendance for this period.'}</td></tr>
                  ) : groups.map(g => {
                    const st = subtotal(g.items);
                    return (
                      <Fragment key={g.label}>
                        {groupBy !== 'none' && (
                          <tr className="bg-accent/40">
                            <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide">{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length}</span></td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-right font-bold">{st.lop || ''}</td>
                            <td className="px-3 py-2 text-right font-bold">{st.absent || ''}</td>
                            <td className="px-3 py-2 text-right font-bold">{st.unpaid || ''}</td>
                            <td className="px-3 py-2 text-right font-bold">{formatAmount(st.amount)}</td>
                          </tr>
                        )}
                        {g.items.map(r => (
                          <tr key={r.emp.id} className="hover:bg-accent/20">
                            <td className="px-3 py-2.5"><div className="font-semibold">{r.emp.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.emp.employeeCode}</div></td>
                            <td className="px-3 py-2.5 text-right">{r.working}</td>
                            <td className="px-3 py-2.5 text-right text-rose-600">{r.lop || '—'}</td>
                            <td className="px-3 py-2.5 text-right text-red-600">{r.absent || '—'}</td>
                            <td className="px-3 py-2.5 text-right font-medium">{r.unpaid || '—'}</td>
                            <td className="px-3 py-2.5 text-right font-medium">{r.amount ? formatAmount(r.amount) : '—'}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-accent/30 font-bold border-t-2 border-border">
                      <td className="px-3 py-2.5">GRAND TOTAL</td>
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5 text-right">{grand.lop || '—'}</td>
                      <td className="px-3 py-2.5 text-right">{grand.absent || '—'}</td>
                      <td className="px-3 py-2.5 text-right">{grand.unpaid || '—'}</td>
                      <td className="px-3 py-2.5 text-right">{formatAmount(grand.amount)}</td>
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
