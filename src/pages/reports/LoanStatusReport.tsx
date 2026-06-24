import { useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useLoanRegister, useEstablishment, type LoanRow } from '../../lib/reports';
import { useCurrency } from '../../context/CurrencyContext';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

type GroupBy = 'status' | 'none' | 'loanType' | 'department' | 'location' | 'employeeType' | 'establishment';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'status', label: 'Status Wise' },
  { value: 'loanType', label: 'Loan Type Wise' },
  { value: 'department', label: 'Department Wise' },
  { value: 'location', label: 'Work Location Wise' },
  { value: 'employeeType', label: 'Employee Type Wise' },
  { value: 'establishment', label: 'Establishment Wise' },
  { value: 'none', label: 'No Grouping' },
];

const STATUS_META: { key: string; color: string; chip: string }[] = [
  { key: 'Active', color: 'text-green-700', chip: 'bg-green-100 text-green-700' },
  { key: 'Approved', color: 'text-blue-600', chip: 'bg-blue-100 text-blue-700' },
  { key: 'Pending', color: 'text-amber-600', chip: 'bg-amber-100 text-amber-700' },
  { key: 'Closed', color: 'text-muted-foreground', chip: 'bg-gray-100 text-gray-600' },
  { key: 'Rejected', color: 'text-red-600', chip: 'bg-red-100 text-red-700' },
];

export default function LoanStatusReport() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { formatAmount } = useCurrency();
  const { rows, loading } = useLoanRegister();
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => !q || r.name.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q) || r.loanType.toLowerCase().includes(q));
  }, [rows, search]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.status] = (m[r.status] ?? 0) + 1; });
    return m;
  }, [filtered]);
  const totalOutstanding = useMemo(() => filtered.reduce((t, r) => t + r.outstanding, 0), [filtered]);

  const groups = useMemo(() => {
    const keyOf = (r: LoanRow) => (groupBy === 'none' ? 'All Loans' : (r[groupBy] || '—'));
    const m = new Map<string, LoanRow[]>();
    filtered.forEach(r => { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const pct = (r: LoanRow) => (r.tenureMonths > 0 ? Math.round((r.paidEmis / r.tenureMonths) * 100) : 0);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'type', label: 'Loan Type', text: true },
      { key: 'status', label: 'Status', text: true },
      { key: 'progress', label: 'EMIs Paid', text: true },
      { key: 'pct', label: '% Repaid', align: 'right' as const },
      { key: 'outstanding', label: 'Outstanding', align: 'right' as const },
      { key: 'approval', label: 'Approval (Mgr/HR)', text: true },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const out = g.items.reduce((t, r) => t + r.outstanding, 0);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', type: '', status: `${g.items.length}`, progress: '', pct: '', outstanding: out, approval: '' });
      }
      g.items.forEach(r => rowsOut.push({
        employee: r.name, code: r.employeeCode, type: r.loanType, status: r.status,
        progress: `${r.paidEmis}/${r.tenureMonths}`, pct: `${pct(r)}%`, outstanding: r.outstanding,
        approval: `${r.managerStatus} / ${r.hrStatus}`,
      }));
    });
    return {
      title: 'Loan Status Report',
      establishment: est.name,
      subtitle: `${groupBy !== 'none' ? GROUP_OPTIONS.find(o => o.value === groupBy)?.label : 'All loans'} · ${filtered.length} loan(s)`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', outstanding: totalOutstanding },
      note: 'Computer-generated loan status report — repayment progress and approval state.',
    };
  }, [groups, groupBy, est.name, filtered.length, totalOutstanding]);

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
              <div className="p-2 bg-indigo-100 rounded-lg"><Activity size={22} className="text-indigo-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Loan Status Report</h1>
                <p className="text-xs text-muted-foreground">Repayment progress and approval state of every loan & advance.</p>
              </div>
            </div>
            <button onClick={() => setShowView(true)} disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50">
              <Eye size={15} /> View / Print
            </button>
          </div>
        </div>

        <div className="p-8 space-y-5">
          {/* Status KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {STATUS_META.map(s => (
              <div key={s.key} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{counts[s.key] ?? 0}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.key}</p>
              </div>
            ))}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-indigo-700">{formatAmount(totalOutstanding)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">Outstanding</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
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
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5 text-left w-40">Repayment</th>
                    <th className="px-3 py-2.5 text-right">Outstanding</th>
                    <th className="px-3 py-2.5 text-left">Approval (Mgr/HR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No loans or advances on record.</td></tr>
                  ) : groups.map(g => (
                    <Fragment key={g.label}>
                      {groupBy !== 'none' && (
                        <tr className="bg-accent/40">
                          <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide" colSpan={4}>{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length}</span></td>
                          <td className="px-3 py-2 text-right font-bold">{formatAmount(g.items.reduce((t, r) => t + r.outstanding, 0))}</td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      )}
                      {g.items.map(r => {
                        const meta = STATUS_META.find(s => s.key === r.status);
                        return (
                          <tr key={r.id} className="hover:bg-accent/20">
                            <td className="px-3 py-2.5"><div className="font-semibold">{r.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</div></td>
                            <td className="px-3 py-2.5">{r.loanType}</td>
                            <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta?.chip ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${pct(r)}%` }} /></div>
                                <span className="text-[10px] text-muted-foreground tabular-nums">{r.paidEmis}/{r.tenureMonths}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium">{formatAmount(r.outstanding)}</td>
                            <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{r.managerStatus} / {r.hrStatus}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}
