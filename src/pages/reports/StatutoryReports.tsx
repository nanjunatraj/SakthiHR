import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Download, ChevronLeft, PiggyBank, CreditCard,
  Receipt, FileText, Building2, CheckCircle2, AlertCircle,
  Search, Calendar, Filter, X, RefreshCw, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useCurrency } from '../../context/CurrencyContext';
import { useStatutory, useEstablishment } from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';
import StatutoryPeriodPanel from './StatutoryReturns';
import type { StatKind } from '../../lib/statutoryReturns';

const SECTIONS = [
  { key: 'statements', label: 'Statements' },
  { key: 'registers', label: 'Registers' },
  { key: 'returns', label: 'Returns' },
] as const;
type SectionKey = typeof SECTIONS[number]['key'];

const STATUTORY_REPORTS = [
  {
    key: 'pf',
    title: 'PF Report',
    subtitle: 'EPFO Monthly Contribution',
    icon: PiggyBank,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    accentBg: 'bg-emerald-50',
    accentBorder: 'border-emerald-200',
    accentText: 'text-emerald-700',
    description: 'Employee and employer PF contributions, UAN-wise breakup for EPFO filing.',
    filingDue: '15th of next month',
    form: 'ECR (Electronic Challan cum Return)',
  },
  {
    key: 'esi',
    title: 'ESI Report',
    subtitle: 'ESIC Monthly Contribution',
    icon: CreditCard,
    color: 'bg-blue-100',
    iconColor: 'text-blue-600',
    accentBg: 'bg-blue-50',
    accentBorder: 'border-blue-200',
    accentText: 'text-blue-700',
    description: 'Employee and employer ESI contributions for employees with gross ≤ ₹21,000.',
    filingDue: '15th of next month',
    form: 'ESIC Monthly Contribution',
  },
  {
    key: 'tds',
    title: 'TDS / Form 16',
    subtitle: 'Income Tax Deduction at Source',
    icon: Receipt,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    accentBg: 'bg-rose-50',
    accentBorder: 'border-rose-200',
    accentText: 'text-rose-700',
    description: 'Monthly TDS deductions, quarterly returns, and annual Form 16 generation.',
    filingDue: 'Quarterly (Jul, Oct, Jan, May)',
    form: 'Form 24Q / Form 16',
  },
  {
    key: 'pt',
    title: 'PT Report',
    subtitle: 'Professional Tax',
    icon: Building2,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    accentBg: 'bg-violet-50',
    accentBorder: 'border-violet-200',
    accentText: 'text-violet-700',
    description: 'State-wise professional tax deductions and remittance reports.',
    filingDue: 'Monthly / Annually (state-wise)',
    form: 'PT Challan',
  },
];

const FINANCIAL_YEARS = ['2025-26', '2024-25', '2023-24'];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

export default function StatutoryReports() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { pf: PF_DATA, esi: ESI_DATA, tds: TDS_DATA, pt: PT_DATA } = useStatutory();
  const [activeReport, setActiveReport] = useState('pf');
  const [section, setSection] = useState<SectionKey>('statements');
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDeptFilter('All');
    setLocationFilter('All');
    setSearch('');
  };

  const hasActiveFilters = dateFrom || dateTo || deptFilter !== 'All' || locationFilter !== 'All' || search;

  // Filter option lists derived from the real statutory data (no fabricated names).
  const PERIODS = ['All'];
  const DEPARTMENTS = useMemo(() => ['All', ...new Set([...PF_DATA, ...ESI_DATA, ...TDS_DATA].map(e => e.dept).filter(d => d && d !== '—'))], [PF_DATA, ESI_DATA, TDS_DATA]);
  const LOCATIONS = useMemo(() => ['All', ...new Set([...PF_DATA, ...ESI_DATA, ...TDS_DATA].map(e => e.location).filter(l => l && l !== '—'))], [PF_DATA, ESI_DATA, TDS_DATA]);

  const activeReportMeta = STATUTORY_REPORTS.find(r => r.key === activeReport)!;
  const ActiveIcon = activeReportMeta.icon;

  const filteredPF = useMemo(() => PF_DATA.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.uan.includes(search);
    const matchDept = deptFilter === 'All' || e.dept === deptFilter;
    const matchLocation = locationFilter === 'All' || e.location === locationFilter;
    return matchSearch && matchDept && matchLocation;
  }), [PF_DATA, search, deptFilter, locationFilter]);

  const filteredESI = useMemo(() => ESI_DATA.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.esiNo.includes(search);
    const matchDept = deptFilter === 'All' || e.dept === deptFilter;
    const matchLocation = locationFilter === 'All' || e.location === locationFilter;
    return matchSearch && matchDept && matchLocation;
  }), [ESI_DATA, search, deptFilter, locationFilter]);

  const filteredTDS = useMemo(() => TDS_DATA.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.pan.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || e.dept === deptFilter;
    const matchLocation = locationFilter === 'All' || e.location === locationFilter;
    return matchSearch && matchDept && matchLocation;
  }), [TDS_DATA, search, deptFilter, locationFilter]);

  const est = useEstablishment();
  const [showView, setShowView] = useState(false);
  const reportDoc: StatementDoc = useMemo((): StatementDoc => {
    const base = { establishment: est.name, subtitle: `${activeReportMeta.title}${hasActiveFilters ? ' (filtered)' : ''}`, note: 'Computer-generated Statutory Report.' };
    if (activeReport === 'esi') {
      return {
        ...base, title: 'ESI Statement',
        columns: [{ key: 'name', label: 'Employee' }, { key: 'esiNo', label: 'ESI No' }, { key: 'dept', label: 'Dept' }, { key: 'gross', label: 'Gross Wages', align: 'right' }, { key: 'emp', label: 'Employee ESI', align: 'right' }, { key: 'er', label: 'Employer ESI', align: 'right' }],
        rows: filteredESI.map(e => ({ name: e.name, esiNo: e.esiNo, dept: e.dept, gross: formatAmount(e.grossWages), emp: formatAmount(e.empESI), er: formatAmount(e.empESIER) })),
        totals: { name: 'Total', emp: formatAmount(filteredESI.reduce((s, e) => s + e.empESI, 0)), er: formatAmount(filteredESI.reduce((s, e) => s + e.empESIER, 0)) },
      };
    }
    if (activeReport === 'tds') {
      return {
        ...base, title: 'TDS Statement',
        columns: [{ key: 'name', label: 'Employee' }, { key: 'pan', label: 'PAN' }, { key: 'dept', label: 'Dept' }, { key: 'gross', label: 'YTD Gross', align: 'right' }, { key: 'tds', label: 'YTD TDS', align: 'right' }],
        rows: filteredTDS.map(e => ({ name: e.name, pan: e.pan, dept: e.dept, gross: formatAmount(e.ytdGross), tds: formatAmount(e.ytdTDS) })),
        totals: { name: 'Total', tds: formatAmount(filteredTDS.reduce((s, e) => s + e.ytdTDS, 0)) },
      };
    }
    if (activeReport === 'pt') {
      return {
        ...base, title: 'Professional Tax Statement',
        columns: [{ key: 'state', label: 'State' }, { key: 'employees', label: 'Employees', align: 'right' }, { key: 'slab', label: 'PT Slab' }, { key: 'total', label: 'Total PT', align: 'right' }, { key: 'status', label: 'Status' }],
        rows: PT_DATA.map(p => ({ state: p.state, employees: p.employees, slab: p.ptSlab, total: formatAmount(p.totalPT), status: p.status })),
        totals: { state: 'Total', total: formatAmount(PT_DATA.reduce((s, p) => s + p.totalPT, 0)) },
      };
    }
    return {
      ...base, title: 'PF Statement (ECR)',
      columns: [{ key: 'name', label: 'Employee' }, { key: 'uan', label: 'UAN' }, { key: 'dept', label: 'Dept' }, { key: 'wages', label: 'PF Wages', align: 'right' }, { key: 'emp', label: 'Employee PF', align: 'right' }, { key: 'er', label: 'Employer PF', align: 'right' }, { key: 'eps', label: 'EPS', align: 'right' }, { key: 'edli', label: 'EDLI', align: 'right' }],
      rows: filteredPF.map(e => ({ name: e.name, uan: e.uan, dept: e.dept, wages: formatAmount(e.pfWages), emp: formatAmount(e.empPF), er: formatAmount(e.empPFER), eps: formatAmount(e.eps), edli: formatAmount(e.edli) })),
      totals: { name: 'Total', emp: formatAmount(filteredPF.reduce((s, e) => s + e.empPF, 0)), er: formatAmount(filteredPF.reduce((s, e) => s + e.empPFER, 0)) },
    };
  }, [activeReport, activeReportMeta, est.name, hasActiveFilters, filteredPF, filteredESI, filteredTDS, PT_DATA, formatAmount]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-rose-100 rounded-lg"><Shield size={22} className="text-rose-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Statutory Reports</h1>
                <p className="text-xs text-muted-foreground">PF, ESI, TDS, and PT compliance reports for government filings.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent text-muted-foreground'}`}
              >
                <Filter size={15} /> Filters {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
              </button>
              <button onClick={() => setShowView(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm">
                <Eye size={15} /> View / Print
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Filter Panel */}
          {showFilters && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm flex items-center gap-2"><Filter size={15} className="text-primary" /> Report Filters</h3>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw size={12} /> Reset
                    </button>
                  )}
                  <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"><X size={16} /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Financial Year</label>
                  <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={financialYear} onChange={e => setFinancialYear(e.target.value)}>
                    {FINANCIAL_YEARS.map(fy => <option key={fy}>FY {fy}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Date From</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="date" className="w-full pl-8 pr-2 py-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Date To</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="date" className="w-full pl-8 pr-2 py-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Department</label>
                  <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Location</label>
                  <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                    {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {dateFrom && <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">From: {formatDateDisplay(dateFrom)}</span>}
                  {dateTo && <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">To: {formatDateDisplay(dateTo)}</span>}
                  {deptFilter !== 'All' && <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">Dept: {deptFilter}</span>}
                  {locationFilter !== 'All' && <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Location: {locationFilter}</span>}
                </div>
              )}
            </motion.div>
          )}

          {/* Report Type Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATUTORY_REPORTS.map((report, i) => {
              const Icon = report.icon;
              const isActive = activeReport === report.key;
              return (
                <motion.button
                  key={report.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2 }}
                  onClick={() => { setActiveReport(report.key); setSearch(''); }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${isActive ? `${report.accentBg} ${report.accentBorder} shadow-md` : 'border-border bg-card hover:border-primary/30'}`}
                >
                  <div className={`p-2.5 ${report.color} rounded-xl w-fit mb-3`}>
                    <Icon size={20} className={report.iconColor} />
                  </div>
                  <p className={`font-bold text-sm ${isActive ? report.accentText : ''}`}>{report.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{report.subtitle}</p>
                </motion.button>
              );
            })}
          </div>

          {/* Active Report Info */}
          <div className={`flex items-start gap-4 p-5 rounded-xl border-2 ${activeReportMeta.accentBg} ${activeReportMeta.accentBorder}`}>
            <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0">
              <ActiveIcon size={22} className={activeReportMeta.iconColor} />
            </div>
            <div className="flex-1">
              <h2 className={`font-bold text-base ${activeReportMeta.accentText}`}>{activeReportMeta.title}</h2>
              <p className={`text-xs ${activeReportMeta.accentText} opacity-80 mt-0.5`}>{activeReportMeta.description}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-[10px] font-bold ${activeReportMeta.accentText} uppercase tracking-wide`}>Filing Due</p>
              <p className={`text-xs font-semibold ${activeReportMeta.accentText} mt-0.5`}>{activeReportMeta.filingDue}</p>
              <p className={`text-[10px] ${activeReportMeta.accentText} opacity-70 mt-0.5`}>{activeReportMeta.form}</p>
            </div>
          </div>

          {/* Statements / Registers / Returns section toggle */}
          <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border border-border shadow-sm w-fit">
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setSection(s.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${section === s.key ? `${activeReportMeta.accentBg} ${activeReportMeta.accentText} shadow-sm` : 'text-muted-foreground hover:bg-accent'}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Registers / Returns — period-wise, grouped by work-location statutory code */}
          {section !== 'statements' && (
            <StatutoryPeriodPanel report={activeReport as StatKind} mode={section} />
          )}

          {/* Period + Search Filters (Statements) */}
          {section === 'statements' && (
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search by name, UAN, PAN, ESI No..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
              {PERIODS.map(p => <option key={p}>{p}</option>)}
            </select>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">Period: {periodFilter} · FY {financialYear}</div>
          </div>
          )}

          {/* PF Report */}
          {section === 'statements' && activeReport === 'pf' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Employees', value: filteredPF.length, color: 'bg-emerald-100', textColor: 'text-emerald-700' },
                  { label: 'Employee PF', value: formatAmount(filteredPF.reduce((s, e) => s + e.empPF, 0)), color: 'bg-blue-100', textColor: 'text-blue-700' },
                  { label: 'Employer PF', value: formatAmount(filteredPF.reduce((s, e) => s + e.empPFER, 0)), color: 'bg-violet-100', textColor: 'text-violet-700' },
                  { label: 'Total Remittance', value: formatAmount(filteredPF.reduce((s, e) => s + e.empPF + e.empPFER + e.edli + e.adminCharges, 0)), color: 'bg-amber-100', textColor: 'text-amber-700' },
                ].map((card, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${card.color} text-center`}>
                    <p className={`text-lg font-bold ${card.textColor}`}>{card.value}</p>
                    <p className={`text-[10px] font-medium ${card.textColor} uppercase tracking-wide`}>{card.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">UAN</th>
                        <th className="px-4 py-3 font-semibold">PF Wages</th>
                        <th className="px-4 py-3 font-semibold text-blue-700">Emp PF (12%)</th>
                        <th className="px-4 py-3 font-semibold text-violet-700">Empr PF (12%)</th>
                        <th className="px-4 py-3 font-semibold text-emerald-700">EPS</th>
                        <th className="px-4 py-3 font-semibold text-amber-700">EDLI</th>
                        <th className="px-4 py-3 font-semibold text-rose-700">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPF.map((emp, i) => (
                        <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-[9px] shrink-0">{emp.name.split(' ').map(n => n[0]).join('')}</div>
                              <div>
                                <span className="font-semibold">{emp.name}</span>
                                <p className="text-[10px] text-muted-foreground">{emp.dept} · {emp.location}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{emp.uan}</td>
                          <td className="px-4 py-3 font-medium">{formatAmount(emp.pfWages)}</td>
                          <td className="px-4 py-3 text-blue-700 font-semibold">{formatAmount(emp.empPF)}</td>
                          <td className="px-4 py-3 text-violet-700 font-semibold">{formatAmount(emp.empPFER)}</td>
                          <td className="px-4 py-3 text-emerald-700">{formatAmount(emp.eps)}</td>
                          <td className="px-4 py-3 text-amber-700">{formatAmount(emp.edli)}</td>
                          <td className="px-4 py-3 text-rose-700">{formatAmount(emp.adminCharges)}</td>
                        </motion.tr>
                      ))}
                      {filteredPF.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">No records match the selected filters.</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-accent/30 border-t-2 border-border">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total</td>
                        <td className="px-4 py-3 font-bold">{formatAmount(filteredPF.reduce((s, e) => s + e.pfWages, 0))}</td>
                        <td className="px-4 py-3 font-bold text-blue-700">{formatAmount(filteredPF.reduce((s, e) => s + e.empPF, 0))}</td>
                        <td className="px-4 py-3 font-bold text-violet-700">{formatAmount(filteredPF.reduce((s, e) => s + e.empPFER, 0))}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{formatAmount(filteredPF.reduce((s, e) => s + e.eps, 0))}</td>
                        <td className="px-4 py-3 font-bold text-amber-700">{formatAmount(filteredPF.reduce((s, e) => s + e.edli, 0))}</td>
                        <td className="px-4 py-3 font-bold text-rose-700">{formatAmount(filteredPF.reduce((s, e) => s + e.adminCharges, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ESI Report */}
          {section === 'statements' && activeReport === 'esi' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'ESI Eligible Employees', value: filteredESI.length, color: 'bg-blue-100', textColor: 'text-blue-700' },
                  { label: 'Employee ESI (0.75%)', value: formatAmount(filteredESI.reduce((s, e) => s + e.empESI, 0)), color: 'bg-violet-100', textColor: 'text-violet-700' },
                  { label: 'Employer ESI (3.25%)', value: formatAmount(filteredESI.reduce((s, e) => s + e.empESIER, 0)), color: 'bg-emerald-100', textColor: 'text-emerald-700' },
                ].map((card, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${card.color} text-center`}>
                    <p className={`text-lg font-bold ${card.textColor}`}>{card.value}</p>
                    <p className={`text-[10px] font-medium ${card.textColor} uppercase tracking-wide`}>{card.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">ESI No.</th>
                        <th className="px-4 py-3 font-semibold">Gross Wages</th>
                        <th className="px-4 py-3 font-semibold text-blue-700">Emp ESI (0.75%)</th>
                        <th className="px-4 py-3 font-semibold text-emerald-700">Empr ESI (3.25%)</th>
                        <th className="px-4 py-3 font-semibold text-amber-700">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredESI.map((emp, i) => (
                        <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[9px] shrink-0">{emp.name.split(' ').map(n => n[0]).join('')}</div>
                              <div>
                                <span className="font-semibold">{emp.name}</span>
                                <p className="text-[10px] text-muted-foreground">{emp.dept} · {emp.location}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{emp.esiNo}</td>
                          <td className="px-4 py-3 font-medium">{formatAmount(emp.grossWages)}</td>
                          <td className="px-4 py-3 text-blue-700 font-semibold">{formatAmount(emp.empESI)}</td>
                          <td className="px-4 py-3 text-emerald-700 font-semibold">{formatAmount(emp.empESIER)}</td>
                          <td className="px-4 py-3 font-bold text-amber-700">{formatAmount(emp.empESI + emp.empESIER)}</td>
                        </motion.tr>
                      ))}
                      {filteredESI.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">No records match the selected filters.</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-accent/30 border-t-2 border-border">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total</td>
                        <td className="px-4 py-3 font-bold">{formatAmount(filteredESI.reduce((s, e) => s + e.grossWages, 0))}</td>
                        <td className="px-4 py-3 font-bold text-blue-700">{formatAmount(filteredESI.reduce((s, e) => s + e.empESI, 0))}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{formatAmount(filteredESI.reduce((s, e) => s + e.empESIER, 0))}</td>
                        <td className="px-4 py-3 font-bold text-amber-700">{formatAmount(filteredESI.reduce((s, e) => s + e.empESI + e.empESIER, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TDS Report */}
          {section === 'statements' && activeReport === 'tds' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Employees with TDS', value: filteredTDS.length, color: 'bg-rose-100', textColor: 'text-rose-700' },
                  { label: 'YTD TDS Deducted', value: formatAmount(filteredTDS.reduce((s, e) => s + e.ytdTDS, 0)), color: 'bg-amber-100', textColor: 'text-amber-700' },
                  { label: 'This Quarter (Q2)', value: formatAmount(filteredTDS.reduce((s, e) => s + e.tdsQ2, 0)), color: 'bg-blue-100', textColor: 'text-blue-700' },
                ].map((card, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${card.color} text-center`}>
                    <p className={`text-lg font-bold ${card.textColor}`}>{card.value}</p>
                    <p className={`text-[10px] font-medium ${card.textColor} uppercase tracking-wide`}>{card.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">PAN</th>
                        <th className="px-4 py-3 font-semibold">YTD Gross</th>
                        <th className="px-4 py-3 font-semibold text-blue-700">Q1 TDS</th>
                        <th className="px-4 py-3 font-semibold text-blue-700">Q2 TDS</th>
                        <th className="px-4 py-3 font-semibold text-blue-700">Q3 TDS</th>
                        <th className="px-4 py-3 font-semibold text-blue-700">Q4 TDS</th>
                        <th className="px-4 py-3 font-semibold text-rose-700">YTD TDS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredTDS.map((emp, i) => (
                        <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-rose-100 flex items-center justify-center text-rose-700 font-bold text-[9px] shrink-0">{emp.name.split(' ').map(n => n[0]).join('')}</div>
                              <div>
                                <span className="font-semibold">{emp.name}</span>
                                <p className="text-[10px] text-muted-foreground">{emp.dept} · {emp.location}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{emp.pan}</td>
                          <td className="px-4 py-3 font-medium">{formatAmount(emp.ytdGross)}</td>
                          <td className="px-4 py-3 text-blue-600">{formatAmount(emp.tdsQ1)}</td>
                          <td className="px-4 py-3 text-blue-600">{formatAmount(emp.tdsQ2)}</td>
                          <td className="px-4 py-3 text-blue-600">{formatAmount(emp.tdsQ3)}</td>
                          <td className="px-4 py-3 text-blue-600">{formatAmount(emp.tdsQ4)}</td>
                          <td className="px-4 py-3 font-bold text-rose-700">{formatAmount(emp.ytdTDS)}</td>
                        </motion.tr>
                      ))}
                      {filteredTDS.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">No records match the selected filters.</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-accent/30 border-t-2 border-border">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total</td>
                        <td className="px-4 py-3 font-bold">{formatAmount(filteredTDS.reduce((s, e) => s + e.ytdGross, 0))}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">{formatAmount(filteredTDS.reduce((s, e) => s + e.tdsQ1, 0))}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">{formatAmount(filteredTDS.reduce((s, e) => s + e.tdsQ2, 0))}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">{formatAmount(filteredTDS.reduce((s, e) => s + e.tdsQ3, 0))}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">{formatAmount(filteredTDS.reduce((s, e) => s + e.tdsQ4, 0))}</td>
                        <td className="px-4 py-3 font-bold text-rose-700">{formatAmount(filteredTDS.reduce((s, e) => s + e.ytdTDS, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PT Report */}
          {section === 'statements' && activeReport === 'pt' && (
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-accent/20">
                  <h3 className="font-bold text-sm">Professional Tax — State-wise Summary · {periodFilter}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">State</th>
                        <th className="px-4 py-3 font-semibold">Employees</th>
                        <th className="px-4 py-3 font-semibold">PT Slab</th>
                        <th className="px-4 py-3 font-semibold">Total PT</th>
                        <th className="px-4 py-3 font-semibold">Remittance Due</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {PT_DATA.map((row, i) => (
                        <motion.tr key={row.state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3 font-semibold">{row.state}</td>
                          <td className="px-4 py-3">{row.employees}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.ptSlab}</td>
                          <td className="px-4 py-3 font-bold text-violet-700">{row.totalPT > 0 ? formatAmount(row.totalPT) : '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.remittanceDue}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              row.status === 'Paid' ? 'bg-green-100 text-green-700 border-green-200' :
                              row.status === 'Pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              'bg-gray-100 text-gray-500 border-gray-200'
                            }`}>
                              {row.status === 'Paid' ? <CheckCircle2 size={10} /> : row.status === 'Pending' ? <AlertCircle size={10} /> : null}
                              {row.status}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-accent/30 border-t-2 border-border">
                      <tr>
                        <td className="px-4 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total</td>
                        <td className="px-4 py-3 font-bold">{PT_DATA.reduce((s, r) => s + r.employees, 0)}</td>
                        <td />
                        <td className="px-4 py-3 font-bold text-violet-700">{formatAmount(PT_DATA.reduce((s, r) => s + r.totalPT, 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}