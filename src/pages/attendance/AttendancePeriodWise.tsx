import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarRange, Search, CheckCircle2, XCircle, AlertCircle,
  Calendar, Download, TrendingUp, Users, Timer,
  X, Save, Pencil, Lock, Unlock, Sparkles, RefreshCw,
  Eye, MapPin, Sunset, CalendarCheck,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import { usePayrollPeriods, isPeriodLocked, type AttPeriod } from '../../lib/attendancePeriods';
import {
  loadPeriodSummaries, previewPeriodAttendance, generatePeriodAttendance,
  setPeriodApproval, saveEmployeeSummary, loadPeriodHolidays,
  type PeriodAttRow, type GenerateConfig, type PeriodHoliday,
} from '../../lib/periodAttendance';

const EMPTY_PERIOD: AttPeriod = { id: '', name: '—', code: '', fromDate: '', toDate: '', status: 'Open' };

const RECORD_STATUS_STYLES = {
  Draft: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  Submitted: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Approved: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

const inputCls = 'w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all';

export default function AttendancePeriodWise() {
  const { periods } = usePayrollPeriods();
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [records, setRecords] = useState<PeriodAttRow[]>([]);
  const [holidays, setHolidays] = useState<PeriodHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  const [editModal, setEditModal] = useState<PeriodAttRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<PeriodAttRow>>({});

  const [generateModal, setGenerateModal] = useState(false);
  const [generateConfig, setGenerateConfig] = useState<GenerateConfig>({ overwriteExisting: true });
  const [generateStep, setGenerateStep] = useState<'config' | 'preview' | 'done'>('config');
  const [previewRows, setPreviewRows] = useState<PeriodAttRow[]>([]);
  const [generating, setGenerating] = useState(false);

  // Default to the period containing today (matches the Pre-Payroll page) so attendance
  // is generated against the current period rather than the newest one in the list.
  useEffect(() => {
    if (!selectedPeriodId && periods.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const current = periods.find(p => p.fromDate <= today && today <= p.toDate);
      setSelectedPeriodId((current ?? periods[0]).id);
    }
  }, [periods, selectedPeriodId]);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) ?? periods[0] ?? EMPTY_PERIOD;
  const isLocked = isPeriodLocked(selectedPeriod);

  const reload = useCallback(async () => {
    if (!selectedPeriod.fromDate) { setRecords([]); return; }
    setLoading(true);
    const [rows, hols] = await Promise.all([
      loadPeriodSummaries(selectedPeriod.fromDate, selectedPeriod.toDate),
      loadPeriodHolidays(selectedPeriod.fromDate, selectedPeriod.toDate),
    ]);
    setRecords(rows);
    setHolidays(hols);
    setLoading(false);
  }, [selectedPeriod.fromDate, selectedPeriod.toDate]);

  useEffect(() => { void reload(); }, [reload]);

  const filtered = useMemo(() =>
    records
      .filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.department.toLowerCase().includes(search.toLowerCase()))
      .filter(r => deptFilter === 'All' || r.department === deptFilter),
    [records, search, deptFilter]);

  const departments = [...new Set(records.map(r => r.department))];
  const totalPresent = records.reduce((s, r) => s + r.presentDays, 0);
  const totalAbsent = records.reduce((s, r) => s + r.absentDays + r.lopDays, 0);
  const totalOT = records.reduce((s, r) => s + r.overtimeHours, 0);
  const totalHalfDays = records.reduce((s, r) => s + r.halfDays, 0);
  const avgAttendance = records.length > 0
    ? Math.round(records.reduce((s, r) => s + (r.presentDays / Math.max(r.workingDays, 1)) * 100, 0) / records.length)
    : 0;

  const draftCount = records.filter(r => r.approval === 'Draft').length;
  const submittedCount = records.filter(r => r.approval === 'Submitted').length;
  const approvedCount = records.filter(r => r.approval === 'Approved').length;

  const fullHolidays = holidays.filter(h => !h.isHalfDay && !/weekend|weekly|week.?off/i.test(h.type));
  const weeklyOffs = holidays.filter(h => !h.isHalfDay && /weekend|weekly|week.?off/i.test(h.type));
  const halfDayHolidays = holidays.filter(h => h.isHalfDay);

  // ── Actions (all persist to attendance_records) ──
  const openEdit = (rec: PeriodAttRow) => { setEditForm({ ...rec }); setEditModal(rec); };

  const saveEdit = async () => {
    if (!editModal) return;
    setBusy(true);
    const { error } = await saveEmployeeSummary(editModal.employeeId, selectedPeriod.fromDate, selectedPeriod.toDate, {
      presentDays: Number(editForm.presentDays) || 0,
      absentDays: Number(editForm.absentDays) || 0,
      lateDays: Number(editForm.lateDays) || 0,
      halfDays: Number(editForm.halfDays) || 0,
      leaveDays: Number(editForm.leaveDays) || 0,
      lopDays: Number(editForm.lopDays) || 0,
      overtimeHours: Number(editForm.overtimeHours) || 0,
    });
    setBusy(false);
    if (error) { toast.error(`Could not save: ${error}`); return; }
    toast.success('Attendance record updated.');
    setEditModal(null);
    await reload();
  };

  const handleSubmitAll = async () => {
    setBusy(true);
    const { error } = await setPeriodApproval(selectedPeriod.fromDate, selectedPeriod.toDate, 'Draft', 'Submitted');
    setBusy(false);
    if (error) { toast.error(`Submit failed: ${error}`); return; }
    toast.success('All draft records submitted for approval.');
    await reload();
  };

  const handleApproveAll = async () => {
    setBusy(true);
    const { error } = await setPeriodApproval(selectedPeriod.fromDate, selectedPeriod.toDate, 'Submitted', 'Approved');
    setBusy(false);
    if (error) { toast.error(`Approve failed: ${error}`); return; }
    toast.success('All submitted records approved.');
    await reload();
  };

  const openGenerateModal = () => { setGenerateStep('config'); setPreviewRows([]); setGenerateModal(true); };

  const handlePreviewGenerate = async () => {
    setGenerating(true);
    const rows = await previewPeriodAttendance(selectedPeriod.fromDate, selectedPeriod.toDate, generateConfig);
    setPreviewRows(rows);
    setGenerating(false);
    setGenerateStep('preview');
  };

  const handleConfirmGenerate = async () => {
    setGenerating(true);
    const { error, count, employees } = await generatePeriodAttendance(selectedPeriod.fromDate, selectedPeriod.toDate, generateConfig);
    setGenerating(false);
    if (error) { toast.error(`Generation failed: ${error}`); return; }
    setGenerateStep('done');
    toast.success(`Saved ${count} attendance records for ${employees} employees.`);
    await reload();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg"><CalendarRange size={22} className="text-indigo-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Payroll Period Wise Attendance</h1>
                <p className="text-xs text-muted-foreground">Generate, submit and approve attendance — saved per day to the database.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isLocked && (
                <button onClick={openGenerateModal} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60">
                  <Sparkles size={15} /> Generate Attendance
                </button>
              )}
              {!isLocked && draftCount > 0 && (
                <button onClick={handleSubmitAll} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium disabled:opacity-60">
                  <Save size={15} /> Submit All ({draftCount})
                </button>
              )}
              {!isLocked && submittedCount > 0 && (
                <button onClick={handleApproveAll} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60">
                  <CheckCircle2 size={15} /> Approve All ({submittedCount})
                </button>
              )}
              <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                <Download size={15} /> Export
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Period Selector */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <CalendarRange size={16} className="text-primary" />
              <h2 className="font-bold text-sm">Select Payroll Period</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {periods.length === 0 && (
                <p className="text-sm text-muted-foreground">No payroll periods defined. Create them in Payroll Setup → Payroll Period.</p>
              )}
              {periods.map(period => {
                const locked = isPeriodLocked(period);
                const closed = period.status.toLowerCase() === 'closed';
                return (
                  <button key={period.id} onClick={() => setSelectedPeriodId(period.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      selectedPeriodId === period.id ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
                    {locked ? <Lock size={13} /> : closed ? <CheckCircle2 size={13} /> : <Unlock size={13} />}
                    {period.name}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      selectedPeriodId === period.id ? 'bg-white/20 text-white' : locked ? 'bg-red-100 text-red-700' : closed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                      {period.status}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedPeriod.fromDate && (
              <div className="mt-4 flex items-center gap-4 px-4 py-3 bg-accent/30 rounded-xl border border-border text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(selectedPeriod.fromDate)} → {formatDate(selectedPeriod.toDate)}</span>
                <span className="flex items-center gap-1.5"><Users size={12} /> {records.length} employees with records</span>
                <span className="flex items-center gap-1.5"><CalendarCheck size={12} /> {fullHolidays.length} holidays · {weeklyOffs.length} weekly-offs{halfDayHolidays.length ? ` · ${halfDayHolidays.length} half-day` : ''}</span>
                {isLocked && <span className="flex items-center gap-1.5 text-red-600 font-semibold"><Lock size={12} /> Period is locked — read only</span>}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Avg Attendance', value: `${avgAttendance}%`, sub: 'This period', color: 'bg-green-100', iconColor: 'text-green-600', icon: TrendingUp },
              { label: 'Total Present Days', value: totalPresent, sub: 'Across all employees', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: CheckCircle2 },
              { label: 'Absent / LOP Days', value: totalAbsent, sub: 'Across all employees', color: 'bg-red-100', iconColor: 'text-red-600', icon: XCircle },
              { label: 'Half Days', value: totalHalfDays, sub: 'Across all employees', color: 'bg-teal-100', iconColor: 'text-teal-600', icon: Sunset },
              { label: 'Total Overtime', value: `${totalOT.toFixed(1)}h`, sub: 'Across all employees', color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Timer },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={20} className={card.iconColor} /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-lg mt-0.5">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Status Summary */}
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: 'Draft', count: draftCount, style: RECORD_STATUS_STYLES.Draft },
              { label: 'Submitted', count: submittedCount, style: RECORD_STATUS_STYLES.Submitted },
              { label: 'Approved', count: approvedCount, style: RECORD_STATUS_STYLES.Approved },
            ].map(item => (
              <div key={item.label} className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${item.style.bg} ${item.style.border}`}>
                <span className={`text-sm font-bold ${item.style.text}`}>{item.count}</span>
                <span className={`text-xs font-medium ${item.style.text}`}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search employees..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} employees</div>
          </div>

          {/* Attendance Table */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Work Location</th>
                    <th className="px-4 py-3 font-semibold text-center">Present</th>
                    <th className="px-4 py-3 font-semibold text-center">Absent</th>
                    <th className="px-4 py-3 font-semibold text-center">LOP</th>
                    <th className="px-4 py-3 font-semibold text-center">Half</th>
                    <th className="px-4 py-3 font-semibold text-center">Leave</th>
                    <th className="px-4 py-3 font-semibold text-center text-violet-700">Holiday</th>
                    <th className="px-4 py-3 font-semibold text-center text-gray-500">Week-off</th>
                    <th className="px-4 py-3 font-semibold text-center">OT</th>
                    <th className="px-4 py-3 font-semibold text-center">Att %</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    {!isLocked && <th className="px-4 py-3 font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-muted-foreground"><RefreshCw size={16} className="inline animate-spin mr-2" /> Loading…</td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={13} className="px-4 py-12 text-center">
                      <p className="text-sm font-medium text-muted-foreground">No attendance records for this period yet.</p>
                      {!isLocked && <p className="text-xs text-muted-foreground mt-1">Click <strong>Generate Attendance</strong> to create them from the holiday calendar and approved leaves.</p>}
                    </td></tr>
                  )}
                  {!loading && filtered.map((rec, i) => {
                    const attPct = Math.round((rec.presentDays / Math.max(rec.workingDays, 1)) * 100);
                    const recStyle = RECORD_STATUS_STYLES[rec.approval];
                    return (
                      <motion.tr key={rec.employeeId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{rec.avatar}</div>
                            <div>
                              <p className="text-sm font-medium">{rec.name}</p>
                              <p className="text-[10px] text-muted-foreground">{rec.code} · {rec.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-muted-foreground shrink-0" />
                            <p className="text-xs font-medium truncate max-w-[140px]">{rec.workLocationName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-green-600">{rec.presentDays}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">{rec.absentDays}</td>
                        <td className="px-4 py-3 text-center font-bold text-rose-600">{rec.lopDays}</td>
                        <td className="px-4 py-3 text-center font-bold text-orange-600">{rec.halfDays}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{rec.leaveDays}</td>
                        <td className="px-4 py-3 text-center font-bold text-violet-600">{rec.holidayDays}</td>
                        <td className="px-4 py-3 text-center font-medium text-gray-500">{rec.weekendDays}</td>
                        <td className="px-4 py-3 text-center font-bold text-violet-600">{rec.overtimeHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-1.5 bg-accent rounded-full">
                              <div className={`h-full rounded-full ${attPct >= 90 ? 'bg-green-500' : attPct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${attPct}%` }} />
                            </div>
                            <span className="text-xs font-bold">{attPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${recStyle.bg} ${recStyle.text} ${recStyle.border}`}>{rec.approval}</span>
                        </td>
                        {!isLocked && (
                          <td className="px-4 py-3">
                            <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                              <Pencil size={14} />
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">Edit Attendance — {editModal.name}</h2>
                <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  Saving redistributes statuses across this employee's {editModal.workingDays} working days (holidays & week-offs are preserved) and resets approval to Draft on changed days.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'presentDays', label: 'Present Days' },
                    { key: 'absentDays', label: 'Absent Days' },
                    { key: 'lateDays', label: 'Late Days' },
                    { key: 'halfDays', label: 'Half Days' },
                    { key: 'leaveDays', label: 'Leave Days' },
                    { key: 'lopDays', label: 'LOP Days' },
                    { key: 'overtimeHours', label: 'Overtime Hours' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">{field.label}</label>
                      <input type="number" className={inputCls} min={0} step={field.key === 'overtimeHours' ? 0.5 : 1}
                        value={(editForm as any)[field.key] ?? 0}
                        onChange={e => setEditForm(f => ({ ...f, [field.key]: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setEditModal(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={saveEdit} disabled={busy} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md disabled:opacity-60">
                  {busy ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />} Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generate Attendance Modal */}
      <AnimatePresence>
        {generateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }} className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-xl"><Sparkles size={20} className="text-indigo-600" /></div>
                  <div>
                    <h2 className="text-base font-bold text-indigo-900">Generate Attendance</h2>
                    <p className="text-xs text-indigo-600">Auto-generate &amp; save for {selectedPeriod.name}</p>
                  </div>
                </div>
                <button onClick={() => setGenerateModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center gap-0 px-6 pt-4 pb-0">
                {[{ key: 'config', label: 'Configure', num: 1 }, { key: 'preview', label: 'Preview', num: 2 }, { key: 'done', label: 'Done', num: 3 }].map((step, i) => {
                  const isActive = generateStep === step.key;
                  const isDone = (generateStep === 'preview' && step.key === 'config') || (generateStep === 'done' && step.key !== 'done');
                  return (
                    <React.Fragment key={step.key}>
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isActive ? 'bg-indigo-600 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-accent text-muted-foreground'}`}>
                          {isDone ? <CheckCircle2 size={14} /> : step.num}
                        </div>
                        <span className={`text-xs font-semibold ${isActive ? 'text-indigo-700' : isDone ? 'text-green-600' : 'text-muted-foreground'}`}>{step.label}</span>
                      </div>
                      {i < 2 && <div className="flex-1 h-0.5 bg-border mx-3" />}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
                {/* Step 1: Config */}
                {generateStep === 'config' && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-700">
                      <CalendarCheck size={16} className="text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">How attendance is generated</p>
                        <ul className="space-y-0.5 list-disc list-inside">
                          <li><strong>Weekly-offs</strong> and <strong>holidays</strong> come from the <strong>Holiday List Master</strong> (Weekly Off → Week-off, half-day → Half&nbsp;Day, others → Holiday)</li>
                          <li>Approved <strong>leave requests</strong> become <strong>On Leave</strong></li>
                          <li>Every other day defaults to <strong>Present</strong></li>
                          <li>All generated rows start in <strong>Draft</strong> for review &amp; approval</li>
                        </ul>
                      </div>
                    </div>

                    {/* Real holidays in this period */}
                    <div>
                      <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Holidays in {selectedPeriod.name}</label>
                      {holidays.length === 0 ? (
                        <p className="text-xs text-amber-600 flex items-center gap-1.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl"><AlertCircle size={13} /> No holidays configured for this period in the Holiday List Master.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 rounded-xl border bg-violet-50 border-violet-200 text-center"><p className="text-lg font-bold text-violet-700">{fullHolidays.length}</p><p className="text-[10px] text-violet-600">Full Holidays</p></div>
                          <div className="p-3 rounded-xl border bg-gray-50 border-gray-200 text-center"><p className="text-lg font-bold text-gray-600">{weeklyOffs.length}</p><p className="text-[10px] text-gray-500">Weekly Offs</p></div>
                          <div className="p-3 rounded-xl border bg-teal-50 border-teal-200 text-center"><p className="text-lg font-bold text-teal-700">{halfDayHolidays.length}</p><p className="text-[10px] text-teal-600">Half-Day</p></div>
                        </div>
                      )}
                    </div>

                    {/* Options */}
                    <div className="space-y-3 p-4 bg-accent/30 rounded-xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Options</p>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div onClick={() => setGenerateConfig(prev => ({ ...prev, overwriteExisting: !prev.overwriteExisting }))}
                          className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${generateConfig.overwriteExisting ? 'bg-primary' : 'bg-border'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${generateConfig.overwriteExisting ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <div>
                          <span className="text-sm font-medium">Overwrite existing records</span>
                          <p className="text-[10px] text-muted-foreground">Replace any previously saved attendance for this period (resets approval to Draft)</p>
                        </div>
                      </label>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Preview */}
                {generateStep === 'preview' && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                      <Eye size={16} className="text-blue-600 shrink-0 mt-0.5" />
                      <p>Preview of what will be saved for <strong>{previewRows.length}</strong> employees. Confirm to write these rows to the database.</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                      <div className="overflow-x-auto max-h-[40vh]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider sticky top-0">
                            <tr>
                              <th className="px-3 py-2.5 font-semibold">Employee</th>
                              <th className="px-3 py-2.5 font-semibold text-center text-green-700">Present</th>
                              <th className="px-3 py-2.5 font-semibold text-center text-blue-700">Leave</th>
                              <th className="px-3 py-2.5 font-semibold text-center text-violet-700">Holiday</th>
                              <th className="px-3 py-2.5 font-semibold text-center text-teal-700">Half</th>
                              <th className="px-3 py-2.5 font-semibold text-center text-gray-500">Week-off</th>
                              <th className="px-3 py-2.5 font-semibold text-center">Working</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {previewRows.map(item => (
                              <tr key={item.employeeId} className="hover:bg-accent/20 transition-colors">
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px] shrink-0">{item.avatar}</div>
                                    <div><p className="font-semibold">{item.name}</p><p className="text-[10px] text-muted-foreground">{item.department}</p></div>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-green-600">{item.presentDays}</td>
                                <td className="px-3 py-2.5 text-center font-bold text-blue-600">{item.leaveDays}</td>
                                <td className="px-3 py-2.5 text-center font-bold text-violet-600">{item.holidayDays}</td>
                                <td className="px-3 py-2.5 text-center font-bold text-teal-600">{item.halfDays || '—'}</td>
                                <td className="px-3 py-2.5 text-center text-gray-500 font-medium">{item.weekendDays}</td>
                                <td className="px-3 py-2.5 text-center font-medium">{item.workingDays}</td>
                              </tr>
                            ))}
                            {previewRows.length === 0 && (
                              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No employees found to generate for.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Done */}
                {generateStep === 'done' && (
                  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto"><CheckCircle2 size={32} className="text-green-600" /></div>
                    <div>
                      <h3 className="text-lg font-bold text-green-800">Attendance Saved!</h3>
                      <p className="text-sm text-muted-foreground mt-1">Per-day attendance has been saved to the database for <strong>{previewRows.length} employees</strong> for <strong>{selectedPeriod.name}</strong>.</p>
                    </div>
                    <p className="text-xs text-muted-foreground">All records are in <strong>Draft</strong> status. Review, then Submit and Approve when ready.</p>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
                <button onClick={() => { if (generateStep === 'preview') setGenerateStep('config'); else setGenerateModal(false); }}
                  className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {generateStep === 'preview' ? '← Back' : 'Cancel'}
                </button>
                <div className="flex items-center gap-3">
                  {generateStep === 'config' && (
                    <button onClick={handlePreviewGenerate} disabled={generating}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-60">
                      {generating ? <><RefreshCw size={15} className="animate-spin" /> Computing…</> : <><Eye size={15} /> Preview Results</>}
                    </button>
                  )}
                  {generateStep === 'preview' && (
                    <button onClick={handleConfirmGenerate} disabled={generating}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-md disabled:opacity-60">
                      {generating ? <><RefreshCw size={15} className="animate-spin" /> Saving…</> : <><Sparkles size={15} /> Confirm &amp; Save</>}
                    </button>
                  )}
                  {generateStep === 'done' && (
                    <button onClick={() => setGenerateModal(false)} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                      <CheckCircle2 size={15} /> Done
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
