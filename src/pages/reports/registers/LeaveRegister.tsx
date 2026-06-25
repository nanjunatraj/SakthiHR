import React, { useState, useMemo } from 'react';
import { useLeaveRegister, useEstablishment } from '../../../lib/reports';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, ChevronLeft, Search,
  Calendar, Users, CheckCircle2, XCircle, RefreshCw,
  Printer, FileDown, Building2, MapPin, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/Sidebar';
import { toast } from 'react-toastify';

type GroupByOption = 'none' | 'establishment' | 'work-location' | 'department' | 'designation' | 'grade' | 'employee-type';

const DEPARTMENTS = ['All', 'Engineering', 'Marketing', 'Design', 'Sales', 'Human Resources', 'Finance'];
const FINANCIAL_YEARS = ['2025-26', '2024-25', '2023-24'];

const GROUP_BY_OPTIONS: { value: GroupByOption; label: string; icon: React.ElementType }[] = [
  { value: 'none', label: 'No Grouping', icon: Layers },
  { value: 'establishment', label: 'Establishment Wise', icon: Building2 },
  { value: 'work-location', label: 'Work Location Wise', icon: MapPin },
  { value: 'department', label: 'Department Wise', icon: Users },
  { value: 'designation', label: 'Designation Wise', icon: Users },
  { value: 'grade', label: 'Grade Wise', icon: Users },
  { value: 'employee-type', label: 'Employee Type Wise', icon: Users },
];

// Register rows derive from payroll/attendance/leave data — empty until those exist.
const SEED_DATA: any[] = [];

type EmpData = typeof SEED_DATA[0];

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function getGroupKey(emp: EmpData, groupBy: GroupByOption): string {
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

// ─── Print HTML Generator ─────────────────────────────────────────────────────

function generatePrintHTML(
  employees: EmpData[],
  fyFilter: string,
  groupBy: GroupByOption,
  groupedData: [string, EmpData[]][] | null,
  est: { name: string; address: string },
): string {
  const groupLabel = GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label ?? 'No Grouping';
  const estName = est.name || 'Establishment';

  const tableHeader = `
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;" rowspan="2">#</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;" rowspan="2">Employee</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;" rowspan="2">DOJ</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#2563eb;" colspan="3">Casual Leave</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#e11d48;" colspan="3">Sick Leave</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#16a34a;" colspan="3">Earned Leave</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#7c3aed;" colspan="3">Comp Off</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#d97706;" rowspan="2">UL/LOP</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;" rowspan="2">Used</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;" rowspan="2">Balance</th>
      </tr>
      <tr style="background:#f8fafc;">
        <th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#2563eb;">T</th><th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#2563eb;">U</th><th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#2563eb;">B</th>
        <th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#e11d48;">T</th><th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#e11d48;">U</th><th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#e11d48;">B</th>
        <th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#16a34a;">T</th><th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#16a34a;">U</th><th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#16a34a;">B</th>
        <th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#7c3aed;">T</th><th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#7c3aed;">U</th><th style="padding:3px 6px;border:1px solid #e2e8f0;font-size:8px;text-align:center;color:#7c3aed;">B</th>
      </tr>
    </thead>`;

  const renderRows = (emps: EmpData[], startIdx: number) =>
    emps.map((emp, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;">${startIdx + i + 1}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;"><strong>${emp.name}</strong><br/><span style="color:#6b7280;font-size:8px;">${emp.employeeCode}</span></td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;color:#6b7280;">${formatDate(emp.doj)}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#2563eb;">${emp.clTotal}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;font-weight:bold;color:#2563eb;">${emp.clUsed}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#2563eb;">${emp.clBalance}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#e11d48;">${emp.slTotal}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;font-weight:bold;color:#e11d48;">${emp.slUsed}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#e11d48;">${emp.slBalance}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#16a34a;">${emp.elTotal}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;font-weight:bold;color:#16a34a;">${emp.elUsed}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#16a34a;">${emp.elBalance}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#7c3aed;">${emp.coTotal}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;font-weight:bold;color:#7c3aed;">${emp.coUsed}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;color:#7c3aed;">${emp.coBalance}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;font-weight:bold;color:#d97706;">${emp.ulUsed > 0 ? emp.ulUsed : '—'}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;font-weight:bold;color:#e11d48;">${emp.totalUsed}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;font-weight:bold;color:#16a34a;">${emp.totalBalance}</td>
      </tr>`).join('');

  const renderSubtotalRow = (emps: EmpData[]) => `
    <tr style="background:#eff6ff;font-weight:bold;">
      <td colspan="3" style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;color:#1d4ed8;">Subtotal (${emps.length} employees)</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#2563eb;">${emps.reduce((s,e)=>s+e.clTotal,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#2563eb;">${emps.reduce((s,e)=>s+e.clUsed,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#2563eb;">${emps.reduce((s,e)=>s+e.clBalance,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#e11d48;">${emps.reduce((s,e)=>s+e.slTotal,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#e11d48;">${emps.reduce((s,e)=>s+e.slUsed,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#e11d48;">${emps.reduce((s,e)=>s+e.slBalance,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#16a34a;">${emps.reduce((s,e)=>s+e.elTotal,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#16a34a;">${emps.reduce((s,e)=>s+e.elUsed,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#16a34a;">${emps.reduce((s,e)=>s+e.elBalance,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#7c3aed;">${emps.reduce((s,e)=>s+e.coTotal,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#7c3aed;">${emps.reduce((s,e)=>s+e.coUsed,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#7c3aed;">${emps.reduce((s,e)=>s+e.coBalance,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#d97706;">${emps.reduce((s,e)=>s+e.ulUsed,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#e11d48;">${emps.reduce((s,e)=>s+e.totalUsed,0)}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:center;color:#16a34a;">${emps.reduce((s,e)=>s+e.totalBalance,0)}</td>
    </tr>`;

  let bodyContent = '';
  if (groupBy !== 'none' && groupedData) {
    let globalIdx = 0;
    groupedData.forEach(([groupName, emps]) => {
      bodyContent += `
        <div style="margin-bottom:24px;page-break-inside:avoid;">
          <div style="background:#4c1d95;color:white;padding:8px 12px;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:space-between;">
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
  <title>Leave Register — FY ${fyFilter}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1f2937; background: #f3f4f6; }
    .page { width: 297mm; min-height: 210mm; background: white; margin: 0 auto; padding: 15mm; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; width: 100%; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="background:#4c1d95;color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
    <span style="font-size:13px;font-weight:600;">📅 Leave Register — FY ${fyFilter}${groupBy !== 'none' ? ` (Grouped by ${groupLabel})` : ''}</span>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🖨️ Print / Save PDF</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;">✕ Close</button>
    </div>
  </div>
  <div class="page">
    <div style="border-bottom:3px solid #4c1d95;padding-bottom:12px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:18px;font-weight:bold;color:#4c1d95;">${estName}</div>
          ${est.address ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;">${est.address}</div>` : ''}
          <div style="font-size:13px;font-weight:bold;color:#374151;margin-top:4px;">LEAVE REGISTER — Form No. 14</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">As per Factories Act — Leave Card</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#6b7280;">Financial Year</div>
          <div style="font-size:14px;font-weight:bold;color:#4c1d95;">FY ${fyFilter}</div>
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
    <div style="font-size:9px;color:#9ca3af;text-align:center;margin-top:8px;">This is a computer-generated register. | ${estName} | FY ${fyFilter}</div>
  </div>
</body>
</html>`;
}

interface LeaveGroupProps {
  groupName: string;
  employees: EmpData[];
  groupBy: GroupByOption;
  isExpanded: boolean;
  onToggle: () => void;
}

const LeaveGroup = ({ groupName, employees, groupBy, isExpanded, onToggle }: LeaveGroupProps) => {
  const totalUsed = employees.reduce((s, e) => s + e.totalUsed, 0);
  const totalBalance = employees.reduce((s, e) => s + e.totalBalance, 0);
  const GroupIcon = groupBy === 'establishment' ? Building2 : groupBy === 'work-location' ? MapPin : Users;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100 hover:from-violet-100 hover:to-purple-100 transition-colors">
        <div className="p-2 bg-violet-100 rounded-lg shrink-0"><GroupIcon size={18} className="text-violet-600" /></div>
        <div className="flex-1 text-left">
          <p className="font-bold text-sm text-violet-900">{groupName}</p>
          <p className="text-[10px] text-violet-600 mt-0.5">{employees.length} employee{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-sm font-bold text-rose-600">{totalUsed}d</p>
            <p className="text-[9px] text-muted-foreground">Total Used</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-green-600">{totalBalance}d</p>
            <p className="text-[9px] text-muted-foreground">Balance</p>
          </div>
        </div>
        <div className="p-1.5 rounded-lg hover:bg-violet-200 text-violet-600 transition-colors shrink-0">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">#</th>
                    <th className="px-3 py-2.5 font-semibold">Employee</th>
                    <th className="px-3 py-2.5 font-semibold">DOJ</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-blue-700" colSpan={3}>CL</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-rose-700" colSpan={3}>SL</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-emerald-700" colSpan={3}>EL</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-violet-700" colSpan={3}>CO</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-amber-700">UL</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Used</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Bal</th>
                  </tr>
                  <tr className="bg-accent/20">
                    <th colSpan={3} />
                    <th className="px-2 py-1 text-center text-[9px] text-blue-600">T</th><th className="px-2 py-1 text-center text-[9px] text-blue-600">U</th><th className="px-2 py-1 text-center text-[9px] text-blue-600">B</th>
                    <th className="px-2 py-1 text-center text-[9px] text-rose-600">T</th><th className="px-2 py-1 text-center text-[9px] text-rose-600">U</th><th className="px-2 py-1 text-center text-[9px] text-rose-600">B</th>
                    <th className="px-2 py-1 text-center text-[9px] text-emerald-600">T</th><th className="px-2 py-1 text-center text-[9px] text-emerald-600">U</th><th className="px-2 py-1 text-center text-[9px] text-emerald-600">B</th>
                    <th className="px-2 py-1 text-center text-[9px] text-violet-600">T</th><th className="px-2 py-1 text-center text-[9px] text-violet-600">U</th><th className="px-2 py-1 text-center text-[9px] text-violet-600">B</th>
                    <th /><th /><th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((emp, i) => (
                    <tr key={emp.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5"><p className="font-semibold">{emp.name}</p><p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode}</p></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(emp.doj)}</td>
                      <td className="px-2 py-2.5 text-center text-blue-600">{emp.clTotal}</td>
                      <td className="px-2 py-2.5 text-center font-semibold text-blue-700">{emp.clUsed}</td>
                      <td className="px-2 py-2.5 text-center text-blue-600">{emp.clBalance}</td>
                      <td className="px-2 py-2.5 text-center text-rose-600">{emp.slTotal}</td>
                      <td className="px-2 py-2.5 text-center font-semibold text-rose-700">{emp.slUsed}</td>
                      <td className="px-2 py-2.5 text-center text-rose-600">{emp.slBalance}</td>
                      <td className="px-2 py-2.5 text-center text-emerald-600">{emp.elTotal}</td>
                      <td className="px-2 py-2.5 text-center font-semibold text-emerald-700">{emp.elUsed}</td>
                      <td className="px-2 py-2.5 text-center text-emerald-600">{emp.elBalance}</td>
                      <td className="px-2 py-2.5 text-center text-violet-600">{emp.coTotal}</td>
                      <td className="px-2 py-2.5 text-center font-semibold text-violet-700">{emp.coUsed}</td>
                      <td className="px-2 py-2.5 text-center text-violet-600">{emp.coBalance}</td>
                      <td className="px-2 py-2.5 text-center font-semibold text-amber-600">{emp.ulUsed > 0 ? emp.ulUsed : '—'}</td>
                      <td className="px-2 py-2.5 text-center font-bold text-rose-700">{emp.totalUsed}</td>
                      <td className="px-2 py-2.5 text-center font-bold text-green-700">{emp.totalBalance}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-violet-50 border-t border-violet-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 font-bold text-[10px] text-violet-700 uppercase tracking-wide">Subtotal ({employees.length})</td>
                    <td className="px-2 py-2.5 text-center font-bold text-blue-600">{employees.reduce((s,e)=>s+e.clTotal,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-blue-700">{employees.reduce((s,e)=>s+e.clUsed,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-blue-600">{employees.reduce((s,e)=>s+e.clBalance,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-rose-600">{employees.reduce((s,e)=>s+e.slTotal,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-rose-700">{employees.reduce((s,e)=>s+e.slUsed,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-rose-600">{employees.reduce((s,e)=>s+e.slBalance,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-emerald-600">{employees.reduce((s,e)=>s+e.elTotal,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-emerald-700">{employees.reduce((s,e)=>s+e.elUsed,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-emerald-600">{employees.reduce((s,e)=>s+e.elBalance,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-violet-600">{employees.reduce((s,e)=>s+e.coTotal,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-violet-700">{employees.reduce((s,e)=>s+e.coUsed,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-violet-600">{employees.reduce((s,e)=>s+e.coBalance,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-amber-600">{employees.reduce((s,e)=>s+e.ulUsed,0)}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-rose-700">{totalUsed}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-green-700">{totalBalance}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function LeaveRegister() {
  const SEED_DATA = useLeaveRegister();
  const est = useEstablishment();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [fyFilter, setFyFilter] = useState('2025-26');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filtered = useMemo(() =>
    SEED_DATA.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeCode.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.department === deptFilter;
      return matchSearch && matchDept;
    }),
    [search, deptFilter]
  );

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, EmpData[]>();
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
      if (next.has(groupName)) next.delete(groupName); else next.add(groupName);
      return next;
    });
  };

  const totalUsed = filtered.reduce((s, e) => s + e.totalUsed, 0);
  const totalBalance = filtered.reduce((s, e) => s + e.totalBalance, 0);
  const totalUL = filtered.reduce((s, e) => s + e.ulUsed, 0);

  const resetFilters = () => { setSearch(''); setDeptFilter('All'); };
  const hasFilters = search || deptFilter !== 'All';

  const handlePrint = () => {
    const html = generatePrintHTML(filtered, fyFilter, groupBy, groupedData, est);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=1100,height=750,scrollbars=yes');
    if (!win) { toast.error('Popup blocked. Please allow popups for this site.'); URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success('Print view opened. Use Print → Save as PDF to export.');
  };

  const handleExportCSV = () => {
    const headers = ['#', 'Emp Code', 'Name', 'Department', 'Location', 'Grade', 'Emp Type', 'DOJ', 'CL Total', 'CL Used', 'CL Balance', 'SL Total', 'SL Used', 'SL Balance', 'EL Total', 'EL Used', 'EL Balance', 'CO Total', 'CO Used', 'CO Balance', 'UL/LOP', 'Total Used', 'Total Balance'];
    const rows = filtered.map((emp, i) => [i + 1, emp.employeeCode, emp.name, emp.department, emp.location, emp.grade, emp.employeeType, formatDate(emp.doj), emp.clTotal, emp.clUsed, emp.clBalance, emp.slTotal, emp.slUsed, emp.slBalance, emp.elTotal, emp.elUsed, emp.elBalance, emp.coTotal, emp.coUsed, emp.coBalance, emp.ulUsed, emp.totalUsed, emp.totalBalance]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Leave_Register_FY_${fyFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Leave Register exported as CSV.');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/registers')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-violet-100 rounded-lg"><CalendarDays size={22} className="text-violet-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Leave Register</h1>
                <p className="text-xs text-muted-foreground">Form No. 14 — Leave Card as per Factories Act</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"><Printer size={15} /> Print / PDF</button>
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground"><FileDown size={15} /> Export CSV</button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4"><Calendar size={16} className="text-primary" /><h2 className="font-bold text-sm">Financial Year</h2></div>
            <div className="flex flex-wrap gap-3">
              {FINANCIAL_YEARS.map(fy => (
                <button key={fy} onClick={() => setFyFilter(fy)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${fyFilter === fy ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>FY {fy}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Employees', value: filtered.length, color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Users },
              { label: 'Total Leave Used', value: `${totalUsed}d`, color: 'bg-rose-100', iconColor: 'text-rose-600', icon: CalendarDays },
              { label: 'Total Balance', value: `${totalBalance}d`, color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Unpaid Leave (LOP)', value: `${totalUL}d`, color: 'bg-amber-100', iconColor: 'text-amber-600', icon: XCircle },
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

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input type="text" placeholder="Search by name or employee code..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
              {hasFilters && <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><RefreshCw size={12} /> Reset</button>}
              <div className="ml-auto text-xs text-muted-foreground">{filtered.length} employees</div>
            </div>
            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Layers size={13} /> Group By:</span>
              <div className="flex flex-wrap gap-2">
                {GROUP_BY_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isActive = groupBy === opt.value;
                  return (
                    <button key={opt.value} onClick={() => { setGroupBy(opt.value); setExpandedGroups(new Set()); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-accent text-muted-foreground border-border hover:border-primary/40'}`}>
                      <Icon size={11} />{opt.label}
                    </button>
                  );
                })}
              </div>
              {groupBy !== 'none' && groupedData && (
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => setExpandedGroups(new Set(groupedData.map(([k]) => k)))} className="text-xs text-primary hover:underline font-medium">Expand All</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={() => setExpandedGroups(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Collapse All</button>
                </div>
              )}
            </div>
          </div>

          {groupBy !== 'none' && groupedData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl">
                <Layers size={15} className="text-violet-600 shrink-0" />
                <p className="text-sm text-violet-700">Grouped by <strong>{GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label}</strong> · {groupedData.length} group{groupedData.length !== 1 ? 's' : ''} · {filtered.length} employees</p>
              </div>
              {groupedData.map(([groupName, employees]) => (
                <LeaveGroup key={groupName} groupName={groupName} employees={employees} groupBy={groupBy} isExpanded={expandedGroups.has(groupName)} onToggle={() => toggleGroup(groupName)} />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarDays size={16} className="text-primary" />
                  <h3 className="font-bold text-sm">Leave Register — FY {fyFilter}</h3>
                  <span className="text-xs text-muted-foreground">{filtered.length} records</span>
                </div>
                <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"><Printer size={13} /> Print View</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3 font-semibold">#</th>
                      <th className="px-3 py-3 font-semibold">Employee</th>
                      <th className="px-3 py-3 font-semibold">Dept</th>
                      <th className="px-3 py-3 font-semibold">DOJ</th>
                      <th className="px-3 py-3 font-semibold text-center text-blue-700" colSpan={3}>Casual Leave</th>
                      <th className="px-3 py-3 font-semibold text-center text-rose-700" colSpan={3}>Sick Leave</th>
                      <th className="px-3 py-3 font-semibold text-center text-emerald-700" colSpan={3}>Earned Leave</th>
                      <th className="px-3 py-3 font-semibold text-center text-violet-700" colSpan={3}>Comp Off</th>
                      <th className="px-3 py-3 font-semibold text-center text-amber-700">UL/LOP</th>
                      <th className="px-3 py-3 font-semibold text-center">Total Used</th>
                      <th className="px-3 py-3 font-semibold text-center">Balance</th>
                    </tr>
                    <tr className="bg-accent/30">
                      <th colSpan={4} />
                      <th className="px-2 py-1.5 text-center text-[10px] text-blue-600">Tot</th><th className="px-2 py-1.5 text-center text-[10px] text-blue-600">Used</th><th className="px-2 py-1.5 text-center text-[10px] text-blue-600">Bal</th>
                      <th className="px-2 py-1.5 text-center text-[10px] text-rose-600">Tot</th><th className="px-2 py-1.5 text-center text-[10px] text-rose-600">Used</th><th className="px-2 py-1.5 text-center text-[10px] text-rose-600">Bal</th>
                      <th className="px-2 py-1.5 text-center text-[10px] text-emerald-600">Tot</th><th className="px-2 py-1.5 text-center text-[10px] text-emerald-600">Used</th><th className="px-2 py-1.5 text-center text-[10px] text-emerald-600">Bal</th>
                      <th className="px-2 py-1.5 text-center text-[10px] text-violet-600">Tot</th><th className="px-2 py-1.5 text-center text-[10px] text-violet-600">Used</th><th className="px-2 py-1.5 text-center text-[10px] text-violet-600">Bal</th>
                      <th /><th /><th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((emp, i) => (
                      <motion.tr key={emp.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors">
                        <td className="px-3 py-3 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-3"><p className="font-semibold">{emp.name}</p><p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode}</p></td>
                        <td className="px-3 py-3 text-muted-foreground">{emp.department}</td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDate(emp.doj)}</td>
                        <td className="px-2 py-3 text-center text-blue-600">{emp.clTotal}</td>
                        <td className="px-2 py-3 text-center font-semibold text-blue-700">{emp.clUsed}</td>
                        <td className="px-2 py-3 text-center text-blue-600">{emp.clBalance}</td>
                        <td className="px-2 py-3 text-center text-rose-600">{emp.slTotal}</td>
                        <td className="px-2 py-3 text-center font-semibold text-rose-700">{emp.slUsed}</td>
                        <td className="px-2 py-3 text-center text-rose-600">{emp.slBalance}</td>
                        <td className="px-2 py-3 text-center text-emerald-600">{emp.elTotal}</td>
                        <td className="px-2 py-3 text-center font-semibold text-emerald-700">{emp.elUsed}</td>
                        <td className="px-2 py-3 text-center text-emerald-600">{emp.elBalance}</td>
                        <td className="px-2 py-3 text-center text-violet-600">{emp.coTotal}</td>
                        <td className="px-2 py-3 text-center font-semibold text-violet-700">{emp.coUsed}</td>
                        <td className="px-2 py-3 text-center text-violet-600">{emp.coBalance}</td>
                        <td className="px-2 py-3 text-center font-semibold text-amber-600">{emp.ulUsed > 0 ? emp.ulUsed : '—'}</td>
                        <td className="px-2 py-3 text-center font-bold text-rose-700">{emp.totalUsed}</td>
                        <td className="px-2 py-3 text-center font-bold text-green-700">{emp.totalBalance}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-accent/30 border-t-2 border-border">
                    <tr>
                      <td colSpan={4} className="px-3 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total ({filtered.length})</td>
                      <td className="px-2 py-3 text-center font-bold text-blue-600">{filtered.reduce((s, e) => s + e.clTotal, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-blue-700">{filtered.reduce((s, e) => s + e.clUsed, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-blue-600">{filtered.reduce((s, e) => s + e.clBalance, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-rose-600">{filtered.reduce((s, e) => s + e.slTotal, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-rose-700">{filtered.reduce((s, e) => s + e.slUsed, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-rose-600">{filtered.reduce((s, e) => s + e.slBalance, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-emerald-600">{filtered.reduce((s, e) => s + e.elTotal, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-emerald-700">{filtered.reduce((s, e) => s + e.elUsed, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-emerald-600">{filtered.reduce((s, e) => s + e.elBalance, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-violet-600">{filtered.reduce((s, e) => s + e.coTotal, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-violet-700">{filtered.reduce((s, e) => s + e.coUsed, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-violet-600">{filtered.reduce((s, e) => s + e.coBalance, 0)}</td>
                      <td className="px-2 py-3 text-center font-bold text-amber-600">{totalUL}</td>
                      <td className="px-2 py-3 text-center font-bold text-rose-700">{totalUsed}</td>
                      <td className="px-2 py-3 text-center font-bold text-green-700">{totalBalance}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}