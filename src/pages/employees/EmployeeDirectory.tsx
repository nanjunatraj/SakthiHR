import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserSquare, Search, Filter, Download, Plus, Mail, Phone,
  MapPin, Briefcase, Building2, ChevronRight, Users, X,
  RefreshCw, Eye, Network, Calendar, Tag, Award, CheckCircle2,
  AlertCircle, Clock, LayoutGrid, List, ChevronDown, Pencil
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import {
  useHierarchyEmployees,
  facetsOf,
  getDirectReports,
  getReportingManager,
  type HierarchyEmployee
} from '../../data/employeeHierarchyData';
import { toast } from 'react-toastify';
import EmployeeAvatar from '../../components/EmployeeAvatar';

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

const STATUS_STYLES: Record<HierarchyEmployee['status'], { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Active: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle2 },
  Inactive: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', icon: X },
  'On Leave': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
};

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-700 border-blue-200',
  Marketing: 'bg-violet-100 text-violet-700 border-violet-200',
  'Human Resources': 'bg-rose-100 text-rose-700 border-rose-200',
  Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Sales: 'bg-amber-100 text-amber-700 border-amber-200',
  Design: 'bg-pink-100 text-pink-700 border-pink-200',
  Executive: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

function getDeptColor(dept: string): string {
  return DEPT_COLORS[dept] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

interface EmployeeCardProps {
  employee: HierarchyEmployee;
  onViewHierarchy: (id: string) => void;
  onEdit: (id: string) => void;
}

const EmployeeCard = ({ employee, onViewHierarchy, onEdit }: EmployeeCardProps) => {
  const statusStyle = STATUS_STYLES[employee.status];
  const StatusIcon = statusStyle.icon;
  const manager = getReportingManager(employee.id);
  const directReports = getDirectReports(employee.id);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden group"
    >
      <div className={`h-1.5 w-full ${employee.status === 'Active' ? 'bg-green-400' : employee.status === 'On Leave' ? 'bg-amber-400' : 'bg-gray-300'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <EmployeeAvatar employeeCode={employee.employeeCode} initials={employee.avatar} name={employee.name} size={48} rounded="xl" />
            <div>
              <h3 className="font-bold text-sm">{employee.name}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{employee.designation}</p>
              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded mt-0.5 inline-block">{employee.employeeCode}</span>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
            <StatusIcon size={9} />
            {employee.status}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 size={12} className="shrink-0" />
            <span className="truncate">{employee.department}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{employee.workLocation}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail size={12} className="shrink-0" />
            <span className="truncate">{employee.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar size={12} className="shrink-0" />
            <span>Joined {formatDate(employee.doj)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDeptColor(employee.department)}`}>
            {employee.department}
          </span>
          <span className="text-[10px] font-bold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
            {employee.employeeType}
          </span>
          <span className="text-[10px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full">
            {employee.employeeGrade}
          </span>
        </div>

        {manager && (
          <div className="mb-3 px-3 py-2 bg-accent/30 rounded-lg border border-border">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Reports To</p>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px] shrink-0">{manager.avatar}</div>
              <div>
                <p className="text-xs font-semibold">{manager.name}</p>
                <p className="text-[10px] text-muted-foreground">{manager.designation}</p>
              </div>
            </div>
          </div>
        )}

        {!employee.hierarchyComplete && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle size={12} className="text-amber-600 shrink-0" />
            <p className="text-[10px] text-amber-700 font-medium">Reporting manager not assigned</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Users size={11} />
            <span>{directReports.length} direct report{directReports.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => onEdit(employee.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-primary/10 text-primary border border-primary/20 transition-colors"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={() => onViewHierarchy(employee.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-accent text-muted-foreground border border-border transition-colors"
          >
            <Network size={12} /> Hierarchy
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface EmployeeRowProps {
  employee: HierarchyEmployee;
  index: number;
  onViewHierarchy: (id: string) => void;
  onEdit: (id: string) => void;
}

const EmployeeRow = ({ employee, index, onViewHierarchy, onEdit }: EmployeeRowProps) => {
  const statusStyle = STATUS_STYLES[employee.status];
  const StatusIcon = statusStyle.icon;
  const manager = getReportingManager(employee.id);
  const directReports = getDirectReports(employee.id);

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="hover:bg-accent/30 transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <EmployeeAvatar employeeCode={employee.employeeCode} initials={employee.avatar} name={employee.name} size={32} rounded="lg" />
          <div>
            <p className="font-semibold text-sm">{employee.name}</p>
            <p className="text-[10px] font-mono text-muted-foreground">{employee.employeeCode}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{employee.designation}</p>
        <p className="text-[10px] text-muted-foreground">{employee.department}</p>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{employee.workLocation}</td>
      <td className="px-4 py-3">
        {manager ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px] shrink-0">{manager.avatar}</div>
            <div>
              <p className="text-xs font-medium">{manager.name}</p>
              <p className="text-[10px] text-muted-foreground">{manager.designation}</p>
            </div>
          </div>
        ) : (
          <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
            <AlertCircle size={10} /> Not assigned
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-xs font-bold text-primary">{directReports.length}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
          <StatusIcon size={9} />
          {employee.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(employee.doj)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(employee.id)}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            title="Edit Employee"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onViewHierarchy(employee.id)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
            title="View in Hierarchy"
          >
            <Network size={14} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

export default function EmployeeDirectory() {
  const navigate = useNavigate();
  const employees = useHierarchyEmployees();
  const { departments: DEPARTMENTS, locations: LOCATIONS, designations: DESIGNATIONS, employeeTypes: EMPLOYEE_TYPES } = useMemo(() => facetsOf(employees), [employees]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'On Leave'>('All');
  const [hierarchyFilter, setHierarchyFilter] = useState<'All' | 'Complete' | 'Incomplete'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() =>
    employees.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        e.designation.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.department === deptFilter;
      const matchLoc = locationFilter === 'All' || e.workLocation === locationFilter;
      const matchType = typeFilter === 'All' || e.employeeType === typeFilter;
      const matchStatus = statusFilter === 'All' || e.status === statusFilter;
      const matchHierarchy = hierarchyFilter === 'All' ||
        (hierarchyFilter === 'Complete' && e.hierarchyComplete) ||
        (hierarchyFilter === 'Incomplete' && !e.hierarchyComplete);
      return matchSearch && matchDept && matchLoc && matchType && matchStatus && matchHierarchy;
    }),
    [employees, search, deptFilter, locationFilter, typeFilter, statusFilter, hierarchyFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setDeptFilter('All');
    setLocationFilter('All');
    setTypeFilter('All');
    setStatusFilter('All');
    setHierarchyFilter('All');
  };

  const hasFilters = search || deptFilter !== 'All' || locationFilter !== 'All' || typeFilter !== 'All' || statusFilter !== 'All' || hierarchyFilter !== 'All';

  const handleViewHierarchy = (id: string) => {
    navigate(`/employees/hierarchy?highlight=${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/employees/${id}/edit`);
  };

  const handleExport = () => {
    const headers = ['Emp Code', 'Name', 'Designation', 'Department', 'Location', 'Type', 'Grade', 'Status', 'DOJ', 'Reporting Manager', 'Direct Reports', 'Hierarchy Complete'];
    const rows = filtered.map(e => {
      const manager = getReportingManager(e.id);
      const reports = getDirectReports(e.id);
      return [e.employeeCode, e.name, e.designation, e.department, e.workLocation, e.employeeType, e.employeeGrade, e.status, formatDate(e.doj), manager?.name ?? 'Not Assigned', reports.length, e.hierarchyComplete ? 'Yes' : 'No'];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Employee_Directory.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Employee Directory exported as CSV.');
  };

  const activeCount = employees.filter(e => e.status === 'Active').length;
  const incompleteCount = employees.filter(e => !e.hierarchyComplete).length;
  const deptCounts = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = employees.filter(e => e.department === dept).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserSquare size={22} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Employee Directory</h1>
                <p className="text-xs text-muted-foreground">Complete employee listing with hierarchy status and reporting structure.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent text-muted-foreground'}`}
              >
                <Filter size={15} /> Filters {hasFilters && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
              </button>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}><LayoutGrid size={16} /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}><List size={16} /></button>
              </div>
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                <Download size={15} /> Export
              </button>
              <button onClick={() => navigate('/employees/new')} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
                <Plus size={16} /> Add Employee
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Employees', value: employees.length, sub: `${activeCount} active`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Departments', value: DEPARTMENTS.length, sub: 'Across all locations', color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Building2 },
              { label: 'Hierarchy Complete', value: employees.length - incompleteCount, sub: `${incompleteCount} incomplete`, color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Hierarchy Incomplete', value: incompleteCount, sub: 'No manager assigned', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: AlertCircle },
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

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Filter size={15} className="text-primary" /> Filters</h3>
                  <div className="flex items-center gap-2">
                    {hasFilters && <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><RefreshCw size={12} /> Reset</button>}
                    <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"><X size={16} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Department</label>
                    <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                      <option value="All">All Departments</option>
                      {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Location</label>
                    <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                      <option value="All">All Locations</option>
                      {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Employee Type</label>
                    <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                      <option value="All">All Types</option>
                      {EMPLOYEE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Status</label>
                    <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                      <option value="All">All Status</option>
                      <option>Active</option>
                      <option>Inactive</option>
                      <option>On Leave</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Hierarchy</label>
                    <select className="w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm appearance-none" value={hierarchyFilter} onChange={e => setHierarchyFilter(e.target.value as any)}>
                      <option value="All">All</option>
                      <option value="Complete">Complete</option>
                      <option value="Incomplete">Incomplete</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Bar */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search by name, code, designation, or email..."
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 size={13} className="text-green-500" />
              <span>{filtered.length} of {employees.length} employees</span>
            </div>
          </div>

          {/* Department Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setDeptFilter('All')} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${deptFilter === 'All' ? 'bg-primary text-primary-foreground border-primary' : 'bg-accent text-muted-foreground border-border hover:border-primary/40'}`}>
              All ({employees.length})
            </button>
            {DEPARTMENTS.map(dept => {
              const count = deptCounts[dept] ?? 0;
              const isActive = deptFilter === dept;
              return (
                <button key={dept} onClick={() => setDeptFilter(deptFilter === dept ? 'All' : dept)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isActive ? `${getDeptColor(dept)} ring-2 ring-offset-1 ring-current` : `${getDeptColor(dept)} hover:opacity-80`}`}>
                  {dept} ({count})
                </button>
              );
            })}
          </div>

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map(emp => (
                <EmployeeCard key={emp.id} employee={emp} onViewHierarchy={handleViewHierarchy} onEdit={handleEdit} />
              ))}
              {filtered.length === 0 && (
                <div className="col-span-3 text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <UserSquare size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground">No employees match your filters</p>
                  <button onClick={resetFilters} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto">
                    <RefreshCw size={15} /> Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Designation / Dept</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Reporting Manager</th>
                      <th className="px-4 py-3 font-semibold text-center">Direct Reports</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">DOJ</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((emp, i) => (
                      <EmployeeRow key={emp.id} employee={emp} index={i} onViewHierarchy={handleViewHierarchy} onEdit={handleEdit} />
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No employees match the selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}