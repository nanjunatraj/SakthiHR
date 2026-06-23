import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';

const abdb = supabase as unknown as SupabaseClient;
const initialsOf = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
import {
  ClipboardList, Search, CheckCircle2, XCircle, AlertCircle,
  Calendar, Download, Upload, Save, X, Info, Users,
  ChevronDown, Filter, RefreshCw, FileText, Pencil
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import { CalendarRange } from 'lucide-react';
import { usePayrollPeriods, isWithinPeriod } from '../../lib/attendancePeriods';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Holiday' | 'Weekend';

interface BulkEmployee {
  employeeId: string;
  employeeName: string;
  department: string;
  avatar: string;
  shift: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  remarks: string;
  modified: boolean;
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

const STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Weekend'];

// Roster is loaded live from the employees table (default everyone to Present for the day).
async function loadRoster(): Promise<BulkEmployee[]> {
  const { data } = await abdb.from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, department:departments(name), shift:shifts(name)')
    .order('first_name');
  return ((data ?? []) as Record<string, any>[]).map(e => {
    const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ');
    return {
      employeeId: e.employee_id || e.id, employeeName: name, department: e.department?.name ?? '—',
      avatar: initialsOf(name), shift: e.shift?.name ?? 'General',
      status: 'Present' as AttendanceStatus, checkIn: '09:00', checkOut: '18:00', remarks: '', modified: false,
    };
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

const inputCls = "w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";

export default function AttendanceBulk() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { periods } = usePayrollPeriods();
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const selectedPeriod = useMemo(() => periods.find(p => p.id === selectedPeriodId) ?? null, [periods, selectedPeriodId]);
  useEffect(() => {
    if (selectedPeriodId || periods.length === 0) return;
    const match = periods.find(p => isWithinPeriod(selectedDate, p)) ?? periods[0];
    setSelectedPeriodId(match.id);
  }, [periods, selectedPeriodId, selectedDate]);
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const period = periods.find(p => p.id === periodId);
    if (period && !isWithinPeriod(selectedDate, period)) setSelectedDate(period.fromDate);
  };
  const [employees, setEmployees] = useState<BulkEmployee[]>([]);
  const loadEmployees = useCallback(() => { void loadRoster().then(setEmployees); }, []);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [saved, setSaved] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('Present');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const departments = [...new Set(employees.map(e => e.department))];

  const filtered = useMemo(() =>
    employees
      .filter(e => e.employeeName.toLowerCase().includes(search.toLowerCase()) || e.department.toLowerCase().includes(search.toLowerCase()))
      .filter(e => deptFilter === 'All' || e.department === deptFilter),
    [employees, search, deptFilter]
  );

  const modifiedCount = employees.filter(e => e.modified).length;
  const presentCount = employees.filter(e => e.status === 'Present').length;
  const absentCount = employees.filter(e => e.status === 'Absent').length;
  const lateCount = employees.filter(e => e.status === 'Late').length;

  const updateEmployee = (employeeId: string, updates: Partial<BulkEmployee>) => {
    setEmployees(prev => prev.map(e =>
      e.employeeId === employeeId ? { ...e, ...updates, modified: true } : e
    ));
    setSaved(false);
  };

  const toggleRow = (employeeId: string) => {
    setSelectedRows(prev =>
      prev.includes(employeeId) ? prev.filter(id => id !== employeeId) : [...prev, employeeId]
    );
  };

  const toggleAll = () => {
    if (selectedRows.length === filtered.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filtered.map(e => e.employeeId));
    }
  };

  const applyBulkStatus = () => {
    if (selectedRows.length === 0) { toast.error('Please select at least one employee.'); return; }
    setEmployees(prev => prev.map(e =>
      selectedRows.includes(e.employeeId) ? { ...e, status: bulkStatus, modified: true } : e
    ));
    toast.success(`Status "${bulkStatus}" applied to ${selectedRows.length} employee(s).`);
    setSelectedRows([]);
    setSaved(false);
  };

  const markAllPresent = () => {
    setEmployees(prev => prev.map(e => ({ ...e, status: 'Present', checkIn: '09:00', checkOut: '18:00', modified: true })));
    toast.success('All employees marked as Present.');
    setSaved(false);
  };

  const resetAll = () => {
    loadEmployees();
    setSaved(false);
    toast.info('All changes reset.');
  };

  const handleSave = () => {
    setSaved(true);
    toast.success(`Attendance saved for ${formatDate(selectedDate)} — ${employees.length} records.`);
  };

  const handleExportTemplate = () => {
    const rows = [
      ['Employee ID', 'Employee Name', 'Department', 'Status', 'Check In', 'Check Out', 'Remarks'],
      ...employees.map(e => [e.employeeId, e.employeeName, e.department, e.status, e.checkIn, e.checkOut, e.remarks])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_bulk_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template exported as CSV.');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg"><ClipboardList size={22} className="text-emerald-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Bulk Attendance Entry</h1>
                <p className="text-xs text-muted-foreground">Enter attendance for multiple employees at once for a selected date.</p>
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
              <input
                type="date"
                className="px-3 py-2 border border-border rounded-lg bg-card outline-none text-sm"
                value={selectedDate}
                min={selectedPeriod?.fromDate || undefined}
                max={selectedPeriod?.toDate || undefined}
                onChange={e => setSelectedDate(e.target.value)}
              />
              <button onClick={handleExportTemplate} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                <Download size={15} /> Export CSV
              </button>
              <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
                <Save size={15} /> Save Attendance
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Info size={17} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Bulk Entry for {formatDate(selectedDate)}</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Edit attendance status, check-in, and check-out times inline for each employee. Use the bulk action bar to apply a status to multiple employees at once. Click <strong>Save Attendance</strong> when done.
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Employees', value: employees.length, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Present', value: presentCount, color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Absent', value: absentCount, color: 'bg-red-100', iconColor: 'text-red-600', icon: XCircle },
              { label: 'Modified', value: modifiedCount, color: 'bg-amber-100', iconColor: 'text-amber-600', icon: Pencil },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={20} className={card.iconColor} /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-lg mt-0.5">{card.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Quick Actions:</span>
            <button onClick={markAllPresent} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-200 transition-colors">
              <CheckCircle2 size={13} /> Mark All Present
            </button>
            <button onClick={resetAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-muted-foreground border border-border rounded-lg text-xs font-semibold hover:bg-accent/80 transition-colors">
              <RefreshCw size={13} /> Reset All
            </button>
            <div className="h-5 w-px bg-border" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Bulk Apply:</span>
            <select className="px-3 py-1.5 border border-border rounded-lg bg-card outline-none text-xs appearance-none font-medium" value={bulkStatus} onChange={e => setBulkStatus(e.target.value as AttendanceStatus)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={applyBulkStatus} disabled={selectedRows.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
              Apply to {selectedRows.length > 0 ? `${selectedRows.length} selected` : 'selected'}
            </button>
            {saved && (
              <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                <CheckCircle2 size={13} /> Saved
              </motion.span>
            )}
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
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} employees · {selectedRows.length} selected</div>
          </div>

          {/* Bulk Entry Table */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-10">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selectedRows.length === filtered.length && filtered.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Shift</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Check In</th>
                    <th className="px-4 py-3 font-semibold">Check Out</th>
                    <th className="px-4 py-3 font-semibold">Remarks</th>
                    <th className="px-4 py-3 font-semibold w-16">Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((emp, i) => {
                    const style = STATUS_STYLES[emp.status];
                    const isSelected = selectedRows.includes(emp.employeeId);
                    return (
                      <motion.tr
                        key={emp.employeeId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-accent/30'} ${emp.modified ? 'border-l-2 border-l-amber-400' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={isSelected}
                            onChange={() => toggleRow(emp.employeeId)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{emp.avatar}</div>
                            <div>
                              <p className="text-sm font-medium">{emp.employeeName}</p>
                              <p className="text-[10px] text-muted-foreground">{emp.department} · {emp.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{emp.shift}</td>
                        <td className="px-4 py-3">
                          <select
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold appearance-none outline-none focus:ring-2 focus:ring-primary/20 transition-all ${style.bg} ${style.text} ${style.border}`}
                            value={emp.status}
                            onChange={e => updateEmployee(emp.employeeId, { status: e.target.value as AttendanceStatus })}
                          >
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            className="px-2.5 py-1.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all w-28"
                            value={emp.checkIn}
                            disabled={emp.status === 'Absent' || emp.status === 'Holiday' || emp.status === 'Weekend'}
                            onChange={e => updateEmployee(emp.employeeId, { checkIn: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            className="px-2.5 py-1.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all w-28"
                            value={emp.checkOut}
                            disabled={emp.status === 'Absent' || emp.status === 'Holiday' || emp.status === 'Weekend'}
                            onChange={e => updateEmployee(emp.employeeId, { checkOut: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            className="px-2.5 py-1.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all w-36"
                            placeholder="Optional"
                            value={emp.remarks}
                            onChange={e => updateEmployee(emp.employeeId, { remarks: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {emp.modified && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              <Pencil size={9} /> Edited
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Save Bar */}
          <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border shadow-sm">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{modifiedCount}</span> record{modifiedCount !== 1 ? 's' : ''} modified ·
              <span className="font-semibold text-foreground ml-1">{employees.length}</span> total employees
            </div>
            <div className="flex items-center gap-3">
              <button onClick={resetAll} className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors">
                Reset All
              </button>
              <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
                <Save size={15} /> Save Attendance for {formatDate(selectedDate)}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}