import { useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useEmployeeLeaveStatus, useEstablishment, type LeaveStatusRow } from '../../lib/reports';
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

const n1 = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);

export default function EmployeeLeaveStatus() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { rows, loading } = useEmployeeLeaveStatus();
  const [groupBy, setGroupBy] = useState<GroupBy>('department');
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => !q || r.name.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q));
  }, [rows, search]);

  const groups = useMemo(() => {
    const keyOf = (r: LeaveStatusRow) => (groupBy === 'none' ? 'All Employees' : (r[groupBy] || '—'));
    const m = new Map<string, LeaveStatusRow[]>();
    filtered.forEach(r => { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const subtotal = (items: LeaveStatusRow[]) => items.reduce((t, r) => ({
    entitled: t.entitled + r.entitled, used: t.used + r.used, balance: t.balance + r.balance, pending: t.pending + r.pending,
  }), { entitled: 0, used: 0, balance: 0, pending: 0 });
  const grand = useMemo(() => subtotal(filtered), [filtered]);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'entitled', label: 'Entitled', align: 'right' as const },
      { key: 'used', label: 'Used', align: 'right' as const },
      { key: 'balance', label: 'Balance', align: 'right' as const },
      { key: 'cl', label: 'CL', align: 'right' as const },
      { key: 'sl', label: 'SL', align: 'right' as const },
      { key: 'el', label: 'EL', align: 'right' as const },
      { key: 'pending', label: 'Pending', align: 'right' as const },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const st = subtotal(g.items);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', entitled: n1(st.entitled), used: n1(st.used), balance: n1(st.balance), cl: '', sl: '', el: '', pending: st.pending });
      }
      g.items.forEach(r => rowsOut.push({
        employee: r.name, code: r.employeeCode, entitled: n1(r.entitled), used: n1(r.used), balance: n1(r.balance),
        cl: n1(r.cl), sl: n1(r.sl), el: n1(r.el), pending: r.pending,
      }));
    });
    return {
      title: 'Employee Leave Status',
      establishment: est.name,
      subtitle: `Current leave balances & pending applications${groupBy !== 'none' ? ` · ${GROUP_OPTIONS.find(o => o.value === groupBy)?.label}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', entitled: n1(grand.entitled), used: n1(grand.used), balance: n1(grand.balance), pending: grand.pending },
      note: 'Computer-generated leave status — entitled = opening + accrued; balance = closing.',
    };
  }, [groups, groupBy, est.name, grand]);

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
              <div className="p-2 bg-teal-100 rounded-lg"><BadgeCheck size={22} className="text-teal-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Employee Leave Status</h1>
                <p className="text-xs text-muted-foreground">Current entitlement, used, balance and pending applications per employee.</p>
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
                    <th className="px-3 py-2.5 text-right">Entitled</th>
                    <th className="px-3 py-2.5 text-right">Used</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-3 py-2.5 text-right">CL</th>
                    <th className="px-3 py-2.5 text-right">SL</th>
                    <th className="px-3 py-2.5 text-right">EL</th>
                    <th className="px-3 py-2.5 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No leave balances found.</td></tr>
                  ) : groups.map(g => {
                    const st = subtotal(g.items);
                    return (
                      <Fragment key={g.label}>
                        {groupBy !== 'none' && (
                          <tr className="bg-accent/40">
                            <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide">{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length}</span></td>
                            <td className="px-3 py-2 text-right font-bold">{n1(st.entitled)}</td>
                            <td className="px-3 py-2 text-right font-bold">{n1(st.used)}</td>
                            <td className="px-3 py-2 text-right font-bold">{n1(st.balance)}</td>
                            <td className="px-3 py-2" colSpan={3}></td>
                            <td className="px-3 py-2 text-right font-bold">{st.pending || ''}</td>
                          </tr>
                        )}
                        {g.items.map(r => (
                          <tr key={r.id} className="hover:bg-accent/20">
                            <td className="px-3 py-2.5"><div className="font-semibold">{r.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</div></td>
                            <td className="px-3 py-2.5 text-right">{n1(r.entitled)}</td>
                            <td className="px-3 py-2.5 text-right text-blue-600">{n1(r.used)}</td>
                            <td className="px-3 py-2.5 text-right text-green-700 font-medium">{n1(r.balance)}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">{n1(r.cl)}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">{n1(r.sl)}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">{n1(r.el)}</td>
                            <td className="px-3 py-2.5 text-right">{r.pending ? <span className="text-amber-600 font-medium">{r.pending}</span> : '—'}</td>
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
                      <td className="px-3 py-2.5 text-right">{n1(grand.entitled)}</td>
                      <td className="px-3 py-2.5 text-right">{n1(grand.used)}</td>
                      <td className="px-3 py-2.5 text-right">{n1(grand.balance)}</td>
                      <td className="px-3 py-2.5" colSpan={3}></td>
                      <td className="px-3 py-2.5 text-right">{grand.pending || '—'}</td>
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
