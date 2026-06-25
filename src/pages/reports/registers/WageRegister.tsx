import React, { useState, useMemo } from 'react';
import { useWageRegister, usePayrollPeriodOptions, useEstablishment, EMPTY_PERIOD_OPTION, type PeriodOption } from '../../../lib/reports';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, ChevronLeft, Search,
  Calendar, Users, TrendingUp, TrendingDown, Wallet, RefreshCw,
  Printer, FileDown, Building2, MapPin, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/Sidebar';
import { useCurrency } from '../../../context/CurrencyContext';
import { toast } from 'react-toastify';

type GroupByOption = 'none' | 'establishment' | 'work-location' | 'department' | 'designation' | 'grade' | 'employee-type';


const DEPARTMENTS = ['All', 'Engineering', 'Marketing', 'Design', 'Sales', 'Human Resources', 'Finance'];

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
  period: PeriodOption,
  groupBy: GroupByOption,
  groupedData: [string, EmpData[]][] | null,
  formatAmount: (n: number) => string,
  est: { name: string; address: string },
): string {
  const groupLabel = GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label ?? 'No Grouping';
  const estName = est.name || 'Establishment';

  const tableHeader = `
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:left;">#</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:left;">Employee</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:left;">Designation</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">Basic</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">HRA</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">Special</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">OT Amt</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">Gross</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#dc2626;">PF</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#dc2626;">ESI</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#dc2626;">PT</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#dc2626;">TDS</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#2563eb;">Net Pay</th>
        <th style="padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;">Signature</th>
      </tr>
    </thead>`;

  const renderRows = (emps: EmpData[], startIdx: number) =>
    emps.map((emp, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;">${startIdx + i + 1}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;"><strong>${emp.name}</strong><br/><span style="color:#6b7280;font-size:8px;">${emp.employeeCode}</span></td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;color:#6b7280;">${emp.designation}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">${formatAmount(emp.basic)}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">${formatAmount(emp.hra)}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">${formatAmount(emp.specialAllowance)}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#16a34a;">${emp.overtimeAmount > 0 ? formatAmount(emp.overtimeAmount) : '—'}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;font-weight:bold;color:#16a34a;">${formatAmount(emp.gross)}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#dc2626;">${formatAmount(emp.pfEmployee)}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#dc2626;">${emp.esiEmployee > 0 ? formatAmount(emp.esiEmployee) : '—'}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#dc2626;">${formatAmount(emp.professionalTax)}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;color:#dc2626;">${emp.tds > 0 ? formatAmount(emp.tds) : '—'}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:right;font-weight:bold;color:#2563eb;">${formatAmount(emp.net)}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-size:9px;text-align:center;"><div style="width:60px;border-bottom:1px dashed #9ca3af;margin:0 auto;height:16px;"></div></td>
      </tr>`).join('');

  const renderSubtotalRow = (emps: EmpData[]) => `
    <tr style="background:#eff6ff;font-weight:bold;">
      <td colspan="3" style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;color:#1d4ed8;">Subtotal (${emps.length} employees)</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#16a34a;">${formatAmount(emps.reduce((s,e)=>s+e.basic,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#16a34a;">${formatAmount(emps.reduce((s,e)=>s+e.hra,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#16a34a;">${formatAmount(emps.reduce((s,e)=>s+e.specialAllowance,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#16a34a;">${formatAmount(emps.reduce((s,e)=>s+e.overtimeAmount,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#16a34a;">${formatAmount(emps.reduce((s,e)=>s+e.gross,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#dc2626;">${formatAmount(emps.reduce((s,e)=>s+e.pfEmployee,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#dc2626;">${formatAmount(emps.reduce((s,e)=>s+e.esiEmployee,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#dc2626;">${formatAmount(emps.reduce((s,e)=>s+e.professionalTax,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#dc2626;">${formatAmount(emps.reduce((s,e)=>s+e.tds,0))}</td>
      <td style="padding:5px 6px;border:1px solid #bfdbfe;font-size:9px;text-align:right;color:#2563eb;">${formatAmount(emps.reduce((s,e)=>s+e.net,0))}</td>
      <td></td>
    </tr>`;

  let bodyContent = '';
  if (groupBy !== 'none' && groupedData) {
    let globalIdx = 0;
    groupedData.forEach(([groupName, emps]) => {
      bodyContent += `
        <div style="margin-bottom:24px;page-break-inside:avoid;">
          <div style="background:#065f46;color:white;padding:8px 12px;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:space-between;">
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
  <title>Wage Register — ${period.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1f2937; background: #f3f4f6; }
    .page { width: 297mm; min-height: 210mm; background: white; margin: 0 auto; padding: 15mm; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; width: 100%; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="background:#065f46;color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
    <span style="font-size:13px;font-weight:600;">💰 Wage Register — ${period.name}${groupBy !== 'none' ? ` (Grouped by ${groupLabel})` : ''}</span>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🖨️ Print / Save PDF</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;">✕ Close</button>
    </div>
  </div>
  <div class="page">
    <div style="border-bottom:3px solid #065f46;padding-bottom:12px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:18px;font-weight:bold;color:#065f46;">${estName}</div>
          ${est.address ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;">${est.address}</div>` : ''}
          <div style="font-size:13px;font-weight:bold;color:#374151;margin-top:4px;">WAGE REGISTER — Form No. 11</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">As per Payment of Wages Act / Minimum Wages Act</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#6b7280;">Pay Period</div>
          <div style="font-size:14px;font-weight:bold;color:#065f46;">${period.name}</div>
          <div style="font-size:10px;color:#6b7280;">${formatDate(period.fromDate)} – ${formatDate(period.toDate)}</div>
          ${groupBy !== 'none' ? `<div style="font-size:10px;color:#7c3aed;margin-top:4px;font-weight:bold;">Grouped by: ${groupLabel}</div>` : ''}
        </div>
      </div>
    </div>
    ${bodyContent}
    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
      <div style="text-align:center;border-top:1px dashed #9ca3af;padding-top:4px;font-size:9px;color:#9ca3af;">Prepared By</div>
      <div style="text-align:center;border-top:1px dashed #9ca3af;padding-top:4px;font-size:9px;color:#9ca3af;">HR / Payroll Manager</div>
      <div style="text-align:center;border-top:1px dashed #9ca3af;padding-top:4px;font-size:9px;color:#9ca3af;">Authorised Signatory</div>
    </div>
    <div style="font-size:9px;color:#9ca3af;text-align:center;margin-top:8px;">This is a computer-generated register. | ${estName} | ${period.name}</div>
  </div>
</body>
</html>`;
}

interface WageGroupProps {
  groupName: string;
  employees: EmpData[];
  groupBy: GroupByOption;
  isExpanded: boolean;
  onToggle: () => void;
  formatAmount: (n: number) => string;
}

const WageGroup = ({ groupName, employees, groupBy, isExpanded, onToggle, formatAmount }: WageGroupProps) => {
  const totalGross = employees.reduce((s, e) => s + e.gross, 0);
  const totalNet = employees.reduce((s, e) => s + e.net, 0);
  const totalDeductions = employees.reduce((s, e) => s + e.totalDeductions, 0);
  const GroupIcon = groupBy === 'establishment' ? Building2 : groupBy === 'work-location' ? MapPin : Users;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 hover:from-emerald-100 hover:to-teal-100 transition-colors">
        <div className="p-2 bg-emerald-100 rounded-lg shrink-0"><GroupIcon size={18} className="text-emerald-600" /></div>
        <div className="flex-1 text-left">
          <p className="font-bold text-sm text-emerald-900">{groupName}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">{employees.length} employee{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-sm font-bold text-green-700">{formatAmount(totalGross)}</p>
            <p className="text-[9px] text-muted-foreground">Gross</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-red-600">{formatAmount(totalDeductions)}</p>
            <p className="text-[9px] text-muted-foreground">Deductions</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-blue-700">{formatAmount(totalNet)}</p>
            <p className="text-[9px] text-muted-foreground">Net Pay</p>
          </div>
        </div>
        <div className="p-1.5 rounded-lg hover:bg-emerald-200 text-emerald-600 transition-colors shrink-0">
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
                    <th className="px-3 py-2.5 font-semibold">Designation</th>
                    <th className="px-3 py-2.5 font-semibold text-green-700">Basic</th>
                    <th className="px-3 py-2.5 font-semibold text-green-700">HRA</th>
                    <th className="px-3 py-2.5 font-semibold text-green-700">Special</th>
                    <th className="px-3 py-2.5 font-semibold text-green-700">OT Amt</th>
                    <th className="px-3 py-2.5 font-semibold text-green-700">Gross</th>
                    <th className="px-3 py-2.5 font-semibold text-red-700">PF</th>
                    <th className="px-3 py-2.5 font-semibold text-red-700">ESI</th>
                    <th className="px-3 py-2.5 font-semibold text-red-700">PT</th>
                    <th className="px-3 py-2.5 font-semibold text-red-700">TDS</th>
                    <th className="px-3 py-2.5 font-semibold text-blue-700">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((emp, i) => (
                    <tr key={emp.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold">{emp.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{emp.designation}</td>
                      <td className="px-3 py-2.5 text-green-700 font-medium">{formatAmount(emp.basic)}</td>
                      <td className="px-3 py-2.5 text-green-700 font-medium">{formatAmount(emp.hra)}</td>
                      <td className="px-3 py-2.5 text-green-700 font-medium">{formatAmount(emp.specialAllowance)}</td>
                      <td className="px-3 py-2.5 text-green-700 font-medium">{emp.overtimeAmount > 0 ? formatAmount(emp.overtimeAmount) : '—'}</td>
                      <td className="px-3 py-2.5 font-bold text-green-700">{formatAmount(emp.gross)}</td>
                      <td className="px-3 py-2.5 text-red-600">{formatAmount(emp.pfEmployee)}</td>
                      <td className="px-3 py-2.5 text-red-600">{emp.esiEmployee > 0 ? formatAmount(emp.esiEmployee) : '—'}</td>
                      <td className="px-3 py-2.5 text-red-600">{formatAmount(emp.professionalTax)}</td>
                      <td className="px-3 py-2.5 text-red-600">{emp.tds > 0 ? formatAmount(emp.tds) : '—'}</td>
                      <td className="px-3 py-2.5 font-bold text-blue-700">{formatAmount(emp.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 border-t border-emerald-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 font-bold text-[10px] text-emerald-700 uppercase tracking-wide">Subtotal ({employees.length})</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">{formatAmount(employees.reduce((s,e)=>s+e.basic,0))}</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">{formatAmount(employees.reduce((s,e)=>s+e.hra,0))}</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">{formatAmount(employees.reduce((s,e)=>s+e.specialAllowance,0))}</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">{formatAmount(employees.reduce((s,e)=>s+e.overtimeAmount,0))}</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">{formatAmount(totalGross)}</td>
                    <td className="px-3 py-2.5 font-bold text-red-600">{formatAmount(employees.reduce((s,e)=>s+e.pfEmployee,0))}</td>
                    <td className="px-3 py-2.5 font-bold text-red-600">{formatAmount(employees.reduce((s,e)=>s+e.esiEmployee,0))}</td>
                    <td className="px-3 py-2.5 font-bold text-red-600">{formatAmount(employees.reduce((s,e)=>s+e.professionalTax,0))}</td>
                    <td className="px-3 py-2.5 font-bold text-red-600">{formatAmount(employees.reduce((s,e)=>s+e.tds,0))}</td>
                    <td className="px-3 py-2.5 font-bold text-blue-700">{formatAmount(totalNet)}</td>
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

export default function WageRegister() {
  const PAYROLL_PERIODS = usePayrollPeriodOptions();
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const period = PAYROLL_PERIODS.find(p => p.id === selectedPeriod) ?? PAYROLL_PERIODS[0] ?? EMPTY_PERIOD_OPTION;
  const est = useEstablishment();
  const SEED_DATA = useWageRegister(period.id);

  const filtered = useMemo(() =>
    SEED_DATA.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeCode.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.department === deptFilter;
      return matchSearch && matchDept;
    }),
    [SEED_DATA, search, deptFilter]
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

  const totalGross = filtered.reduce((s, e) => s + e.gross, 0);
  const totalDeductions = filtered.reduce((s, e) => s + e.totalDeductions, 0);
  const totalNet = filtered.reduce((s, e) => s + e.net, 0);
  const totalPF = filtered.reduce((s, e) => s + e.pfEmployee, 0);

  const resetFilters = () => { setSearch(''); setDeptFilter('All'); };
  const hasFilters = search || deptFilter !== 'All';

  const handlePrint = () => {
    const html = generatePrintHTML(filtered, period, groupBy, groupedData, formatAmount, est);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=1100,height=750,scrollbars=yes');
    if (!win) { toast.error('Popup blocked. Please allow popups for this site.'); URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success('Print view opened. Use Print → Save as PDF to export.');
  };

  const handleExportCSV = () => {
    const headers = ['#', 'Emp Code', 'Name', 'Designation', 'Department', 'Location', 'Grade', 'Emp Type', 'Basic', 'HRA', 'Conveyance', 'Special', 'OT Amount', 'Gross', 'PF', 'ESI', 'PT', 'TDS', 'LOP', 'Other Deductions', 'Net Pay'];
    const rows = filtered.map((emp, i) => [i + 1, emp.employeeCode, emp.name, emp.designation, emp.department, emp.location, emp.grade, emp.employeeType, emp.basic, emp.hra, emp.conveyance, emp.specialAllowance, emp.overtimeAmount, emp.gross, emp.pfEmployee, emp.esiEmployee, emp.professionalTax, emp.tds, emp.lopAmount, emp.otherDeductions, emp.net]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Wage_Register_${period.name.replace(' ', '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Wage Register exported as CSV.');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/registers')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-emerald-100 rounded-lg"><DollarSign size={22} className="text-emerald-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Wage Register</h1>
                <p className="text-xs text-muted-foreground">Form No. 11 — Monthly Wage Register as per Payment of Wages Act</p>
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
            <div className="flex items-center gap-3 mb-4"><Calendar size={16} className="text-primary" /><h2 className="font-bold text-sm">Select Period</h2></div>
            <div className="flex flex-wrap gap-3">
              {PAYROLL_PERIODS.map(p => (
                <button key={p.id} onClick={() => setSelectedPeriod(p.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${selectedPeriod === p.id ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>{p.name}</button>
              ))}
            </div>
            {period && (
              <div className="mt-3 flex items-center gap-4 px-4 py-3 bg-accent/30 rounded-xl border border-border text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(period.fromDate)} → {formatDate(period.toDate)}</span>
                <span className="flex items-center gap-1.5"><Users size={12} /> {filtered.length} employees</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Gross Pay', value: formatAmount(totalGross), color: 'bg-green-100', iconColor: 'text-green-600', icon: TrendingUp },
              { label: 'Total Deductions', value: formatAmount(totalDeductions), color: 'bg-red-100', iconColor: 'text-red-600', icon: TrendingDown },
              { label: 'Total Net Pay', value: formatAmount(totalNet), color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Wallet },
              { label: 'Total PF (Employee)', value: formatAmount(totalPF), color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: DollarSign },
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
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <Layers size={15} className="text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700">Grouped by <strong>{GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label}</strong> · {groupedData.length} group{groupedData.length !== 1 ? 's' : ''} · {filtered.length} employees</p>
              </div>
              {groupedData.map(([groupName, employees]) => (
                <WageGroup key={groupName} groupName={groupName} employees={employees} groupBy={groupBy} isExpanded={expandedGroups.has(groupName)} onToggle={() => toggleGroup(groupName)} formatAmount={formatAmount} />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign size={16} className="text-primary" />
                  <h3 className="font-bold text-sm">Wage Register — {period?.name}</h3>
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
                      <th className="px-3 py-3 font-semibold">Designation</th>
                      <th className="px-3 py-3 font-semibold text-green-700">Basic</th>
                      <th className="px-3 py-3 font-semibold text-green-700">HRA</th>
                      <th className="px-3 py-3 font-semibold text-green-700">Conv.</th>
                      <th className="px-3 py-3 font-semibold text-green-700">Special</th>
                      <th className="px-3 py-3 font-semibold text-green-700">OT Amt</th>
                      <th className="px-3 py-3 font-semibold text-green-700">Gross</th>
                      <th className="px-3 py-3 font-semibold text-red-700">PF</th>
                      <th className="px-3 py-3 font-semibold text-red-700">ESI</th>
                      <th className="px-3 py-3 font-semibold text-red-700">PT</th>
                      <th className="px-3 py-3 font-semibold text-red-700">TDS</th>
                      <th className="px-3 py-3 font-semibold text-red-700">LOP</th>
                      <th className="px-3 py-3 font-semibold text-red-700">Other</th>
                      <th className="px-3 py-3 font-semibold text-blue-700">Net Pay</th>
                      <th className="px-3 py-3 font-semibold">Signature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((emp, i) => (
                      <motion.tr key={emp.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors">
                        <td className="px-3 py-3 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-3"><p className="font-semibold">{emp.name}</p><p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode}</p></td>
                        <td className="px-3 py-3 text-muted-foreground">{emp.designation}</td>
                        <td className="px-3 py-3 text-green-700 font-medium">{formatAmount(emp.basic)}</td>
                        <td className="px-3 py-3 text-green-700 font-medium">{formatAmount(emp.hra)}</td>
                        <td className="px-3 py-3 text-green-700 font-medium">{formatAmount(emp.conveyance)}</td>
                        <td className="px-3 py-3 text-green-700 font-medium">{formatAmount(emp.specialAllowance)}</td>
                        <td className="px-3 py-3 text-green-700 font-medium">{emp.overtimeAmount > 0 ? formatAmount(emp.overtimeAmount) : '—'}</td>
                        <td className="px-3 py-3 font-bold text-green-700">{formatAmount(emp.gross)}</td>
                        <td className="px-3 py-3 text-red-600">{formatAmount(emp.pfEmployee)}</td>
                        <td className="px-3 py-3 text-red-600">{emp.esiEmployee > 0 ? formatAmount(emp.esiEmployee) : '—'}</td>
                        <td className="px-3 py-3 text-red-600">{formatAmount(emp.professionalTax)}</td>
                        <td className="px-3 py-3 text-red-600">{emp.tds > 0 ? formatAmount(emp.tds) : '—'}</td>
                        <td className="px-3 py-3 text-red-600">{emp.lopAmount > 0 ? formatAmount(emp.lopAmount) : '—'}</td>
                        <td className="px-3 py-3 text-red-600">{emp.otherDeductions > 0 ? formatAmount(emp.otherDeductions) : '—'}</td>
                        <td className="px-3 py-3 font-bold text-blue-700">{formatAmount(emp.net)}</td>
                        <td className="px-3 py-3"><div className="w-20 h-6 border-b border-dashed border-gray-300" /></td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-accent/30 border-t-2 border-border">
                    <tr>
                      <td colSpan={3} className="px-3 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total ({filtered.length})</td>
                      <td className="px-3 py-3 font-bold text-green-700">{formatAmount(filtered.reduce((s, e) => s + e.basic, 0))}</td>
                      <td className="px-3 py-3 font-bold text-green-700">{formatAmount(filtered.reduce((s, e) => s + e.hra, 0))}</td>
                      <td className="px-3 py-3 font-bold text-green-700">{formatAmount(filtered.reduce((s, e) => s + e.conveyance, 0))}</td>
                      <td className="px-3 py-3 font-bold text-green-700">{formatAmount(filtered.reduce((s, e) => s + e.specialAllowance, 0))}</td>
                      <td className="px-3 py-3 font-bold text-green-700">{formatAmount(filtered.reduce((s, e) => s + e.overtimeAmount, 0))}</td>
                      <td className="px-3 py-3 font-bold text-green-700">{formatAmount(totalGross)}</td>
                      <td className="px-3 py-3 font-bold text-red-600">{formatAmount(totalPF)}</td>
                      <td className="px-3 py-3 font-bold text-red-600">{formatAmount(filtered.reduce((s, e) => s + e.esiEmployee, 0))}</td>
                      <td className="px-3 py-3 font-bold text-red-600">{formatAmount(filtered.reduce((s, e) => s + e.professionalTax, 0))}</td>
                      <td className="px-3 py-3 font-bold text-red-600">{formatAmount(filtered.reduce((s, e) => s + e.tds, 0))}</td>
                      <td className="px-3 py-3 font-bold text-red-600">{formatAmount(filtered.reduce((s, e) => s + e.lopAmount, 0))}</td>
                      <td className="px-3 py-3 font-bold text-red-600">{formatAmount(filtered.reduce((s, e) => s + e.otherDeductions, 0))}</td>
                      <td className="px-3 py-3 font-bold text-blue-700">{formatAmount(totalNet)}</td>
                      <td />
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