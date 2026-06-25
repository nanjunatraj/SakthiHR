import DateInput from '../DateInput';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import { upsertEmployeeAssignment, loadDbStructures } from '../../lib/salaryAssignments';
import { solveForTarget } from '../../lib/salarySolver';
import { loadStatutorySettings, type StatutorySettings, type PtSlab } from '../../lib/statutory';
import type { SalaryStructure } from '../../data/salaryStructures';
import {
  Layers, ChevronLeft, Plus, Search, Pencil, Trash2, X, Save,
  CheckCircle2, AlertCircle, Info, Users, Building2, Tag,
  Award, Briefcase, Grid3X3, Calendar, ChevronDown, Eye,
  DollarSign, Percent, Hash, TrendingUp, RefreshCw, Copy,
  Filter, Download, BarChart3, Wallet, Calculator, Star,
  ArrowRight, Clock, Lock, Unlock, Settings2, Shield
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type CalculationBasis = 'Fixed' | 'Percentage of Basic' | 'Percentage of Gross' | 'Percentage of CTC' | 'Formula';
type AssignmentStatus = 'Active' | 'Inactive' | 'Draft';

interface SalaryComponentOverride {
  componentId: string;
  componentName: string;
  componentCode: string;
  componentType: 'Earning' | 'Deduction' | 'Employer Contribution' | 'Reimbursement';
  calculationBasis: CalculationBasis;
  value: number;
  formula: string;
  isOverridden: boolean;
}

interface EmployeeSalaryAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  employeeType: string;
  employeeGrade: string;
  avatar: string;
  salaryStructureId: string;
  salaryStructureName: string;
  salaryStructureCode: string;
  ctcAnnual: number;
  ctcMonthly: number;
  effectiveFrom: string;
  effectiveTo: string;
  status: AssignmentStatus;
  componentOverrides: SalaryComponentOverride[];
  statutoryOverrides?: StatutoryOverrides | null;
  createdAt: string;
  remarks: string;
}

interface StatutoryOverrides {
  pf: { eligible: boolean; employeeRate: number; employerRate: number; ceiling: number };
  esi: { eligible: boolean; employeeRate: number; employerRate: number; ceiling: number };
  pt: { eligible: boolean };
}

interface BulkAssignmentFilter {
  employeeType: string[];
  employeeGroup: string[];
  employeeCategory: string[];
  employeeSection: string[];
  employeeGrade: string[];
  designation: string[];
  department: string[];
  allEmployees: boolean;
}

interface BulkAssignment {
  id: string;
  salaryStructureId: string;
  salaryStructureName: string;
  salaryStructureCode: string;
  filterCriteria: BulkAssignmentFilter;
  ctcAnnual: number;
  effectiveFrom: string;
  effectiveTo: string;
  allocatedEmployees: string[];
  status: AssignmentStatus;
  createdAt: string;
  remarks: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ssadb = supabase as unknown as SupabaseClient;
interface StructComp { componentId: string; componentName: string; componentCode: string; componentType: 'Earning' | 'Deduction' | 'Reimbursement' | 'Employer Contribution'; calculationBasis: CalculationBasis; value: number; formula: string; }
interface StructOpt { id: string; name: string; code: string; applicableTo: string[]; components: StructComp[]; }
interface EmpRow { id: string; employeeCode: string; name: string; department: string; designation: string; employeeType: string; employeeGrade: string; employeeGroup: string; employeeCategory: string; employeeSection: string; avatar: string; }

// Salary structures + employees load live from the DB (module-scoped for the helpers below).
let SALARY_STRUCTURES: StructOpt[] = [];
let EMPLOYEES_LIST: EmpRow[] = [];
function useAssignmentRefs() {
  const [, force] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [structRes, sscRes, compRes, empRes] = await Promise.all([
        ssadb.from('salary_structures').select('id, name, code, applicable_to').order('name'),
        ssadb.from('salary_structure_components').select('salary_structure_id, salary_component_id, value, calculation_basis, formula, sort_order'),
        ssadb.from('salary_components').select('id, name, code, type'),
        ssadb.from('employees').select('id, employee_id, first_name, middle_name, last_name, section, designation:designations(name), department:departments(name), employee_type:employee_types(name), employee_group:employee_groups(name), employee_category:employee_categories(name), grade:employee_grades(name)').order('first_name'),
      ]);
      const comps = new Map(((compRes.data ?? []) as Record<string, any>[]).map(c => [c.id, c]));
      const ssc = (sscRes.data ?? []) as Record<string, any>[];
      SALARY_STRUCTURES = ((structRes.data ?? []) as Record<string, any>[]).map(st => ({
        id: st.id, name: st.name ?? '', code: st.code ?? '', applicableTo: st.applicable_to ?? [],
        components: ssc.filter(x => x.salary_structure_id === st.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(x => {
          const c = comps.get(x.salary_component_id);
          return {
            componentId: x.salary_component_id, componentName: c?.name ?? '', componentCode: c?.code ?? '',
            componentType: (c?.type ?? 'Earning') as StructComp['componentType'],
            calculationBasis: (x.calculation_basis ?? 'Fixed') as CalculationBasis, value: Number(x.value ?? 0), formula: x.formula ?? '',
          };
        }),
      }));
      EMPLOYEES_LIST = ((empRes.data ?? []) as Record<string, any>[]).map(e => {
        const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ');
        return {
          id: e.id, employeeCode: e.employee_id ?? '', name,
          department: e.department?.name ?? '—', designation: e.designation?.name ?? '—',
          employeeType: e.employee_type?.name ?? '—', employeeGrade: e.grade?.name ?? '—',
          employeeGroup: e.employee_group?.name ?? '—', employeeCategory: e.employee_category?.name ?? '—',
          employeeSection: e.section ?? '—', avatar: name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        };
      });
      if (active) force(n => n + 1);
    })();
    return () => { active = false; };
  }, []);
}


const EMPLOYEE_TYPES_LIST = ['All', 'Permanent', 'Probationary', 'Contract', 'Intern', 'Part-Time', 'Consultant', 'Trainee'];
const EMPLOYEE_GROUPS_LIST = ['All', 'Management Staff', 'Technical Staff', 'Support Staff', 'Sales Force', 'Field Workers'];
const EMPLOYEE_CATEGORIES_LIST = ['All', 'General', 'OBC', 'SC', 'ST', 'EWS', 'PwD', 'Ex-Serviceman'];
const EMPLOYEE_SECTIONS_LIST = ['All', 'Frontend Development', 'Backend Development', 'DevOps', 'Talent Acquisition', 'Payroll & Compliance', 'Inside Sales', 'Field Sales'];
const EMPLOYEE_GRADES_LIST = ['All', 'Grade A1', 'Grade A2', 'Grade B1', 'Grade B2', 'Grade C1', 'Grade C2', 'Grade D', 'Grade E'];
const DESIGNATIONS_LIST = ['All', 'Software Engineer', 'Senior Software Engineer', 'Tech Lead', 'HR Executive', 'HR Manager', 'Sales Executive', 'Finance Analyst'];
const DEPARTMENTS_LIST = ['All', 'Engineering', 'Human Resources', 'Finance', 'Sales', 'Marketing', 'Design', 'Operations'];

const COMPONENT_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Earning': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  'Deduction': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  'Employer Contribution': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'Reimbursement': { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

function todayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[now.getMonth()]}/${now.getFullYear()}`;
}

// Existing assignments load from employee_salary_assignments; empty until any are made.
const SEED_ASSIGNMENTS: EmployeeSalaryAssignment[] = [];

// Bulk-assignment history is session-only (no DB table); no seed/mock records.
const SEED_BULK_ASSIGNMENTS: BulkAssignment[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function computeComponentValue(comp: { calculationBasis: CalculationBasis; value: number }, ctcMonthly: number, basicMonthly: number, grossMonthly: number): number {
  switch (comp.calculationBasis) {
    case 'Fixed': return comp.value;
    case 'Percentage of CTC': return Math.round((comp.value / 100) * ctcMonthly);
    case 'Percentage of Basic': return Math.round((comp.value / 100) * basicMonthly);
    case 'Percentage of Gross': return Math.round((comp.value / 100) * grossMonthly);
    default: return comp.value;
  }
}

function computeCTCBreakdown(structure: StructOpt, ctcMonthly: number, overrides: SalaryComponentOverride[]) {
  const basicComp = structure.components.find(c => c.componentCode === 'BASIC');
  const basicMonthly = basicComp
    ? (basicComp.calculationBasis === 'Percentage of CTC' ? Math.round((basicComp.value / 100) * ctcMonthly) : basicComp.value)
    : 0;

  const earningComponents = structure.components.filter(c => c.componentType === 'Earning');
  const grossMonthly = earningComponents.reduce((sum, comp) => {
    const override = overrides.find(o => o.componentId === comp.componentId);
    const effectiveComp = override ? { ...comp, value: override.value, calculationBasis: override.calculationBasis } : comp;
    return sum + computeComponentValue(effectiveComp, ctcMonthly, basicMonthly, 0);
  }, 0);

  return structure.components.map(comp => {
    const override = overrides.find(o => o.componentId === comp.componentId);
    const effectiveComp = override ? { ...comp, value: override.value, calculationBasis: override.calculationBasis } : comp;
    const amount = computeComponentValue(effectiveComp, ctcMonthly, basicMonthly, grossMonthly);
    return { ...comp, amount, isOverridden: !!override };
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

const Field = ({ label, required, children, hint }: FieldProps) => (
  <div>
    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

interface MultiSelectChipsProps {
  label: string;
  icon: React.ElementType;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  accentBg?: string;
  accentText?: string;
  accentBorder?: string;
}

const MultiSelectChips = ({ label, icon: Icon, options, selected, onChange, accentBg = 'bg-primary/10', accentText = 'text-primary', accentBorder = 'border-primary/30' }: MultiSelectChipsProps) => {
  const filteredOptions = options.filter(o => o !== 'All');
  const toggle = (opt: string) => {
    const updated = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(updated);
  };
  return (
    <div>
      <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Icon size={12} /> {label}
        {selected.length > 0 && (
          <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${accentBg} ${accentText} border ${accentBorder}`}>
            {selected.length} selected
          </span>
        )}
      </label>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => onChange([])} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selected.length === 0 ? `${accentBg} ${accentText} ${accentBorder} ring-1 ring-offset-1 ring-current` : 'bg-accent text-muted-foreground border-border hover:border-primary/30'}`}>All</button>
        {filteredOptions.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button key={opt} onClick={() => toggle(opt)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isSelected ? `${accentBg} ${accentText} ${accentBorder} ring-1 ring-offset-1 ring-current` : 'bg-accent text-muted-foreground border-border hover:border-primary/30'}`}>
              {isSelected && <CheckCircle2 size={10} className="inline mr-1" />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── CTC Breakdown Preview ────────────────────────────────────────────────────

interface CTCBreakdownPreviewProps {
  structure: StructOpt;
  ctcMonthly: number;
  overrides: SalaryComponentOverride[];
}

const CTCBreakdownPreview = ({ structure, ctcMonthly, overrides }: CTCBreakdownPreviewProps) => {
  const breakdown = computeCTCBreakdown(structure, ctcMonthly, overrides);
  const earnings = breakdown.filter(c => c.componentType === 'Earning');
  const deductions = breakdown.filter(c => c.componentType === 'Deduction');
  const reimbursements = breakdown.filter(c => c.componentType === 'Reimbursement');
  const grossMonthly = earnings.reduce((s, c) => s + c.amount, 0);
  const totalDeductions = deductions.reduce((s, c) => s + c.amount, 0);
  const netMonthly = grossMonthly - totalDeductions;

  return (
    <div className="bg-accent/20 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-accent/40 border-b border-border flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">CTC Breakdown Preview</span>
        <span className="text-xs font-bold text-primary">{formatCurrency(ctcMonthly)}/month</span>
      </div>
      <div className="p-4 space-y-3">
        {earnings.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-1.5">Earnings</p>
            <div className="space-y-1">
              {earnings.map(comp => (
                <div key={comp.componentId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{comp.componentName}</span>
                    {comp.isOverridden && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">Override</span>}
                    <span className="text-[10px] text-muted-foreground">({comp.calculationBasis === 'Fixed' ? `₹${comp.value}` : `${comp.value}%`})</span>
                  </div>
                  <span className="font-semibold text-green-700">{formatCurrency(comp.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs font-bold border-t border-border pt-1 mt-1">
                <span>Gross Monthly</span>
                <span className="text-green-700">{formatCurrency(grossMonthly)}</span>
              </div>
            </div>
          </div>
        )}
        {deductions.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1.5">Deductions</p>
            <div className="space-y-1">
              {deductions.map(comp => (
                <div key={comp.componentId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{comp.componentName}</span>
                    {comp.isOverridden && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">Override</span>}
                  </div>
                  <span className="font-semibold text-red-600">-{formatCurrency(comp.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs font-bold border-t border-border pt-1 mt-1">
                <span>Total Deductions</span>
                <span className="text-red-600">-{formatCurrency(totalDeductions)}</span>
              </div>
            </div>
          </div>
        )}
        {reimbursements.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-1.5">Reimbursements</p>
            <div className="space-y-1">
              {reimbursements.map(comp => (
                <div key={comp.componentId} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{comp.componentName}</span>
                  <span className="font-semibold text-violet-600">{formatCurrency(comp.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-sm font-bold bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <span>Net Monthly Take-Home</span>
          <span className="text-primary">{formatCurrency(netMonthly)}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Individual Assignment Modal ──────────────────────────────────────────────

type AssignmentFormTab = 'basic' | 'components' | 'statutory' | 'preview';

const DEFAULT_STAT_OVERRIDES: StatutoryOverrides = {
  pf: { eligible: true, employeeRate: 12, employerRate: 12, ceiling: 15000 },
  esi: { eligible: true, employeeRate: 0.75, employerRate: 3.25, ceiling: 21000 },
  pt: { eligible: true },
};

interface IndividualAssignmentModalProps {
  onClose: () => void;
  onSave: (assignment: Omit<EmployeeSalaryAssignment, 'id' | 'createdAt'>) => void;
  editingAssignment?: EmployeeSalaryAssignment | null;
}

const IndividualAssignmentModal = ({ onClose, onSave, editingAssignment }: IndividualAssignmentModalProps) => {
  const [activeTab, setActiveTab] = useState<AssignmentFormTab>('basic');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(editingAssignment?.employeeId ?? '');
  const [selectedStructureId, setSelectedStructureId] = useState(editingAssignment?.salaryStructureId ?? '');
  const [ctcAnnual, setCtcAnnual] = useState(editingAssignment?.ctcAnnual ?? 0);
  const [effectiveFrom, setEffectiveFrom] = useState(editingAssignment?.effectiveFrom ?? new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState(editingAssignment?.effectiveTo ?? '');
  const [remarks, setRemarks] = useState(editingAssignment?.remarks ?? '');
  const [overrides, setOverrides] = useState<SalaryComponentOverride[]>(editingAssignment?.componentOverrides ?? []);
  const [statutory, setStatutory] = useState<StatutoryOverrides | null>(editingAssignment?.statutoryOverrides ?? null);
  const [empSearch, setEmpSearch] = useState('');
  const [solverSettings, setSolverSettings] = useState<StatutorySettings | null>(null);
  const [solverPtSlabs] = useState<PtSlab[]>([]);
  const [richStructures, setRichStructures] = useState<SalaryStructure[]>([]);
  const [targetNet, setTargetNet] = useState('');
  useEffect(() => { void (async () => { setSolverSettings(await loadStatutorySettings()); setRichStructures(await loadDbStructures()); })(); }, []);

  // Seed PF/ESI/PT override defaults from the org-wide Payroll Settings (for new assignments).
  useEffect(() => {
    if (statutory) return;
    let active = true;
    void (async () => {
      const { data } = await ssadb.from('pf_esi_config').select('pf_enabled, pf_employee_rate, pf_employer_rate, pf_wage_ceiling, esi_enabled, esi_employee_rate, esi_employer_rate, esi_wage_ceiling, professional_tax_enabled').limit(1).maybeSingle();
      if (!active) return;
      const s = (data ?? {}) as Record<string, any>;
      setStatutory(data ? {
        pf: { eligible: Boolean(s.pf_enabled), employeeRate: Number(s.pf_employee_rate ?? 12), employerRate: Number(s.pf_employer_rate ?? 12), ceiling: Number(s.pf_wage_ceiling ?? 15000) },
        esi: { eligible: Boolean(s.esi_enabled), employeeRate: Number(s.esi_employee_rate ?? 0.75), employerRate: Number(s.esi_employer_rate ?? 3.25), ceiling: Number(s.esi_wage_ceiling ?? 21000) },
        pt: { eligible: Boolean(s.professional_tax_enabled) },
      } : { ...DEFAULT_STAT_OVERRIDES });
    })();
    return () => { active = false; };
  }, [statutory]);
  const stat = statutory ?? DEFAULT_STAT_OVERRIDES;
  const setStat = (patch: Partial<StatutoryOverrides>) => setStatutory(s => ({ ...(s ?? DEFAULT_STAT_OVERRIDES), ...patch }));

  const ctcMonthly = Math.round(ctcAnnual / 12);
  const selectedEmployee = EMPLOYEES_LIST.find(e => e.id === selectedEmployeeId);
  const selectedStructure = SALARY_STRUCTURES.find(s => s.id === selectedStructureId);

  const filteredEmployees = EMPLOYEES_LIST.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.employeeCode.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.department.toLowerCase().includes(empSearch.toLowerCase())
  );

  const updateOverride = (componentId: string, field: keyof SalaryComponentOverride, value: any) => {
    setOverrides(prev => {
      const existing = prev.find(o => o.componentId === componentId);
      if (existing) {
        return prev.map(o => o.componentId === componentId ? { ...o, [field]: value } : o);
      }
      const comp = selectedStructure?.components.find(c => c.componentId === componentId);
      if (!comp) return prev;
      return [...prev, {
        componentId,
        componentName: comp.componentName,
        componentCode: comp.componentCode,
        componentType: comp.componentType,
        calculationBasis: comp.calculationBasis,
        value: comp.value,
        formula: comp.formula,
        isOverridden: true,
        [field]: value,
      }];
    });
  };

  const removeOverride = (componentId: string) => {
    setOverrides(prev => prev.filter(o => o.componentId !== componentId));
  };

  // Reverse entry: solve the CTC that yields a desired Monthly Net Take-Home.
  const solveNetTakeHome = () => {
    const richStruct = richStructures.find(s => s.id === selectedStructureId);
    if (!richStruct) { toast.error('Please select a salary structure first.'); return; }
    if (!solverSettings) { toast.error('Settings still loading — try again.'); return; }
    const target = parseFloat(targetNet) || 0;
    if (target <= 0) { toast.error('Enter the required monthly net take-home.'); return; }
    const componentValues = Object.fromEntries(overrides.map(o => [o.componentId, o.value]));
    const res = solveForTarget('TakeHome', target, richStruct, ctcMonthly, componentValues, solverSettings, solverPtSlabs, statutory, 0);
    setCtcAnnual(res.ctcMonthly * 12);
    if (res.clamped) toast.warn(`Closest achievable take-home is ₹${Math.round(res.achieved).toLocaleString('en-IN')} — fixed components limit the minimum.`);
    else toast.success(`CTC set to ₹${(res.ctcMonthly * 12).toLocaleString('en-IN')}/yr → ~₹${Math.round(res.achieved).toLocaleString('en-IN')} take-home.`);
  };

  const handleSave = () => {
    if (!selectedEmployeeId) { toast.error('Please select an employee.'); return; }
    if (!selectedStructureId) { toast.error('Please select a salary structure.'); return; }
    if (!ctcAnnual || ctcAnnual <= 0) { toast.error('Please enter a valid CTC amount.'); return; }
    if (!effectiveFrom) { toast.error('Effective From date is required.'); return; }

    const emp = EMPLOYEES_LIST.find(e => e.id === selectedEmployeeId)!;
    const struct = SALARY_STRUCTURES.find(s => s.id === selectedStructureId)!;

    onSave({
      employeeId: selectedEmployeeId,
      employeeName: emp.name,
      employeeCode: emp.employeeCode,
      department: emp.department,
      designation: emp.designation,
      employeeType: emp.employeeType,
      employeeGrade: emp.employeeGrade,
      avatar: emp.avatar,
      salaryStructureId: selectedStructureId,
      salaryStructureName: struct.name,
      salaryStructureCode: struct.code,
      ctcAnnual,
      ctcMonthly,
      effectiveFrom,
      effectiveTo,
      status: 'Active',
      componentOverrides: overrides,
      statutoryOverrides: stat,
      remarks,
    });
  };

  const tabs: { key: AssignmentFormTab; label: string; icon: React.ElementType }[] = [
    { key: 'basic', label: 'Basic Details', icon: Layers },
    { key: 'components', label: 'Component Overrides', icon: Settings2 },
    { key: 'statutory', label: 'PF / ESI / PT', icon: Shield },
    { key: 'preview', label: 'CTC Preview', icon: Eye },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl"><Layers size={20} className="text-amber-600" /></div>
            <div>
              <h2 className="text-base font-bold text-amber-900">{editingAssignment ? 'Edit Salary Assignment' : 'Assign Salary Structure'}</h2>
              <p className="text-xs text-amber-600">Assign a salary structure with CTC and component overrides to an employee</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-0.5 px-6 pt-3 border-b border-border bg-accent/10 overflow-x-auto">
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all rounded-t-lg border-b-2 whitespace-nowrap ${isActive ? 'text-primary border-primary bg-primary/5' : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50'}`}>
                <TabIcon size={13} />{tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>

              {activeTab === 'basic' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Select Employee <span className="text-destructive">*</span></label>
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" placeholder="Search employees..." className="w-full pl-8 pr-4 py-2.5 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {filteredEmployees.map(emp => (
                        <button key={emp.id} onClick={() => setSelectedEmployeeId(emp.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${selectedEmployeeId === emp.id ? 'border-amber-400 bg-amber-50' : 'border-border bg-card hover:border-amber-200 hover:bg-amber-50/30'}`}>
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{emp.avatar}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{emp.name}</p>
                            <p className="text-[10px] text-muted-foreground">{emp.department} · {emp.designation} · {emp.employeeType}</p>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded shrink-0">{emp.employeeCode}</span>
                          {selectedEmployeeId === emp.id && <CheckCircle2 size={16} className="text-amber-600 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Select Salary Structure <span className="text-destructive">*</span></label>
                    <div className="space-y-2">
                      {SALARY_STRUCTURES.map(struct => (
                        <button key={struct.id} onClick={() => { setSelectedStructureId(struct.id); setOverrides([]); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border-2 text-left transition-all ${selectedStructureId === struct.id ? 'border-amber-400 bg-amber-50' : 'border-border bg-card hover:border-amber-200'}`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedStructureId === struct.id ? 'bg-amber-100' : 'bg-accent'}`}>
                            <Layers size={18} className={selectedStructureId === struct.id ? 'text-amber-600' : 'text-muted-foreground'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm">{struct.name}</p>
                              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{struct.code}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{struct.components.length} components · For: {struct.applicableTo.join(', ')}</p>
                          </div>
                          {selectedStructureId === struct.id && <CheckCircle2 size={16} className="text-amber-600 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Annual CTC (₹)" required hint="Drag the slider to auto-adjust the breakdown & net take-home; release to save the assignment.">
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="number" className={`${inputCls} pl-9`} min={0} step={10000} value={ctcAnnual || ''} placeholder="e.g. 1200000" onChange={e => setCtcAnnual(parseInt(e.target.value) || 0)} />
                      </div>
                      {/* CTC slider — live breakdown; release saves when employee + structure are chosen. */}
                      <div className={`mt-3 ${!selectedStructureId ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input
                          type="range" min={120000} max={Math.max(3000000, Math.ceil((ctcAnnual * 1.5) / 100000) * 100000)} step={10000}
                          value={Math.min(Math.max(ctcAnnual || 120000, 120000), Math.max(3000000, Math.ceil((ctcAnnual * 1.5) / 100000) * 100000))}
                          onChange={e => setCtcAnnual(parseInt(e.target.value) || 0)}
                          onPointerUp={() => { if (selectedEmployeeId && selectedStructureId && ctcAnnual > 0) handleSave(); }}
                          onKeyUp={() => { if (selectedEmployeeId && selectedStructureId && ctcAnnual > 0) handleSave(); }}
                          disabled={!selectedStructureId}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                          <span>₹1.2L</span>
                          <span className="font-semibold text-amber-700">{formatCurrency(ctcMonthly)}/mo · release to save</span>
                          <span>₹{(Math.max(3000000, Math.ceil((ctcAnnual * 1.5) / 100000) * 100000) / 100000).toFixed(0)}L</span>
                        </div>
                      </div>
                    </Field>
                    <div className="flex flex-col justify-end gap-3">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide mb-1.5">Or enter required Net Take-Home / mo</p>
                        <div className="flex items-center gap-2">
                          <input type="number" className={`${inputCls}`} placeholder="e.g. 50000" value={targetNet} onChange={e => setTargetNet(e.target.value)} disabled={!selectedStructureId} />
                          <button type="button" onClick={solveNetTakeHome} disabled={!selectedStructureId} className="px-3 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap">Generate</button>
                        </div>
                        <p className="text-[9px] text-emerald-600 mt-1">Solves CTC & components for this take-home (after PF/ESI/PT).</p>
                      </div>
                      {ctcAnnual > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                          <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Monthly CTC</p>
                          <p className="text-lg font-bold text-amber-700">{formatCurrency(ctcMonthly)}</p>
                        </div>
                      )}
                    </div>
                    <Field label="Effective From" required>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <DateInput className={`${inputCls} pl-9`} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
                      </div>
                    </Field>
                    <Field label="Effective To" hint="Leave blank for open-ended">
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <DateInput className={`${inputCls} pl-9`} value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} />
                      </div>
                    </Field>
                  </div>

                  <Field label="Remarks">
                    <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
                  </Field>
                </div>
              )}

              {activeTab === 'components' && (
                <div className="space-y-4">
                  {!selectedStructureId ? (
                    <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                      <Layers size={28} className="text-muted-foreground mx-auto mb-3" />
                      <p className="font-semibold text-muted-foreground text-sm">Select a salary structure first</p>
                      <p className="text-xs text-muted-foreground mt-1">Go to Basic Details tab and select a structure to configure overrides</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          Override specific component values for this employee. Leave unchanged to use the structure defaults. Overrides are employee-specific and do not affect the base structure.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {selectedStructure?.components.map(comp => {
                          const override = overrides.find(o => o.componentId === comp.componentId);
                          const typeStyle = COMPONENT_TYPE_STYLES[comp.componentType];
                          return (
                            <div key={comp.componentId} className={`p-4 rounded-xl border-2 transition-all ${override ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>{comp.componentType}</span>
                                  <span className="font-bold text-sm">{comp.componentName}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{comp.componentCode}</span>
                                  {override && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">Overridden</span>}
                                </div>
                                {override && (
                                  <button onClick={() => removeOverride(comp.componentId)} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                                    <RefreshCw size={11} /> Reset
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Calculation Basis</label>
                                  <select
                                    className="w-full p-2.5 bg-white border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-xs appearance-none"
                                    value={override?.calculationBasis ?? comp.calculationBasis}
                                    onChange={e => updateOverride(comp.componentId, 'calculationBasis', e.target.value)}
                                  >
                                    {['Fixed', 'Percentage of Basic', 'Percentage of Gross', 'Percentage of CTC'].map(b => <option key={b}>{b}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">
                                    Value {(override?.calculationBasis ?? comp.calculationBasis) === 'Fixed' ? '(₹)' : '(%)'}
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      className="w-full p-2.5 bg-white border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                                      value={override?.value ?? comp.value}
                                      min={0}
                                      step={(override?.calculationBasis ?? comp.calculationBasis) === 'Fixed' ? 100 : 0.5}
                                      onChange={e => updateOverride(comp.componentId, 'value', parseFloat(e.target.value) || 0)}
                                    />
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      Default: {comp.calculationBasis === 'Fixed' ? formatCurrency(comp.value) : `${comp.value}%`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'statutory' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">Defaults come from <strong>Payroll Settings</strong>. Adjust eligibility, rates and ceilings for this employee — payroll uses these effective values to compute PF, ESI and PT.</p>
                  </div>

                  {/* PF */}
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2"><Lock size={14} className="text-emerald-600" /><span className="text-sm font-bold">Provident Fund (PF)</span></div>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer"><input type="checkbox" checked={stat.pf.eligible} onChange={e => setStat({ pf: { ...stat.pf, eligible: e.target.checked } })} /> Eligible</label>
                    </div>
                    {stat.pf.eligible && (
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Employee %</label><input type="number" step={0.5} className={inputCls} value={stat.pf.employeeRate} onChange={e => setStat({ pf: { ...stat.pf, employeeRate: parseFloat(e.target.value) || 0 } })} /></div>
                        <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Employer %</label><input type="number" step={0.5} className={inputCls} value={stat.pf.employerRate} onChange={e => setStat({ pf: { ...stat.pf, employerRate: parseFloat(e.target.value) || 0 } })} /></div>
                        <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Wage Ceiling ₹</label><input type="number" step={500} className={inputCls} value={stat.pf.ceiling} onChange={e => setStat({ pf: { ...stat.pf, ceiling: parseInt(e.target.value) || 0 } })} /></div>
                      </div>
                    )}
                  </div>

                  {/* ESI */}
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2"><Shield size={14} className="text-blue-600" /><span className="text-sm font-bold">Employee State Insurance (ESI)</span></div>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer"><input type="checkbox" checked={stat.esi.eligible} onChange={e => setStat({ esi: { ...stat.esi, eligible: e.target.checked } })} /> Eligible</label>
                    </div>
                    {stat.esi.eligible && (
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Employee %</label><input type="number" step={0.25} className={inputCls} value={stat.esi.employeeRate} onChange={e => setStat({ esi: { ...stat.esi, employeeRate: parseFloat(e.target.value) || 0 } })} /></div>
                        <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Employer %</label><input type="number" step={0.25} className={inputCls} value={stat.esi.employerRate} onChange={e => setStat({ esi: { ...stat.esi, employerRate: parseFloat(e.target.value) || 0 } })} /></div>
                        <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Wage Ceiling ₹</label><input type="number" step={500} className={inputCls} value={stat.esi.ceiling} onChange={e => setStat({ esi: { ...stat.esi, ceiling: parseInt(e.target.value) || 0 } })} /></div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">ESI applies only when monthly gross is within the wage ceiling.</p>
                  </div>

                  {/* PT */}
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Building2 size={14} className="text-purple-600" /><span className="text-sm font-bold">Professional Tax (PT)</span></div>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer"><input type="checkbox" checked={stat.pt.eligible} onChange={e => setStat({ pt: { ...stat.pt, eligible: e.target.checked } })} /> Eligible</label>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">PT amount is taken from the state-wise slab (Payroll Setup → Professional Tax) by monthly gross.</p>
                  </div>
                </div>
              )}

              {activeTab === 'preview' && (
                <div className="space-y-4">
                  {!selectedStructureId || !ctcAnnual ? (
                    <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                      <BarChart3 size={28} className="text-muted-foreground mx-auto mb-3" />
                      <p className="font-semibold text-muted-foreground text-sm">Select structure and enter CTC to preview</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        {selectedEmployee && (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">{selectedEmployee.avatar}</div>
                            <div>
                              <p className="font-bold text-sm">{selectedEmployee.name}</p>
                              <p className="text-[10px] text-muted-foreground">{selectedEmployee.department} · {selectedEmployee.designation}</p>
                            </div>
                          </div>
                        )}
                        <div className="ml-auto text-right">
                          <p className="text-lg font-bold text-amber-700">{formatCurrency(ctcAnnual)}</p>
                          <p className="text-[10px] text-amber-600">Annual CTC · {formatCurrency(ctcMonthly)}/month</p>
                        </div>
                      </div>
                      <CTCBreakdownPreview structure={selectedStructure!} ctcMonthly={ctcMonthly} overrides={overrides} />
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <div className="flex items-center gap-2">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`w-2 h-2 rounded-full transition-all ${activeTab === tab.key ? 'bg-primary w-4' : 'bg-border hover:bg-muted-foreground'}`} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors shadow-md">
              <Save size={15} /> {editingAssignment ? 'Save Changes' : 'Assign Structure'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Bulk Assignment Modal ────────────────────────────────────────────────────

type BulkStep = 'structure' | 'filter' | 'preview';

interface BulkAssignmentModalProps {
  onClose: () => void;
  onSave: (assignment: Omit<BulkAssignment, 'id' | 'createdAt'>) => void;
}

const BulkAssignmentModal = ({ onClose, onSave }: BulkAssignmentModalProps) => {
  const [step, setStep] = useState<BulkStep>('structure');
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [ctcAnnual, setCtcAnnual] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filter, setFilter] = useState<BulkAssignmentFilter>({
    employeeType: [], employeeGroup: [], employeeCategory: [],
    employeeSection: [], employeeGrade: [], designation: [], department: [], allEmployees: false,
  });
  const [empSearch, setEmpSearch] = useState('');

  const selectedStructure = SALARY_STRUCTURES.find(s => s.id === selectedStructureId);
  const ctcMonthly = Math.round(ctcAnnual / 12);

  const filteredEmployees = useMemo(() => {
    return EMPLOYEES_LIST.filter(emp => {
      const matchSearch = emp.name.toLowerCase().includes(empSearch.toLowerCase()) || emp.employeeCode.toLowerCase().includes(empSearch.toLowerCase());
      if (!matchSearch) return false;
      if (filter.allEmployees) return true;
      const checks = [
        filter.employeeType.length === 0 || filter.employeeType.includes(emp.employeeType),
        filter.employeeGroup.length === 0 || filter.employeeGroup.includes(emp.employeeGroup),
        filter.employeeCategory.length === 0 || filter.employeeCategory.includes(emp.employeeCategory),
        filter.employeeSection.length === 0 || filter.employeeSection.includes(emp.employeeSection),
        filter.employeeGrade.length === 0 || filter.employeeGrade.includes(emp.employeeGrade),
        filter.designation.length === 0 || filter.designation.includes(emp.designation),
        filter.department.length === 0 || filter.department.includes(emp.department),
      ];
      return checks.every(Boolean);
    });
  }, [filter, empSearch]);

  const handleSave = () => {
    if (!selectedStructureId) { toast.error('Please select a salary structure.'); return; }
    if (!effectiveFrom) { toast.error('Effective From date is required.'); return; }
    if (filteredEmployees.length === 0) { toast.error('No employees match the selected criteria.'); return; }
    const struct = SALARY_STRUCTURES.find(s => s.id === selectedStructureId)!;
    onSave({
      salaryStructureId: selectedStructureId,
      salaryStructureName: struct.name,
      salaryStructureCode: struct.code,
      filterCriteria: filter,
      ctcAnnual,
      effectiveFrom,
      effectiveTo,
      allocatedEmployees: filteredEmployees.map(e => e.id),
      status: 'Active',
      remarks,
    });
  };

  const steps: { key: BulkStep; label: string; num: number }[] = [
    { key: 'structure', label: 'Select Structure', num: 1 },
    { key: 'filter', label: 'Filter Employees', num: 2 },
    { key: 'preview', label: 'Preview & Confirm', num: 3 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl"><Users size={20} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-base font-bold text-indigo-900">Bulk Salary Structure Assignment</h2>
              <p className="text-xs text-indigo-600">Assign a salary structure to multiple employees based on filter criteria</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-0 px-6 pt-4 pb-0">
          {steps.map((s, i) => {
            const isActive = step === s.key;
            const isDone = (step === 'filter' && s.key === 'structure') || (step === 'preview' && s.key !== 'preview');
            return (
              <React.Fragment key={s.key}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isActive ? 'bg-indigo-600 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-accent text-muted-foreground'}`}>
                    {isDone ? <CheckCircle2 size={14} /> : s.num}
                  </div>
                  <span className={`text-xs font-semibold ${isActive ? 'text-indigo-700' : isDone ? 'text-green-600' : 'text-muted-foreground'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-border mx-3" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
          {step === 'structure' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="space-y-2">
                {SALARY_STRUCTURES.map(struct => (
                  <button key={struct.id} onClick={() => setSelectedStructureId(struct.id)} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${selectedStructureId === struct.id ? 'border-indigo-400 bg-indigo-50' : 'border-border bg-card hover:border-indigo-200'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedStructureId === struct.id ? 'bg-indigo-100' : 'bg-accent'}`}>
                      <Layers size={20} className={selectedStructureId === struct.id ? 'text-indigo-600' : 'text-muted-foreground'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{struct.name}</p>
                        <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{struct.code}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{struct.components.length} components · For: {struct.applicableTo.join(', ')}</p>
                    </div>
                    {selectedStructureId === struct.id && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Default Annual CTC (₹)" hint="Optional — can be set per employee later">
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="number" className={`${inputCls} pl-9`} min={0} step={10000} value={ctcAnnual || ''} placeholder="e.g. 600000" onChange={e => setCtcAnnual(parseInt(e.target.value) || 0)} />
                  </div>
                </Field>
                <div className="flex flex-col justify-end">
                  {ctcAnnual > 0 && (
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                      <p className="text-[10px] text-indigo-600 font-medium uppercase tracking-wide">Monthly CTC</p>
                      <p className="text-lg font-bold text-indigo-700">{formatCurrency(ctcMonthly)}</p>
                    </div>
                  )}
                </div>
                <Field label="Effective From" required>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <DateInput className={`${inputCls} pl-9`} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
                  </div>
                </Field>
                <Field label="Effective To" hint="Leave blank for open-ended">
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-forevement" />
                    <DateInput className={`${inputCls} pl-9`} value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} />
                  </div>
                </Field>
              </div>
              <Field label="Remarks">
                <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
              </Field>
            </motion.div>
          )}

          {step === 'filter' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">Filter employees by criteria. Leaving a filter empty includes all values for that criterion.</p>
              </div>
              <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${filter.allEmployees ? 'bg-indigo-50 border-indigo-300' : 'bg-accent/30 border-border'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${filter.allEmployees ? 'bg-indigo-100' : 'bg-accent'}`}><Users size={18} className={filter.allEmployees ? 'text-indigo-600' : 'text-muted-foreground'} /></div>
                  <div>
                    <p className="font-bold text-sm">All Employees</p>
                    <p className="text-[10px] text-muted-foreground">Assign to all employees regardless of other filters</p>
                  </div>
                </div>
                <div onClick={() => setFilter(f => ({ ...f, allEmployees: !f.allEmployees }))} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${filter.allEmployees ? 'bg-indigo-500' : 'bg-border'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${filter.allEmployees ? 'translate-x-7' : 'translate-x-1'}`} />
                </div>
              </div>
              {!filter.allEmployees && (
                <div className="space-y-4">
                  <MultiSelectChips label="Employee Type" icon={Tag} options={EMPLOYEE_TYPES_LIST} selected={filter.employeeType} onChange={v => setFilter(f => ({ ...f, employeeType: v }))} accentBg="bg-blue-100" accentText="text-blue-700" accentBorder="border-blue-300" />
                  <MultiSelectChips label="Employee Group" icon={Users} options={EMPLOYEE_GROUPS_LIST} selected={filter.employeeGroup} onChange={v => setFilter(f => ({ ...f, employeeGroup: v }))} accentBg="bg-violet-100" accentText="text-violet-700" accentBorder="border-violet-300" />
                  <MultiSelectChips label="Employee Grade" icon={Award} options={EMPLOYEE_GRADES_LIST} selected={filter.employeeGrade} onChange={v => setFilter(f => ({ ...f, employeeGrade: v }))} accentBg="bg-cyan-100" accentText="text-cyan-700" accentBorder="border-cyan-300" />
                  <MultiSelectChips label="Department" icon={Building2} options={DEPARTMENTS_LIST} selected={filter.department} onChange={v => setFilter(f => ({ ...f, department: v }))} accentBg="bg-emerald-100" accentText="text-emerald-700" accentBorder="border-emerald-300" />
                  <MultiSelectChips label="Designation" icon={Briefcase} options={DESIGNATIONS_LIST} selected={filter.designation} onChange={v => setFilter(f => ({ ...f, designation: v }))} accentBg="bg-indigo-100" accentText="text-indigo-700" accentBorder="border-indigo-300" />
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-3 bg-accent/30 rounded-xl border border-border">
                <Users size={15} className="text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{filteredEmployees.length}</strong> employee{filteredEmployees.length !== 1 ? 's' : ''} match the current filter criteria
                </p>
              </div>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                  <p className="text-2xl font-bold text-indigo-700">{filteredEmployees.length}</p>
                  <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-wide">Employees</p>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-sm font-bold text-amber-700">{selectedStructure?.name}</p>
                  <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Structure</p>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-sm font-bold text-emerald-700">{formatDate(effectiveFrom)}</p>
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Effective From</p>
                </div>
              </div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Search employees..." className="w-full pl-9 pr-4 py-2.5 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredEmployees.map((emp, i) => (
                  <motion.div key={emp.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-indigo-50 border-indigo-200">
                    <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{emp.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.department} · {emp.employeeType} · {emp.employeeGrade}</p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{emp.employeeCode}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <button onClick={step === 'structure' ? onClose : () => setStep(step === 'filter' ? 'structure' : 'filter')} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {step === 'structure' ? 'Cancel' : '← Back'}
          </button>
          <button
            onClick={step === 'preview' ? handleSave : () => setStep(step === 'structure' ? 'filter' : 'preview')}
            disabled={step === 'structure' && !selectedStructureId}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 'preview' ? <><Save size={15} /> Assign to {filteredEmployees.length} Employees</> : <>Next →</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Assignment Card ──────────────────────────────────────────────────────────

interface AssignmentCardProps {
  assignment: EmployeeSalaryAssignment;
  onEdit: (a: EmployeeSalaryAssignment) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
}

const AssignmentCard = ({ assignment, onEdit, onDelete, onToggleStatus }: AssignmentCardProps) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const structure = SALARY_STRUCTURES.find(s => s.id === assignment.salaryStructureId);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -3 }} className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className={`h-1.5 w-full ${assignment.status === 'Active' ? 'bg-amber-400' : assignment.status === 'Draft' ? 'bg-gray-300' : 'bg-gray-200'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">{assignment.avatar}</div>
            <div>
              <p className="font-bold text-sm">{assignment.employeeName}</p>
              <p className="text-[10px] text-muted-foreground">{assignment.department} · {assignment.designation}</p>
              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{assignment.employeeCode}</span>
            </div>
          </div>
          <button onClick={() => onToggleStatus(assignment.id)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${assignment.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${assignment.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} />
            {assignment.status}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Annual CTC</p>
            <p className="text-sm font-bold text-amber-700">{formatCurrency(assignment.ctcAnnual)}</p>
          </div>
          <div className="bg-accent/40 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Monthly CTC</p>
            <p className="text-sm font-bold">{formatCurrency(assignment.ctcMonthly)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/30 rounded-lg border border-border flex-1">
            <Layers size={12} className="text-amber-600 shrink-0" />
            <span className="text-xs font-semibold truncate">{assignment.salaryStructureName}</span>
            <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1 py-0.5 rounded ml-auto shrink-0">{assignment.salaryStructureCode}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
          <Calendar size={11} />
          <span>{formatDate(assignment.effectiveFrom)}</span>
          {assignment.effectiveTo ? <><span>→</span><span>{formatDate(assignment.effectiveTo)}</span></> : <span className="text-amber-600 font-medium">· Open-ended</span>}
        </div>

        {assignment.componentOverrides.length > 0 && (
          <div className="mb-3">
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              {assignment.componentOverrides.length} component override{assignment.componentOverrides.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {structure && (
          <button onClick={() => setShowBreakdown(v => !v)} className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors mb-3">
            <BarChart3 size={11} />
            {showBreakdown ? 'Hide' : 'Show'} CTC Breakdown
            <ChevronDown size={11} className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
          </button>
        )}

        <AnimatePresence>
          {showBreakdown && structure && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
              <CTCBreakdownPreview structure={structure} ctcMonthly={assignment.ctcMonthly} overrides={assignment.componentOverrides} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1 pt-3 border-t border-border">
          <button onClick={() => onEdit(assignment)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"><Pencil size={12} /> Edit</button>
          <button onClick={() => onDelete(assignment.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto"><Trash2 size={12} /> Delete</button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface SalaryStructureAssignmentProps {
  onBack: () => void;
}

// eslint-disable-next-line
export default function SalaryStructureAssignment({ onBack }: SalaryStructureAssignmentProps) {
  useAssignmentRefs();
  const [assignments, setAssignments] = useState<EmployeeSalaryAssignment[]>(SEED_ASSIGNMENTS);
  const [bulkAssignments, setBulkAssignments] = useState<BulkAssignment[]>(SEED_BULK_ASSIGNMENTS);

  // Live assignments from the DB (employee_salary_assignments) — the single source
  // of truth shared with the Employee Master salary tab.
  const loadAssignments = useCallback(async () => {
    const { data } = await ssadb.from('employee_salary_assignments')
      .select('id, employee_id, salary_structure_id, ctc_annual, ctc_monthly, effective_from, effective_to, is_current, component_values, statutory_overrides, employees:employee_id(employee_id, first_name, middle_name, last_name, section, designation:designations(name), department:departments(name), employee_type:employee_types(name), grade:employee_grades(name)), salary_structures(name, code)')
      .eq('is_current', true);
    const rows = (data ?? []) as Record<string, any>[];
    setAssignments(rows.map(r => {
      const e = r.employees ?? {};
      const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || (e.employee_id ?? 'Employee');
      const values = (r.component_values ?? {}) as Record<string, number>;
      const overrides: SalaryComponentOverride[] = Object.entries(values).map(([componentId, value]) => ({
        componentId, value: Number(value), isOverridden: true,
        componentName: '', componentCode: '', componentType: 'Earning', calculationBasis: 'Fixed', formula: '',
      }));
      return {
        id: r.id, employeeId: r.employee_id, employeeName: name, employeeCode: e.employee_id ?? '',
        department: e.department?.name ?? '—', designation: e.designation?.name ?? '—',
        employeeType: e.employee_type?.name ?? '—', employeeGrade: e.grade?.name ?? '—',
        avatar: name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        salaryStructureId: r.salary_structure_id, salaryStructureName: r.salary_structures?.name ?? '', salaryStructureCode: r.salary_structures?.code ?? '',
        ctcAnnual: Number(r.ctc_annual ?? 0), ctcMonthly: Number(r.ctc_monthly ?? 0),
        effectiveFrom: r.effective_from ?? '', effectiveTo: r.effective_to ?? '',
        status: (r.is_current ? 'Active' : 'Inactive') as AssignmentStatus,
        componentOverrides: overrides, statutoryOverrides: (r.statutory_overrides ?? null) as StatutoryOverrides | null, createdAt: '', remarks: '',
      } as EmployeeSalaryAssignment;
    }));
  }, []);
  useEffect(() => { void loadAssignments(); }, [loadAssignments]);
  const [activeView, setActiveView] = useState<'individual' | 'bulk'>('individual');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [structureFilter, setStructureFilter] = useState('All');
  const [individualModal, setIndividualModal] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<EmployeeSalaryAssignment | null>(null);

  const filteredAssignments = useMemo(() =>
    assignments
      .filter(a => a.employeeName.toLowerCase().includes(search.toLowerCase()) || a.employeeCode.toLowerCase().includes(search.toLowerCase()))
      .filter(a => deptFilter === 'All' || a.department === deptFilter)
      .filter(a => structureFilter === 'All' || a.salaryStructureId === structureFilter),
    [assignments, search, deptFilter, structureFilter]
  );

  const departments = [...new Set(assignments.map(a => a.department))];
  const activeCount = assignments.filter(a => a.status === 'Active').length;
  const totalCTC = assignments.filter(a => a.status === 'Active').reduce((s, a) => s + a.ctcAnnual, 0);
  const unassignedCount = EMPLOYEES_LIST.filter(e => !assignments.some(a => a.employeeId === e.id && a.status === 'Active')).length;

  const openAdd = () => { setEditingAssignment(null); setIndividualModal(true); };
  const openEdit = (a: EmployeeSalaryAssignment) => { setEditingAssignment(a); setIndividualModal(true); };

  const handleSaveIndividual = async (data: Omit<EmployeeSalaryAssignment, 'id' | 'createdAt'>) => {
    const componentValues = Object.fromEntries(
      data.componentOverrides.filter(o => o.isOverridden).map(o => [o.componentId, o.value]),
    );
    const { error } = await upsertEmployeeAssignment({
      empId: data.employeeId, structureId: data.salaryStructureId, ctcMonthly: data.ctcMonthly,
      componentValues, effectiveFrom: data.effectiveFrom || undefined, effectiveTo: data.effectiveTo || null,
      statutoryOverrides: (data.statutoryOverrides ?? null) as unknown as Record<string, unknown> | null,
    });
    if (error) { toast.error(error); return; }
    toast.success(editingAssignment ? 'Salary assignment updated — copied to Employee Master.' : `Salary structure assigned to ${data.employeeName} — copied to Employee Master.`);
    setIndividualModal(false);
    setEditingAssignment(null);
    void loadAssignments();
  };

  const handleSaveBulk = async (data: Omit<BulkAssignment, 'id' | 'createdAt'>) => {
    const newId = `BA${String(bulkAssignments.length + 1).padStart(3, '0')}`;
    setBulkAssignments(prev => [...prev, { ...data, id: newId, createdAt: todayFormatted() }]);
    const ctcMonthly = Math.round(data.ctcAnnual / 12);
    for (const empId of data.allocatedEmployees) {
      const { error } = await upsertEmployeeAssignment({
        empId, structureId: data.salaryStructureId, ctcMonthly, componentValues: {},
        effectiveFrom: data.effectiveFrom || undefined, effectiveTo: data.effectiveTo || null,
      });
      if (error) { toast.error(error); return; }
    }
    toast.success(`Salary structure assigned to ${data.allocatedEmployees.length} employees — copied to Employee Master.`);
    setBulkModal(false);
    void loadAssignments();
  };

  const deleteAssignment = async (rowId: string) => {
    const { error } = await ssadb.from('employee_salary_assignments').delete().eq('id', rowId);
    if (error) { toast.error(error.message); return; }
    toast.info('Salary assignment removed.');
    void loadAssignments();
  };

  const toggleStatus = async (rowId: string) => {
    const a = assignments.find(x => x.id === rowId);
    if (!a) return;
    const { error } = await ssadb.from('employee_salary_assignments').update({ is_current: a.status !== 'Active' }).eq('id', rowId);
    if (error) { toast.error(error.message); return; }
    void loadAssignments();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-amber-100 rounded-lg"><Layers size={22} className="text-amber-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Salary Structure Assignment</h1>
                <p className="text-xs text-muted-foreground">Assign salary structures to employees with CTC, component overrides, and effective dates.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setBulkModal(true)} className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
                <Users size={15} /> Bulk Assign
              </button>
              <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-md text-sm font-medium">
                <Plus size={16} /> Assign Structure
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Assignments', value: assignments.length, sub: `${activeCount} active`, color: 'bg-amber-100', iconColor: 'text-amber-600', icon: Layers },
              { label: 'Total CTC (Active)', value: formatCurrency(totalCTC), sub: 'Annual', color: 'bg-green-100', iconColor: 'text-green-600', icon: DollarSign },
              { label: 'Unassigned', value: unassignedCount, sub: 'Employees without structure', color: 'bg-rose-100', iconColor: 'text-rose-600', icon: AlertCircle },
              { label: 'Structures Used', value: new Set(assignments.map(a => a.salaryStructureId)).size, sub: `of ${SALARY_STRUCTURES.length} available`, color: 'bg-indigo-100', iconColor: 'text-indigo-600', icon: BarChart3 },
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

          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Info size={17} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Salary Structure Assignment — Employee-wise CTC Configuration</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Assign salary structures to individual employees with specific CTC amounts and component-level overrides. Use <strong>Bulk Assign</strong> to assign a structure to multiple employees filtered by Type, Group, Grade, Department, or Designation. The <strong>Salary Structure tab</strong> in Employee Master shows the month-wise and pay period-wise CTC breakdown.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-accent/50 p-1 rounded-xl w-fit">
            <button onClick={() => setActiveView('individual')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === 'individual' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Layers size={15} /> Individual Assignments
            </button>
            <button onClick={() => setActiveView('bulk')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === 'bulk' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Users size={15} /> Bulk Assignments
            </button>
          </div>

          {activeView === 'individual' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input type="text" placeholder="Search by employee name or code..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <option value="All">All Departments</option>
                  {departments.map(d => <option key={d}>{d}</option>)}
                </select>
                <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={structureFilter} onChange={e => setStructureFilter(e.target.value)}>
                  <option value="All">All Structures</option>
                  {SALARY_STRUCTURES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="ml-auto text-xs text-muted-foreground">{filteredAssignments.length} assignments</div>
              </div>

              {filteredAssignments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredAssignments.map(a => (
                    <AssignmentCard key={a.id} assignment={a} onEdit={openEdit} onDelete={deleteAssignment} onToggleStatus={toggleStatus} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Layers size={28} className="text-amber-600" /></div>
                  <p className="font-semibold text-muted-foreground">No salary assignments found</p>
                  <button onClick={openAdd} className="mt-4 flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium mx-auto">
                    <Plus size={15} /> Assign Structure
                  </button>
                </div>
              )}

              {assignments.length > 0 && (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
                    <BarChart3 size={16} className="text-primary" />
                    <h3 className="font-bold text-sm">Assignment Overview</h3>
                    <span className="ml-auto text-xs text-muted-foreground">{assignments.length} assignments</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Employee</th>
                          <th className="px-4 py-3 font-semibold">Structure</th>
                          <th className="px-4 py-3 font-semibold">Annual CTC</th>
                          <th className="px-4 py-3 font-semibold">Monthly CTC</th>
                          <th className="px-4 py-3 font-semibold">Effective From</th>
                          <th className="px-4 py-3 font-semibold">Overrides</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {assignments.map((a, i) => (
                          <motion.tr key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">{a.avatar}</div>
                                <div>
                                  <p className="font-semibold text-sm">{a.employeeName}</p>
                                  <p className="text-[10px] text-muted-foreground">{a.department}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Layers size={12} className="text-amber-600 shrink-0" />
                                <span className="text-xs font-medium">{a.salaryStructureName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-bold text-sm text-amber-700">{formatCurrency(a.ctcAnnual)}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{formatCurrency(a.ctcMonthly)}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(a.effectiveFrom)}</td>
                            <td className="px-4 py-3">
                              {a.componentOverrides.length > 0 ? (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{a.componentOverrides.length} overrides</span>
                              ) : <span className="text-xs text-muted-foreground">None</span>}
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => toggleStatus(a.id)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${a.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                {a.status}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                                <button onClick={() => deleteAssignment(a.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeView === 'bulk' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {bulkAssignments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {bulkAssignments.map((ba, i) => {
                    const allocatedEmps = EMPLOYEES_LIST.filter(e => ba.allocatedEmployees.includes(e.id));
                    return (
                      <motion.div key={ba.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className={`h-1.5 w-full ${ba.status === 'Active' ? 'bg-indigo-400' : 'bg-gray-300'}`} />
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0"><Users size={20} className="text-indigo-600" /></div>
                              <div>
                                <p className="font-bold text-sm">{ba.salaryStructureName}</p>
                                <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{ba.salaryStructureCode}</span>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${ba.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${ba.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {ba.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
                            <Calendar size={11} />
                            <span>{formatDate(ba.effectiveFrom)}</span>
                            {ba.effectiveTo && <><span>→</span><span>{formatDate(ba.effectiveTo)}</span></>}
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <Users size={13} className="text-indigo-600 shrink-0" />
                            <span className="text-xs font-semibold text-indigo-700">{ba.allocatedEmployees.length} employees assigned</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {allocatedEmps.slice(0, 5).map(emp => (
                              <div key={emp.id} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <div className="w-4 h-4 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[8px]">{emp.avatar}</div>
                                <span className="text-[10px] font-medium text-indigo-800">{emp.name.split(' ')[0]}</span>
                              </div>
                            ))}
                            {allocatedEmps.length > 5 && <span className="text-[10px] text-muted-foreground px-2 py-1">+{allocatedEmps.length - 5} more</span>}
                          </div>
                          {ba.remarks && <p className="text-[11px] text-muted-foreground italic mt-3 truncate">{ba.remarks}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={28} className="text-indigo-600" /></div>
                  <p className="font-semibold text-muted-foreground">No bulk assignments yet</p>
                  <button onClick={() => setBulkModal(true)} className="mt-4 flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium mx-auto">
                    <Plus size={15} /> Create Bulk Assignment
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {individualModal && (
          <IndividualAssignmentModal onClose={() => setIndividualModal(false)} onSave={handleSaveIndividual} editingAssignment={editingAssignment} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {bulkModal && (
          <BulkAssignmentModal onClose={() => setBulkModal(false)} onSave={handleSaveBulk} />
        )}
      </AnimatePresence>
    </div>
  );
}