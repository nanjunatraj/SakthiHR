import React, { useState, useMemo, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';

const addb = supabase as unknown as SupabaseClient;
// Live roster from the employees table; populated by the component on mount.
let ROSTER: { id: string; name: string; department: string; avatar: string; shift: string }[] = [];
async function loadDailyRoster() {
  const { data } = await addb.from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, department:departments(name), shift:shifts(name)')
    .order('first_name');
  ROSTER = ((data ?? []) as Record<string, any>[]).map(e => {
    const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ');
    return { id: e.employee_id || e.id, name, department: e.department?.name ?? '—', avatar: name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(), shift: e.shift?.name ?? 'General' };
  });
}
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogIn, Search, CheckCircle2, XCircle, AlertCircle,
  Calendar, Download, Clock, Timer, X, Save, Pencil,
  ChevronLeft, ChevronRight, BarChart2, Users, Plus, Sunset
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePayrollPeriods, isWithinPeriod } from '../../lib/attendancePeriods';
import { CalendarRange } from 'lucide-react';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Holiday' | 'Half-Day Holiday' | 'Weekend';

interface DailyRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  avatar: string;
  workLocationId: string;
  workLocationName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  status: AttendanceStatus;
  shift: string;
  overtime: number;
  remarks: string;
  holidayName?: string;
  halfDaySession?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

// ─── Holiday List Master — includes Half-Day Weekly Off ───────────────────────
const HOLIDAY_LISTS_MASTER: Record<string, {
  id: string; name: string;
  holidays: { date: string; name: string; type: string; isHalfDay?: boolean; halfDaySession?: string }[]
}> = {
  HL001: {
    id: 'HL001',
    name: `Holiday List ${CURRENT_YEAR}`,
    holidays: [
      { date: `${CURRENT_YEAR}-01-01`, name: "New Year's Day", type: 'National' },
      { date: `${CURRENT_YEAR}-01-26`, name: 'Republic Day', type: 'National' },
      { date: `${CURRENT_YEAR}-08-15`, name: 'Independence Day', type: 'National' },
      { date: `${CURRENT_YEAR}-10-02`, name: 'Gandhi Jayanti', type: 'National' },
      { date: `${CURRENT_YEAR}-12-25`, name: 'Christmas', type: 'National' },
      // Half-Day Weekly Off — 2nd and 4th Saturdays (afternoon off)
      { date: `${CURRENT_YEAR}-07-12`, name: 'Half-Day Saturday', type: 'Half-Day Weekly Off', isHalfDay: true, halfDaySession: 'afternoon' },
      { date: `${CURRENT_YEAR}-07-26`, name: 'Half-Day Saturday', type: 'Half-Day Weekly Off', isHalfDay: true, halfDaySession: 'afternoon' },
    ],
  },
  HL002: {
    id: 'HL002',
    name: `Holiday List ${CURRENT_YEAR} (India)`,
    holidays: [
      { date: `${CURRENT_YEAR}-01-01`, name: "New Year's Day", type: 'National' },
      { date: `${CURRENT_YEAR}-08-15`, name: 'Independence Day', type: 'National' },
      { date: `${CURRENT_YEAR}-12-25`, name: 'Christmas', type: 'National' },
      // Half-Day Weekly Off — Morning session
      { date: `${CURRENT_YEAR}-07-05`, name: 'Half-Day Saturday', type: 'Half-Day Weekly Off', isHalfDay: true, halfDaySession: 'morning' },
      { date: `${CURRENT_YEAR}-07-19`, name: 'Half-Day Saturday', type: 'Half-Day Weekly Off', isHalfDay: true, halfDaySession: 'morning' },
    ],
  },
};

const WORK_LOCATIONS_MASTER: Record<string, {
  id: string; name: string; holidayListId: string
}> = {
  LOC001: { id: 'LOC001', name: 'Head Office – Mumbai', holidayListId: 'HL001' },
  LOC002: { id: 'LOC002', name: 'Regional Office – Delhi', holidayListId: 'HL002' },
  LOC003: { id: 'LOC003', name: 'Branch Office – Bangalore', holidayListId: '' },
};

const EMPLOYEE_WORK_LOCATIONS: Record<string, string> = {
  EMP001: 'LOC001',
  EMP002: 'LOC001',
  EMP003: 'LOC002',
  EMP004: 'LOC001',
  EMP005: 'LOC002',
  EMP006: 'LOC003',
};

// ─── Helper: Get holiday info for a date and employee ─────────────────────────
function getHolidayForDate(employeeId: string, date: string): {
  isFullHoliday: boolean;
  isHalfDayHoliday: boolean;
  name: string;
  halfDaySession?: string;
} | null {
  const locationId = EMPLOYEE_WORK_LOCATIONS[employeeId];
  if (!locationId) return null;
  const location = WORK_LOCATIONS_MASTER[locationId];
  if (!location?.holidayListId) return null;
  const holidayList = HOLIDAY_LISTS_MASTER[location.holidayListId];
  if (!holidayList) return null;

  const holiday = holidayList.holidays.find(h => h.date === date);
  if (!holiday) return null;

  return {
    isFullHoliday: !holiday.isHalfDay,
    isHalfDayHoliday: !!holiday.isHalfDay,
    name: holiday.name,
    halfDaySession: holiday.halfDaySession,
  };
}

const STATUS_STYLES: Record<AttendanceStatus, { bg: string; text: string; border: string }> = {
  Present: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  Absent: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  Late: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  'Half Day': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  'On Leave': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Holiday: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  'Half-Day Holiday': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  Weekend: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
};

const STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Half-Day Holiday', 'Weekend'];

// ─── Build seed records with holiday detection ────────────────────────────────
function buildSeedRecords(date: string): DailyRecord[] {
  // Roster comes from the employees table (loaded by the component); no hardcoded staff.
  const employees: { id: string; name: string; department: string; avatar: string; shift: string }[] = ROSTER;

  const dayOfWeek = new Date(date + 'T00:00:00').getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return employees.map((emp, i) => {
    const locationId = EMPLOYEE_WORK_LOCATIONS[emp.id];
    const location = locationId ? WORK_LOCATIONS_MASTER[locationId] : null;
    const holidayInfo = getHolidayForDate(emp.id, date);

    let status: AttendanceStatus = 'Present';
    let checkIn = '09:00';
    let checkOut = '18:00';
    let hoursWorked = 9;
    let overtime = 0;
    let remarks = '';
    let holidayName: string | undefined;
    let halfDaySession: string | undefined;

    if (isWeekend) {
      status = 'Weekend';
      checkIn = '';
      checkOut = '';
      hoursWorked = 0;
    } else if (holidayInfo?.isFullHoliday) {
      // Full holiday — mark as Holiday (H)
      status = 'Holiday';
      checkIn = '';
      checkOut = '';
      hoursWorked = 0;
      holidayName = holidayInfo.name;
      remarks = `Holiday: ${holidayInfo.name}`;
    } else if (holidayInfo?.isHalfDayHoliday) {
      // Half-Day Weekly Off — mark as Half-Day Holiday (HD)
      status = 'Half-Day Holiday';
      halfDaySession = holidayInfo.halfDaySession;
      holidayName = holidayInfo.name;
      if (holidayInfo.halfDaySession === 'morning') {
        // Morning is holiday, work in afternoon
        checkIn = '13:00';
        checkOut = '18:00';
        hoursWorked = 5;
        remarks = `Half-Day Holiday (Morning off): ${holidayInfo.name}`;
      } else {
        // Afternoon is holiday, work in morning
        checkIn = '09:00';
        checkOut = '13:00';
        hoursWorked = 4;
        remarks = `Half-Day Holiday (Afternoon off): ${holidayInfo.name}`;
      }
    } else {
      // Normal working day — vary by employee for demo
      const patterns: Partial<DailyRecord>[] = [
        { status: 'Present', checkIn: '09:02', checkOut: '18:15', hoursWorked: 9.2, overtime: 0.2 },
        { status: 'Late', checkIn: '09:45', checkOut: '18:00', hoursWorked: 8.25, overtime: 0, remarks: 'Traffic delay' },
        { status: 'Present', checkIn: '09:00', checkOut: '18:00', hoursWorked: 9, overtime: 0 },
        { status: 'Absent', checkIn: '', checkOut: '', hoursWorked: 0, overtime: 0, remarks: 'No information' },
        { status: 'Half Day', checkIn: '09:05', checkOut: '13:00', hoursWorked: 4, overtime: 0, remarks: 'Medical appointment' },
        { status: 'Present', checkIn: '09:00', checkOut: '18:30', hoursWorked: 9.5, overtime: 0.5 },
      ];
      const pattern = patterns[i % patterns.length];
      status = pattern.status as AttendanceStatus;
      checkIn = pattern.checkIn ?? '';
      checkOut = pattern.checkOut ?? '';
      hoursWorked = pattern.hoursWorked ?? 0;
      overtime = pattern.overtime ?? 0;
      remarks = pattern.remarks ?? '';
    }

    return {
      id: `ATT-${emp.id}-${date}`,
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      avatar: emp.avatar,
      workLocationId: locationId ?? '',
      workLocationName: location?.name ?? 'Unknown',
      date,
      checkIn,
      checkOut,
      hoursWorked,
      status,
      shift: emp.shift,
      overtime,
      remarks,
      holidayName,
      halfDaySession,
    };
  });
}

const CHART_DATA = [
  { day: 'Mon', present: 142, absent: 8, late: 4 },
  { day: 'Tue', present: 138, absent: 12, late: 4 },
  { day: 'Wed', present: 145, absent: 5, late: 4 },
  { day: 'Thu', present: 140, absent: 10, late: 4 },
  { day: 'Fri', present: 135, absent: 15, late: 4 },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function formatTime(t: string) { return t || '—'; }

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";

export default function AttendanceDaily() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const { periods } = usePayrollPeriods();
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const selectedPeriod = useMemo(() => periods.find(p => p.id === selectedPeriodId) ?? null, [periods, selectedPeriodId]);
  // Default to the period covering the selected date (else the most recent) once periods load.
  useEffect(() => {
    if (selectedPeriodId || periods.length === 0) return;
    const match = periods.find(p => isWithinPeriod(selectedDate, p)) ?? periods[0];
    setSelectedPeriodId(match.id);
  }, [periods, selectedPeriodId, selectedDate]);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  // Load the roster once, then (re)build the day's records from real employees.
  useEffect(() => {
    let active = true;
    void loadDailyRoster().then(() => { if (active) setRecords(buildSeedRecords(selectedDate)); });
    return () => { active = false; };
  }, [selectedDate]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'All'>('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [editModal, setEditModal] = useState<DailyRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<DailyRecord>>({});

  // Rebuild records when date changes — auto-detect holidays
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setRecords(buildSeedRecords(newDate));
  };

  // Switching payroll period snaps the working date into that period's range.
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const period = periods.find(p => p.id === periodId);
    if (period && !isWithinPeriod(selectedDate, period)) {
      handleDateChange(period.fromDate);
    }
  };

  const todayRecords = records.filter(r => r.date === selectedDate);

  const filtered = useMemo(() =>
    todayRecords
      .filter(r => r.employeeName.toLowerCase().includes(search.toLowerCase()) || r.department.toLowerCase().includes(search.toLowerCase()))
      .filter(r => statusFilter === 'All' || r.status === statusFilter)
      .filter(r => deptFilter === 'All' || r.department === deptFilter),
    [todayRecords, search, statusFilter, deptFilter]
  );

  const presentCount = todayRecords.filter(r => r.status === 'Present').length;
  const absentCount = todayRecords.filter(r => r.status === 'Absent').length;
  const lateCount = todayRecords.filter(r => r.status === 'Late').length;
  const leaveCount = todayRecords.filter(r => r.status === 'On Leave').length;
  const halfDayHolidayCount = todayRecords.filter(r => r.status === 'Half-Day Holiday').length;
  const fullHolidayCount = todayRecords.filter(r => r.status === 'Holiday').length;
  const avgHours = todayRecords.filter(r => r.hoursWorked > 0).reduce((s, r) => s + r.hoursWorked, 0) / Math.max(1, todayRecords.filter(r => r.hoursWorked > 0).length);

  const departments = [...new Set(records.map(r => r.department))];

  const openEdit = (rec: DailyRecord) => {
    setEditForm({ ...rec });
    setEditModal(rec);
  };

  const saveEdit = () => {
    if (!editModal) return;
    setRecords(prev => prev.map(r => r.id === editModal.id ? { ...r, ...editForm } : r));
    toast.success('Attendance record updated.');
    setEditModal(null);
  };

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + dir);
    const newDate = d.toISOString().split('T')[0];
    handleDateChange(newDate);
  };

  // Check if selected date has any half-day holidays
  const dateHalfDayHolidays = todayRecords.filter(r => r.status === 'Half-Day Holiday');

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><LogIn size={22} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Daily Check-in / Check-out</h1>
                <p className="text-xs text-muted-foreground">Half-Day Weekly Off holidays auto-detected from each employee's Work Location holiday list.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Payroll Period selector */}
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                <CalendarRange size={14} className="text-muted-foreground shrink-0" />
                <select
                  className="bg-transparent outline-none text-sm font-medium max-w-[170px]"
                  value={selectedPeriodId}
                  onChange={e => handlePeriodChange(e.target.value)}
                >
                  {periods.length === 0 && <option value="">No payroll periods</option>}
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.status ? ` · ${p.status}` : ''}</option>
                  ))}
                </select>
              </div>
              {/* Date Navigator */}
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                <button onClick={() => navigateDate(-1)} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"><ChevronLeft size={16} /></button>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium">{formatDate(selectedDate)}</span>
                </div>
                <button onClick={() => navigateDate(1)} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"><ChevronRight size={16} /></button>
              </div>
              <input
                type="date"
                className="px-3 py-2 border border-border rounded-lg bg-card outline-none text-sm"
                value={selectedDate}
                min={selectedPeriod?.fromDate || undefined}
                max={selectedPeriod?.toDate || undefined}
                onChange={e => handleDateChange(e.target.value)}
              />
              <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                <Download size={15} /> Export
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Half-Day Holiday Alert for selected date */}
          {dateHalfDayHolidays.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
              <Sunset size={17} className="text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-teal-800">Half-Day Weekly Off Holiday Detected — {formatDate(selectedDate)}</p>
                <p className="text-xs text-teal-700 mt-0.5">
                  <strong>{dateHalfDayHolidays.length}</strong> employee{dateHalfDayHolidays.length !== 1 ? 's' : ''} have a Half-Day Weekly Off holiday today based on their Work Location's holiday list.
                  These are marked as <strong>HD (Half-Day Holiday)</strong> — employees work half the day.
                  {dateHalfDayHolidays[0]?.halfDaySession === 'morning'
                    ? ' Morning is off, employees work in the afternoon.'
                    : ' Afternoon is off, employees work in the morning.'}
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: 'Present', value: presentCount, color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Absent', value: absentCount, color: 'bg-red-100', iconColor: 'text-red-600', icon: XCircle },
              { label: 'Late', value: lateCount, color: 'bg-amber-100', iconColor: 'text-amber-600', icon: AlertCircle },
              { label: 'On Leave', value: leaveCount, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Calendar },
              { label: 'Half-Day Holiday (HD)', value: halfDayHolidayCount, color: 'bg-teal-100', iconColor: 'text-teal-600', icon: Sunset },
              { label: 'Avg Hours', value: `${avgHours.toFixed(1)}h`, color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Timer },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-3">
                <div className={`p-2.5 ${card.color} rounded-xl shrink-0`}><card.icon size={18} className={card.iconColor} /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-lg mt-0.5">{card.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2"><BarChart2 size={18} className="text-primary" /> Weekly Attendance Overview</h2>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Present</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Absent</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Late</span>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CHART_DATA} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="present" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="#f87171" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search employees..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="All">All Status</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} records</div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setStatusFilter('All')} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${statusFilter === 'All' ? 'bg-primary text-primary-foreground border-primary' : 'bg-accent text-muted-foreground border-border hover:border-primary/40'}`}>
              All ({todayRecords.length})
            </button>
            {STATUSES.map(s => {
              const count = todayRecords.filter(r => r.status === s).length;
              if (count === 0) return null;
              const style = STATUS_STYLES[s];
              return (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${statusFilter === s ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-current` : `${style.bg} ${style.text} ${style.border} hover:opacity-80`}`}>
                  {s === 'Half-Day Holiday' && <Sunset size={11} />}
                  {s} ({count})
                </button>
              );
            })}
          </div>

          {/* Attendance Table */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Work Location</th>
                    <th className="px-4 py-3 font-semibold">Shift</th>
                    <th className="px-4 py-3 font-semibold">Check In</th>
                    <th className="px-4 py-3 font-semibold">Check Out</th>
                    <th className="px-4 py-3 font-semibold">Hours</th>
                    <th className="px-4 py-3 font-semibold">Overtime</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Remarks</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((rec, i) => {
                    const style = STATUS_STYLES[rec.status];
                    return (
                      <motion.tr key={rec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{rec.avatar}</div>
                            <div>
                              <p className="text-sm font-medium">{rec.employeeName}</p>
                              <p className="text-[10px] text-muted-foreground">{rec.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium truncate max-w-[130px]">{rec.workLocationName}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{rec.shift}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${rec.status === 'Late' ? 'text-amber-600' : ''}`}>{formatTime(rec.checkIn)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatTime(rec.checkOut)}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold">{rec.hoursWorked > 0 ? `${rec.hoursWorked.toFixed(1)}h` : '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          {rec.overtime > 0 ? (
                            <span className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">+{rec.overtime.toFixed(1)}h</span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
                              {rec.status === 'Half-Day Holiday' && <Sunset size={11} />}
                              {rec.status}
                            </span>
                            {rec.status === 'Half-Day Holiday' && rec.halfDaySession && (
                              <span className="text-[9px] text-teal-600 font-medium px-1">
                                {rec.halfDaySession === 'morning' ? 'AM off · PM work' : 'AM work · PM off'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                          {rec.holidayName ? (
                            <span className={`font-medium ${rec.status === 'Half-Day Holiday' ? 'text-teal-600' : 'text-violet-600'}`}>
                              {rec.holidayName}
                            </span>
                          ) : rec.remarks || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                            <Pencil size={14} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground text-sm">No attendance records found for the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Status Legend</p>
            <div className="flex flex-wrap gap-3">
              {[
                { status: 'Holiday' as AttendanceStatus, desc: 'Full Holiday — entire day off (National, Festival, Weekly Off)' },
                { status: 'Half-Day Holiday' as AttendanceStatus, desc: 'Half-Day Weekly Off — employee works half day, other half is holiday' },
              ].map(item => {
                const style = STATUS_STYLES[item.status];
                return (
                  <div key={item.status} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${style.bg} ${style.border}`}>
                    {item.status === 'Half-Day Holiday' && <Sunset size={13} className={style.text} />}
                    <div>
                      <p className={`text-[10px] font-bold ${style.text}`}>{item.status}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
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
                <h2 className="text-lg font-bold">Edit Attendance — {editModal.employeeName}</h2>
                <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Check In Time</label>
                    <input type="time" className={inputCls} value={editForm.checkIn ?? ''} onChange={e => setEditForm(f => ({ ...f, checkIn: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Check Out Time</label>
                    <input type="time" className={inputCls} value={editForm.checkOut ?? ''} onChange={e => setEditForm(f => ({ ...f, checkOut: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Hours Worked</label>
                    <input type="number" className={inputCls} min={0} max={24} step={0.25} value={editForm.hoursWorked ?? 0} onChange={e => setEditForm(f => ({ ...f, hoursWorked: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Overtime Hours</label>
                    <input type="number" className={inputCls} min={0} max={12} step={0.25} value={editForm.overtime ?? 0} onChange={e => setEditForm(f => ({ ...f, overtime: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Status</label>
                  <select className={`${inputCls} appearance-none`} value={editForm.status ?? 'Present'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as AttendanceStatus }))}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {(editForm.status === 'Half-Day Holiday') && (
                  <div className="flex items-start gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                    <Sunset size={15} className="text-teal-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-teal-700">
                      <strong>Half-Day Holiday (HD)</strong> — Employee works half the day. The other half is a holiday from the Work Location's holiday list.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Remarks</label>
                  <input type="text" className={inputCls} placeholder="Optional remarks" value={editForm.remarks ?? ''} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setEditModal(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={saveEdit} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                  <Save size={15} /> Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}