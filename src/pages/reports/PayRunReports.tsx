import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Download, ChevronLeft, CheckCircle2, Clock,
  Lock, DollarSign, Users, Eye, Search,
  CalendarRange, Unlock, Filter, Calendar, X, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useCurrency } from '../../context/CurrencyContext';
import { usePayRuns, useEstablishment } from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Draft: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  Approved: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: CheckCircle2 },
  Disbursed: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle2 },
  Locked: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: Lock },
};

const FINANCIAL_YEARS = ['2025-26', '2024-25', '2023-24'];
const RUN_STATUSES = ['All', 'Draft', 'Approved', 'Disbursed', 'Locked'];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

export default function PayRunReports() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { runs, payslipsByRun } = usePayRuns();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDeptFilter('All');
    setLocationFilter('All');
    setStatusFilter('All');
  };

  const hasActiveFilters = dateFrom || dateTo || deptFilter !== 'All' || locationFilter !== 'All' || statusFilter !== 'All';

  const runPayslips = selectedRun ? (payslipsByRun[selectedRun] ?? []) : [];
  // Filter option lists derived from the real payslip data (no fabricated names).
  const DEPARTMENTS = useMemo(() => ['All', ...new Set(runPayslips.map(e => e.dept).filter(Boolean))], [runPayslips]);
  const LOCATIONS = useMemo(() => ['All', ...new Set(runPayslips.map(e => e.location).filter(Boolean))], [runPayslips]);

  const filteredRuns = useMemo(() => {
    return runs.filter(run => {
      const matchFrom = !dateFrom || run.runDate >= dateFrom;
      const matchTo = !dateTo || run.runDate <= dateTo;
      const matchStatus = statusFilter === 'All' || run.status === statusFilter;
      return matchFrom && matchTo && matchStatus;
    });
  }, [runs, dateFrom, dateTo, statusFilter]);

  const filteredPayslips = useMemo(() => {
    return runPayslips.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.dept.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.dept === deptFilter;
      const matchLocation = locationFilter === 'All' || e.location === locationFilter;
      return matchSearch && matchDept && matchLocation;
    });
  }, [runPayslips, search, deptFilter, locationFilter]);

  const selectedRunData = runs.find(r => r.id === selectedRun);

  const est = useEstablishment();
  const [showView, setShowView] = useState(false);
  const reportDoc: StatementDoc = useMemo((): StatementDoc => {
    if (selectedRunData) {
      return {
        title: `Pay Run — ${selectedRunData.period}`, establishment: est.name,
        subtitle: `Run ${formatDateDisplay(selectedRunData.runDate)} · ${selectedRunData.status} · ${filteredPayslips.length} employees`,
        columns: [
          { key: 'name', label: 'Employee' }, { key: 'dept', label: 'Department' },
          { key: 'gross', label: 'Gross', align: 'right' }, { key: 'pf', label: 'PF', align: 'right' },
          { key: 'esi', label: 'ESI', align: 'right' }, { key: 'pt', label: 'PT', align: 'right' },
          { key: 'tds', label: 'TDS', align: 'right' }, { key: 'net', label: 'Net', align: 'right' },
        ],
        rows: filteredPayslips.map(p => ({
          name: p.name, dept: p.dept, gross: formatAmount(p.gross), pf: formatAmount(p.pf),
          esi: formatAmount(p.esi), pt: formatAmount(p.pt), tds: formatAmount(p.tds), net: formatAmount(p.net),
        })),
        totals: {
          name: 'Total', gross: formatAmount(filteredPayslips.reduce((s, p) => s + p.gross, 0)),
          net: formatAmount(filteredPayslips.reduce((s, p) => s + p.net, 0)),
        },
        note: 'Computer-generated Pay Run Report.',
      };
    }
    return {
      title: 'Pay Run Reports', establishment: est.name, subtitle: `${filteredRuns.length} pay runs`,
      columns: [
        { key: 'period', label: 'Period' }, { key: 'runDate', label: 'Run Date' }, { key: 'status', label: 'Status' },
        { key: 'employees', label: 'Employees', align: 'right' }, { key: 'gross', label: 'Gross', align: 'right' },
        { key: 'deductions', label: 'Deductions', align: 'right' }, { key: 'net', label: 'Net', align: 'right' },
      ],
      rows: filteredRuns.map(r => ({
        period: r.period, runDate: formatDateDisplay(r.runDate), status: r.status, employees: r.employees,
        gross: formatAmount(r.gross), deductions: formatAmount(r.deductions), net: formatAmount(r.net),
      })),
      note: 'Select a pay run to view employee-wise payslip data.',
    };
  }, [selectedRunData, est.name, filteredPayslips, filteredRuns, formatAmount]);

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
              <div className="p-2 bg-violet-100 rounded-lg"><Play size={22} className="text-violet-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Pay Run Reports</h1>
                <p className="text-xs text-muted-foreground">Detailed pay run data per payroll period with employee-wise payslip breakdown.</p>
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
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Run Date From</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="date" className="w-full pl-8 pr-2 py-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Run Date To</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="date" className="w-full pl-8 pr-2 py-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Run Status</label>
                  <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    {RUN_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
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
                  {statusFilter !== 'All' && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Status: {statusFilter}</span>}
                  {deptFilter !== 'All' && <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">Dept: {deptFilter}</span>}
                  {locationFilter !== 'All' && <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Location: {locationFilter}</span>}
                </div>
              )}
            </motion.div>
          )}

          {/* Pay Run List */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
              <CalendarRange size={16} className="text-primary" />
              <h3 className="font-bold text-sm">Payroll Runs — FY {financialYear}</h3>
              <span className="ml-auto text-xs text-muted-foreground">{filteredRuns.length} runs</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Period</th>
                    <th className="px-4 py-3 font-semibold">Run Date</th>
                    <th className="px-4 py-3 font-semibold">Employees</th>
                    <th className="px-4 py-3 font-semibold">Gross Pay</th>
                    <th className="px-4 py-3 font-semibold">Deductions</th>
                    <th className="px-4 py-3 font-semibold">Net Pay</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRuns.map((run, i) => {
                    const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.Draft;
                    const StatusIcon = style.icon;
                    return (
                      <motion.tr key={run.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className={`hover:bg-accent/30 transition-colors ${selectedRun === run.id ? 'bg-primary/5' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-sm">{run.period}</p>
                          <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{run.code}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateDisplay(run.runDate)}</td>
                        <td className="px-4 py-3 font-bold text-sm">{run.employees}</td>
                        <td className="px-4 py-3 font-semibold text-sm">{formatAmount(run.gross)}</td>
                        <td className="px-4 py-3 text-red-600 text-sm">{formatAmount(run.deductions)}</td>
                        <td className="px-4 py-3 font-bold text-green-600 text-sm">{formatAmount(run.net)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                            <StatusIcon size={10} />{run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedRun(selectedRun === run.id ? null : run.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary border border-primary/20 transition-colors"
                          >
                            <Eye size={12} /> {selectedRun === run.id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filteredRuns.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">No pay runs match the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employee Payslip Detail */}
          {selectedRun && selectedRunData && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-violet-50 border border-violet-200 rounded-xl">
                <div className="p-2.5 bg-white rounded-xl shadow-sm"><Play size={20} className="text-violet-600" /></div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-violet-800">{selectedRunData.period} — Employee-wise Payslip Data</p>
                  <p className="text-xs text-violet-700">{selectedRunData.employees} employees · Run on {formatDateDisplay(selectedRunData.runDate)}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-sm font-bold text-violet-700">{formatAmount(selectedRunData.gross)}</p><p className="text-[10px] text-violet-600">Gross</p></div>
                  <div><p className="text-sm font-bold text-red-600">{formatAmount(selectedRunData.deductions)}</p><p className="text-[10px] text-red-500">Deductions</p></div>
                  <div><p className="text-sm font-bold text-green-600">{formatAmount(selectedRunData.net)}</p><p className="text-[10px] text-green-500">Net</p></div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex gap-3 items-center flex-wrap">
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
                <div className="ml-auto text-xs text-muted-foreground">{filteredPayslips.length} employees</div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold text-green-700">Basic</th>
                        <th className="px-4 py-3 font-semibold text-green-700">HRA</th>
                        <th className="px-4 py-3 font-semibold text-green-700">Special</th>
                        <th className="px-4 py-3 font-semibold text-green-700">Gross</th>
                        <th className="px-4 py-3 font-semibold text-red-700">PF</th>
                        <th className="px-4 py-3 font-semibold text-red-700">ESI</th>
                        <th className="px-4 py-3 font-semibold text-red-700">PT</th>
                        <th className="px-4 py-3 font-semibold text-red-700">TDS</th>
                        <th className="px-4 py-3 font-semibold text-blue-700">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPayslips.map((emp, i) => (
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
                          <td className="px-4 py-3 text-green-700 font-medium">{formatAmount(emp.basic)}</td>
                          <td className="px-4 py-3 text-green-700 font-medium">{formatAmount(emp.hra)}</td>
                          <td className="px-4 py-3 text-green-700 font-medium">{formatAmount(emp.special)}</td>
                          <td className="px-4 py-3 font-bold text-green-700">{formatAmount(emp.gross)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(emp.pf)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(emp.esi)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(emp.pt)}</td>
                          <td className="px-4 py-3 text-red-600">{formatAmount(emp.tds)}</td>
                          <td className="px-4 py-3 font-bold text-blue-700">{formatAmount(emp.net)}</td>
                        </motion.tr>
                      ))}
                      {filteredPayslips.length === 0 && (
                        <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground text-sm">No employees match the selected filters.</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-accent/30 border-t-2 border-border">
                      <tr>
                        <td className="px-4 py-3 font-bold text-xs uppercase tracking-wide text-muted-foreground">Total</td>
                        <td className="px-4 py-3 font-bold text-green-700">{formatAmount(filteredPayslips.reduce((s, e) => s + e.basic, 0))}</td>
                        <td className="px-4 py-3 font-bold text-green-700">{formatAmount(filteredPayslips.reduce((s, e) => s + e.hra, 0))}</td>
                        <td className="px-4 py-3 font-bold text-green-700">{formatAmount(filteredPayslips.reduce((s, e) => s + e.special, 0))}</td>
                        <td className="px-4 py-3 font-bold text-green-700">{formatAmount(filteredPayslips.reduce((s, e) => s + e.gross, 0))}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{formatAmount(filteredPayslips.reduce((s, e) => s + e.pf, 0))}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{formatAmount(filteredPayslips.reduce((s, e) => s + e.esi, 0))}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{formatAmount(filteredPayslips.reduce((s, e) => s + e.pt, 0))}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{formatAmount(filteredPayslips.reduce((s, e) => s + e.tds, 0))}</td>
                        <td className="px-4 py-3 font-bold text-blue-700">{formatAmount(filteredPayslips.reduce((s, e) => s + e.net, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}