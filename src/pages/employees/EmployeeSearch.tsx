import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Users, Building2, MapPin, Mail, Phone,
  Calendar, Network, ChevronRight, Filter, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Star, Briefcase,
  Award, Tag, ArrowRight, Eye, UserSquare, Sparkles,
  Hash, TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import {
  useHierarchyEmployees,
  facetsOf,
  getDirectReports,
  getReportingManager,
  getHierarchyPath,
  getAllReports,
  type HierarchyEmployee
} from '../../data/employeeHierarchyData';
import EmployeeAvatar from '../../components/EmployeeAvatar';

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Engineering: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Marketing: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  'Human Resources': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  Finance: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  Sales: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  Design: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  Executive: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
};

function getDeptStyle(dept: string) {
  return DEPT_COLORS[dept] ?? { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
}

const STATUS_STYLES: Record<HierarchyEmployee['status'], { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Active: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle2 },
  Inactive: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', icon: X },
  'On Leave': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
};

// ─── Search Result Card ───────────────────────────────────────────────────────

interface SearchResultCardProps {
  employee: HierarchyEmployee;
  query: string;
  onViewHierarchy: (id: string) => void;
  onSelect: (emp: HierarchyEmployee) => void;
  isSelected: boolean;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5">{part}</mark> : part
  );
}

const SearchResultCard = ({ employee, query, onViewHierarchy, onSelect, isSelected }: SearchResultCardProps) => {
  const statusStyle = STATUS_STYLES[employee.status];
  const StatusIcon = statusStyle.icon;
  const deptStyle = getDeptStyle(employee.department);
  const manager = getReportingManager(employee.id);
  const directReports = getDirectReports(employee.id);
  const allReports = getAllReports(employee.id);
  const hierarchyPath = getHierarchyPath(employee.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-xl border-2 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer ${
        isSelected ? `${deptStyle.border} shadow-md` : 'border-border hover:border-primary/40'
      }`}
      onClick={() => onSelect(employee)}
    >
      <div className={`h-1 w-full ${employee.status === 'Active' ? 'bg-green-400' : employee.status === 'On Leave' ? 'bg-amber-400' : 'bg-gray-300'}`} />
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <EmployeeAvatar employeeCode={employee.employeeCode} initials={employee.avatar} name={employee.name} size={48} rounded="xl" className={`${deptStyle.bg} ${deptStyle.text}`} />

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-sm">{highlightText(employee.name, query)}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                <StatusIcon size={9} />
                {employee.status}
              </span>
              {!employee.hierarchyComplete && (
                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <AlertCircle size={8} /> Incomplete
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{highlightText(employee.designation, query)}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deptStyle.bg} ${deptStyle.text} ${deptStyle.border}`}>
                {employee.department}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                {highlightText(employee.employeeCode, query)}
              </span>
              <span className="text-[10px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full">
                {employee.employeeGrade}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="text-right shrink-0 space-y-1">
            <div className="text-center">
              <p className="text-sm font-bold text-primary">{directReports.length}</p>
              <p className="text-[9px] text-muted-foreground">Direct</p>
            </div>
            {allReports.length > 0 && (
              <div className="text-center">
                <p className="text-xs font-bold text-muted-foreground">{allReports.length}</p>
                <p className="text-[9px] text-muted-foreground">Total</p>
              </div>
            )}
          </div>
        </div>

        {/* Details Row */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{employee.workLocation}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail size={11} className="shrink-0" />
            <span className="truncate">{employee.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar size={11} className="shrink-0" />
            <span>Joined {formatDate(employee.doj)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tag size={11} className="shrink-0" />
            <span>{employee.employeeType}</span>
          </div>
        </div>

        {/* Hierarchy Path */}
        {hierarchyPath.length > 1 && (
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium">Path:</span>
            {hierarchyPath.map((emp, i) => (
              <React.Fragment key={emp.id}>
                {i > 0 && <ChevronRight size={10} className="text-muted-foreground" />}
                <span className={`text-[10px] font-semibold ${emp.id === employee.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {emp.name}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Reporting Manager */}
        {manager && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-accent/30 rounded-lg border border-border">
            <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${getDeptStyle(manager.department).bg} ${getDeptStyle(manager.department).text}`}>
              {manager.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium">Reports to</p>
              <p className="text-xs font-semibold truncate">{manager.name} · {manager.designation}</p>
            </div>
          </div>
        )}

        {/* Skills */}
        {employee.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {employee.skills.slice(0, 4).map(skill => (
              <span key={skill} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                {skill}
              </span>
            ))}
            {employee.skills.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{employee.skills.length - 4} more</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onViewHierarchy(employee.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-primary/10 text-primary border border-primary/20 transition-colors"
          >
            <Network size={12} /> View in Hierarchy
          </button>
          <div className="ml-auto text-[10px] text-muted-foreground">
            {employee.hierarchyComplete ? (
              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={10} /> Hierarchy complete</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600"><AlertCircle size={10} /> Manager not assigned</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeSearch() {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const employees = useHierarchyEmployees();
  const { departments: DEPARTMENTS, locations: LOCATIONS, designations: DESIGNATIONS, employeeTypes: EMPLOYEE_TYPES } = useMemo(() => facetsOf(employees), [employees]);

  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'On Leave'>('All');
  const [hierarchyFilter, setHierarchyFilter] = useState<'All' | 'Complete' | 'Incomplete'>('All');
  const [selectedEmployee, setSelectedEmployee] = useState<HierarchyEmployee | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Auto-focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return employees.filter(e => {
      const matchQuery = !q ||
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.workLocation.toLowerCase().includes(q) ||
        e.skills.some(s => s.toLowerCase().includes(q));
      const matchDept = deptFilter === 'All' || e.department === deptFilter;
      const matchLoc = locationFilter === 'All' || e.workLocation === locationFilter;
      const matchType = typeFilter === 'All' || e.employeeType === typeFilter;
      const matchStatus = statusFilter === 'All' || e.status === statusFilter;
      const matchHierarchy = hierarchyFilter === 'All' ||
        (hierarchyFilter === 'Complete' && e.hierarchyComplete) ||
        (hierarchyFilter === 'Incomplete' && !e.hierarchyComplete);
      return matchQuery && matchDept && matchLoc && matchType && matchStatus && matchHierarchy;
    });
  }, [employees, query, deptFilter, locationFilter, typeFilter, statusFilter, hierarchyFilter]);

  const hasFilters = deptFilter !== 'All' || locationFilter !== 'All' || typeFilter !== 'All' || statusFilter !== 'All' || hierarchyFilter !== 'All';

  const resetFilters = () => {
    setDeptFilter('All');
    setLocationFilter('All');
    setTypeFilter('All');
    setStatusFilter('All');
    setHierarchyFilter('All');
  };

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim() && !recentSearches.includes(q.trim())) {
      setRecentSearches(prev => [q.trim(), ...prev.slice(0, 4)]);
    }
  };

  const handleViewHierarchy = (id: string) => {
    navigate(`/employees/hierarchy?highlight=${id}`);
  };

  // Stats
  const activeCount = results.filter(e => e.status === 'Active').length;
  const incompleteCount = results.filter(e => !e.hierarchyComplete).length;
  const deptBreakdown = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = results.filter(e => e.department === dept).length;
    return acc;
  }, {} as Record<string, number>);

  const showResults = query.trim() || hasFilters;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Search size={22} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Employee Search</h1>
              <p className="text-xs text-muted-foreground">Search across all employees by name, code, designation, skills, department, or location.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Search Box */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name, employee code, designation, skills, department, location..."
                className="w-full pl-12 pr-12 py-4 bg-accent/50 border-2 border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-base transition-all"
                value={query}
                onChange={e => handleSearch(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Quick Stats */}
            {showResults && (
              <div className="mt-4 flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{results.length} result{results.length !== 1 ? 's' : ''}</span>
                {activeCount > 0 && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={11} /> {activeCount} active</span>}
                {incompleteCount > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertCircle size={11} /> {incompleteCount} hierarchy incomplete</span>}
                {hasFilters && (
                  <button onClick={resetFilters} className="flex items-center gap-1 text-primary hover:underline font-medium ml-auto">
                    <RefreshCw size={11} /> Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Advanced Filters */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowAdvancedFilters(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <Filter size={15} />
                Advanced Filters
                {hasFilters && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
              </button>
              {hasFilters && (
                <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw size={12} /> Reset All
                </button>
              )}
            </div>

            <AnimatePresence>
              {showAdvancedFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Department</label>
                      <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none text-xs appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                        <option value="All">All Departments</option>
                        {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Location</label>
                      <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none text-xs appearance-none" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                        <option value="All">All Locations</option>
                        {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Employee Type</label>
                      <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none text-xs appearance-none" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                        <option value="All">All Types</option>
                        {EMPLOYEE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Status</label>
                      <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none text-xs appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                        <option value="All">All Status</option>
                        <option>Active</option>
                        <option>Inactive</option>
                        <option>On Leave</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Hierarchy</label>
                      <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none text-xs appearance-none" value={hierarchyFilter} onChange={e => setHierarchyFilter(e.target.value as any)}>
                        <option value="All">All</option>
                        <option value="Complete">Complete</option>
                        <option value="Incomplete">Incomplete</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* No Query State — Show All / Recent */}
          {!showResults && (
            <div className="space-y-6">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Clock size={13} /> Recent Searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map(s => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-accent/50 border border-border rounded-full text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
                      >
                        <Search size={11} /> {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Employees', value: employees.length, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
                  { label: 'Active', value: employees.filter(e => e.status === 'Active').length, color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
                  { label: 'Departments', value: DEPARTMENTS.length, color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Building2 },
                  { label: 'Hierarchy Incomplete', value: employees.filter(e => !e.hierarchyComplete).length, color: 'bg-amber-100', iconColor: 'text-amber-600', icon: AlertCircle },
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

              {/* Browse by Department */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Building2 size={13} /> Browse by Department
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {DEPARTMENTS.map(dept => {
                    const count = employees.filter(e => e.department === dept).length;
                    const deptStyle = getDeptStyle(dept);
                    return (
                      <button
                        key={dept}
                        onClick={() => { setDeptFilter(dept); setShowAdvancedFilters(true); }}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-sm ${deptStyle.bg} ${deptStyle.border} hover:opacity-80`}
                      >
                        <div>
                          <p className={`font-bold text-sm ${deptStyle.text}`}>{dept}</p>
                          <p className={`text-[10px] ${deptStyle.text} opacity-70`}>{count} employee{count !== 1 ? 's' : ''}</p>
                        </div>
                        <ChevronRight size={14} className={deptStyle.text} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Search Suggestions */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Sparkles size={13} /> Quick Search Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Engineering Manager', 'CEO', 'React', 'Mumbai', 'Permanent', 'Active', 'DevOps', 'HR Manager'].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setQuery(suggestion)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/50 border border-border rounded-full text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
                    >
                      <Search size={11} /> {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search Results */}
          {showResults && (
            <div className="space-y-4">
              {/* Department Breakdown */}
              {results.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(deptBreakdown).filter(([, count]) => count > 0).map(([dept, count]) => {
                    const deptStyle = getDeptStyle(dept);
                    return (
                      <button
                        key={dept}
                        onClick={() => setDeptFilter(deptFilter === dept ? 'All' : dept)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          deptFilter === dept
                            ? `${deptStyle.bg} ${deptStyle.text} ${deptStyle.border} ring-2 ring-offset-1 ring-current`
                            : `${deptStyle.bg} ${deptStyle.text} ${deptStyle.border} hover:opacity-80`
                        }`}
                      >
                        {dept} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Results Grid */}
              {results.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {results.map(emp => (
                    <SearchResultCard
                      key={emp.id}
                      employee={emp}
                      query={query}
                      onViewHierarchy={handleViewHierarchy}
                      onSelect={setSelectedEmployee}
                      isSelected={selectedEmployee?.id === emp.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <Search size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground">No employees found</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-5">
                    {query ? `No results for "${query}"` : 'No employees match the selected filters'}
                  </p>
                  <div className="flex items-center gap-3 justify-center">
                    {query && (
                      <button onClick={() => setQuery('')} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
                        <X size={15} /> Clear Search
                      </button>
                    )}
                    {hasFilters && (
                      <button onClick={resetFilters} className="flex items-center gap-2 px-5 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                        <RefreshCw size={15} /> Reset Filters
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}