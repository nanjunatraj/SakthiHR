import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useFinesDeductionsRegister, usePayrollPeriodOptions, useEstablishment } from '../../lib/reports';
import { useCurrency } from '../../context/CurrencyContext';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

// Category columns for the per-employee pivot (slug → short label).
const CATS: { slug: string; label: string }[] = [
  { slug: 'fines', label: 'Fines' },
  { slug: 'damages-loss', label: 'Damages' },
  { slug: 'canteen', label: 'Canteen' },
  { slug: 'society', label: 'Society' },
  { slug: 'donations', label: 'Donations' },
  { slug: 'loan-advances', label: 'Loan/Adv' },
  { slug: 'other-deductions', label: 'Other' },
];

type GroupBy = 'none' | 'department' | 'location' | 'designation' | 'grade' | 'employeeType' | 'establishment';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'department', label: 'Department Wise' },
  { value: 'location', label: 'Work Location Wise' },
  { value: 'designation', label: 'Designation Wise' },
  { value: 'grade', label: 'Grade Wise' },
  { value: 'employeeType', label: 'Employee Type Wise' },
  { value: 'establishment', label: 'Establishment Wise' },
  { value: 'none', label: 'No Grouping' },
];

interface Entry {
  id: string; employeeId?: string; employeeCode: string; name: string; department: string; designation: string;
  location: string; grade: string; employeeType: string; establishment: string; category: string; amount: number;
}

interface EmpRow {
  id: string; employeeCode: string; name: string; department: string; designation: string; location: string;
  grade: string; employeeType: string; establishment: string;
  byCat: Record<string, number>; total: number; count: number;
}

export default function DeductionsEmployeeReport() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { formatAmount } = useCurrency();
  const periods = usePayrollPeriodOptions();
  const [periodId, setPeriodId] = useState('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('department');
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  // Keep the period dropdown harmless until periods load; default stays "all".
  useEffect(() => { if (periodId === '') setPeriodId('all'); }, [periodId]);

  const all = useFinesDeductionsRegister(periodId === 'all' ? null : (periodId || null)) as Entry[];

  // Pivot entries → one row per employee with category-wise totals.
  const empRows = useMemo<EmpRow[]>(() => {
    const m = new Map<string, EmpRow>();
    all.forEach(e => {
      const key = e.employeeCode || e.name;
      const r = m.get(key) ?? {
        id: key, employeeCode: e.employeeCode, name: e.name, department: e.department, designation: e.designation,
        location: e.location, grade: e.grade, employeeType: e.employeeType, establishment: e.establishment,
        byCat: {}, total: 0, count: 0,
      };
      r.byCat[e.category] = (r.byCat[e.category] ?? 0) + e.amount;
      r.total += e.amount; r.count += 1;
      m.set(key, r);
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return empRows.filter(r => !q || r.name.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q));
  }, [empRows, search]);

  const groups = useMemo(() => {
    const keyOf = (r: EmpRow) => (groupBy === 'none' ? 'All Employees' : ((r[groupBy] as string) || '—'));
    const m = new Map<string, EmpRow[]>();
    filtered.forEach(r => { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const subtotal = (items: EmpRow[]) => {
    const byCat: Record<string, number> = {};
    let total = 0, count = 0;
    items.forEach(r => { CATS.forEach(c => { byCat[c.slug] = (byCat[c.slug] ?? 0) + (r.byCat[c.slug] ?? 0); }); total += r.total; count += r.count; });
    return { byCat, total, count };
  };
  const grand = useMemo(() => subtotal(filtered), [filtered]);

  const amt = (n: number) => (n ? formatAmount(n) : '—');

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      ...CATS.map(c => ({ key: c.slug, label: c.label, align: 'right' as const })),
      { key: 'count', label: 'Entries', align: 'right' as const },
      { key: 'total', label: 'Total', align: 'right' as const },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    const catCells = (byCat: Record<string, number>) => Object.fromEntries(CATS.map(c => [c.slug, byCat[c.slug] || 0]));
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const st = subtotal(g.items);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', ...catCells(st.byCat), count: st.count, total: st.total });
      }
      g.items.forEach(r => rowsOut.push({ employee: r.name, code: r.employeeCode, ...catCells(r.byCat), count: r.count, total: r.total }));
    });
    const periodName = periodId === 'all' ? 'All Periods' : (periods.find(p => p.id === periodId)?.name ?? '');
    return {
      title: 'Employee-wise Fine & Deduction Report',
      establishment: est.name,
      subtitle: `${periodName}${groupBy !== 'none' ? ` · ${GROUP_OPTIONS.find(o => o.value === groupBy)?.label}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', ...catCells(grand.byCat), count: grand.count, total: grand.total },
      note: 'Computer-generated employee-wise deduction summary (category-wise).',
    };
  }, [groups, groupBy, est.name, grand, periodId, periods]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/deductions')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-orange-100 rounded-lg"><Users size={22} className="text-orange-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Employee-wise Fine & Deduction Report</h1>
                <p className="text-xs text-muted-foreground">Per-employee deduction summary, broken down by category, with totals.</p>
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
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Period</label>
              <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card min-w-[180px]">
                <option value="all">All Periods</option>
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
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee or ID…" className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    {CATS.map(c => <th key={c.slug} className="px-3 py-2.5 text-right">{c.label}</th>)}
                    <th className="px-3 py-2.5 text-right">Entries</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={CATS.length + 3} className="px-3 py-10 text-center text-muted-foreground">No deduction entries found.</td></tr>
                  ) : groups.map(g => {
                    const st = subtotal(g.items);
                    return (
                      <Fragment key={g.label}>
                        {groupBy !== 'none' && (
                          <tr className="bg-accent/40">
                            <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide">{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length}</span></td>
                            {CATS.map(c => <td key={c.slug} className="px-3 py-2 text-right font-bold">{amt(st.byCat[c.slug] ?? 0)}</td>)}
                            <td className="px-3 py-2 text-right font-bold">{st.count}</td>
                            <td className="px-3 py-2 text-right font-bold text-rose-700">{formatAmount(st.total)}</td>
                          </tr>
                        )}
                        {g.items.map(r => (
                          <tr key={r.id} className="hover:bg-accent/20">
                            <td className="px-3 py-2.5"><div className="font-semibold">{r.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</div></td>
                            {CATS.map(c => <td key={c.slug} className="px-3 py-2.5 text-right">{amt(r.byCat[c.slug] ?? 0)}</td>)}
                            <td className="px-3 py-2.5 text-right text-muted-foreground">{r.count}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-rose-700">{formatAmount(r.total)}</td>
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
                      {CATS.map(c => <td key={c.slug} className="px-3 py-2.5 text-right">{amt(grand.byCat[c.slug] ?? 0)}</td>)}
                      <td className="px-3 py-2.5 text-right">{grand.count}</td>
                      <td className="px-3 py-2.5 text-right text-rose-700">{formatAmount(grand.total)}</td>
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
