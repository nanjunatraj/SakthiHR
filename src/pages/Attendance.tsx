import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Search, Filter, CheckCircle2, XCircle, AlertCircle,
  Calendar, Download, TrendingUp, Users, Timer, ArrowUpRight,
  ChevronLeft, ChevronRight, BarChart2, Minus
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;
const hhmm = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : '');
const initials = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Holiday' | 'Weekend';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  avatar: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  status: AttendanceStatus;
  shift: string;
  overtime: number;
}

const STATUS_STYLES: Record<AttendanceStatus, { bg: string; text: string; border: string }> = {
  Present: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  Absent: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  Late: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  'Half Day': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  'On Leave': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Holiday: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  Weekend: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
};

// Attendance rows are loaded live from the `attendance_records` table.
type DbAttendanceRow = Record<string, any> & { id: string };
function rowToAttendance(r: DbAttendanceRow): AttendanceRecord {
  const emp = r.employee;
  const name = emp ? [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') : '—';
  return {
    id: r.id,
    employeeId: r.employee_id ?? '',
    employeeName: name,
    department: emp?.department?.name ?? '—',
    avatar: initials(name),
    date: r.attendance_date ?? '',
    checkIn: hhmm(r.check_in),
    checkOut: hhmm(r.check_out),
    hoursWorked: Number(r.hours_worked ?? 0),
    status: (r.status as AttendanceStatus) ?? 'Present',
    shift: r.shift?.name ?? '—',
    overtime: Number(r.overtime_hours ?? 0),
  };
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(t: string) { return t || '—'; }

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function Attendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'All'>('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await db.from('attendance_records')
        .select('id, employee_id, attendance_date, check_in, check_out, hours_worked, overtime_hours, status, employee:employees(first_name, middle_name, last_name, department:departments(name)), shift:shifts(name)')
        .order('attendance_date', { ascending: false });
      if (active) setRecords((data ?? []).map(rowToAttendance));
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() =>
    records.filter(r => r.date === selectedDate)
      .filter(r => r.employeeName.toLowerCase().includes(search.toLowerCase()) || r.department.toLowerCase().includes(search.toLowerCase()))
      .filter(r => statusFilter === 'All' || r.status === statusFilter)
      .filter(r => deptFilter === 'All' || r.department === deptFilter),
    [records, search, statusFilter, deptFilter, selectedDate]
  );

  const todayRecords = useMemo(() => records.filter(r => r.date === selectedDate), [records, selectedDate]);
  const presentCount = todayRecords.filter(r => r.status === 'Present').length;
  const absentCount = todayRecords.filter(r => r.status === 'Absent').length;
  const lateCount = todayRecords.filter(r => r.status === 'Late').length;
  const leaveCount = todayRecords.filter(r => r.status === 'On Leave').length;
  const avgHours = todayRecords.filter(r => r.hoursWorked > 0).reduce((s, r) => s + r.hoursWorked, 0) / Math.max(1, todayRecords.filter(r => r.hoursWorked > 0).length);

  const departments = useMemo(() => [...new Set(records.map(r => r.department).filter(d => d && d !== '—'))], [records]);

  // Weekly overview derived from real records (present/absent/late counts per weekday).
  const CHART_DATA = useMemo(() => {
    const base = WEEKDAY_LABELS.slice(1, 6).map(day => ({ day, present: 0, absent: 0, late: 0 }));
    records.forEach(r => {
      if (!r.date) return;
      const wd = new Date(r.date + 'T00:00:00').getDay();
      const slot = base.find(b => b.day === WEEKDAY_LABELS[wd]);
      if (!slot) return;
      if (r.status === 'Present') slot.present++;
      else if (r.status === 'Absent') slot.absent++;
      else if (r.status === 'Late') slot.late++;
    });
    return base;
  }, [records]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Clock size={22} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Attendance & Time Tracking</h1>
                <p className="text-xs text-muted-foreground">Monitor daily attendance, check-in/out times, and overtime.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs text-muted-foreground">
                <Calendar size={14} />
                <span>{formatDate(selectedDate)}</span>
              </div>
              <input type="date" className="px-3 py-2 border border-border rounded-lg bg-card outline-none text-sm" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                <Download size={15} /> Export
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Present', value: presentCount, color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Absent', value: absentCount, color: 'bg-red-100', iconColor: 'text-red-600', icon: XCircle },
              { label: 'Late', value: lateCount, color: 'bg-amber-100', iconColor: 'text-amber-600', icon: AlertCircle },
              { label: 'On Leave', value: leaveCount, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Calendar },
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
            <div className="h-[220px]">
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
              {(['Present', 'Absent', 'Late', 'Half Day', 'On Leave'] as AttendanceStatus[]).map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} records</div>
          </div>

          {/* Attendance Table */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Shift</th>
                    <th className="px-4 py-3 font-semibold">Check In</th>
                    <th className="px-4 py-3 font-semibold">Check Out</th>
                    <th className="px-4 py-3 font-semibold">Hours</th>
                    <th className="px-4 py-3 font-semibold">Overtime</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((rec, i) => {
                    const style = STATUS_STYLES[rec.status];
                    return (
                      <motion.tr key={rec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{rec.avatar}</div>
                            <div>
                              <p className="text-sm font-medium">{rec.employeeName}</p>
                              <p className="text-[10px] text-muted-foreground">{rec.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(rec.date)}</td>
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
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
                            {rec.status}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No attendance records found for the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}