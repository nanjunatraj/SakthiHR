import { formatDate } from '../../utils/date';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import {
  useAttendanceRegister, usePayrollPeriodOptions, useEstablishment, EMPTY_PERIOD_OPTION,
  type AttendanceRegisterEmp,
} from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

type GroupBy = 'none' | 'department' | 'designation' | 'location' | 'grade' | 'employeeType' | 'establishment';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'No Grouping' },
  { value: 'department', label: 'Department Wise' },
  { value: 'designation', label: 'Designation Wise' },
  { value: 'location', label: 'Work Location Wise' },
  { value: 'grade', label: 'Grade Wise' },
  { value: 'employeeType', label: 'Employee Type Wise' },
  { value: 'establishment', label: 'Establishment Wise' },
];

interface Summary {
  emp: AttendanceRegisterEmp;
  working: number; present: number; absent: number; leave: number; lop: number;
  halfDay: number; late: number; holiday: number; weekoff: number; otHours: number; hoursWorked: number;
}

function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + 'T00:00:00'); const end = new Date(to + 'T00:00:00');
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return out;
}

export default function AttendanceStatement() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const periods = usePayrollPeriodOptions();
  const [periodId, setPeriodId] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('department');
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  useEffect(() => {
    if (periodId || !periods.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const cur = periods.find(p => p.fromDate <= today && today <= p.toDate);
    setPeriodId((cur ?? periods[0]).id);
  }, [periods, periodId]);
  const period = periods.find(p => p.id === periodId) ?? EMPTY_PERIOD_OPTION;

  const { employees, holidaysByDate, loading } = useAttendanceRegister(period.fromDate, period.toDate);

  // Per-employee attendance summary over the period's date range.
  const summaries = useMemo<Summary[]>(() => {
    if (!period.fromDate || !period.toDate) return [];
    const dates = datesInRange(period.fromDate, period.toDate);
    const today = new Date().toISOString().slice(0, 10);
    return employees.map(emp => {
      const s: Summary = { emp, working: 0, present: 0, absent: 0, leave: 0, lop: 0, halfDay: 0, late: 0, holiday: 0, weekoff: 0, otHours: emp.overtimeHours, hoursWorked: emp.totalHoursWorked };
      dates.forEach(date => {
        const rec = emp.daily[date];
        const hol = holidaysByDate[date];
        const code = rec?.status ?? (hol ?? (date <= today ? 'A' : '-'));
        switch (code) {
          case 'H': s.holiday++; break;
          case 'WO': s.weekoff++; break;
          case 'L': s.leave++; s.working++; break;
          case 'LOP': s.lop++; s.working++; break;
          case 'A': s.absent++; s.working++; break;
          case 'HD': s.halfDay++; s.present++; s.working++; break;
          case 'LT': s.late++; s.present++; s.working++; break;
          case 'P': s.present++; s.working++; break;
          default: break; // not-marked future days
        }
      });
      return s;
    });
  }, [employees, holidaysByDate, period.fromDate, period.toDate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter(s => !q || s.emp.name.toLowerCase().includes(q) || s.emp.employeeCode.toLowerCase().includes(q));
  }, [summaries, search]);

  const groups = useMemo(() => {
    const keyOf = (s: Summary) => (groupBy === 'none' ? 'All Employees' : (s.emp[groupBy] || '—'));
    const m = new Map<string, Summary[]>();
    filtered.forEach(s => { const k = keyOf(s); (m.get(k) ?? m.set(k, []).get(k)!).push(s); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const grand = useMemo(() => filtered.reduce((t, s) => ({
    present: t.present + s.present, absent: t.absent + s.absent, leave: t.leave + s.leave,
    lop: t.lop + s.lop, late: t.late + s.late, otHours: t.otHours + s.otHours,
  }), { present: 0, absent: 0, leave: 0, lop: 0, late: 0, otHours: 0 }), [filtered]);

  const num = (n: number) => (n === 0 ? '—' : String(n));

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'working', label: 'Working', align: 'right' as const },
      { key: 'present', label: 'Present', align: 'right' as const },
      { key: 'absent', label: 'Absent', align: 'right' as const },
      { key: 'leave', label: 'Leave', align: 'right' as const },
      { key: 'lop', label: 'LOP', align: 'right' as const },
      { key: 'halfDay', label: 'Half', align: 'right' as const },
      { key: 'late', label: 'Late', align: 'right' as const },
      { key: 'ot', label: 'OT Hrs', align: 'right' as const },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    const subtotal = (items: Summary[]) => items.reduce((t, s) => ({
      working: t.working + s.working, present: t.present + s.present, absent: t.absent + s.absent,
      leave: t.leave + s.leave, lop: t.lop + s.lop, halfDay: t.halfDay + s.halfDay, late: t.late + s.late, ot: t.ot + s.otHours,
    }), { working: 0, present: 0, absent: 0, leave: 0, lop: 0, halfDay: 0, late: 0, ot: 0 });
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const st = subtotal(g.items);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', working: st.working, present: st.present, absent: st.absent, leave: st.leave, lop: st.lop, halfDay: st.halfDay, late: st.late, ot: st.ot });
      }
      g.items.forEach(s => rowsOut.push({
        employee: s.emp.name, code: s.emp.employeeCode, working: s.working, present: s.present, absent: s.absent,
        leave: s.leave, lop: s.lop, halfDay: s.halfDay, late: s.late, ot: s.otHours,
      }));
    });
    return {
      title: 'Attendance Statement',
      establishment: est.name,
      subtitle: `${period.name}${period.fromDate ? ` · ${formatDate(period.fromDate)} – ${formatDate(period.toDate)}` : ''}${groupBy !== 'none' ? ` · ${GROUP_OPTIONS.find(o => o.value === groupBy)?.label}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', present: grand.present, absent: grand.absent, leave: grand.leave, lop: grand.lop, late: grand.late, ot: grand.otHours },
      note: 'Computer-generated attendance statement.',
    };
  }, [groups, groupBy, est.name, period, grand]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/attendance')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-cyan-100 rounded-lg"><ClipboardList size={22} className="text-cyan-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Attendance Statement</h1>
                <p className="text-xs text-muted-foreground">Per-employee attendance summary for a pay period, grouped by any org dimension.</p>
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
                    <th className="px-3 py-2.5 text-right">Present</th>
                    <th className="px-3 py-2.5 text-right">Absent</th>
                    <th className="px-3 py-2.5 text-right">Leave</th>
                    <th className="px-3 py-2.5 text-right">LOP</th>
                    <th className="px-3 py-2.5 text-right">Half</th>
                    <th className="px-3 py-2.5 text-right">Late</th>
                    <th className="px-3 py-2.5 text-right">OT Hrs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">No attendance for this period.</td></tr>
                  ) : groups.map(g => (
                    <Fragment key={g.label}>
                      {groupBy !== 'none' && (
                        <tr className="bg-accent/40">
                          <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide" colSpan={9}>{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length} employee{g.items.length !== 1 ? 's' : ''}</span></td>
                        </tr>
                      )}
                      {g.items.map(s => (
                        <tr key={s.emp.id} className="hover:bg-accent/20">
                          <td className="px-3 py-2.5"><div className="font-semibold">{s.emp.name}</div><div className="text-[10px] font-mono text-muted-foreground">{s.emp.employeeCode}</div></td>
                          <td className="px-3 py-2.5 text-right">{s.working}</td>
                          <td className="px-3 py-2.5 text-right text-green-700 font-medium">{num(s.present)}</td>
                          <td className="px-3 py-2.5 text-right text-red-600">{num(s.absent)}</td>
                          <td className="px-3 py-2.5 text-right text-blue-600">{num(s.leave)}</td>
                          <td className="px-3 py-2.5 text-right text-rose-600">{num(s.lop)}</td>
                          <td className="px-3 py-2.5 text-right text-orange-600">{num(s.halfDay)}</td>
                          <td className="px-3 py-2.5 text-right text-amber-600">{num(s.late)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700 font-medium">{s.otHours ? `${s.otHours}` : '—'}</td>
                        </tr>
                      ))}
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
