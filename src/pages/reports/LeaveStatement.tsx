import { formatDate } from '../../utils/date';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, ScrollText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import {
  useLeaveStatement, usePayrollPeriodOptions, useEstablishment, EMPTY_PERIOD_OPTION,
  type LeaveStatementRow,
} from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

type GroupBy = 'none' | 'department' | 'designation' | 'location' | 'grade' | 'employeeType' | 'establishment' | 'leaveType';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'department', label: 'Department Wise' },
  { value: 'leaveType', label: 'Leave Type Wise' },
  { value: 'designation', label: 'Designation Wise' },
  { value: 'location', label: 'Work Location Wise' },
  { value: 'grade', label: 'Grade Wise' },
  { value: 'employeeType', label: 'Employee Type Wise' },
  { value: 'establishment', label: 'Establishment Wise' },
  { value: 'none', label: 'No Grouping' },
];

const STATUS_STYLE: Record<string, string> = {
  Approved: 'text-green-700', Pending: 'text-amber-600', Applied: 'text-amber-600',
  Rejected: 'text-red-600', Cancelled: 'text-muted-foreground',
};

const fmtDate = (s: string) => formatDate(s);

export default function LeaveStatement() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const periods = usePayrollPeriodOptions();
  const [periodId, setPeriodId] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('department');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  useEffect(() => {
    if (periodId || !periods.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const cur = periods.find(p => p.fromDate <= today && today <= p.toDate);
    setPeriodId((cur ?? periods[0]).id);
  }, [periods, periodId]);
  const period = periods.find(p => p.id === periodId) ?? EMPTY_PERIOD_OPTION;

  const { rows, loading } = useLeaveStatement(period.fromDate, period.toDate);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (statusFilter === 'all' || r.status === statusFilter) &&
      (!q || r.name.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q) || r.leaveType.toLowerCase().includes(q)));
  }, [rows, search, statusFilter]);

  const groups = useMemo(() => {
    const keyOf = (r: LeaveStatementRow) => (groupBy === 'none' ? 'All Leave Applications' : (r[groupBy] || '—'));
    const m = new Map<string, LeaveStatementRow[]>();
    filtered.forEach(r => { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const grandDays = useMemo(() => filtered.reduce((t, r) => t + r.days, 0), [filtered]);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'type', label: 'Leave Type', text: true },
      { key: 'from', label: 'From', text: true },
      { key: 'to', label: 'To', text: true },
      { key: 'days', label: 'Days', align: 'right' as const },
      { key: 'status', label: 'Status', text: true },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const days = g.items.reduce((t, r) => t + r.days, 0);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', type: '', from: '', to: '', days, status: `${g.items.length} appln` });
      }
      g.items.forEach(r => rowsOut.push({
        employee: r.name, code: r.employeeCode, type: `${r.leaveType}${r.halfDay ? ' (½)' : ''}`,
        from: fmtDate(r.fromDate), to: fmtDate(r.toDate), days: r.days, status: r.status,
      }));
    });
    return {
      title: 'Leave Statement',
      establishment: est.name,
      subtitle: `${period.name}${period.fromDate ? ` · ${fmtDate(period.fromDate)} – ${fmtDate(period.toDate)}` : ''}${groupBy !== 'none' ? ` · ${GROUP_OPTIONS.find(o => o.value === groupBy)?.label}` : ''}${statusFilter !== 'all' ? ` · ${statusFilter}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', days: grandDays, status: `${filtered.length} appln` },
      note: 'Computer-generated leave statement — applications overlapping the selected period.',
    };
  }, [groups, groupBy, est.name, period, grandDays, filtered.length, statusFilter]);

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
              <div className="p-2 bg-teal-100 rounded-lg"><ScrollText size={22} className="text-teal-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Leave Statement</h1>
                <p className="text-xs text-muted-foreground">Leave applications taken in a period, grouped by any org dimension or leave type.</p>
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
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card min-w-[130px]">
                <option value="all">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee, ID or leave type…" className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-left">Leave Type</th>
                    <th className="px-3 py-2.5 text-left">From</th>
                    <th className="px-3 py-2.5 text-left">To</th>
                    <th className="px-3 py-2.5 text-right">Days</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No leave applications for this period.</td></tr>
                  ) : groups.map(g => (
                    <Fragment key={g.label}>
                      {groupBy !== 'none' && (
                        <tr className="bg-accent/40">
                          <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide" colSpan={4}>{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length} application{g.items.length !== 1 ? 's' : ''}</span></td>
                          <td className="px-3 py-2 text-right font-bold">{g.items.reduce((t, r) => t + r.days, 0)}</td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      )}
                      {g.items.map(r => (
                        <tr key={r.id} className="hover:bg-accent/20">
                          <td className="px-3 py-2.5"><div className="font-semibold">{r.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</div></td>
                          <td className="px-3 py-2.5">{r.leaveType}{r.halfDay && <span className="ml-1 text-[10px] text-muted-foreground">(½ day)</span>}</td>
                          <td className="px-3 py-2.5">{fmtDate(r.fromDate)}</td>
                          <td className="px-3 py-2.5">{fmtDate(r.toDate)}</td>
                          <td className="px-3 py-2.5 text-right font-medium">{r.days}</td>
                          <td className={`px-3 py-2.5 font-medium ${STATUS_STYLE[r.status] ?? 'text-muted-foreground'}`}>{r.status}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-accent/30 font-bold border-t-2 border-border">
                      <td className="px-3 py-2.5" colSpan={4}>GRAND TOTAL · {filtered.length} application{filtered.length !== 1 ? 's' : ''}</td>
                      <td className="px-3 py-2.5 text-right">{grandDays}</td>
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
