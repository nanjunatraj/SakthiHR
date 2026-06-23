import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Download, ChevronLeft, DollarSign, Search,
  BarChart2, PiggyBank, Receipt, Filter, Calendar, X, RefreshCw, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useCurrency } from '../../context/CurrencyContext';
import { useEstablishment } from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { useYTD } from '../../lib/reports';

const FINANCIAL_YEARS = ['2025-26', '2024-25', '2023-24'];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

export default function YTDReports() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { monthly: YTD_MONTHLY, employees: EMPLOYEE_YTD } = useYTD();
  const [activeView, setActiveView] = useState<'summary' | 'employee'>('summary');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('All');

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDeptFilter('All');
    setLocationFilter('All');
    setGradeFilter('All');
    setSearch('');
  };

  const hasActiveFilters = dateFrom || dateTo || deptFilter !== 'All' || locationFilter !== 'All' || gradeFilter !== 'All' || search;

  // Filter option lists derived from the real data (no fabricated names).
  const DEPARTMENTS = useMemo(() => ['All', ...new Set(EMPLOYEE_YTD.map(e => e.dept).filter(Boolean))], [EMPLOYEE_YTD]);
  const LOCATIONS = useMemo(() => ['All', ...new Set(EMPLOYEE_YTD.map(e => e.location).filter(Boolean))], [EMPLOYEE_YTD]);
  const GRADES = useMemo(() => ['All', ...new Set(EMPLOYEE_YTD.map(e => e.grade).filter(Boolean))], [EMPLOYEE_YTD]);

  const filteredMonthly = useMemo(() => {
    return YTD_MONTHLY.filter(row => {
      const matchFrom = !dateFrom || row.period >= dateFrom.slice(0, 7);
      const matchTo = !dateTo || row.period <= dateTo.slice(0, 7);
      return matchFrom && matchTo;
    });
  }, [YTD_MONTHLY, dateFrom, dateTo]);

  const filteredEmployees = useMemo(() => {
    return EMPLOYEE_YTD.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.dept === deptFilter;
      const matchLocation = locationFilter === 'All' || e.location === locationFilter;
      const matchGrade = gradeFilter === 'All' || e.grade === gradeFilter;
      return matchSearch && matchDept && matchLocation && matchGrade;
    });
  }, [EMPLOYEE_YTD, search, deptFilter, locationFilter, gradeFilter]);

  const FY = `FY ${financialYear}`;
  const totalYTDGross = filteredEmployees.reduce((s, e) => s + e.ytdGross, 0);
  const totalYTDPF = filteredEmployees.reduce((s, e) => s + e.ytdPF, 0);
  const totalYTDTDS = filteredEmployees.reduce((s, e) => s + e.ytdTDS, 0);
  const totalYTDNet = filteredEmployees.reduce((s, e) => s + e.ytdNet, 0);

  const est = useEstablishment();
  const [showView, setShowView] = useState(false);
  const reportDoc: StatementDoc = useMemo(() => ({
    title: 'YTD Report (Employee-wise)',
    establishment: est.name,
    subtitle: `FY ${financialYear} · ${filteredEmployees.length} employees`,
    columns: [
      { key: 'id', label: 'Emp ID' }, { key: 'name', label: 'Name' }, { key: 'dept', label: 'Department' },
      { key: 'gross', label: 'YTD Gross', align: 'right' }, { key: 'pf', label: 'YTD PF', align: 'right' },
      { key: 'esi', label: 'YTD ESI', align: 'right' }, { key: 'pt', label: 'YTD PT', align: 'right' },
      { key: 'tds', label: 'YTD TDS', align: 'right' }, { key: 'net', label: 'YTD Net', align: 'right' },
    ],
    rows: filteredEmployees.map(e => ({
      id: e.id, name: e.name, dept: e.dept, gross: formatAmount(e.ytdGross), pf: formatAmount(e.ytdPF),
      esi: formatAmount(e.ytdESI), pt: formatAmount(e.ytdPT), tds: formatAmount(e.ytdTDS), net: formatAmount(e.ytdNet),
    })),
    totals: { id: 'TOTAL', gross: formatAmount(totalYTDGross), pf: formatAmount(totalYTDPF), tds: formatAmount(totalYTDTDS), net: formatAmount(totalYTDNet) },
    note: 'Computer-generated YTD Report.',
  }), [filteredEmployees, est.name, financialYear, totalYTDGross, totalYTDPF, totalYTDTDS, totalYTDNet, formatAmount]);

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
              <div className="p-2 bg-amber-100 rounded-lg"><TrendingUp size={22} className="text-amber-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">YTD Reports</h1>
                <p className="text-xs text-muted-foreground">Year-to-date earnings, deductions, tax, and PF/ESI contributions — {FY}.</p>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Financial Year</label>
                  <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={financialYear} onChange={e => setFinancialYear(e.target.value)}>
                    {FINANCIAL_YEARS.map(fy => <option key={fy}>FY {fy}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Period From</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="date" className="w-full pl-8 pr-2 py-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Period To</label>
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
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Grade</label>
                  <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                    {GRADES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {dateFrom && <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">From: {formatDateDisplay(dateFrom)}</span>}
                  {dateTo && <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">To: {formatDateDisplay(dateTo)}</span>}
                  {deptFilter !== 'All' && <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">Dept: {deptFilter}</span>}
                  {locationFilter !== 'All' && <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Location: {locationFilter}</span>}
                  {gradeFilter !== 'All' && <span className="text-[10px] font-semibold bg-cyan-100 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full">Grade: {gradeFilter}</span>}
                </div>
              )}
            </motion.div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'YTD Gross Pay', value: formatAmount(totalYTDGross), sub: FY, color: 'bg-amber-100', iconColor: 'text-amber-600', icon: DollarSign },
              { label: 'YTD Net Pay', value: formatAmount(totalYTDNet), sub: FY, color: 'bg-green-100', iconColor: 'text-green-600', icon: TrendingUp },
              { label: 'YTD PF Contribution', value: formatAmount(totalYTDPF), sub: 'Employee + Employer', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: PiggyBank },
              { label: 'YTD TDS Deducted', value: formatAmount(totalYTDTDS), sub: FY, color: 'bg-rose-100', iconColor: 'text-rose-600', icon: Receipt },
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

          {/* View Tabs */}
          <div className="flex items-center gap-2">
            {[
              { key: 'summary', label: 'YTD Trend' },
              { key: 'employee', label: 'Employee-wise YTD' },
            ].map(v => (
              <button key={v.key} onClick={() => setActiveView(v.key as any)} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${activeView === v.key ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* YTD Trend Chart */}
          {activeView === 'summary' && (
            <div className="space-y-5">
              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold flex items-center gap-2"><BarChart2 size={18} className="text-primary" /> Cumulative YTD — Gross, PF & TDS</h2>
                  <span className="text-xs text-muted-foreground bg-accent border border-border px-2 py-0.5 rounded-full">
                    {filteredMonthly.length} period{filteredMonthly.length !== 1 ? 's' : ''} shown
                  </span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredMonthly} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v: number) => formatAmount(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="ytdGross" fill="#f59e0b" radius={[4, 4, 0, 0]} name="YTD Gross" />
                      <Bar dataKey="ytdPF" fill="#3b82f6" radius={[4, 4, 0, 0]} name="YTD PF" />
                      <Bar dataKey="ytdTDS" fill="#f43f5e" radius={[4, 4, 0, 0]} name="YTD TDS" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-accent/20">
                  <h3 className="font-bold text-sm">Cumulative YTD Summary — {FY}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Month</th>
                        <th className="px-4 py-3 font-semibold">YTD Gross</th>
                        <th className="px-4 py-3 font-semibold">YTD PF</th>
                        <th className="px-4 py-3 font-semibold">YTD ESI</th>
                        <th className="px-4 py-3 font-semibold">YTD TDS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMonthly.map(row => (
                        <tr key={row.month} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{row.month} 2025</td>
                          <td className="px-4 py-3 font-semibold text-amber-700">{formatAmount(row.ytdGross)}</td>
                          <td className="px-4 py-3 text-blue-600">{formatAmount(row.ytdPF)}</td>
                          <td className="px-4 py-3 text-violet-600">{formatAmount(row.ytdESI)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(row.ytdTDS)}</td>
                        </tr>
                      ))}
                      {filteredMonthly.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">No data for the selected date range.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Employee-wise YTD */}
          {activeView === 'employee' && (
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input type="text" placeholder="Search employees..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
                <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                  {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
                <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                  {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
                <div className="ml-auto text-xs text-muted-foreground">{filteredEmployees.length} employees</div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold text-amber-700">YTD Gross</th>
                        <th className="px-4 py-3 font-semibold text-amber-700">YTD Basic</th>
                        <th className="px-4 py-3 font-semibold text-amber-700">YTD HRA</th>
                        <th className="px-4 py-3 font-semibold text-red-700">YTD PF</th>
                        <th className="px-4 py-3 font-semibold text-red-700">YTD ESI</th>
                        <th className="px-4 py-3 font-semibold text-red-700">YTD PT</th>
                        <th className="px-4 py-3 font-semibold text-red-700">YTD TDS</th>
                        <th className="px-4 py-3 font-semibold text-green-700">YTD Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredEmployees.map((emp, i) => (
                        <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px] shrink-0">{emp.name.split(' ').map(n => n[0]).join('')}</div>
                              <div>
                                <p className="font-semibold">{emp.name}</p>
                                <p className="text-[10px] text-muted-foreground">{emp.dept} · {emp.location}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-700">{formatAmount(emp.ytdGross)}</td>
                          <td className="px-4 py-3 text-amber-600">{formatAmount(emp.ytdBasic)}</td>
                          <td className="px-4 py-3 text-amber-600">{formatAmount(emp.ytdHRA)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(emp.ytdPF)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(emp.ytdESI)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(emp.ytdPT)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(emp.ytdTDS)}</td>
                          <td className="px-4 py-3 font-bold text-green-700">{formatAmount(emp.ytdNet)}</td>
                        </motion.tr>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">No employees match the selected filters.</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-accent/30 border-t-2 border-border">
                      <tr>
                        <td className="px-4 py-3 font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Total</td>
                        <td className="px-4 py-3 font-bold text-amber-700">{formatAmount(filteredEmployees.reduce((s, e) => s + e.ytdGross, 0))}</td>
                        <td className="px-4 py-3 font-bold text-amber-600">{formatAmount(filteredEmployees.reduce((s, e) => s + e.ytdBasic, 0))}</td>
                        <td className="px-4 py-3 font-bold text-amber-600">{formatAmount(filteredEmployees.reduce((s, e) => s + e.ytdHRA, 0))}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{formatAmount(filteredEmployees.reduce((s, e) => s + e.ytdPF, 0))}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{formatAmount(filteredEmployees.reduce((s, e) => s + e.ytdESI, 0))}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{formatAmount(filteredEmployees.reduce((s, e) => s + e.ytdPT, 0))}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{formatAmount(filteredEmployees.reduce((s, e) => s + e.ytdTDS, 0))}</td>
                        <td className="px-4 py-3 font-bold text-green-700">{formatAmount(filteredEmployees.reduce((s, e) => s + e.ytdNet, 0))}</td>
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