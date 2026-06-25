import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt, Download, ChevronLeft, DollarSign, TrendingUp,
  TrendingDown, Users, Building2, BarChart2, Filter, Calendar,
  X, RefreshCw, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useCurrency } from '../../context/CurrencyContext';
import { useEstablishment } from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts';
import { usePayrollSummary } from '../../lib/reports';

const FINANCIAL_YEARS = ['2025-26', '2024-25', '2023-24'];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

export default function PayrollSummaryReports() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { monthly, byDept, deductions } = usePayrollSummary();
  const [activeView, setActiveView] = useState<'trend' | 'department' | 'deductions'>('trend');
  const [showFilters, setShowFilters] = useState(false);
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');

  // Filter option lists derived from the real data (no fabricated names).
  const DEPARTMENTS = useMemo(() => ['All', ...byDept.map(d => d.dept)], [byDept]);
  const LOCATIONS = ['All'];

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDeptFilter('All');
    setLocationFilter('All');
  };

  const hasActiveFilters = dateFrom || dateTo || deptFilter !== 'All' || locationFilter !== 'All';

  const filteredMonthlyData = useMemo(() => {
    return monthly.filter(row => {
      const matchFrom = !dateFrom || row.period >= dateFrom.slice(0, 7);
      const matchTo = !dateTo || row.period <= dateTo.slice(0, 7);
      return matchFrom && matchTo;
    });
  }, [monthly, dateFrom, dateTo]);

  const filteredDeptData = useMemo(() => {
    return byDept.filter(d => deptFilter === 'All' || d.dept === deptFilter);
  }, [byDept, deptFilter]);

  const EMPTY_MONTH = { month: '—', period: '', gross: 0, deductions: 0, net: 0, employees: 0 };
  const latestMonth = filteredMonthlyData[filteredMonthlyData.length - 1] ?? EMPTY_MONTH;
  const prevMonth = filteredMonthlyData[filteredMonthlyData.length - 2];
  const grossChange = prevMonth && prevMonth.gross ? (((latestMonth.gross - prevMonth.gross) / prevMonth.gross) * 100).toFixed(1) : '0';
  const netChange = prevMonth && prevMonth.net ? (((latestMonth.net - prevMonth.net) / prevMonth.net) * 100).toFixed(1) : '0';

  const est = useEstablishment();
  const [showView, setShowView] = useState(false);
  const reportDoc: StatementDoc = useMemo((): StatementDoc => {
    if (activeView === 'department') {
      return {
        title: 'Payroll Summary — Department-wise', establishment: est.name, subtitle: `FY ${financialYear}`,
        columns: [{ key: 'dept', label: 'Department' }, { key: 'employees', label: 'Employees', align: 'right' }, { key: 'gross', label: 'Monthly Gross', align: 'right' }],
        rows: filteredDeptData.map(d => ({ dept: d.dept, employees: d.employees, gross: formatAmount(d.gross) })),
        totals: { dept: 'Total', gross: formatAmount(filteredDeptData.reduce((s, d) => s + d.gross, 0)) },
        note: 'Computer-generated Payroll Summary.',
      };
    }
    if (activeView === 'deductions') {
      return {
        title: 'Payroll Summary — Deduction Breakdown', establishment: est.name, subtitle: latestMonth.period || latestMonth.month,
        columns: [{ key: 'name', label: 'Deduction' }, { key: 'amount', label: 'Amount', align: 'right' }],
        rows: deductions.map(d => ({ name: d.name, amount: formatAmount(d.amount) })),
        totals: { name: 'Total Deductions', amount: formatAmount(deductions.reduce((s, d) => s + d.amount, 0)) },
        note: 'Computer-generated Payroll Summary.',
      };
    }
    return {
      title: 'Payroll Summary — Monthly Trend', establishment: est.name, subtitle: `FY ${financialYear}`,
      columns: [
        { key: 'month', label: 'Month' }, { key: 'employees', label: 'Employees', align: 'right' },
        { key: 'gross', label: 'Gross Pay', align: 'right' }, { key: 'deductions', label: 'Deductions', align: 'right' }, { key: 'net', label: 'Net Pay', align: 'right' },
      ],
      rows: filteredMonthlyData.map(r => ({ month: r.period || r.month, employees: r.employees, gross: formatAmount(r.gross), deductions: formatAmount(r.deductions), net: formatAmount(r.net) })),
      totals: {
        month: 'Total', gross: formatAmount(filteredMonthlyData.reduce((s, r) => s + r.gross, 0)),
        deductions: formatAmount(filteredMonthlyData.reduce((s, r) => s + r.deductions, 0)), net: formatAmount(filteredMonthlyData.reduce((s, r) => s + r.net, 0)),
      },
      note: 'Computer-generated Payroll Summary.',
    };
  }, [activeView, est.name, financialYear, filteredMonthlyData, filteredDeptData, deductions, latestMonth, formatAmount]);

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
              <div className="p-2 bg-emerald-100 rounded-lg"><Receipt size={22} className="text-emerald-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Payroll Summary Reports</h1>
                <p className="text-xs text-muted-foreground">Monthly payroll trends, gross vs net, department-wise cost analysis.</p>
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

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: `Gross Pay (${latestMonth.month})`, value: formatAmount(latestMonth.gross), sub: `+${grossChange}% vs prev`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: DollarSign, trend: 'up' },
              { label: `Net Pay (${latestMonth.month})`, value: formatAmount(latestMonth.net), sub: `+${netChange}% vs prev`, color: 'bg-green-100', iconColor: 'text-green-600', icon: TrendingUp, trend: 'up' },
              { label: 'Total Deductions', value: formatAmount(latestMonth.deductions), sub: latestMonth.period || latestMonth.month, color: 'bg-red-100', iconColor: 'text-red-600', icon: TrendingDown, trend: 'neutral' },
              { label: 'Employees on Payroll', value: latestMonth.employees, sub: latestMonth.period || latestMonth.month, color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Users, trend: 'neutral' },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={20} className={card.iconColor} /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-lg mt-0.5">{card.value}</p>
                  <p className={`text-[10px] font-medium ${card.trend === 'up' ? 'text-green-600' : 'text-muted-foreground'}`}>{card.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* View Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'trend', label: 'Monthly Trend' },
              { key: 'department', label: 'Department-wise' },
              { key: 'deductions', label: 'Deduction Breakdown' },
            ].map(v => (
              <button key={v.key} onClick={() => setActiveView(v.key as any)} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${activeView === v.key ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Monthly Trend */}
          {activeView === 'trend' && (
            <div className="space-y-5">
              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold flex items-center gap-2"><BarChart2 size={18} className="text-primary" /> Gross vs Net Pay Trend</h2>
                  <span className="text-xs text-muted-foreground bg-accent border border-border px-2 py-0.5 rounded-full">
                    {filteredMonthlyData.length} period{filteredMonthlyData.length !== 1 ? 's' : ''} shown
                  </span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredMonthlyData}>
                      <defs>
                        <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v: number) => formatAmount(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                      <Area type="monotone" dataKey="gross" stroke="#3b82f6" fill="url(#grossGrad)" strokeWidth={2} name="Gross Pay" />
                      <Area type="monotone" dataKey="net" stroke="#10b981" fill="url(#netGrad)" strokeWidth={2} name="Net Pay" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-accent/20">
                  <h3 className="font-bold text-sm">Monthly Payroll Summary — FY {financialYear}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Month</th>
                        <th className="px-4 py-3 font-semibold">Employees</th>
                        <th className="px-4 py-3 font-semibold">Gross Pay</th>
                        <th className="px-4 py-3 font-semibold">Deductions</th>
                        <th className="px-4 py-3 font-semibold">Net Pay</th>
                        <th className="px-4 py-3 font-semibold">Deduction %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMonthlyData.map(row => (
                        <tr key={row.month} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{row.period || row.month}</td>
                          <td className="px-4 py-3 text-sm">{row.employees}</td>
                          <td className="px-4 py-3 font-semibold">{formatAmount(row.gross)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(row.deductions)}</td>
                          <td className="px-4 py-3 font-bold text-green-600">{formatAmount(row.net)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{((row.deductions / row.gross) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                      {filteredMonthlyData.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">No data for the selected date range.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Department-wise */}
          {activeView === 'department' && (
            <div className="space-y-5">
              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold flex items-center gap-2"><Building2 size={18} className="text-primary" /> Department-wise Payroll Cost</h2>
                  {deptFilter !== 'All' && <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">Filtered: {deptFilter}</span>}
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredDeptData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="dept" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v: number) => formatAmount(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="gross" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Gross Pay" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Department</th>
                        <th className="px-4 py-3 font-semibold">Employees</th>
                        <th className="px-4 py-3 font-semibold">Monthly Gross</th>
                        <th className="px-4 py-3 font-semibold">% of Total</th>
                        <th className="px-4 py-3 font-semibold">Avg Cost/Employee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredDeptData.map(row => {
                        const total = filteredDeptData.reduce((s, d) => s + d.gross, 0);
                        return (
                          <tr key={row.dept} className="hover:bg-accent/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{row.dept}</td>
                            <td className="px-4 py-3 text-sm">{row.employees}</td>
                            <td className="px-4 py-3 font-semibold">{formatAmount(row.gross)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{total > 0 ? ((row.gross / total) * 100).toFixed(1) : 0}%</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatAmount(Math.round(row.gross / row.employees))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Deduction Breakdown */}
          {activeView === 'deductions' && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20">
                <h3 className="font-bold text-sm">Deduction Breakdown — {latestMonth.month}</h3>
              </div>
              <div className="p-6 space-y-4">
                {deductions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No payroll has been processed yet.</p>
                )}
                {deductions.map(item => {
                  const total = deductions.reduce((s, d) => s + d.amount, 0);
                  const pct = total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0';
                  return (
                    <div key={item.name} className="flex items-center gap-4">
                      <span className="text-sm font-medium w-40 shrink-0">{item.name}</span>
                      <div className="flex-1 h-3 bg-accent rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-bold w-24 text-right">{formatAmount(item.amount)}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">{pct}%</span>
                    </div>
                  );
                })}
                {deductions.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="font-bold text-sm">Total Deductions</span>
                    <span className="font-bold text-red-600">{formatAmount(deductions.reduce((s, d) => s + d.amount, 0))}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}