import React, { useState, useMemo } from 'react';
import { usePayrollPeriodOptions, useFinesDeductionsRegister, EMPTY_PERIOD_OPTION, type PeriodOption } from '../../../lib/reports';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MinusCircle, ChevronLeft, Search,
  Calendar, Users, DollarSign, RefreshCw, AlertCircle,
  CheckCircle2, XCircle, Clock, ThumbsUp, ThumbsDown,
  Printer, FileDown, Building2, MapPin, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/Sidebar';
import { useCurrency } from '../../../context/CurrencyContext';
import { toast } from 'react-toastify';

type GroupByOption = 'none' | 'establishment' | 'work-location' | 'department' | 'designation' | 'grade' | 'employee-type';
type DeductionStatus = 'Draft' | 'Applied' | 'Pending Employee Approval' | 'Approved by Employee' | 'Rejected by Employee';


const DEPARTMENTS = ['All', 'Engineering', 'Marketing', 'Design', 'Sales', 'Human Resources', 'Finance'];
const CATEGORIES = ['All', 'Fines', 'Damages & Loss', 'Canteen', 'Society', 'Donations / Campaign', 'Other Deductions'];

const GROUP_BY_OPTIONS: { value: GroupByOption; label: string; icon: React.ElementType }[] = [
  { value: 'none', label: 'No Grouping', icon: Layers },
  { value: 'establishment', label: 'Establishment Wise', icon: Building2 },
  { value: 'work-location', label: 'Work Location Wise', icon: MapPin },
  { value: 'department', label: 'Department Wise', icon: Users },
  { value: 'designation', label: 'Designation Wise', icon: Users },
  { value: 'grade', label: 'Grade Wise', icon: Users },
  { value: 'employee-type', label: 'Employee Type Wise', icon: Users },
];

const STATUS_STYLES: Record<DeductionStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  'Draft': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: Clock },
  'Applied': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle2 },
  'Pending Employee Approval': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  'Approved by Employee': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: ThumbsUp },
  'Rejected by Employee': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: ThumbsDown },
};
const statusStyleOf = (s: string) => STATUS_STYLES[s as DeductionStatus] ?? STATUS_STYLES['Draft'];

const SEED_DATA: {
  id: string; employeeCode: string; name: string; department: string; designation: string;
  location: string; grade: string; employeeType: string; establishment: string;
  category: string; description: string; amount: number; referenceNo: string;
  payrollPeriod: string; status: DeductionStatus; issuedBy: string; issuedOn: string;
  employeeResponse?: string; remarks: string;
}[] = [];

type EntryData = typeof SEED_DATA[0];

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function getGroupKey(entry: EntryData, groupBy: GroupByOption): string {
  switch (groupBy) {
    case 'establishment': return entry.establishment;
    case 'work-location': return entry.location;
    case 'department': return entry.department;
    case 'designation': return entry.designation;
    case 'grade': return entry.grade;
    case 'employee-type': return entry.employeeType;
    default: return 'All Entries';
  }
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Fines': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  'Damages & Loss': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  'Canteen': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  'Society': { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  'Donations / Campaign': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  'Other Deductions': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
};

interface FinesGroupProps {
  groupName: string;
  entries: EntryData[];
  groupBy: GroupByOption;
  isExpanded: boolean;
  onToggle: () => void;
  formatAmount: (n: number) => string;
}

const FinesGroup = ({ groupName, entries, groupBy, isExpanded, onToggle, formatAmount }: FinesGroupProps) => {
  const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
  const appliedAmount = entries.filter(e => e.status === 'Applied').reduce((s, e) => s + e.amount, 0);
  const GroupIcon = groupBy === 'establishment' ? Building2 : groupBy === 'work-location' ? MapPin : Users;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-rose-50 to-red-50 border-b border-rose-100 hover:from-rose-100 hover:to-red-100 transition-colors">
        <div className="p-2 bg-rose-100 rounded-lg shrink-0"><GroupIcon size={18} className="text-rose-600" /></div>
        <div className="flex-1 text-left">
          <p className="font-bold text-sm text-rose-900">{groupName}</p>
          <p className="text-[10px] text-rose-600 mt-0.5">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-sm font-bold text-rose-700">{formatAmount(totalAmount)}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-green-700">{formatAmount(appliedAmount)}</p>
            <p className="text-[9px] text-muted-foreground">Applied</p>
          </div>
        </div>
        <div className="p-1.5 rounded-lg hover:bg-rose-200 text-rose-600 transition-colors shrink-0">
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
                    <th className="px-3 py-2.5 font-semibold">Category</th>
                    <th className="px-3 py-2.5 font-semibold">Description</th>
                    <th className="px-3 py-2.5 font-semibold">Reference No.</th>
                    <th className="px-3 py-2.5 font-semibold">Issued By</th>
                    <th className="px-3 py-2.5 font-semibold">Issued On</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-rose-700">Amount</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry, i) => {
                    const catStyle = CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS['Other Deductions'];
                    const statusStyle = statusStyleOf(entry.status);
                    const StatusIcon = statusStyle.icon;
                    return (
                      <tr key={entry.id} className="hover:bg-accent/20 transition-colors">
                        <td className="px-3 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-2.5"><p className="font-semibold">{entry.name}</p><p className="text-[10px] text-muted-foreground font-mono">{entry.employeeCode}</p></td>
                        <td className="px-3 py-2.5"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>{entry.category}</span></td>
                        <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate">{entry.description}</td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{entry.referenceNo}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{entry.issuedBy}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatDate(entry.issuedOn)}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-rose-700">{formatAmount(entry.amount)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                            <StatusIcon size={9} />
                            {entry.status === 'Pending Employee Approval' ? 'Pending' : entry.status === 'Approved by Employee' ? 'Emp. Approved' : entry.status === 'Rejected by Employee' ? 'Emp. Rejected' : entry.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-rose-50 border-t border-rose-200">
                  <tr>
                    <td colSpan={7} className="px-3 py-2.5 font-bold text-[10px] text-rose-700 uppercase tracking-wide">Group Total ({entries.length} entries)</td>
                    <td className="px-3 py-2.5 text-center font-bold text-rose-700">{formatAmount(totalAmount)}</td>
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

export default function FinesDeductionsRegister() {
  const PAYROLL_PERIODS = usePayrollPeriodOptions();
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<DeductionStatus | 'All'>('All');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const period = PAYROLL_PERIODS.find(p => p.id === selectedPeriod) ?? PAYROLL_PERIODS[0] ?? EMPTY_PERIOD_OPTION;
  const REG_DATA = useFinesDeductionsRegister(period.id);

  const filtered = useMemo(() =>
    REG_DATA.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeCode.toLowerCase().includes(search.toLowerCase()) || e.referenceNo.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.department === deptFilter;
      const matchCat = categoryFilter === 'All' || e.category === categoryFilter;
      const matchStatus = statusFilter === 'All' || e.status === statusFilter;
      return matchSearch && matchDept && matchCat && matchStatus;
    }),
    [REG_DATA, search, deptFilter, categoryFilter, statusFilter]
  );

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, EntryData[]>();
    filtered.forEach(entry => {
      const key = getGroupKey(entry, groupBy);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
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

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
  const appliedAmount = filtered.filter(e => e.status === 'Applied').reduce((s, e) => s + e.amount, 0);
  const pendingAmount = filtered.filter(e => e.status === 'Pending Employee Approval').reduce((s, e) => s + e.amount, 0);
  const rejectedAmount = filtered.filter(e => e.status === 'Rejected by Employee').reduce((s, e) => s + e.amount, 0);

  const resetFilters = () => { setSearch(''); setDeptFilter('All'); setCategoryFilter('All'); setStatusFilter('All'); };
  const hasFilters = search || deptFilter !== 'All' || categoryFilter !== 'All' || statusFilter !== 'All';

  const handlePrint = () => { toast.success('Print view opened. Use Print → Save as PDF to export.'); };

  const handleExportCSV = () => {
    const headers = ['#', 'Emp Code', 'Name', 'Department', 'Location', 'Grade', 'Emp Type', 'Category', 'Description', 'Reference No.', 'Issued By', 'Issued On', 'Amount', 'Status', 'Employee Response', 'Remarks'];
    const rows = filtered.map((entry, i) => [i + 1, entry.employeeCode, entry.name, entry.department, entry.location, entry.grade, entry.employeeType, entry.category, entry.description, entry.referenceNo, entry.issuedBy, formatDate(entry.issuedOn), entry.amount, entry.status, entry.employeeResponse ?? '', entry.remarks]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fines_Deductions_Register_${period.name.replace(' ', '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Fines & Deductions Register exported as CSV.');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/registers')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-rose-100 rounded-lg"><MinusCircle size={22} className="text-rose-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Fines & Deductions Register</h1>
                <p className="text-xs text-muted-foreground">Form No. 2 — Register of Fines as per Payment of Wages Act</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"><Printer size={15} /> Print / PDF</button>
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground"><FileDown size={15} /> Export CSV</button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <AlertCircle size={17} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-800">Payment of Wages Act — Deduction Limits</p>
              <p className="text-xs text-rose-700 mt-0.5">As per the Payment of Wages Act, 1936, total deductions from wages shall not exceed 50% of wages. All fines must be recorded in this register and the employee must be given an opportunity to show cause.</p>
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
                <span className="flex items-center gap-1.5"><Users size={12} /> {filtered.length} entries</span>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Deductions', value: formatAmount(totalAmount), color: 'bg-rose-100', iconColor: 'text-rose-600', icon: MinusCircle },
              { label: 'Applied to Payroll', value: formatAmount(appliedAmount), color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Pending Approval', value: formatAmount(pendingAmount), color: 'bg-amber-100', iconColor: 'text-amber-600', icon: Clock },
              { label: 'Rejected by Employee', value: formatAmount(rejectedAmount), color: 'bg-red-100', iconColor: 'text-red-600', icon: XCircle },
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
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input type="text" placeholder="Search by name, code, or ref no..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
              <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                <option value="All">All Status</option>
                <option value="Applied">Applied</option>
                <option value="Pending Employee Approval">Pending Approval</option>
                <option value="Approved by Employee">Approved by Employee</option>
                <option value="Rejected by Employee">Rejected by Employee</option>
              </select>
              {hasFilters && <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><RefreshCw size={12} /> Reset</button>}
              <div className="ml-auto text-xs text-muted-foreground">{filtered.length} entries</div>
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
              <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
                <Layers size={15} className="text-rose-600 shrink-0" />
                <p className="text-sm text-rose-700">Grouped by <strong>{GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label}</strong> · {groupedData.length} group{groupedData.length !== 1 ? 's' : ''} · {filtered.length} entries</p>
              </div>
              {groupedData.map(([groupName, entries]) => (
                <FinesGroup key={groupName} groupName={groupName} entries={entries} groupBy={groupBy} isExpanded={expandedGroups.has(groupName)} onToggle={() => toggleGroup(groupName)} formatAmount={formatAmount} />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MinusCircle size={16} className="text-primary" />
                  <h3 className="font-bold text-sm">Fines & Deductions Register — {period?.name}</h3>
                  <span className="text-xs text-muted-foreground">{filtered.length} entries · {formatAmount(totalAmount)} total</span>
                </div>
                <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"><Printer size={13} /> Print View</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Reference No.</th>
                      <th className="px-4 py-3 font-semibold">Issued By</th>
                      <th className="px-4 py-3 font-semibold">Issued On</th>
                      <th className="px-4 py-3 font-semibold text-center text-rose-700">Amount</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Employee Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((entry, i) => {
                      const catStyle = CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS['Other Deductions'];
                      const statusStyle = statusStyleOf(entry.status);
                      const StatusIcon = statusStyle.icon;
                      return (
                        <motion.tr key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground font-mono">{i + 1}</td>
                          <td className="px-4 py-3"><p className="font-semibold">{entry.name}</p><p className="text-[10px] text-muted-foreground font-mono">{entry.employeeCode}</p><p className="text-[10px] text-muted-foreground">{entry.department}</p></td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>{entry.category}</span></td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{entry.description}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{entry.referenceNo}</td>
                          <td className="px-4 py-3 text-muted-foreground">{entry.issuedBy}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.issuedOn)}</td>
                          <td className="px-4 py-3 text-center font-bold text-rose-700">{formatAmount(entry.amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                              <StatusIcon size={9} />
                              {entry.status === 'Pending Employee Approval' ? 'Pending' : entry.status === 'Approved by Employee' ? 'Emp. Approved' : entry.status === 'Rejected by Employee' ? 'Emp. Rejected' : entry.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground italic max-w-[160px] truncate">{entry.employeeResponse ?? '—'}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-accent/30 border-t-2 border-border">
                    <tr>
                      <td colSpan={7} className="px-4 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total ({filtered.length} entries)</td>
                      <td className="px-4 py-3 text-center font-bold text-rose-700">{formatAmount(totalAmount)}</td>
                      <td colSpan={2} />
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