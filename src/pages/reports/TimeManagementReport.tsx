import { formatDate } from '../../utils/date';
import { useEffect, useMemo, useState, Fragment } from 'react';
import type { ComponentType } from 'react';
import {
  ChevronLeft, Eye, LogIn, LogOut, Timer, Search,
} from 'lucide-react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import {
  useTimeManagement, usePayrollPeriodOptions, useEstablishment, EMPTY_PERIOD_OPTION,
  type TimeMgmtRow,
} from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

type Metric = 'late' | 'early' | 'overtime';
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

interface MetricCfg {
  title: string;
  blurb: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  accent: string;            // tailwind text colour
  chipBg: string;            // tailwind bg for icon chip
  valueLabel: string;
  filter: (r: TimeMgmtRow) => boolean;
  value: (r: TimeMgmtRow) => number;   // the numeric measure (minutes or hours)
  isHours?: boolean;
}

const METRICS: Record<Metric, MetricCfg> = {
  late: {
    title: 'Late Entry Report', blurb: 'Employees who checked in after their shift start (beyond grace).',
    icon: LogIn, accent: 'text-amber-600', chipBg: 'bg-amber-100',
    valueLabel: 'Late By', filter: r => r.lateMinutes > 0, value: r => r.lateMinutes,
  },
  early: {
    title: 'Early Out Report', blurb: 'Employees who checked out before their shift end (beyond grace).',
    icon: LogOut, accent: 'text-orange-600', chipBg: 'bg-orange-100',
    valueLabel: 'Early By', filter: r => r.earlyMinutes > 0, value: r => r.earlyMinutes,
  },
  overtime: {
    title: 'Overtime Report', blurb: 'Employees with overtime hours logged against their attendance.',
    icon: Timer, accent: 'text-emerald-600', chipBg: 'bg-emerald-100',
    valueLabel: 'OT Hours', filter: r => r.overtimeHours > 0, value: r => r.overtimeHours, isHours: true,
  },
};

const fmtMins = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}h ${n % 60}m` : `${n}m`);
const fmtHours = (n: number) => `${Number(n).toFixed(n % 1 ? 1 : 0)} h`;
const fmtTime = (t: string) => (t ? t.slice(0, 5) : '—');
const fmtDate = (s: string) => formatDate(s);

export default function TimeManagementReport() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { metric = '' } = useParams();
  const cfg = METRICS[metric as Metric];

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

  const { rows, loading } = useTimeManagement(period.fromDate, period.toDate);

  const fmtValue = (n: number) => (cfg?.isHours ? fmtHours(n) : fmtMins(n));

  // Occurrences for this metric, with search applied.
  const filtered = useMemo(() => {
    if (!cfg) return [];
    const q = search.trim().toLowerCase();
    return rows.filter(cfg.filter).filter(r =>
      !q || r.name.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q));
  }, [rows, cfg, search]);

  // Group occurrences by the selected dimension.
  const groups = useMemo(() => {
    const keyOf = (r: TimeMgmtRow) => (groupBy === 'none' ? 'All Records' : (r[groupBy] || '—'));
    const m = new Map<string, TimeMgmtRow[]>();
    filtered.forEach(r => { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()]
      .map(([label, items]) => ({ label, items, total: items.reduce((s, r) => s + cfg.value(r), 0) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy, cfg]);

  const summary = useMemo(() => ({
    occurrences: filtered.length,
    employees: new Set(filtered.map(r => r.empId)).size,
    total: filtered.reduce((s, r) => s + cfg!.value(r), 0),
  }), [filtered, cfg]);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'dept', label: 'Department', text: true },
      { key: 'date', label: 'Date', text: true },
      { key: 'shift', label: 'Shift', text: true },
      ...(metric === 'overtime'
        ? [{ key: 'worked', label: 'Hours Worked', align: 'right' as const }]
        : [
            { key: 'shiftTime', label: metric === 'late' ? 'Shift In' : 'Shift Out', align: 'center' as const },
            { key: 'actual', label: metric === 'late' ? 'Actual In' : 'Actual Out', align: 'center' as const },
          ]),
      { key: 'value', label: cfg?.valueLabel ?? 'Value', align: 'right' as const },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    groups.forEach(g => {
      if (groupBy !== 'none') rowsOut.push({ employee: `— ${g.label} —`, code: '', dept: '', date: '', shift: '', shiftTime: '', actual: '', worked: '', value: fmtValue(g.total) });
      g.items.forEach(r => rowsOut.push({
        employee: r.name, code: r.employeeCode, dept: r.department, date: fmtDate(r.date), shift: r.shift,
        shiftTime: metric === 'late' ? fmtTime(r.shiftStart) : fmtTime(r.shiftEnd),
        actual: metric === 'late' ? fmtTime(r.checkIn) : fmtTime(r.checkOut),
        worked: metric === 'overtime' ? `${r.hoursWorked} h` : '',
        value: fmtValue(cfg!.value(r)),
      }));
    });
    return {
      title: cfg?.title ?? 'Time Management Report',
      establishment: est.name,
      subtitle: `${period.name}${period.fromDate ? ` · ${fmtDate(period.fromDate)} – ${fmtDate(period.toDate)}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'TOTAL', value: fmtValue(summary.total) },
      note: 'Computer-generated time-management report. Late/Early computed against shift timing and grace window.',
    };
  }, [groups, groupBy, cfg, est.name, period, metric, summary.total]);

  if (!cfg) return <Navigate to="/reports/g/time-management" replace />;
  const Icon = cfg.icon;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/time-management')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className={`p-2 ${cfg.chipBg} rounded-lg`}><Icon size={22} className={cfg.accent} /></div>
              <div>
                <h1 className="text-xl font-bold">{cfg.title}</h1>
                <p className="text-xs text-muted-foreground">{cfg.blurb}</p>
              </div>
            </div>
            <button onClick={() => setShowView(true)} disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50">
              <Eye size={15} /> View / Print
            </button>
          </div>
        </div>

        <div className="p-8 space-y-5">
          {/* Filters */}
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

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 max-w-2xl">
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <div className="text-2xl font-bold">{loading ? '…' : summary.occurrences}</div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Occurrences</div>
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <div className="text-2xl font-bold">{loading ? '…' : summary.employees}</div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Employees</div>
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <div className={`text-2xl font-bold ${cfg.accent}`}>{loading ? '…' : fmtValue(summary.total)}</div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Total {cfg.valueLabel}</div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-left">Department</th>
                    <th className="px-3 py-2.5 text-left">Date</th>
                    <th className="px-3 py-2.5 text-left">Shift</th>
                    {metric === 'overtime' ? (
                      <th className="px-3 py-2.5 text-right">Hours Worked</th>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 text-center">{metric === 'late' ? 'Shift In' : 'Shift Out'}</th>
                        <th className="px-3 py-2.5 text-center">{metric === 'late' ? 'Actual In' : 'Actual Out'}</th>
                      </>
                    )}
                    <th className="px-3 py-2.5 text-right">{cfg.valueLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={metric === 'overtime' ? 6 : 7} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={metric === 'overtime' ? 6 : 7} className="px-3 py-10 text-center text-muted-foreground">No records for this period.</td></tr>
                  ) : groups.map(g => (
                    <Fragment key={g.label}>
                      {groupBy !== 'none' && (
                        <tr className="bg-accent/40">
                          <td colSpan={metric === 'overtime' ? 5 : 6} className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide">{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length} record{g.items.length !== 1 ? 's' : ''}</span></td>
                          <td className={`px-3 py-2 text-right font-bold ${cfg.accent}`}>{fmtValue(g.total)}</td>
                        </tr>
                      )}
                      {g.items.map((r, i) => (
                        <tr key={`${r.empId}-${r.date}-${i}`} className="hover:bg-accent/20">
                          <td className="px-3 py-2.5"><div className="font-semibold">{r.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</div></td>
                          <td className="px-3 py-2.5">{r.department}</td>
                          <td className="px-3 py-2.5">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2.5">{r.shift}</td>
                          {metric === 'overtime' ? (
                            <td className="px-3 py-2.5 text-right">{r.hoursWorked} h</td>
                          ) : (
                            <>
                              <td className="px-3 py-2.5 text-center text-muted-foreground">{fmtTime(metric === 'late' ? r.shiftStart : r.shiftEnd)}</td>
                              <td className="px-3 py-2.5 text-center font-medium">{fmtTime(metric === 'late' ? r.checkIn : r.checkOut)}</td>
                            </>
                          )}
                          <td className={`px-3 py-2.5 text-right font-bold ${cfg.accent}`}>{fmtValue(cfg.value(r))}</td>
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
