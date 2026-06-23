import React, { useState, useMemo } from 'react';
import { useAttendanceRegister, usePayrollPeriodOptions, useEstablishment, EMPTY_PERIOD_OPTION, type PeriodOption, type AttendanceRegisterEmp } from '../../../lib/reports';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, ChevronLeft, Search,
  Calendar, Users, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Printer, FileDown, Building2, MapPin, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/Sidebar';
import { toast } from 'react-toastify';

type DayStatus = 'P' | 'A' | 'L' | 'H' | 'WO' | 'HD' | 'LT' | 'LOP' | '-';
type GroupByOption = 'none' | 'establishment' | 'work-location' | 'department' | 'designation' | 'grade' | 'employee-type';

interface DailyEntry {
  date: string;
  dayOfWeek: string;
  status: DayStatus;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  overtimeHours?: number;
  remarks?: string;
}

interface EmployeeAttendance {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  location: string;
  designation: string;
  grade: string;
  employeeType: string;
  establishment: string;
  dailyEntries: DailyEntry[];
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  holidayDays: number;
  weekendDays: number;
  lopDays: number;
  overtimeHours: number;
  totalHoursWorked: number;
}


const DEPARTMENTS = ['All', 'Engineering', 'Marketing', 'Design', 'Sales', 'Human Resources', 'Finance'];
const LOCATIONS = ['All', 'Head Office – Mumbai', 'Regional Office – Delhi', 'Branch Office – Bangalore'];

const GROUP_BY_OPTIONS: { value: GroupByOption; label: string; icon: React.ElementType }[] = [
  { value: 'none', label: 'No Grouping', icon: Layers },
  { value: 'establishment', label: 'Establishment Wise', icon: Building2 },
  { value: 'work-location', label: 'Work Location Wise', icon: MapPin },
  { value: 'department', label: 'Department Wise', icon: Users },
  { value: 'designation', label: 'Designation Wise', icon: Users },
  { value: 'grade', label: 'Grade Wise', icon: Users },
  { value: 'employee-type', label: 'Employee Type Wise', icon: Users },
];

const STATUS_LABELS: Record<DayStatus, string> = {
  P: 'Present', A: 'Absent', L: 'Leave', H: 'Holiday',
  WO: 'Weekend', HD: 'Half Day', LT: 'Late', LOP: 'LOP', '-': 'Not Marked',
};

const STATUS_COLORS: Record<DayStatus, { bg: string; text: string; border: string }> = {
  P:   { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' },
  A:   { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' },
  L:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' },
  H:   { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  WO:  { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200' },
  HD:  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  LT:  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200' },
  LOP: { bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-200' },
  '-': { bg: 'bg-gray-50',    text: 'text-gray-400',   border: 'border-gray-100' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function getDatesInRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T00:00:00');
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getDayShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
}

function getDayNum(dateStr: string): string {
  return String(new Date(dateStr + 'T00:00:00').getDate()).padStart(2, '0');
}

function getGroupKey(emp: EmployeeAttendance, groupBy: GroupByOption): string {
  switch (groupBy) {
    case 'establishment': return emp.establishment;
    case 'work-location': return emp.location;
    case 'department': return emp.department;
    case 'designation': return emp.designation;
    case 'grade': return emp.grade;
    case 'employee-type': return emp.employeeType;
    default: return 'All Employees';
  }
}

function generateDailyEntries(
  fromDate: string,
  toDate: string,
  pattern: { presentDays: number; absentDays: number; lateDays: number; halfDays: number; leaveDays: number; lopDays: number }
): DailyEntry[] {
  const dates = getDatesInRange(fromDate, toDate);
  const entries: DailyEntry[] = [];
  let presentCount = 0, absentCount = 0, lateCount = 0, halfCount = 0, leaveCount = 0, lopCount = 0;

  for (const date of dates) {
    const dayOfWeek = getDayShort(date);
    const dayNum = new Date(date + 'T00:00:00').getDay();
    if (dayNum === 0 || dayNum === 6) { entries.push({ date, dayOfWeek, status: 'WO' }); continue; }
    const dayOfMonth = new Date(date + 'T00:00:00').getDate();
    if (dayOfMonth === 15 || dayOfMonth === 26) { entries.push({ date, dayOfWeek, status: 'H' }); continue; }
    if (lopCount < pattern.lopDays) { entries.push({ date, dayOfWeek, status: 'LOP', remarks: 'Loss of Pay' }); lopCount++; }
    else if (absentCount < pattern.absentDays) { entries.push({ date, dayOfWeek, status: 'A', remarks: 'Absent' }); absentCount++; }
    else if (leaveCount < pattern.leaveDays) { entries.push({ date, dayOfWeek, status: 'L', remarks: 'Approved Leave' }); leaveCount++; }
    else if (halfCount < pattern.halfDays) { entries.push({ date, dayOfWeek, status: 'HD', checkIn: '09:00', checkOut: '13:00', hoursWorked: 4, remarks: 'Half Day' }); halfCount++; }
    else if (lateCount < pattern.lateDays) { entries.push({ date, dayOfWeek, status: 'LT', checkIn: '09:45', checkOut: '18:00', hoursWorked: 8.25, overtimeHours: 0, remarks: 'Late Arrival' }); lateCount++; }
    else {
      const hasOT = presentCount % 5 === 0 && presentCount > 0;
      entries.push({ date, dayOfWeek, status: 'P', checkIn: '09:00', checkOut: hasOT ? '19:00' : '18:00', hoursWorked: hasOT ? 10 : 9, overtimeHours: hasOT ? 1 : 0 });
      presentCount++;
    }
  }
  return entries;
}

// Build the per-employee daily grid from REAL attendance records (scoped to the period),
// classifying non-record days as the holiday/weekly-off from the calendar, else "Not Marked".
function buildEmployeeData(
  employees: AttendanceRegisterEmp[],
  holidaysByDate: Record<string, 'H' | 'WO'>,
  fromDate: string,
  toDate: string,
): EmployeeAttendance[] {
  if (!fromDate || !toDate) return [];
  const dates = getDatesInRange(fromDate, toDate);
  return employees.map(emp => {
    const dailyEntries: DailyEntry[] = dates.map(date => {
      const dayOfWeek = getDayShort(date);
      const rec = emp.daily[date];
      if (rec) return { date, dayOfWeek, status: rec.status as DayStatus, checkIn: rec.checkIn, checkOut: rec.checkOut, hoursWorked: rec.hoursWorked, overtimeHours: rec.overtimeHours, remarks: rec.remarks };
      const hol = holidaysByDate[date];
      if (hol) return { date, dayOfWeek, status: hol };
      return { date, dayOfWeek, status: '-' };
    });
    const c = (st: DayStatus) => dailyEntries.filter(e => e.status === st).length;
    const presentDays = c('P'), absentDays = c('A'), lateDays = c('LT'), halfDays = c('HD'),
      leaveDays = c('L'), holidayDays = c('H'), weekendDays = c('WO'), lopDays = c('LOP');
    const workingDays = dates.length - weekendDays - holidayDays;
    const totalHoursWorked = dailyEntries.reduce((s, e) => s + (e.hoursWorked ?? 0), 0);
    return {
      id: emp.id, employeeCode: emp.employeeCode, name: emp.name, department: emp.department, location: emp.location,
      designation: emp.designation, grade: emp.grade, employeeType: emp.employeeType, establishment: emp.establishment,
      dailyEntries, workingDays, presentDays, absentDays, lateDays, halfDays, leaveDays, holidayDays, weekendDays, lopDays,
      overtimeHours: emp.overtimeHours, totalHoursWorked,
    };
  });
}

// ─── Print HTML Generator ─────────────────────────────────────────────────────

function generatePrintHTML(
  employees: EmployeeAttendance[],
  period: PeriodOption,
  groupBy: GroupByOption,
  groupedData: [string, EmployeeAttendance[]][] | null,
  est: { name: string; address: string },
): string {
  const estName = est.name || 'Establishment';
  const groupLabel = GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label ?? 'No Grouping';

  const tableHeader = `
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:left;">#</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:left;">Employee</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:left;">Dept</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;">Working</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;color:#16a34a;">P</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;color:#dc2626;">A</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;color:#d97706;">LT</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;color:#ea580c;">HD</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;color:#2563eb;">L</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;color:#7c3aed;">H</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;color:#e11d48;">LOP</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;">OT Hrs</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;">Att%</th>
      </tr>
    </thead>`;

  const renderRows = (emps: EmployeeAttendance[], startIdx: number) =>
    emps.map((emp, i) => {
      const attPct = Math.round((emp.presentDays / Math.max(emp.workingDays, 1)) * 100);
      return `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;">${startIdx + i + 1}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;"><strong>${emp.name}</strong><br/><span style="color:#6b7280;font-size:9px;">${emp.employeeCode}</span></td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;color:#6b7280;">${emp.department}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;">${emp.workingDays}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:#16a34a;">${emp.presentDays}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:#dc2626;">${emp.absentDays}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:#d97706;">${emp.lateDays}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:#ea580c;">${emp.halfDays}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:#2563eb;">${emp.leaveDays}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:#7c3aed;">${emp.holidayDays}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:#e11d48;">${emp.lopDays}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:#7c3aed;">${emp.overtimeHours.toFixed(1)}h</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:bold;color:${attPct >= 90 ? '#16a34a' : attPct >= 75 ? '#d97706' : '#dc2626'};">${attPct}%</td>
        </tr>`;
    }).join('');

  const renderSubtotalRow = (emps: EmployeeAttendance[]) => {
    const avgAtt = Math.round(emps.reduce((s, e) => s + (e.presentDays / Math.max(e.workingDays, 1)) * 100, 0) / Math.max(emps.length, 1));
    return `
      <tr style="background:#eff6ff;font-weight:bold;">
        <td colspan="3" style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;color:#1d4ed8;">Subtotal (${emps.length} employees)</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#1d4ed8;">${emps.reduce((s,e)=>s+e.workingDays,0)}</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#16a34a;">${emps.reduce((s,e)=>s+e.presentDays,0)}</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#dc2626;">${emps.reduce((s,e)=>s+e.absentDays,0)}</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#d97706;">${emps.reduce((s,e)=>s+e.lateDays,0)}</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#ea580c;">${emps.reduce((s,e)=>s+e.halfDays,0)}</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#2563eb;">${emps.reduce((s,e)=>s+e.leaveDays,0)}</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#7c3aed;">${emps.reduce((s,e)=>s+e.holidayDays,0)}</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#e11d48;">${emps.reduce((s,e)=>s+e.lopDays,0)}</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#7c3aed;">${emps.reduce((s,e)=>s+e.overtimeHours,0).toFixed(1)}h</td>
        <td style="padding:6px 8px;border:1px solid #bfdbfe;font-size:10px;text-align:center;color:#1d4ed8;">${avgAtt}%</td>
      </tr>`;
  };

  let bodyContent = '';
  if (groupBy !== 'none' && groupedData) {
    let globalIdx = 0;
    groupedData.forEach(([groupName, emps]) => {
      bodyContent += `
        <div style="margin-bottom:24px;page-break-inside:avoid;">
          <div style="background:#1e3a5f;color:white;padding:8px 12px;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:bold;font-size:12px;">${groupLabel}: ${groupName}</span>
            <span style="font-size:10px;opacity:0.8;">${emps.length} employee${emps.length !== 1 ? 's' : ''}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            ${tableHeader}
            <tbody>
              ${renderRows(emps, globalIdx)}
              ${renderSubtotalRow(emps)}
            </tbody>
          </table>
        </div>`;
      globalIdx += emps.length;
    });
  } else {
    bodyContent = `
      <table style="width:100%;border-collapse:collapse;">
        ${tableHeader}
        <tbody>
          ${renderRows(employees, 0)}
          ${renderSubtotalRow(employees)}
        </tbody>
      </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Attendance Register — ${period.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1f2937; background: #f3f4f6; }
    .page { width: 297mm; min-height: 210mm; background: white; margin: 0 auto; padding: 15mm; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; width: 100%; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="background:#1e3a5f;color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
    <span style="font-size:13px;font-weight:600;">📋 Attendance Register — ${period.name}${groupBy !== 'none' ? ` (Grouped by ${groupLabel})` : ''}</span>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🖨️ Print / Save PDF</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;">✕ Close</button>
    </div>
  </div>
  <div class="page">
    <div style="border-bottom:3px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:18px;font-weight:bold;color:#1e3a5f;">${estName}</div>
          ${est.address ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;">${est.address}</div>` : ''}
          <div style="font-size:13px;font-weight:bold;color:#374151;margin-top:4px;">ATTENDANCE REGISTER — Form No. 25</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">As per Factories Act / Shops & Establishments Act</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#6b7280;">Pay Period</div>
          <div style="font-size:14px;font-weight:bold;color:#1e3a5f;">${period.name}</div>
          <div style="font-size:10px;color:#6b7280;">${formatDate(period.fromDate)} – ${formatDate(period.toDate)}</div>
          ${groupBy !== 'none' ? `<div style="font-size:10px;color:#7c3aed;margin-top:4px;font-weight:bold;">Grouped by: ${groupLabel}</div>` : ''}
        </div>
      </div>
    </div>
    ${bodyContent}
    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
      <div style="text-align:center;border-top:1px dashed #9ca3af;padding-top:4px;font-size:9px;color:#9ca3af;">Prepared By</div>
      <div style="text-align:center;border-top:1px dashed #9ca3af;padding-top:4px;font-size:9px;color:#9ca3af;">HR Manager</div>
      <div style="text-align:center;border-top:1px dashed #9ca3af;padding-top:4px;font-size:9px;color:#9ca3af;">Authorised Signatory</div>
    </div>
    <div style="font-size:9px;color:#9ca3af;text-align:center;margin-top:8px;">This is a computer-generated register. | ${estName} | ${period.name}</div>
  </div>
</body>
</html>`;
}

// ─── Group Summary Component ──────────────────────────────────────────────────

interface GroupSummaryRowProps {
  groupName: string;
  employees: EmployeeAttendance[];
  groupBy: GroupByOption;
  isExpanded: boolean;
  onToggle: () => void;
  expandedEmployee: string | null;
  onToggleEmployee: (id: string) => void;
  dates: string[];
  activeView: 'daily' | 'summary';
}

const GroupSummaryRow = ({ groupName, employees, groupBy, isExpanded, onToggle, expandedEmployee, onToggleEmployee, dates, activeView }: GroupSummaryRowProps) => {
  const totalPresent = employees.reduce((s, e) => s + e.presentDays, 0);
  const totalAbsent = employees.reduce((s, e) => s + e.absentDays, 0);
  const totalLOP = employees.reduce((s, e) => s + e.lopDays, 0);
  const totalOT = employees.reduce((s, e) => s + e.overtimeHours, 0);
  const avgAtt = Math.round(employees.reduce((s, e) => s + (e.presentDays / Math.max(e.workingDays, 1)) * 100, 0) / Math.max(employees.length, 1));

  const GroupIcon = groupBy === 'establishment' ? Building2 : groupBy === 'work-location' ? MapPin : Users;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 hover:from-indigo-100 hover:to-blue-100 transition-colors"
      >
        <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
          <GroupIcon size={18} className="text-indigo-600" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-bold text-sm text-indigo-900">{groupName}</p>
          <p className="text-[10px] text-indigo-600 mt-0.5">{employees.length} employee{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-sm font-bold text-green-600">{totalPresent}</p>
            <p className="text-[9px] text-muted-foreground">Present</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-red-600">{totalAbsent}</p>
            <p className="text-[9px] text-muted-foreground">Absent</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-rose-600">{totalLOP}</p>
            <p className="text-[9px] text-muted-foreground">LOP</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-violet-600">{totalOT.toFixed(1)}h</p>
            <p className="text-[9px] text-muted-foreground">OT</p>
          </div>
          <div className="text-center">
            <p className={`text-sm font-bold ${avgAtt >= 90 ? 'text-green-600' : avgAtt >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{avgAtt}%</p>
            <p className="text-[9px] text-muted-foreground">Avg Att</p>
          </div>
        </div>
        <div className="p-1.5 rounded-lg hover:bg-indigo-200 text-indigo-600 transition-colors shrink-0">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {activeView === 'summary' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">#</th>
                        <th className="px-3 py-2.5 font-semibold">Employee</th>
                        <th className="px-3 py-2.5 font-semibold">Dept</th>
                        <th className="px-3 py-2.5 font-semibold text-center">Working</th>
                        <th className="px-3 py-2.5 font-semibold text-center text-green-700">P</th>
                        <th className="px-3 py-2.5 font-semibold text-center text-red-700">A</th>
                        <th className="px-3 py-2.5 font-semibold text-center text-amber-700">LT</th>
                        <th className="px-3 py-2.5 font-semibold text-center text-orange-700">HD</th>
                        <th className="px-3 py-2.5 font-semibold text-center text-blue-700">L</th>
                        <th className="px-3 py-2.5 font-semibold text-center text-violet-700">H</th>
                        <th className="px-3 py-2.5 font-semibold text-center text-rose-700">LOP</th>
                        <th className="px-3 py-2.5 font-semibold text-center">OT</th>
                        <th className="px-3 py-2.5 font-semibold text-center">Att%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {employees.map((emp, i) => {
                        const attPct = Math.round((emp.presentDays / Math.max(emp.workingDays, 1)) * 100);
                        return (
                          <tr key={emp.id} className="hover:bg-accent/20 transition-colors">
                            <td className="px-3 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-semibold">{emp.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode}</p>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">{emp.department}</td>
                            <td className="px-3 py-2.5 text-center font-medium">{emp.workingDays}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-green-600">{emp.presentDays}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-red-600">{emp.absentDays}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-amber-600">{emp.lateDays}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-orange-600">{emp.halfDays}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-blue-600">{emp.leaveDays}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-violet-600">{emp.holidayDays}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-rose-600">{emp.lopDays}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-indigo-600">{emp.overtimeHours.toFixed(1)}h</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-xs font-bold ${attPct >= 90 ? 'text-green-600' : attPct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{attPct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-indigo-50 border-t border-indigo-200">
                      <tr>
                        <td colSpan={3} className="px-3 py-2.5 font-bold text-[10px] text-indigo-700 uppercase tracking-wide">Subtotal ({employees.length})</td>
                        <td className="px-3 py-2.5 text-center font-bold text-indigo-700">{employees.reduce((s,e)=>s+e.workingDays,0)}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-green-700">{totalPresent}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-red-700">{totalAbsent}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-amber-700">{employees.reduce((s,e)=>s+e.lateDays,0)}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-orange-700">{employees.reduce((s,e)=>s+e.halfDays,0)}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-blue-700">{employees.reduce((s,e)=>s+e.leaveDays,0)}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-violet-700">{employees.reduce((s,e)=>s+e.holidayDays,0)}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-rose-700">{totalLOP}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-indigo-700">{totalOT.toFixed(1)}h</td>
                        <td className="px-3 py-2.5 text-center font-bold text-indigo-700">{avgAtt}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                employees.map((emp) => {
                  const isExpanded = expandedEmployee === emp.id;
                  const attPct = Math.round((emp.presentDays / Math.max(emp.workingDays, 1)) * 100);
                  return (
                    <div key={emp.id} className="bg-accent/20 rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/40 transition-colors" onClick={() => onToggleEmployee(emp.id)}>
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{emp.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex gap-0.5 flex-1 max-w-xs">
                              {emp.dailyEntries.map((entry, di) => {
                                const style = STATUS_COLORS[entry.status];
                                return <div key={di} title={`${formatDate(entry.date)}: ${STATUS_LABELS[entry.status]}`} className={`h-2.5 flex-1 rounded-sm ${style.bg} border ${style.border}`} />;
                              })}
                            </div>
                            <span className={`text-[10px] font-bold ${attPct >= 90 ? 'text-green-600' : attPct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{attPct}%</span>
                          </div>
                        </div>
                        <div className="hidden md:flex items-center gap-3 shrink-0 text-xs">
                          <span className="text-green-600 font-bold">{emp.presentDays}P</span>
                          <span className="text-red-600 font-bold">{emp.absentDays}A</span>
                          <span className="text-rose-600 font-bold">{emp.lopDays}LOP</span>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-border">
                          <div className="overflow-x-auto mt-3">
                            <div className="flex gap-1 min-w-max">
                              {emp.dailyEntries.map((entry, di) => {
                                const style = STATUS_COLORS[entry.status];
                                return (
                                  <div key={di} className={`flex flex-col items-center gap-0.5 w-9 shrink-0 rounded-lg border p-1 ${style.bg} ${style.border}`} title={`${formatDate(entry.date)}: ${STATUS_LABELS[entry.status]}`}>
                                    <span className="text-[8px] text-muted-foreground">{entry.dayOfWeek}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground">{getDayNum(entry.date)}</span>
                                    <span className={`text-[9px] font-bold ${style.text}`}>{entry.status}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttendanceRegister() {
  const PAYROLL_PERIODS = usePayrollPeriodOptions();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'daily' | 'summary'>('summary');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const period = PAYROLL_PERIODS.find(p => p.id === selectedPeriod) ?? PAYROLL_PERIODS[0] ?? EMPTY_PERIOD_OPTION;
  const est = useEstablishment();

  // Real attendance for the selected period (per-day records + holiday calendar).
  const { employees: attEmployees, holidaysByDate } = useAttendanceRegister(period.fromDate, period.toDate);
  const allEmployees = useMemo(
    () => buildEmployeeData(attEmployees, holidaysByDate, period.fromDate, period.toDate),
    [attEmployees, holidaysByDate, period],
  );

  const filtered = useMemo(() =>
    allEmployees.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeCode.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.department === deptFilter;
      const matchLoc = locationFilter === 'All' || e.location === locationFilter;
      return matchSearch && matchDept && matchLoc;
    }),
    [allEmployees, search, deptFilter, locationFilter]
  );

  const dates = useMemo(() => getDatesInRange(period.fromDate, period.toDate), [period]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, EmployeeAttendance[]>();
    filtered.forEach(emp => {
      const key = getGroupKey(emp, groupBy);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(emp);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const expandAllGroups = () => {
    if (groupedData) setExpandedGroups(new Set(groupedData.map(([k]) => k)));
  };

  const collapseAllGroups = () => setExpandedGroups(new Set());

  const totalPresent = filtered.reduce((s, e) => s + e.presentDays, 0);
  const totalAbsent = filtered.reduce((s, e) => s + e.absentDays, 0);
  const totalLOP = filtered.reduce((s, e) => s + e.lopDays, 0);
  const totalOT = filtered.reduce((s, e) => s + e.overtimeHours, 0);
  const avgAttendance = filtered.length > 0
    ? Math.round(filtered.reduce((s, e) => s + (e.presentDays / Math.max(e.workingDays, 1)) * 100, 0) / filtered.length)
    : 0;

  const resetFilters = () => { setSearch(''); setDeptFilter('All'); setLocationFilter('All'); };
  const hasFilters = search || deptFilter !== 'All' || locationFilter !== 'All';

  const handlePrint = () => {
    const html = generatePrintHTML(filtered, period, groupBy, groupedData, est);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=1100,height=750,scrollbars=yes');
    if (!win) { toast.error('Popup blocked. Please allow popups for this site.'); URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success('Print view opened. Use Print → Save as PDF to export.');
  };

  const handleExportCSV = () => {
    const headers = ['#', 'Emp Code', 'Name', 'Department', 'Location', 'Designation', 'Grade', 'Emp Type', 'Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Holiday', 'LOP', 'OT Hours', 'Att %'];
    const rows = filtered.map((emp, i) => {
      const attPct = Math.round((emp.presentDays / Math.max(emp.workingDays, 1)) * 100);
      return [i + 1, emp.employeeCode, emp.name, emp.department, emp.location, emp.designation, emp.grade, emp.employeeType, emp.presentDays, emp.absentDays, emp.lateDays, emp.halfDays, emp.leaveDays, emp.holidayDays, emp.lopDays, emp.overtimeHours.toFixed(1), `${attPct}%`];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Register_${period.name.replace(' ', '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Attendance Register exported as CSV.');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/registers')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-blue-100 rounded-lg"><Clock size={22} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Attendance Register</h1>
                <p className="text-xs text-muted-foreground">Form No. 25 — Daily Muster Roll as per Factories Act / Shops & Establishments Act</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm">
                <Printer size={15} /> Print / PDF
              </button>
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                <FileDown size={15} /> Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Period Selector */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <Calendar size={16} className="text-primary" />
              <h2 className="font-bold text-sm">Select Period</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {PAYROLL_PERIODS.map(p => (
                <button key={p.id} onClick={() => setSelectedPeriod(p.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${selectedPeriod === p.id ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
                  {p.name}
                </button>
              ))}
            </div>
            {period && (
              <div className="mt-3 flex items-center gap-4 px-4 py-3 bg-accent/30 rounded-xl border border-border text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(period.fromDate)} → {formatDate(period.toDate)}</span>
                <span className="flex items-center gap-1.5"><Users size={12} /> {filtered.length} employees</span>
                <span className="flex items-center gap-1.5"><Clock size={12} /> {dates.length} days in period</span>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Avg Attendance', value: `${avgAttendance}%`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Total Present Days', value: totalPresent, color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Total Absent Days', value: totalAbsent, color: 'bg-red-100', iconColor: 'text-red-600', icon: XCircle },
              { label: 'Total LOP Days', value: totalLOP, color: 'bg-rose-100', iconColor: 'text-rose-600', icon: AlertCircle },
              { label: 'Total OT Hours', value: `${totalOT.toFixed(1)}h`, color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Clock },
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

          {/* Filters + Group By */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input type="text" placeholder="Search by name or employee code..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
              <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
              {hasFilters && (
                <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw size={12} /> Reset
                </button>
              )}
              <div className="ml-auto text-xs text-muted-foreground">{filtered.length} employees</div>
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Layers size={13} /> Group By:
              </span>
              <div className="flex flex-wrap gap-2">
                {GROUP_BY_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isActive = groupBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setGroupBy(opt.value); setExpandedGroups(new Set()); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-accent text-muted-foreground border-border hover:border-primary/40'}`}
                    >
                      <Icon size={11} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {groupBy !== 'none' && groupedData && (
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={expandAllGroups} className="text-xs text-primary hover:underline font-medium">Expand All</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={collapseAllGroups} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Collapse All</button>
                </div>
              )}
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-accent/50 p-1 rounded-xl w-fit">
            <button onClick={() => setActiveView('daily')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === 'daily' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Calendar size={15} /> Daily Attendance
            </button>
            <button onClick={() => setActiveView('summary')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === 'summary' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Users size={15} /> Summary View
            </button>
          </div>

          {/* Legend */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Attendance Status Legend</p>
            <div className="flex flex-wrap gap-3">
              {(Object.entries(STATUS_LABELS) as [DayStatus, string][]).map(([key, label]) => {
                const style = STATUS_COLORS[key];
                return (
                  <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${style.bg} ${style.text} ${style.border}`}>
                    <span className="font-mono">{key}</span>
                    <span className="opacity-70">= {label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grouped or Flat View */}
          {groupBy !== 'none' && groupedData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <Layers size={15} className="text-indigo-600 shrink-0" />
                <p className="text-sm text-indigo-700">
                  Grouped by <strong>{GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label}</strong> · {groupedData.length} group{groupedData.length !== 1 ? 's' : ''} · {filtered.length} employees
                </p>
              </div>

              {groupedData.map(([groupName, employees]) => (
                <GroupSummaryRow
                  key={groupName}
                  groupName={groupName}
                  employees={employees}
                  groupBy={groupBy}
                  isExpanded={expandedGroups.has(groupName)}
                  onToggle={() => toggleGroup(groupName)}
                  expandedEmployee={expandedEmployee}
                  onToggleEmployee={(id) => setExpandedEmployee(expandedEmployee === id ? null : id)}
                  dates={dates}
                  activeView={activeView}
                />
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {activeView === 'summary' && (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock size={16} className="text-primary" />
                      <h3 className="font-bold text-sm">Attendance Summary — {period?.name}</h3>
                      <span className="text-xs text-muted-foreground">{filtered.length} records</span>
                    </div>
                    <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline">
                      <Printer size={13} /> Print View
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">Employee</th>
                          <th className="px-4 py-3 font-semibold">Department</th>
                          <th className="px-4 py-3 font-semibold text-center">Working Days</th>
                          <th className="px-4 py-3 font-semibold text-center text-green-700">Present</th>
                          <th className="px-4 py-3 font-semibold text-center text-red-700">Absent</th>
                          <th className="px-4 py-3 font-semibold text-center text-amber-700">Late</th>
                          <th className="px-4 py-3 font-semibold text-center text-orange-700">Half Day</th>
                          <th className="px-4 py-3 font-semibold text-center text-blue-700">Leave</th>
                          <th className="px-4 py-3 font-semibold text-center text-violet-700">Holiday</th>
                          <th className="px-4 py-3 font-semibold text-center text-rose-700">LOP</th>
                          <th className="px-4 py-3 font-semibold text-center">OT Hours</th>
                          <th className="px-4 py-3 font-semibold text-center">Att %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filtered.map((emp, i) => {
                          const attPct = Math.round((emp.presentDays / Math.max(emp.workingDays, 1)) * 100);
                          return (
                            <motion.tr key={emp.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors">
                              <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{i + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">{emp.name.split(' ').map(n => n[0]).join('')}</div>
                                  <div>
                                    <p className="text-sm font-semibold">{emp.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{emp.department}</td>
                              <td className="px-4 py-3 text-center font-semibold text-sm">{emp.workingDays}</td>
                              <td className="px-4 py-3 text-center font-bold text-green-600">{emp.presentDays}</td>
                              <td className="px-4 py-3 text-center font-bold text-red-600">{emp.absentDays}</td>
                              <td className="px-4 py-3 text-center font-bold text-amber-600">{emp.lateDays}</td>
                              <td className="px-4 py-3 text-center font-bold text-orange-600">{emp.halfDays}</td>
                              <td className="px-4 py-3 text-center font-bold text-blue-600">{emp.leaveDays}</td>
                              <td className="px-4 py-3 text-center font-bold text-violet-600">{emp.holidayDays}</td>
                              <td className="px-4 py-3 text-center font-bold text-rose-600">{emp.lopDays}</td>
                              <td className="px-4 py-3 text-center font-bold text-indigo-600">{emp.overtimeHours.toFixed(1)}h</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-12 h-1.5 bg-accent rounded-full">
                                    <div className={`h-full rounded-full ${attPct >= 90 ? 'bg-green-500' : attPct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${attPct}%` }} />
                                  </div>
                                  <span className="text-xs font-bold">{attPct}%</span>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-xs font-bold text-indigo-800 uppercase tracking-wide">Summary — {filtered.length} Employees · {period.name}</td>
                          <td className="px-4 py-4 text-center font-bold text-green-700 text-sm">{filtered.reduce((s, e) => s + e.presentDays, 0)}</td>
                          <td className="px-4 py-4 text-center font-bold text-red-700 text-sm">{filtered.reduce((s, e) => s + e.absentDays, 0)}</td>
                          <td className="px-4 py-4 text-center font-bold text-amber-700 text-sm">{filtered.reduce((s, e) => s + e.lateDays, 0)}</td>
                          <td className="px-4 py-4 text-center font-bold text-orange-700 text-sm">{filtered.reduce((s, e) => s + e.halfDays, 0)}</td>
                          <td className="px-4 py-4 text-center font-bold text-blue-700 text-sm">{filtered.reduce((s, e) => s + e.leaveDays, 0)}</td>
                          <td className="px-4 py-4 text-center font-bold text-violet-700 text-sm">{filtered.reduce((s, e) => s + e.holidayDays, 0)}</td>
                          <td className="px-4 py-4 text-center font-bold text-rose-700 text-sm">{totalLOP}</td>
                          <td className="px-4 py-4 text-center font-bold text-indigo-700 text-sm">{totalOT.toFixed(1)}h</td>
                          <td className="px-4 py-4 text-center font-bold text-indigo-700 text-sm">{avgAttendance}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {activeView === 'daily' && (
                <div className="space-y-4">
                  {filtered.map((emp, empIdx) => {
                    const isExpanded = expandedEmployee === emp.id;
                    const attPct = Math.round((emp.presentDays / Math.max(emp.workingDays, 1)) * 100);
                    return (
                      <motion.div key={emp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: empIdx * 0.04 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}>
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">{emp.name.split(' ').map(n => n[0]).join('')}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm">{emp.name}</p>
                              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{emp.employeeCode}</span>
                              <span className="text-[10px] text-muted-foreground">{emp.department}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex gap-0.5 flex-1 max-w-xs">
                                {emp.dailyEntries.map((entry, di) => {
                                  const style = STATUS_COLORS[entry.status];
                                  return <div key={di} title={`${formatDate(entry.date)}: ${STATUS_LABELS[entry.status]}`} className={`h-3 flex-1 rounded-sm ${style.bg} border ${style.border}`} />;
                                })}
                              </div>
                              <span className={`text-[10px] font-bold ${attPct >= 90 ? 'text-green-600' : attPct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{attPct}%</span>
                            </div>
                          </div>
                          <div className="hidden md:flex items-center gap-3 shrink-0">
                            {[
                              { label: 'P', value: emp.presentDays, color: 'text-green-600' },
                              { label: 'A', value: emp.absentDays, color: 'text-red-600' },
                              { label: 'L', value: emp.leaveDays, color: 'text-blue-600' },
                              { label: 'LOP', value: emp.lopDays, color: 'text-rose-600' },
                            ].map(stat => (
                              <div key={stat.label} className="text-center">
                                <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                                <p className="text-[9px] text-muted-foreground font-medium">{stat.label}</p>
                              </div>
                            ))}
                          </div>
                          <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors shrink-0">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                        {isExpanded && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-border">
                            <div className="p-5">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Daily Attendance — {period.name}</p>
                              <div className="overflow-x-auto">
                                <div className="flex gap-1 min-w-max">
                                  {emp.dailyEntries.map((entry, di) => {
                                    const style = STATUS_COLORS[entry.status];
                                    return (
                                      <div key={di} className={`flex flex-col items-center gap-0.5 w-10 shrink-0 rounded-lg border p-1.5 ${style.bg} ${style.border}`} title={`${formatDate(entry.date)}: ${STATUS_LABELS[entry.status]}`}>
                                        <span className="text-[9px] text-muted-foreground font-medium">{getDayShort(entry.date)}</span>
                                        <span className="text-[11px] font-bold text-muted-foreground">{getDayNum(entry.date)}</span>
                                        <span className={`text-[10px] font-bold ${style.text}`}>{entry.status}</span>
                                        {entry.overtimeHours && entry.overtimeHours > 0 && <span className="text-[8px] text-violet-600 font-bold">+{entry.overtimeHours}h</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                      <Clock size={32} className="text-muted-foreground mx-auto mb-3" />
                      <p className="font-semibold text-muted-foreground">No employees match the selected filters</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}