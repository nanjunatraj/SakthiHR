import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, ChevronDown, ChevronRight, Users, Building2,
  MapPin, Mail, Phone, AlertCircle, CheckCircle2, Info,
  ZoomIn, ZoomOut, RefreshCw, Download, Filter, Search,
  ChevronLeft, Star, Maximize2, Minimize2, Eye, X,
  ArrowRight, Clock, UserSquare
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import {
  useHierarchyEmployees,
  facetsOf,
  buildHierarchyTree,
  getDirectReports,
  getAllReports,
  getHierarchyPath,
  type HierarchyEmployee
} from '../../data/employeeHierarchyData';
import EmployeeAvatar from '../../components/EmployeeAvatar';
import { toast } from 'react-toastify';

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Engineering: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500' },
  Marketing: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', dot: 'bg-violet-500' },
  'Human Resources': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', dot: 'bg-rose-500' },
  Finance: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  Sales: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500' },
  Design: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300', dot: 'bg-pink-500' },
  Executive: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', dot: 'bg-indigo-500' },
};

function getDeptStyle(dept: string) {
  return DEPT_COLORS[dept] ?? { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', dot: 'bg-gray-400' };
}

// ─── Employee Node Card ───────────────────────────────────────────────────────

interface EmployeeNodeProps {
  employee: HierarchyEmployee;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  isHighlighted: boolean;
  onSelect: (emp: HierarchyEmployee) => void;
  isSelected: boolean;
  deptFilter: string;
}

const EmployeeNode = ({ employee, depth, isExpanded, onToggle, isHighlighted, onSelect, isSelected, deptFilter }: EmployeeNodeProps) => {
  const directReports = getDirectReports(employee.id);
  const allReports = getAllReports(employee.id);
  const deptStyle = getDeptStyle(employee.department);
  const hasChildren = directReports.length > 0;
  const isFiltered = deptFilter !== 'All' && employee.department !== deptFilter;

  if (isFiltered) return null;

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.05 }}
        className={`relative flex items-start gap-3 mb-3 ${depth > 0 ? 'ml-8' : ''}`}
      >
        {/* Connector line */}
        {depth > 0 && (
          <div className="absolute -left-8 top-6 w-8 h-px bg-border" />
        )}
        {depth > 0 && (
          <div className="absolute -left-8 -top-3 bottom-6 w-px bg-border" />
        )}

        {/* Expand/Collapse Button */}
        {hasChildren && (
          <button
            onClick={onToggle}
            className={`absolute -left-4 top-5 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
              isExpanded
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        )}

        {/* Employee Card */}
        <div
          onClick={() => onSelect(employee)}
          className={`flex-1 cursor-pointer rounded-xl border-2 transition-all shadow-sm hover:shadow-md ${
            isHighlighted
              ? 'border-amber-400 bg-amber-50 shadow-amber-100'
              : isSelected
              ? `${deptStyle.border} ${deptStyle.bg} shadow-md`
              : 'border-border bg-card hover:border-primary/40'
          }`}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <EmployeeAvatar employeeCode={employee.employeeCode} initials={employee.avatar} name={employee.name} size={40} rounded="xl" className={`${deptStyle.bg} ${deptStyle.text}`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">{employee.name}</p>
                  {isHighlighted && (
                    <span className="text-[9px] font-bold bg-amber-200 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Star size={8} /> Highlighted
                    </span>
                  )}
                  {depth === 0 && (
                    <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                      Root
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{employee.designation}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deptStyle.bg} ${deptStyle.text} ${deptStyle.border}`}>
                    {employee.department}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                    {employee.employeeCode}
                  </span>
                  {employee.status !== 'Active' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${employee.status === 'On Leave' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {employee.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="text-right shrink-0">
                {hasChildren && (
                  <div className="text-center">
                    <p className="text-sm font-bold text-primary">{directReports.length}</p>
                    <p className="text-[9px] text-muted-foreground">Direct</p>
                  </div>
                )}
                {allReports.length > directReports.length && (
                  <div className="text-center mt-1">
                    <p className="text-xs font-bold text-muted-foreground">{allReports.length}</p>
                    <p className="text-[9px] text-muted-foreground">Total</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`relative ${depth > 0 ? 'ml-8' : ''}`}>
              {/* Vertical connector */}
              <div className="absolute left-0 top-0 bottom-3 w-px bg-border" />
              <div className="pl-8">
                {directReports.map(child => (
                  <HierarchySubTree
                    key={child.id}
                    employee={child}
                    depth={depth + 1}
                    highlightId={isHighlighted ? '' : ''}
                    onSelect={onSelect}
                    selectedId={isSelected ? employee.id : ''}
                    deptFilter={deptFilter}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Recursive Sub-Tree ───────────────────────────────────────────────────────

interface HierarchySubTreeProps {
  employee: HierarchyEmployee;
  depth: number;
  highlightId: string;
  onSelect: (emp: HierarchyEmployee) => void;
  selectedId: string;
  deptFilter: string;
}

const HierarchySubTree = ({ employee, depth, highlightId, onSelect, selectedId, deptFilter }: HierarchySubTreeProps) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const directReports = getDirectReports(employee.id);
  const hasChildren = directReports.length > 0;
  const isHighlighted = employee.id === highlightId;
  const isSelected = employee.id === selectedId;
  const isFiltered = deptFilter !== 'All' && employee.department !== deptFilter;

  if (isFiltered) return null;

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.03 }}
        className="relative flex items-start gap-3 mb-3"
      >
        {/* Horizontal connector */}
        <div className="absolute -left-8 top-6 w-8 h-px bg-border" />

        {/* Expand/Collapse Button */}
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(v => !v)}
            className={`absolute -left-4 top-5 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
              isExpanded
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        )}

        {/* Employee Card */}
        <div
          onClick={() => onSelect(employee)}
          className={`flex-1 cursor-pointer rounded-xl border-2 transition-all shadow-sm hover:shadow-md ${
            isHighlighted
              ? 'border-amber-400 bg-amber-50 shadow-amber-100'
              : isSelected
              ? `${getDeptStyle(employee.department).border} ${getDeptStyle(employee.department).bg} shadow-md`
              : 'border-border bg-card hover:border-primary/40'
          }`}
        >
          <div className="p-3">
            <div className="flex items-center gap-3">
              <EmployeeAvatar employeeCode={employee.employeeCode} initials={employee.avatar} name={employee.name} size={36} rounded="lg" className={`${getDeptStyle(employee.department).bg} ${getDeptStyle(employee.department).text}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">{employee.name}</p>
                  {isHighlighted && (
                    <span className="text-[9px] font-bold bg-amber-200 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Star size={8} /> Highlighted
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{employee.designation}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${getDeptStyle(employee.department).bg} ${getDeptStyle(employee.department).text} ${getDeptStyle(employee.department).border}`}>
                    {employee.department}
                  </span>
                  {employee.status !== 'Active' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${employee.status === 'On Leave' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {employee.status}
                    </span>
                  )}
                </div>
              </div>
              {hasChildren && (
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-primary">{directReports.length}</p>
                  <p className="text-[9px] text-muted-foreground">reports</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative pl-8">
              <div className="absolute left-0 top-0 bottom-3 w-px bg-border" />
              {directReports.map(child => (
                <HierarchySubTree
                  key={child.id}
                  employee={child}
                  depth={depth + 1}
                  highlightId={highlightId}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  deptFilter={deptFilter}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Employee Detail Panel ────────────────────────────────────────────────────

interface EmployeeDetailPanelProps {
  employee: HierarchyEmployee;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const EmployeeDetailPanel = ({ employee, onClose, onNavigate }: EmployeeDetailPanelProps) => {
  const directReports = getDirectReports(employee.id);
  const allReports = getAllReports(employee.id);
  const hierarchyPath = getHierarchyPath(employee.id);
  const deptStyle = getDeptStyle(employee.department);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 bg-card border-l border-border flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className={`px-5 py-4 border-b border-border ${deptStyle.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${deptStyle.text}`}>Employee Profile</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/50 text-muted-foreground transition-colors"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-3">
          <EmployeeAvatar employeeCode={employee.employeeCode} initials={employee.avatar} name={employee.name} size={48} rounded="xl" className={`${deptStyle.bg} ${deptStyle.text} border-2 ${deptStyle.border}`} />
          <div>
            <p className="font-bold text-sm">{employee.name}</p>
            <p className="text-[11px] text-muted-foreground">{employee.designation}</p>
            <span className="text-[10px] font-mono text-muted-foreground bg-white/60 px-1.5 py-0.5 rounded mt-0.5 inline-block">{employee.employeeCode}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            employee.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' :
            employee.status === 'On Leave' ? 'bg-amber-100 text-amber-700 border-amber-200' :
            'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            {employee.status === 'Active' ? <CheckCircle2 size={9} /> : <Clock size={9} />}
            {employee.status}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deptStyle.bg} ${deptStyle.text} ${deptStyle.border}`}>
            {employee.department}
          </span>
        </div>

        {/* Contact */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Contact</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail size={12} className="shrink-0" /><span className="truncate">{employee.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone size={12} className="shrink-0" /><span>{employee.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin size={12} className="shrink-0" /><span className="truncate">{employee.workLocation}</span>
          </div>
        </div>

        {/* Employment */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Employment</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Type', value: employee.employeeType },
              { label: 'Grade', value: employee.employeeGrade },
              { label: 'DOJ', value: formatDate(employee.doj) },
            ].map(row => (
              <div key={row.label} className="p-2.5 bg-accent/30 rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{row.label}</p>
                <p className="text-xs font-semibold mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Hierarchy Path */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Hierarchy Path</p>
          <div className="space-y-1">
            {hierarchyPath.map((emp, i) => (
              <div key={emp.id} className="flex items-center gap-2">
                {i > 0 && <ArrowRight size={10} className="text-muted-foreground shrink-0" />}
                <button
                  onClick={() => onNavigate(emp.id)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${emp.id === employee.id ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${getDeptStyle(emp.department).bg} ${getDeptStyle(emp.department).text}`}>
                    {emp.avatar}
                  </div>
                  {emp.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Team Stats */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Team</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-center">
              <p className="text-xl font-bold text-primary">{directReports.length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Direct Reports</p>
            </div>
            <div className="p-3 bg-accent/30 border border-border rounded-xl text-center">
              <p className="text-xl font-bold text-muted-foreground">{allReports.length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Total Team</p>
            </div>
          </div>
        </div>

        {/* Direct Reports List */}
        {directReports.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Direct Reports</p>
            <div className="space-y-1.5">
              {directReports.map(report => (
                <button
                  key={report.id}
                  onClick={() => onNavigate(report.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/30 border border-border hover:border-primary/40 hover:bg-accent/60 transition-all text-left"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${getDeptStyle(report.department).bg} ${getDeptStyle(report.department).text}`}>
                    {report.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{report.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{report.designation}</p>
                  </div>
                  <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {employee.skills.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {employee.skills.map(skill => (
                <span key={skill} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hierarchy Status */}
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${employee.hierarchyComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          {employee.hierarchyComplete ? (
            <><CheckCircle2 size={15} className="text-green-600 shrink-0 mt-0.5" /><div><p className="text-xs font-semibold text-green-800">Hierarchy Complete</p><p className="text-[10px] text-green-700 mt-0.5">Reporting manager is assigned.</p></div></>
          ) : (
            <><AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" /><div><p className="text-xs font-semibold text-amber-800">Hierarchy Incomplete</p><p className="text-[10px] text-amber-700 mt-0.5">No reporting manager assigned. Please update in Employee Master.</p></div></>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeHierarchy() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') ?? '';

  const employees = useHierarchyEmployees();
  const DEPARTMENTS = useMemo(() => facetsOf(employees).departments, [employees]);

  const [selectedEmployee, setSelectedEmployee] = useState<HierarchyEmployee | null>(null);
  const [deptFilter, setDeptFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [expandAll, setExpandAll] = useState(false);
  const [expandKey, setExpandKey] = useState(0);

  // Root employees (no reporting manager)
  const rootEmployees = useMemo(() =>
    employees.filter(e => e.reportingManagerId === null && e.hierarchyComplete),
    [employees]
  );

  // Employees without hierarchy
  const incompleteEmployees = useMemo(() =>
    employees.filter(e => !e.hierarchyComplete),
    [employees]
  );

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return employees.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.designation.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(search.toLowerCase())
    );
  }, [employees, search]);

  // Auto-select highlighted employee
  useEffect(() => {
    if (highlightId) {
      const emp = employees.find(e => e.id === highlightId);
      if (emp) setSelectedEmployee(emp);
    }
  }, [employees, highlightId]);

  const handleNavigate = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (emp) setSelectedEmployee(emp);
  };

  const totalEmployees = employees.length;
  const hierarchyComplete = employees.filter(e => e.hierarchyComplete).length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Network size={22} className="text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Employee Hierarchy</h1>
                <p className="text-xs text-muted-foreground">Auto-generated from reporting manager assignments in Employee Master.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 size={14} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700">{hierarchyComplete}/{totalEmployees} hierarchy complete</span>
              </div>
              {incompleteEmployees.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle size={14} className="text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">{incompleteEmployees.length} incomplete</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Hierarchy Panel */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-6 space-y-6">
              {/* Controls */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex flex-wrap gap-3 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    placeholder="Search employees in hierarchy..."
                    className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {/* Department Filter */}
                <select
                  className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>

                {/* Expand/Collapse All */}
                <button
                  onClick={() => { setExpandAll(v => !v); setExpandKey(k => k + 1); }}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground"
                >
                  {expandAll ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  {expandAll ? 'Collapse All' : 'Expand All'}
                </button>

                <div className="ml-auto text-xs text-muted-foreground">
                  {totalEmployees} employees · {rootEmployees.length} root node{rootEmployees.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Search Results */}
              {search.trim() && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                    Search Results ({searchResults.length})
                  </p>
                  {searchResults.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.map(emp => {
                        const deptStyle = getDeptStyle(emp.department);
                        return (
                          <button
                            key={emp.id}
                            onClick={() => { setSelectedEmployee(emp); setSearch(''); }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/30 transition-all text-left"
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${deptStyle.bg} ${deptStyle.text}`}>
                              {emp.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{emp.name}</p>
                              <p className="text-[11px] text-muted-foreground">{emp.designation} · {emp.department}</p>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded shrink-0">{emp.employeeCode}</span>
                            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No employees found matching "{search}"</p>
                  )}
                </div>
              )}

              {/* Legend */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Department Legend</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(DEPT_COLORS).map(([dept, style]) => (
                    <button
                      key={dept}
                      onClick={() => setDeptFilter(deptFilter === dept ? 'All' : dept)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        deptFilter === dept
                          ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-current`
                          : `${style.bg} ${style.text} ${style.border} hover:opacity-80`
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                      {dept}
                    </button>
                  ))}
                  {deptFilter !== 'All' && (
                    <button onClick={() => setDeptFilter('All')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2">
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Hierarchy Tree */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Network size={18} className="text-primary" />
                  <h2 className="font-bold text-base">Organisation Hierarchy</h2>
                  <span className="text-xs text-muted-foreground ml-auto">Click any node to view details · Click +/- to expand/collapse</span>
                </div>

                {rootEmployees.length > 0 ? (
                  <div className="space-y-4">
                    {rootEmployees.map(root => (
                      <RootHierarchyNode
                        key={`${root.id}-${expandKey}`}
                        employee={root}
                        highlightId={highlightId}
                        onSelect={setSelectedEmployee}
                        selectedId={selectedEmployee?.id ?? ''}
                        deptFilter={deptFilter}
                        defaultExpanded={expandAll}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Network size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="font-semibold text-muted-foreground">No hierarchy data available</p>
                    <p className="text-xs text-muted-foreground mt-1">Assign reporting managers in Employee Master to build the hierarchy.</p>
                  </div>
                )}
              </div>

              {/* Incomplete Hierarchy Section */}
              {incompleteEmployees.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertCircle size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-amber-900">Hierarchy Incomplete — {incompleteEmployees.length} Employee{incompleteEmployees.length !== 1 ? 's' : ''}</h2>
                      <p className="text-xs text-amber-700 mt-0.5">These employees do not have a reporting manager assigned. Please update in Employee Master to complete the hierarchy.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {incompleteEmployees.map(emp => {
                      const deptStyle = getDeptStyle(emp.department);
                      return (
                        <motion.div
                          key={emp.id}
                          whileHover={{ y: -2 }}
                          onClick={() => setSelectedEmployee(emp)}
                          className="bg-white border border-amber-200 rounded-xl p-4 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${deptStyle.bg} ${deptStyle.text}`}>
                              {emp.avatar}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{emp.name}</p>
                              <p className="text-[11px] text-muted-foreground">{emp.designation}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deptStyle.bg} ${deptStyle.text} ${deptStyle.border}`}>
                              {emp.department}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{emp.employeeCode}</span>
                          </div>
                          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertCircle size={11} className="text-amber-600 shrink-0" />
                            <p className="text-[10px] text-amber-700 font-medium">No reporting manager assigned</p>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{emp.workLocation}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-white border border-amber-200 rounded-xl">
                    <Info size={15} className="text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">
                      To complete the hierarchy, go to <strong>Employee Master</strong> → Employment Details → Reporting Manager and assign the appropriate manager for each employee listed above.
                    </p>
                    <button
                      onClick={() => navigate('/employees/new')}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors shrink-0"
                    >
                      Go to Employee Master <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {selectedEmployee && (
              <EmployeeDetailPanel
                employee={selectedEmployee}
                onClose={() => setSelectedEmployee(null)}
                onNavigate={handleNavigate}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Root Hierarchy Node (with internal expand state) ─────────────────────────

interface RootHierarchyNodeProps {
  employee: HierarchyEmployee;
  highlightId: string;
  onSelect: (emp: HierarchyEmployee) => void;
  selectedId: string;
  deptFilter: string;
  defaultExpanded: boolean;
}

const RootHierarchyNode = ({ employee, highlightId, onSelect, selectedId, deptFilter, defaultExpanded }: RootHierarchyNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const directReports = getDirectReports(employee.id);
  const allReports = getAllReports(employee.id);
  const hasChildren = directReports.length > 0;
  const isHighlighted = employee.id === highlightId;
  const isSelected = employee.id === selectedId;
  const deptStyle = getDeptStyle(employee.department);
  const isFiltered = deptFilter !== 'All' && employee.department !== deptFilter;

  useEffect(() => {
    setIsExpanded(defaultExpanded || true);
  }, [defaultExpanded]);

  if (isFiltered) return null;

  return (
    <div>
      {/* Root Node */}
      <div className="flex items-start gap-3 mb-4">
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(v => !v)}
            className={`mt-5 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all shrink-0 ${
              isExpanded
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}

        <div
          onClick={() => onSelect(employee)}
          className={`flex-1 cursor-pointer rounded-xl border-2 transition-all shadow-sm hover:shadow-md ${
            isHighlighted
              ? 'border-amber-400 bg-amber-50 shadow-amber-100'
              : isSelected
              ? `${deptStyle.border} ${deptStyle.bg} shadow-md`
              : 'border-border bg-card hover:border-primary/40'
          }`}
        >
          <div className="p-5">
            <div className="flex items-start gap-4">
              <EmployeeAvatar employeeCode={employee.employeeCode} initials={employee.avatar} name={employee.name} size={56} rounded="xl" className={`${deptStyle.bg} ${deptStyle.text} border-2 ${deptStyle.border}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-base">{employee.name}</p>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">Root</span>
                  {isHighlighted && (
                    <span className="text-[10px] font-bold bg-amber-200 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Star size={9} /> Highlighted
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{employee.designation}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deptStyle.bg} ${deptStyle.text} ${deptStyle.border}`}>
                    {employee.department}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{employee.employeeCode}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MapPin size={10} /> {employee.workLocation}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{directReports.length}</p>
                  <p className="text-[10px] text-muted-foreground">Direct Reports</p>
                </div>
                {allReports.length > directReports.length && (
                  <div className="text-center mt-1">
                    <p className="text-sm font-bold text-muted-foreground">{allReports.length}</p>
                    <p className="text-[10px] text-muted-foreground">Total Team</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative pl-12">
              <div className="absolute left-3 top-0 bottom-3 w-px bg-border" />
              {directReports.map(child => (
                <HierarchySubTree
                  key={child.id}
                  employee={child}
                  depth={1}
                  highlightId={highlightId}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  deptFilter={deptFilter}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};