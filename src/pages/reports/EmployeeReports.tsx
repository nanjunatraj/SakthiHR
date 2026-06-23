import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  UserSquare, Download, Search, Users, UserPlus,
  UserMinus, Building2, ChevronLeft, BarChart2, Calendar,
  TrendingUp, Briefcase, MapPin, Filter, X, RefreshCw, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useEstablishment } from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useHierarchyEmployees, facetsOf } from '../../data/employeeHierarchyData';

const FINANCIAL_YEARS = ['2025-26', '2024-25', '2023-24', '2022-23'];
const TYPE_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#06b6d4', '#eab308'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const REPORT_TYPES = [
  { key: 'headcount', label: 'Headcount Report' },
  { key: 'department', label: 'Department-wise' },
  { key: 'joining', label: 'Joining & Exit' },
  { key: 'type', label: 'Employee Type' },
];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

export default function EmployeeReports() {
  const navigate = useNavigate();
  const hierarchyEmployees = useHierarchyEmployees();
  // Map the DB employees to this report's row shape.
  const EMPLOYEE_LIST = useMemo(() => hierarchyEmployees.map(e => ({
    id: e.employeeCode || e.id, name: e.name, dept: e.department, designation: e.designation,
    type: e.employeeType, doj: e.doj, location: e.workLocation, status: e.status,
  })), [hierarchyEmployees]);

  const { departments: deptFacets, locations: locFacets, employeeTypes: typeFacets } = useMemo(() => facetsOf(hierarchyEmployees), [hierarchyEmployees]);
  const DEPARTMENTS = ['All', ...deptFacets];
  const LOCATIONS = ['All', ...locFacets];
  const EMP_TYPES = ['All', ...typeFacets];

  // Chart aggregates derived from real employees.
  const DEPT_DATA = useMemo(() => deptFacets.map(dept => {
    const inDept = hierarchyEmployees.filter(e => e.department === dept);
    return { dept, count: inDept.length, male: 0, female: 0 };
  }), [hierarchyEmployees, deptFacets]);

  const EMP_TYPE_DATA = useMemo(() => typeFacets.map((name, i) => ({
    name, value: hierarchyEmployees.filter(e => e.employeeType === name).length, color: TYPE_COLORS[i % TYPE_COLORS.length],
  })), [hierarchyEmployees, typeFacets]);

  const JOINING_DATA = useMemo(() => MONTHS.map((month, i) => ({
    month,
    joined: hierarchyEmployees.filter(e => e.doj && new Date(e.doj).getMonth() === i).length,
    exited: 0,
  })), [hierarchyEmployees]);

  const [activeReport, setActiveReport] = useState('headcount');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [empTypeFilter, setEmpTypeFilter] = useState('All');
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const resetFilters = () => {
    setSearch('');
    setDeptFilter('All');
    setLocationFilter('All');
    setEmpTypeFilter('All');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = deptFilter !== 'All' || locationFilter !== 'All' || empTypeFilter !== 'All' || dateFrom || dateTo || search;

  const filtered = useMemo(() => {
    return EMPLOYEE_LIST.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.dept === deptFilter;
      const matchLocation = locationFilter === 'All' || e.location === locationFilter;
      const matchType = empTypeFilter === 'All' || e.type === empTypeFilter;
      const matchFrom = !dateFrom || e.doj >= dateFrom;
      const matchTo = !dateTo || e.doj <= dateTo;
      return matchSearch && matchDept && matchLocation && matchType && matchFrom && matchTo;
    });
  }, [EMPLOYEE_LIST, search, deptFilter, locationFilter, empTypeFilter, dateFrom, dateTo]);

  const totalEmployees = DEPT_DATA.reduce((s, d) => s + d.count, 0);
  const totalJoined = JOINING_DATA.reduce((s, d) => s + d.joined, 0);
  const totalExited = JOINING_DATA.reduce((s, d) => s + d.exited, 0);

  const est = useEstablishment();
  const [showView, setShowView] = useState(false);
  const reportDoc: StatementDoc = useMemo(() => ({
    title: 'Employee Report',
    establishment: est.name,
    subtitle: `${filtered.length} employees${hasActiveFilters ? ' (filtered)' : ''}`,
    columns: [
      { key: 'id', label: 'Emp ID' }, { key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' },
      { key: 'dept', label: 'Department' }, { key: 'location', label: 'Work Location' }, { key: 'type', label: 'Type' },
      { key: 'doj', label: 'Date of Joining' }, { key: 'status', label: 'Status' },
    ],
    rows: filtered.map(e => ({
      id: e.id, name: e.name, designation: e.designation || '—', dept: e.dept || '—', location: e.location || '—',
      type: e.type || '—', doj: e.doj || '—', status: e.status || '—',
    })),
    note: 'Computer-generated Employee Report.',
  }), [filtered, est.name, hasActiveFilters]);

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
              <div className="p-2 bg-blue-100 rounded-lg"><UserSquare size={22} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Employee Reports</h1>
                <p className="text-xs text-muted-foreground">Headcount, department-wise, joining & exit analytics.</p>
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
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm flex items-center gap-2"><Filter size={15} className="text-primary" /> Report Filters</h3>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw size={12} /> Reset
                    </button>
                  )}
                  <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors">
                    <X size={16} />
                  </button>
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
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Employee Type</label>
                  <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={empTypeFilter} onChange={e => setEmpTypeFilter(e.target.value)}>
                    {EMP_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {financialYear && <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">FY {financialYear}</span>}
                  {dateFrom && <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">From: {formatDateDisplay(dateFrom)}</span>}
                  {dateTo && <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">To: {formatDateDisplay(dateTo)}</span>}
                  {deptFilter !== 'All' && <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">Dept: {deptFilter}</span>}
                  {locationFilter !== 'All' && <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Location: {locationFilter}</span>}
                  {empTypeFilter !== 'All' && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Type: {empTypeFilter}</span>}
                </div>
              )}
            </motion.div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Employees', value: totalEmployees, sub: 'Active headcount', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Departments', value: DEPT_DATA.length, sub: 'Active departments', color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Building2 },
              { label: 'Joined (YTD)', value: totalJoined, sub: `FY ${financialYear}`, color: 'bg-green-100', iconColor: 'text-green-600', icon: UserPlus },
              { label: 'Exited (YTD)', value: totalExited, sub: `FY ${financialYear}`, color: 'bg-rose-100', iconColor: 'text-rose-600', icon: UserMinus },
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

          {/* Report Type Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {REPORT_TYPES.map(rt => (
              <button
                key={rt.key}
                onClick={() => setActiveReport(rt.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  activeReport === rt.key
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>

          {/* Department-wise Chart */}
          {activeReport === 'department' && (
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Building2 size={18} className="text-primary" /> Department-wise Headcount</h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DEPT_DATA} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="dept" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="male" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Male" stackId="a" />
                    <Bar dataKey="female" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Female" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 justify-center text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Male</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> Female</span>
              </div>
            </div>
          )}

          {/* Joining & Exit Chart */}
          {activeReport === 'joining' && (
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Calendar size={18} className="text-primary" /> Monthly Joining & Exit Trend — FY {financialYear}</h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={JOINING_DATA} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="joined" fill="#10b981" radius={[4, 4, 0, 0]} name="Joined" />
                    <Bar dataKey="exited" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Exited" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 justify-center text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Joined</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> Exited</span>
              </div>
            </div>
          )}

          {/* Employee Type Pie */}
          {activeReport === 'type' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <h2 className="font-bold mb-4 flex items-center gap-2"><Briefcase size={18} className="text-primary" /> Employee Type Distribution</h2>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={EMP_TYPE_DATA} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {EMP_TYPE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <h2 className="font-bold mb-4">Type Summary</h2>
                <div className="space-y-3">
                  {EMP_TYPE_DATA.map(item => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm flex-1">{item.name}</span>
                      <span className="font-bold text-sm">{item.value}</span>
                      <div className="w-24 h-1.5 bg-accent rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${(item.value / totalEmployees) * 100}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Headcount Table */}
          {activeReport === 'headcount' && (
            <>
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
                <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={empTypeFilter} onChange={e => setEmpTypeFilter(e.target.value)}>
                  {EMP_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <div className="ml-auto text-xs text-muted-foreground">{filtered.length} employees</div>
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">Department</th>
                        <th className="px-4 py-3 font-semibold">Designation</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Date of Joining</th>
                        <th className="px-4 py-3 font-semibold">Location</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((emp, i) => (
                        <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">{emp.name.split(' ').map(n => n[0]).join('')}</div>
                              <div>
                                <p className="text-sm font-medium">{emp.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{emp.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{emp.dept}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{emp.designation}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{emp.type}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateDisplay(emp.doj)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin size={11} />{emp.location}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{emp.status}</span>
                          </td>
                        </motion.tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No employees match the selected filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}