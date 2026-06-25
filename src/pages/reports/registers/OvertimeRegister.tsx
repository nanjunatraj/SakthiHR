import React, { useState, useMemo } from 'react';
import { useOvertimeRegister, usePayrollPeriodOptions, EMPTY_PERIOD_OPTION, type PeriodOption } from '../../../lib/reports';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, ChevronLeft, Search,
  Calendar, Users, Clock, DollarSign, RefreshCw, AlertCircle,
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

interface OTGroupProps {
  groupName: string;
  employees: EmpData[];
  groupBy: GroupByOption;
  isExpanded: boolean;
  onToggle: () => void;
  formatAmount: (n: number) => string;
}

const OTGroup = ({ groupName, employees, groupBy, isExpanded, onToggle, formatAmount }: OTGroupProps) => {
  const totalOTHours = employees.reduce((s, e) => s + e.otHours, 0);
  const totalOTAmount = employees.reduce((s, e) => s + e.otAmount, 0);
  const GroupIcon = groupBy === 'establishment' ? Building2 : groupBy === 'work-location' ? MapPin : Users;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 hover:from-amber-100 hover:to-orange-100 transition-colors">
        <div className="p-2 bg-amber-100 rounded-lg shrink-0"><GroupIcon size={18} className="text-amber-600" /></div>
        <div className="flex-1 text-left">
          <p className="font-bold text-sm text-amber-900">{groupName}</p>
          <p className="text-[10px] text-amber-600 mt-0.5">{employees.length} employee{employees.length !== 1 ? 's' : ''} with OT</p>
        </div>
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-sm font-bold text-amber-700">{totalOTHours.toFixed(1)}h</p>
            <p className="text-[9px] text-muted-foreground">OT Hours</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-green-700">{formatAmount(totalOTAmount)}</p>
            <p className="text-[9px] text-muted-foreground">OT Amount</p>
          </div>
        </div>
        <div className="p-1.5 rounded-lg hover:bg-amber-200 text-amber-600 transition-colors shrink-0">
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
                    <th className="px-3 py-2.5 font-semibold">Shift</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Normal Hrs</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-amber-700">OT Days</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-amber-700">OT Hours</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Total Hrs</th>
                    <th className="px-3 py-2.5 font-semibold text-center">OT Rate</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-green-700">OT Amount</th>
                    <th className="px-3 py-2.5 font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((emp, i) => (
                    <tr key={emp.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5"><p className="font-semibold">{emp.name}</p><p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode}</p></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{emp.shift}</td>
                      <td className="px-3 py-2.5 text-center font-medium">{emp.normalHours}h</td>
                      <td className="px-3 py-2.5 text-center font-bold text-amber-600">{emp.otDays}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-amber-700">{emp.otHours}h</td>
                      <td className="px-3 py-2.5 text-center font-bold text-indigo-600">{emp.totalHours}h</td>
                      <td className="px-3 py-2.5 text-center"><span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{emp.otRate}×</span></td>
                      <td className="px-3 py-2.5 text-center font-bold text-green-700">{formatAmount(emp.otAmount)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground italic">{emp.remarks}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-amber-50 border-t border-amber-200">
                  <tr>
                    <td colSpan={4} className="px-3 py-2.5 font-bold text-[10px] text-amber-700 uppercase tracking-wide">Group Total</td>
                    <td className="px-3 py-2.5 text-center font-bold text-amber-600">{employees.reduce((s,e)=>s+e.otDays,0)}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-amber-700">{totalOTHours.toFixed(1)}h</td>
                    <td className="px-3 py-2.5 text-center font-bold text-indigo-600">{employees.reduce((s,e)=>s+e.totalHours,0).toFixed(1)}h</td>
                    <td />
                    <td className="px-3 py-2.5 text-center font-bold text-green-700">{formatAmount(totalOTAmount)}</td>
                    <td />
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

export default function OvertimeRegister() {
  const PAYROLL_PERIODS = usePayrollPeriodOptions();
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const period = PAYROLL_PERIODS.find(p => p.id === selectedPeriod) ?? PAYROLL_PERIODS[0] ?? EMPTY_PERIOD_OPTION;
  const SEED_DATA = useOvertimeRegister(period.fromDate, period.toDate, period.id);

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

  const totalOTHours = filtered.reduce((s, e) => s + e.otHours, 0);
  const totalOTAmount = filtered.reduce((s, e) => s + e.otAmount, 0);
  const totalOTDays = filtered.reduce((s, e) => s + e.otDays, 0);

  const resetFilters = () => { setSearch(''); setDeptFilter('All'); };
  const hasFilters = search || deptFilter !== 'All';

  const handlePrint = () => { toast.success('Print view opened. Use Print → Save as PDF to export.'); };

  const handleExportCSV = () => {
    const headers = ['#', 'Emp Code', 'Name', 'Department', 'Location', 'Grade', 'Emp Type', 'Shift', 'Normal Hours', 'OT Days', 'OT Hours', 'Total Hours', 'Basic/Day', 'OT Rate', 'OT Amount', 'Remarks'];
    const rows = filtered.map((emp, i) => [i + 1, emp.employeeCode, emp.name, emp.department, emp.location, emp.grade, emp.employeeType, emp.shift, emp.normalHours, emp.otDays, emp.otHours, emp.totalHours, emp.basicPerDay, `${emp.otRate}x`, emp.otAmount, emp.remarks]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Overtime_Register_${period.name.replace(' ', '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Overtime Register exported as CSV.');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/registers')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-amber-100 rounded-lg"><TrendingUp size={22} className="text-amber-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Overtime Register</h1>
                <p className="text-xs text-muted-foreground">Form No. 26 — Overtime Register as per Factories Act (Section 59)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"><Printer size={15} /> Print / PDF</button>
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground"><FileDown size={15} /> Export CSV</button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle size={17} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Factories Act — Overtime Limits</p>
              <p className="text-xs text-amber-700 mt-0.5">As per Section 59 of the Factories Act, 1948, overtime wages must be paid at twice the ordinary rate. No worker shall work overtime for more than 50 hours in any quarter.</p>
            </div>
          </div>

          {/* Period Selector */}
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
                <span className="flex items-center gap-1.5"><Users size={12} /> {filtered.length} employees with OT</span>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Employees with OT', value: filtered.length, color: 'bg-amber-100', iconColor: 'text-amber-600', icon: Users },
              { label: 'Total OT Days', value: `${totalOTDays}d`, color: 'bg-orange-100', iconColor: 'text-orange-600', icon: Calendar },
              { label: 'Total OT Hours', value: `${totalOTHours.toFixed(1)}h`, color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Clock },
              { label: 'Total OT Amount', value: formatAmount(totalOTAmount), color: 'bg-green-100', iconColor: 'text-green-600', icon: DollarSign },
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
              {hasFilters && <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><RefreshCw size={12} /> Reset</button>}
              <div className="ml-auto text-xs text-muted-foreground">{filtered.length} records</div>
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

          {/* Grouped or Flat View */}
          {groupBy !== 'none' && groupedData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Layers size={15} className="text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700">Grouped by <strong>{GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label}</strong> · {groupedData.length} group{groupedData.length !== 1 ? 's' : ''} · {filtered.length} employees</p>
              </div>
              {groupedData.map(([groupName, employees]) => (
                <OTGroup key={groupName} groupName={groupName} employees={employees} groupBy={groupBy} isExpanded={expandedGroups.has(groupName)} onToggle={() => toggleGroup(groupName)} formatAmount={formatAmount} />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp size={16} className="text-primary" />
                  <h3 className="font-bold text-sm">Overtime Register — {period?.name}</h3>
                  <span className="text-xs text-muted-foreground">{filtered.length} records</span>
                </div>
                <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"><Printer size={13} /> Print View</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Department</th>
                      <th className="px-4 py-3 font-semibold">Shift</th>
                      <th className="px-4 py-3 font-semibold text-center">Normal Hours</th>
                      <th className="px-4 py-3 font-semibold text-center text-amber-700">OT Days</th>
                      <th className="px-4 py-3 font-semibold text-center text-amber-700">OT Hours</th>
                      <th className="px-4 py-3 font-semibold text-center">Total Hours</th>
                      <th className="px-4 py-3 font-semibold text-center">Basic/Day</th>
                      <th className="px-4 py-3 font-semibold text-center">OT Rate</th>
                      <th className="px-4 py-3 font-semibold text-center text-green-700">OT Amount</th>
                      <th className="px-4 py-3 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((emp, i) => (
                      <motion.tr key={emp.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-4 py-3"><p className="font-semibold">{emp.name}</p><p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode}</p></td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.shift}</td>
                        <td className="px-4 py-3 text-center font-medium">{emp.normalHours}h</td>
                        <td className="px-4 py-3 text-center font-bold text-amber-600">{emp.otDays}</td>
                        <td className="px-4 py-3 text-center font-bold text-amber-700">{emp.otHours}h</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600">{emp.totalHours}h</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{formatAmount(emp.basicPerDay)}</td>
                        <td className="px-4 py-3 text-center"><span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{emp.otRate}× Rate</span></td>
                        <td className="px-4 py-3 text-center font-bold text-green-700">{formatAmount(emp.otAmount)}</td>
                        <td className="px-4 py-3 text-muted-foreground italic">{emp.remarks}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-accent/30 border-t-2 border-border">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total ({filtered.length})</td>
                      <td className="px-4 py-3 text-center font-bold">{filtered.reduce((s, e) => s + e.normalHours, 0)}h</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600">{totalOTDays}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">{totalOTHours.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-center font-bold text-indigo-600">{filtered.reduce((s, e) => s + e.totalHours, 0).toFixed(1)}h</td>
                      <td colSpan={2} />
                      <td className="px-4 py-3 text-center font-bold text-green-700">{formatAmount(totalOTAmount)}</td>
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