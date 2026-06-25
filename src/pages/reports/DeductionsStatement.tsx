import { formatDate } from '../../utils/date';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, ScrollText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useFinesDeductionsRegister, usePayrollPeriodOptions, useEstablishment } from '../../lib/reports';
import { useCurrency } from '../../context/CurrencyContext';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

const CAT_LABELS: Record<string, string> = {
  'loan-advances': 'Loan & Advances', 'damages-loss': 'Damages & Loss', 'fines': 'Fines', 'canteen': 'Canteen',
  'society': 'Society', 'other-deductions': 'Other Deductions', 'donations': 'Donations / Campaign',
};
const catLabel = (s: string) => CAT_LABELS[s] ?? (s ? s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—');

type GroupBy = 'category' | 'status' | 'department' | 'location' | 'designation' | 'grade' | 'employeeType' | 'establishment' | 'none';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'category', label: 'Category Wise' },
  { value: 'status', label: 'Status Wise' },
  { value: 'department', label: 'Department Wise' },
  { value: 'location', label: 'Work Location Wise' },
  { value: 'designation', label: 'Designation Wise' },
  { value: 'grade', label: 'Grade Wise' },
  { value: 'employeeType', label: 'Employee Type Wise' },
  { value: 'establishment', label: 'Establishment Wise' },
  { value: 'none', label: 'No Grouping' },
];

interface Entry {
  id: string; employeeCode: string; name: string; department: string; designation: string; location: string;
  grade: string; employeeType: string; establishment: string; category: string; description: string;
  amount: number; referenceNo: string; status: string; issuedOn: string;
}

const fmtDate = (s: string) => formatDate(s);

export default function DeductionsStatement() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { formatAmount } = useCurrency();
  const periods = usePayrollPeriodOptions();
  const [periodId, setPeriodId] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  useEffect(() => {
    if (periodId || !periods.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const cur = periods.find(p => p.fromDate <= today && today <= p.toDate);
    setPeriodId((cur ?? periods[0]).id);
  }, [periods, periodId]);

  const all = useFinesDeductionsRegister(periodId === 'all' ? null : (periodId || null)) as Entry[];

  const keyFor = (e: Entry, g: GroupBy): string => {
    if (g === 'category') return catLabel(e.category);
    if (g === 'none') return 'All Deductions';
    return (e[g] as string) || '—';
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(e => !q || e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q) || catLabel(e.category).toLowerCase().includes(q) || e.referenceNo.toLowerCase().includes(q));
  }, [all, search]);

  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>();
    filtered.forEach(e => { const k = keyFor(e, groupBy); (m.get(k) ?? m.set(k, []).get(k)!).push(e); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const grand = useMemo(() => filtered.reduce((t, e) => t + e.amount, 0), [filtered]);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'category', label: 'Category', text: true },
      { key: 'desc', label: 'Description', text: true },
      { key: 'ref', label: 'Reference', text: true },
      { key: 'date', label: 'Issued', text: true },
      { key: 'amount', label: 'Amount', align: 'right' as const },
      { key: 'status', label: 'Status', text: true },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const amt = g.items.reduce((t, e) => t + e.amount, 0);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', category: '', desc: '', ref: '', date: '', amount: amt, status: `${g.items.length}` });
      }
      g.items.forEach(e => rowsOut.push({
        employee: e.name, code: e.employeeCode, category: catLabel(e.category), desc: e.description, ref: e.referenceNo,
        date: fmtDate(e.issuedOn), amount: e.amount, status: e.status,
      }));
    });
    const periodName = periodId === 'all' ? 'All Periods' : (periods.find(p => p.id === periodId)?.name ?? '');
    return {
      title: 'Fine & Deductions Statement',
      establishment: est.name,
      subtitle: `${periodName}${groupBy !== 'none' ? ` · ${GROUP_OPTIONS.find(o => o.value === groupBy)?.label}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', amount: grand, status: `${filtered.length} entr${filtered.length !== 1 ? 'ies' : 'y'}` },
      note: 'Computer-generated fine & deductions statement.',
    };
  }, [groups, groupBy, est.name, grand, filtered.length, periodId, periods]);

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
              <div className="p-2 bg-orange-100 rounded-lg"><ScrollText size={22} className="text-orange-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Fine & Deductions Statement</h1>
                <p className="text-xs text-muted-foreground">Deduction entries for a period, grouped by category, status or org dimension with amount totals.</p>
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
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee, ID, category or reference…" className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-left">Category</th>
                    <th className="px-3 py-2.5 text-left">Description</th>
                    <th className="px-3 py-2.5 text-left">Reference</th>
                    <th className="px-3 py-2.5 text-left">Issued</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No deduction entries for this period.</td></tr>
                  ) : groups.map(g => (
                    <Fragment key={g.label}>
                      {groupBy !== 'none' && (
                        <tr className="bg-accent/40">
                          <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide" colSpan={5}>{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length} entr{g.items.length !== 1 ? 'ies' : 'y'}</span></td>
                          <td className="px-3 py-2 text-right font-bold">{formatAmount(g.items.reduce((t, e) => t + e.amount, 0))}</td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      )}
                      {g.items.map(e => (
                        <tr key={e.id} className="hover:bg-accent/20">
                          <td className="px-3 py-2.5"><div className="font-semibold">{e.name}</div><div className="text-[10px] font-mono text-muted-foreground">{e.employeeCode}</div></td>
                          <td className="px-3 py-2.5">{catLabel(e.category)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">{e.description || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">{e.referenceNo || '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(e.issuedOn)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-rose-700">{formatAmount(e.amount)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{e.status}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-accent/30 font-bold border-t-2 border-border">
                      <td className="px-3 py-2.5" colSpan={5}>GRAND TOTAL · {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</td>
                      <td className="px-3 py-2.5 text-right text-rose-700">{formatAmount(grand)}</td>
                      <td className="px-3 py-2.5"></td>
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
