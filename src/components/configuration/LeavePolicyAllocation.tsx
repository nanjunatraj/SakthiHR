import DateInput from '../DateInput';
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMasterAccess, ViewOnlyBanner } from './MasterAccess';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import {
  UserCheck, ChevronLeft, Plus, Search, X, CheckCircle2,
  AlertCircle, Info, Users, Filter, Download, Save,
  Building2, Tag, Layers, Award, Briefcase, Grid3X3,
  BookOpen, Calendar, ChevronDown, RefreshCw, Eye,
  Trash2, Pencil, Hash, MapPin
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AllocationFilter {
  employeeType: string[];
  employeeGroup: string[];
  employeeCategory: string[];
  employeeSection: string[];
  employeeGrade: string[];
  designation: string[];
  department: string[];
  allEmployees: boolean;
}

interface PolicyAllocation {
  id: string;
  policyId: string;
  policyName: string;
  policyCode: string;
  filterCriteria: AllocationFilter;
  effectiveFrom: string;
  effectiveTo: string;
  allocatedEmployees: string[];
  status: 'Active' | 'Inactive' | 'Draft';
  createdAt: string;
  remarks: string;
}

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  employeeType: string;
  employeeGroup: string;
  employeeCategory: string;
  employeeSection: string;
  employeeGrade: string;
  avatar: string;
  currentPolicy?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

interface AvailablePolicy { id: string; name: string; code: string; entitlements: number }

// Filter option lists are derived live from the real employees (distinct values),
// not hardcoded — see `distinctOptions` inside AllocationFormModal.
const distinctOptions = (vals: string[]): string[] => ['All', ...[...new Set(vals.filter(v => v && v !== '—'))].sort()];

const lpadb = supabase as unknown as SupabaseClient;

// Leave policies load live from the leave_policies table (with entitlement counts).
async function loadAvailablePolicies(): Promise<AvailablePolicy[]> {
  const [{ data: policies }, { data: ents }] = await Promise.all([
    lpadb.from('leave_policies').select('id, name, code').eq('is_active', true).order('name'),
    lpadb.from('leave_policy_entitlements').select('policy_id'),
  ]);
  const counts = new Map<string, number>();
  ((ents ?? []) as Record<string, any>[]).forEach(e => counts.set(e.policy_id, (counts.get(e.policy_id) ?? 0) + 1));
  return ((policies ?? []) as Record<string, any>[]).map(p => ({
    id: p.id, name: p.name, code: p.code ?? '', entitlements: counts.get(p.id) ?? 0,
  }));
}

// Employees load live from the employees table.
async function loadAllocationEmployees(): Promise<Employee[]> {
  const { data } = await lpadb.from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, section, designation:designations(name), department:departments(name), employee_type:employee_types(name), employee_group:employee_groups(name), employee_category:employee_categories(name), grade:employee_grades(name)')
    .order('first_name');
  return ((data ?? []) as Record<string, any>[]).map(e => {
    const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ');
    return {
      id: e.id, employeeId: e.employee_id ?? '', name,
      department: e.department?.name ?? '—', designation: e.designation?.name ?? '—',
      employeeType: e.employee_type?.name ?? '—', employeeGroup: e.employee_group?.name ?? '—',
      employeeCategory: e.employee_category?.name ?? '—', employeeSection: e.section ?? '—',
      employeeGrade: e.grade?.name ?? '—', avatar: name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      currentPolicy: '',
    } as Employee;
  });
}

// Policy allocations persist to leave_policy_allocations (filter + allocated employee ids as jsonb).
function rowToAllocation(r: Record<string, any>): PolicyAllocation {
  return {
    id: r.id,
    policyId: r.policy_id ?? '',
    policyName: r.policy_name ?? '',
    policyCode: r.policy_code ?? '',
    filterCriteria: r.filter_criteria ?? {
      employeeType: [], employeeGroup: [], employeeCategory: [], employeeSection: [],
      employeeGrade: [], designation: [], department: [], allEmployees: false,
    },
    allocatedEmployees: Array.isArray(r.allocated_employees) ? r.allocated_employees : [],
    effectiveFrom: r.effective_from ?? '',
    effectiveTo: r.effective_to ?? '',
    status: (r.status as PolicyAllocation['status']) ?? 'Active',
    createdAt: r.created_at ? formatDate(String(r.created_at).split('T')[0]) : '',
    remarks: r.remarks ?? '',
  };
}

function allocationToRow(a: Omit<PolicyAllocation, 'id' | 'createdAt'>): Record<string, any> {
  return {
    policy_id: a.policyId,
    policy_name: a.policyName,
    policy_code: a.policyCode || null,
    filter_criteria: a.filterCriteria,
    allocated_employees: a.allocatedEmployees,
    effective_from: a.effectiveFrom || null,
    effective_to: a.effectiveTo || null,
    status: a.status,
    remarks: a.remarks || null,
    updated_at: new Date().toISOString(),
  };
}

async function loadAllocations(): Promise<PolicyAllocation[]> {
  const { data } = await lpadb.from('leave_policy_allocations').select('*').order('created_at', { ascending: false });
  return ((data ?? []) as Record<string, any>[]).map(rowToAllocation);
}

// ─── Applying a policy to employees (leave_balances) ────────────────────────────

// Indian financial year starts in April; the leave_balances `year` is the FY start year.
function fyStartYear(dateStr: string): number {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const y = d.getFullYear();
  return d.getMonth() >= 3 ? y : y - 1;
}

interface PolicyEntitlementLite {
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  daysPerYear: number;
}

async function loadPolicyEntitlements(policyId: string): Promise<PolicyEntitlementLite[]> {
  if (!policyId) return [];
  const { data } = await lpadb.from('leave_policy_entitlements')
    .select('leave_type_id, leave_type_name, leave_type_code, days_per_year, sort_order')
    .eq('policy_id', policyId).order('sort_order');
  return ((data ?? []) as Record<string, any>[])
    .filter(e => e.leave_type_id)
    .map(e => ({
      leaveTypeId: e.leave_type_id,
      leaveTypeName: e.leave_type_name ?? '',
      leaveTypeCode: e.leave_type_code ?? '',
      daysPerYear: Number(e.days_per_year ?? 0),
    }));
}

/** Apply the policy to the covered employees: ensure a leave_balances row exists for
 *  each employee × the policy's leave types for the FY. Non-destructive — existing
 *  balances (and any HR-entered opening balances) are left untouched. */
async function applyPolicyToEmployees(policyId: string, employeeIds: string[], year: number): Promise<{ error: string | null; created: number }> {
  const ents = await loadPolicyEntitlements(policyId);
  if (!ents.length || !employeeIds.length) return { error: null, created: 0 };
  const typeIds = ents.map(e => e.leaveTypeId);
  const { data: existing } = await lpadb.from('leave_balances')
    .select('employee_id, leave_type_id')
    .in('employee_id', employeeIds).in('leave_type_id', typeIds).eq('year', year);
  const have = new Set(((existing ?? []) as Record<string, any>[]).map(r => `${r.employee_id}|${r.leave_type_id}`));
  const rows: Record<string, unknown>[] = [];
  for (const empId of employeeIds) {
    for (const ent of ents) {
      if (have.has(`${empId}|${ent.leaveTypeId}`)) continue;
      rows.push({
        employee_id: empId, leave_type_id: ent.leaveTypeId, year,
        opening_balance: 0, accrued: 0, used: 0, pending: 0, encashed: 0, lapsed: 0, closing_balance: 0,
      });
    }
  }
  if (!rows.length) return { error: null, created: 0 };
  const { error } = await lpadb.from('leave_balances').insert(rows);
  return { error: error?.message ?? null, created: rows.length };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function todayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[now.getMonth()]}/${now.getFullYear()}`;
}

function matchesFilter(emp: Employee, filter: AllocationFilter): boolean {
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

// ─── Multi-Select Chip Component ──────────────────────────────────────────────

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
  const toggle = (opt: string) => {
    if (opt === 'All') {
      onChange([]);
      return;
    }
    const updated = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt];
    onChange(updated);
  };

  const filteredOptions = options.filter(o => o !== 'All');

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
        <button
          onClick={() => onChange([])}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            selected.length === 0
              ? `${accentBg} ${accentText} ${accentBorder} ring-1 ring-offset-1 ring-current`
              : 'bg-accent text-muted-foreground border-border hover:border-primary/30'
          }`}
        >
          All
        </button>
        {filteredOptions.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isSelected
                  ? `${accentBg} ${accentText} ${accentBorder} ring-1 ring-offset-1 ring-current`
                  : 'bg-accent text-muted-foreground border-border hover:border-primary/30'
              }`}
            >
              {isSelected && <CheckCircle2 size={10} className="inline mr-1" />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Allocation Form Modal ────────────────────────────────────────────────────

type AllocationStep = 'policy' | 'filter' | 'preview' | 'confirm';

interface AllocationFormModalProps {
  onClose: () => void;
  onSave: (allocation: Omit<PolicyAllocation, 'id' | 'createdAt'>) => void;
  employees: Employee[];
  policies: AvailablePolicy[];
  editingAllocation?: PolicyAllocation | null;
}

const AllocationFormModal = ({ onClose, onSave, employees, policies, editingAllocation }: AllocationFormModalProps) => {
  const [step, setStep] = useState<AllocationStep>('policy');
  const [selectedPolicyId, setSelectedPolicyId] = useState(editingAllocation?.policyId ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(editingAllocation?.effectiveFrom ?? new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState(editingAllocation?.effectiveTo ?? '');
  const [remarks, setRemarks] = useState(editingAllocation?.remarks ?? '');
  const [filter, setFilter] = useState<AllocationFilter>(editingAllocation?.filterCriteria ?? {
    employeeType: [],
    employeeGroup: [],
    employeeCategory: [],
    employeeSection: [],
    employeeGrade: [],
    designation: [],
    department: [],
    allEmployees: false,
  });
  const [manuallySelected, setManuallySelected] = useState<string[]>(editingAllocation?.allocatedEmployees ?? []);
  const [useManualSelection, setUseManualSelection] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const selectedPolicy = policies.find(p => p.id === selectedPolicyId);

  // Filter dropdown options derived live from the real employees (no hardcoded master values).
  const EMPLOYEE_TYPES_LIST = useMemo(() => distinctOptions(employees.map(e => e.employeeType)), [employees]);
  const EMPLOYEE_GROUPS_LIST = useMemo(() => distinctOptions(employees.map(e => e.employeeGroup)), [employees]);
  const EMPLOYEE_CATEGORIES_LIST = useMemo(() => distinctOptions(employees.map(e => e.employeeCategory)), [employees]);
  const EMPLOYEE_SECTIONS_LIST = useMemo(() => distinctOptions(employees.map(e => e.employeeSection)), [employees]);
  const EMPLOYEE_GRADES_LIST = useMemo(() => distinctOptions(employees.map(e => e.employeeGrade)), [employees]);
  const DESIGNATIONS_LIST = useMemo(() => distinctOptions(employees.map(e => e.designation)), [employees]);
  const DEPARTMENTS_LIST = useMemo(() => distinctOptions(employees.map(e => e.department)), [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.department.toLowerCase().includes(empSearch.toLowerCase());
      const matchesCriteria = filter.allEmployees ? true : matchesFilter(emp, filter);
      return matchesSearch && matchesCriteria;
    });
  }, [employees, filter, empSearch]);

  const previewEmployees = useManualSelection
    ? employees.filter(e => manuallySelected.includes(e.id))
    : filteredEmployees;

  const toggleManualEmployee = (id: string) => {
    setManuallySelected(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleAllFiltered = () => {
    const allIds = filteredEmployees.map(e => e.id);
    const allSelected = allIds.every(id => manuallySelected.includes(id));
    if (allSelected) {
      setManuallySelected(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setManuallySelected(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  const handleSave = () => {
    if (!selectedPolicyId) { toast.error('Please select a leave policy.'); return; }
    if (!effectiveFrom) { toast.error('Effective From date is required.'); return; }
    const allocatedIds = useManualSelection ? manuallySelected : previewEmployees.map(e => e.id);
    if (allocatedIds.length === 0) { toast.error('No employees match the selected criteria.'); return; }

    onSave({
      policyId: selectedPolicyId,
      policyName: selectedPolicy?.name ?? '',
      policyCode: selectedPolicy?.code ?? '',
      filterCriteria: filter,
      effectiveFrom,
      effectiveTo,
      allocatedEmployees: allocatedIds,
      status: 'Active',
      remarks,
    });
  };

  const steps: { key: AllocationStep; label: string; num: number }[] = [
    { key: 'policy', label: 'Select Policy', num: 1 },
    { key: 'filter', label: 'Filter Employees', num: 2 },
    { key: 'preview', label: 'Preview & Confirm', num: 3 },
  ];

  const canProceed = () => {
    if (step === 'policy') return !!selectedPolicyId && !!effectiveFrom;
    if (step === 'filter') return true;
    return true;
  };

  const nextStep = () => {
    if (step === 'policy') setStep('filter');
    else if (step === 'filter') setStep('preview');
    else handleSave();
  };

  const prevStep = () => {
    if (step === 'filter') setStep('policy');
    else if (step === 'preview') setStep('filter');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-teal-50 to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <UserCheck size={20} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-teal-900">
                {editingAllocation ? 'Edit Policy Allocation' : 'Allocate Leave Policy'}
              </h2>
              <p className="text-xs text-teal-600">Assign a leave policy to employees based on selection criteria</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-0">
          {steps.map((s, i) => {
            const isActive = step === s.key;
            const isDone = (step === 'filter' && s.key === 'policy') || (step === 'preview' && s.key !== 'preview');
            return (
              <React.Fragment key={s.key}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isActive ? 'bg-teal-600 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-accent text-muted-foreground'}`}>
                    {isDone ? <CheckCircle2 size={14} /> : s.num}
                  </div>
                  <span className={`text-xs font-semibold ${isActive ? 'text-teal-700' : isDone ? 'text-green-600' : 'text-muted-foreground'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-border mx-3" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">

          {/* ── Step 1: Select Policy ── */}
          {step === 'policy' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                <Info size={16} className="text-teal-600 shrink-0 mt-0.5" />
                <p className="text-xs text-teal-700">
                  Select the leave policy to allocate and set the effective period. In the next step, you can filter employees by various criteria such as Employee Type, Group, Category, Section, Grade, Designation, and Department.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Select Leave Policy <span className="text-destructive">*</span></label>
                {policies.length === 0 && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      No leave policies are available. Please create a policy in the <strong>Leave Policy Master</strong> first, then allocate it here.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {policies.map(policy => (
                    <button
                      key={policy.id}
                      onClick={() => setSelectedPolicyId(policy.id)}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${
                        selectedPolicyId === policy.id
                          ? 'border-teal-400 bg-teal-50 shadow-sm'
                          : 'border-border bg-card hover:border-teal-200 hover:bg-teal-50/30'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedPolicyId === policy.id ? 'bg-teal-100' : 'bg-accent'}`}>
                        <BookOpen size={20} className={selectedPolicyId === policy.id ? 'text-teal-600' : 'text-muted-foreground'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{policy.name}</p>
                          <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{policy.code}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{policy.entitlements} leave type{policy.entitlements !== 1 ? 's' : ''} configured</p>
                      </div>
                      {selectedPolicyId === policy.id && (
                        <CheckCircle2 size={18} className="text-teal-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Effective From" required>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <DateInput className={`${inputCls} pl-9`} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
                  </div>
                </Field>
                <Field label="Effective To" hint="Leave blank for open-ended allocation">
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <DateInput className={`${inputCls} pl-9`} value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} />
                  </div>
                </Field>
              </div>

              <Field label="Remarks">
                <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Optional remarks about this allocation" value={remarks} onChange={e => setRemarks(e.target.value)} />
              </Field>
            </motion.div>
          )}

          {/* ── Step 2: Filter Employees ── */}
          {step === 'filter' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Filter employees by one or more criteria. Leaving a filter empty means <strong>all values</strong> are included for that criterion. Enable <strong>All Employees</strong> to allocate to the entire workforce.
                </p>
              </div>

              {/* All Employees Toggle */}
              <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${filter.allEmployees ? 'bg-teal-50 border-teal-300' : 'bg-accent/30 border-border'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${filter.allEmployees ? 'bg-teal-100' : 'bg-accent'}`}>
                    <Users size={18} className={filter.allEmployees ? 'text-teal-600' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">All Employees</p>
                    <p className="text-[10px] text-muted-foreground">Allocate this policy to all employees regardless of other filters</p>
                  </div>
                </div>
                <div
                  onClick={() => setFilter(f => ({ ...f, allEmployees: !f.allEmployees }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${filter.allEmployees ? 'bg-teal-500' : 'bg-border'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${filter.allEmployees ? 'translate-x-7' : 'translate-x-1'}`} />
                </div>
              </div>

              {!filter.allEmployees && (
                <div className="space-y-4">
                  <MultiSelectChips
                    label="Employee Type"
                    icon={Tag}
                    options={EMPLOYEE_TYPES_LIST}
                    selected={filter.employeeType}
                    onChange={v => setFilter(f => ({ ...f, employeeType: v }))}
                    accentBg="bg-blue-100"
                    accentText="text-blue-700"
                    accentBorder="border-blue-300"
                  />
                  <MultiSelectChips
                    label="Employee Group"
                    icon={Users}
                    options={EMPLOYEE_GROUPS_LIST}
                    selected={filter.employeeGroup}
                    onChange={v => setFilter(f => ({ ...f, employeeGroup: v }))}
                    accentBg="bg-violet-100"
                    accentText="text-violet-700"
                    accentBorder="border-violet-300"
                  />
                  <MultiSelectChips
                    label="Employee Category"
                    icon={Layers}
                    options={EMPLOYEE_CATEGORIES_LIST}
                    selected={filter.employeeCategory}
                    onChange={v => setFilter(f => ({ ...f, employeeCategory: v }))}
                    accentBg="bg-amber-100"
                    accentText="text-amber-700"
                    accentBorder="border-amber-300"
                  />
                  <MultiSelectChips
                    label="Employee Section"
                    icon={Grid3X3}
                    options={EMPLOYEE_SECTIONS_LIST}
                    selected={filter.employeeSection}
                    onChange={v => setFilter(f => ({ ...f, employeeSection: v }))}
                    accentBg="bg-rose-100"
                    accentText="text-rose-700"
                    accentBorder="border-rose-300"
                  />
                  <MultiSelectChips
                    label="Employee Grade"
                    icon={Award}
                    options={EMPLOYEE_GRADES_LIST}
                    selected={filter.employeeGrade}
                    onChange={v => setFilter(f => ({ ...f, employeeGrade: v }))}
                    accentBg="bg-cyan-100"
                    accentText="text-cyan-700"
                    accentBorder="border-cyan-300"
                  />
                  <MultiSelectChips
                    label="Designation"
                    icon={Briefcase}
                    options={DESIGNATIONS_LIST}
                    selected={filter.designation}
                    onChange={v => setFilter(f => ({ ...f, designation: v }))}
                    accentBg="bg-indigo-100"
                    accentText="text-indigo-700"
                    accentBorder="border-indigo-300"
                  />
                  <MultiSelectChips
                    label="Department"
                    icon={Building2}
                    options={DEPARTMENTS_LIST}
                    selected={filter.department}
                    onChange={v => setFilter(f => ({ ...f, department: v }))}
                    accentBg="bg-emerald-100"
                    accentText="text-emerald-700"
                    accentBorder="border-emerald-300"
                  />
                </div>
              )}

              {/* Preview count */}
              <div className="flex items-center gap-3 px-4 py-3 bg-accent/30 rounded-xl border border-border">
                <Users size={15} className="text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{filteredEmployees.length}</strong> employee{filteredEmployees.length !== 1 ? 's' : ''} match the current filter criteria
                </p>
                {filteredEmployees.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
                    {filteredEmployees.length} matched
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Preview & Confirm ── */}
          {step === 'preview' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-center">
                  <p className="text-2xl font-bold text-teal-700">{previewEmployees.length}</p>
                  <p className="text-[10px] font-medium text-teal-600 uppercase tracking-wide">Employees</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <p className="text-sm font-bold text-blue-700">{selectedPolicy?.name}</p>
                  <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Policy</p>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-sm font-bold text-emerald-700">{formatDate(effectiveFrom)}</p>
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Effective From</p>
                </div>
              </div>

              {/* Manual selection toggle */}
              <div className="flex items-center justify-between p-3 bg-accent/30 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-medium">Manual Employee Selection</p>
                  <p className="text-[10px] text-muted-foreground">Override filter and manually select specific employees</p>
                </div>
                <div
                  onClick={() => setUseManualSelection(v => !v)}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${useManualSelection ? 'bg-primary' : 'bg-border'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useManualSelection ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>

              {/* Employee Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  className="w-full pl-9 pr-4 py-2.5 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                />
              </div>

              {useManualSelection && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{manuallySelected.length} selected</span>
                  <button onClick={toggleAllFiltered} className="text-xs text-primary hover:underline font-medium">
                    {filteredEmployees.every(e => manuallySelected.includes(e.id)) ? 'Deselect All' : 'Select All Filtered'}
                  </button>
                </div>
              )}

              {/* Employee List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(useManualSelection ? filteredEmployees : previewEmployees).map((emp, i) => {
                  const isSelected = useManualSelection ? manuallySelected.includes(emp.id) : true;
                  return (
                    <motion.div
                      key={emp.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                        isSelected ? 'bg-teal-50 border-teal-200' : 'bg-accent/20 border-border'
                      }`}
                    >
                      {useManualSelection && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleManualEmployee(emp.id)}
                          className="rounded border-border shrink-0"
                        />
                      )}
                      {!useManualSelection && (
                        <CheckCircle2 size={15} className="text-teal-600 shrink-0" />
                      )}
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {emp.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{emp.name}</p>
                        <p className="text-[10px] text-muted-foreground">{emp.department} · {emp.designation}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-mono text-muted-foreground">{emp.employeeId}</p>
                        <p className="text-[10px] text-muted-foreground">{emp.employeeType}</p>
                      </div>
                    </motion.div>
                  );
                })}
                {(useManualSelection ? filteredEmployees : previewEmployees).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No employees match the current criteria.
                  </div>
                )}
              </div>

              {previewEmployees.length === 0 && !useManualSelection && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    No employees match the selected filter criteria. Please go back and adjust the filters.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <button
            onClick={step === 'policy' ? onClose : prevStep}
            className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {step === 'policy' ? 'Cancel' : '← Back'}
          </button>
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 'preview' ? (
              <><Save size={15} /> Allocate Policy</>
            ) : (
              <>Next →</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Allocation Card ──────────────────────────────────────────────────────────

interface AllocationCardProps {
  allocation: PolicyAllocation;
  employees: Employee[];
  onEdit: (a: PolicyAllocation) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onManageBalances: (a: PolicyAllocation) => void;
}

const AllocationCard = ({ allocation, employees, onEdit, onDelete, onToggleStatus, onManageBalances }: AllocationCardProps) => {
  const [showEmployees, setShowEmployees] = useState(false);
  const allocatedEmps = employees.filter(e => allocation.allocatedEmployees.includes(e.id));

  const filterSummary = () => {
    const parts: string[] = [];
    if (allocation.filterCriteria.allEmployees) return 'All Employees';
    if (allocation.filterCriteria.employeeType.length > 0) parts.push(`Type: ${allocation.filterCriteria.employeeType.join(', ')}`);
    if (allocation.filterCriteria.employeeGroup.length > 0) parts.push(`Group: ${allocation.filterCriteria.employeeGroup.join(', ')}`);
    if (allocation.filterCriteria.employeeCategory.length > 0) parts.push(`Category: ${allocation.filterCriteria.employeeCategory.join(', ')}`);
    if (allocation.filterCriteria.employeeSection.length > 0) parts.push(`Section: ${allocation.filterCriteria.employeeSection.join(', ')}`);
    if (allocation.filterCriteria.employeeGrade.length > 0) parts.push(`Grade: ${allocation.filterCriteria.employeeGrade.join(', ')}`);
    if (allocation.filterCriteria.designation.length > 0) parts.push(`Designation: ${allocation.filterCriteria.designation.join(', ')}`);
    if (allocation.filterCriteria.department.length > 0) parts.push(`Dept: ${allocation.filterCriteria.department.join(', ')}`);
    return parts.length > 0 ? parts.join(' · ') : 'No specific filter (all employees)';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -3 }}
      className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className={`h-1.5 w-full ${allocation.status === 'Active' ? 'bg-teal-400' : allocation.status === 'Draft' ? 'bg-amber-400' : 'bg-gray-300'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
              <UserCheck size={20} className="text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm">{allocation.policyName}</h3>
                <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{allocation.policyCode}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Created {allocation.createdAt}</p>
            </div>
          </div>
          <button
            onClick={() => onToggleStatus(allocation.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              allocation.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' :
              allocation.status === 'Draft' ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' :
              'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${allocation.status === 'Active' ? 'bg-green-500' : allocation.status === 'Draft' ? 'bg-amber-500' : 'bg-gray-400'}`} />
            {allocation.status}
          </button>
        </div>

        {/* Filter Summary */}
        <div className="mb-3 p-3 bg-accent/30 rounded-lg border border-border">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Filter Criteria</p>
          <p className="text-xs text-foreground font-medium line-clamp-2">{filterSummary()}</p>
        </div>

        {/* Effective Period */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
          <Calendar size={11} />
          <span>{formatDate(allocation.effectiveFrom)}</span>
          {allocation.effectiveTo && <><span>→</span><span>{formatDate(allocation.effectiveTo)}</span></>}
          {!allocation.effectiveTo && <span className="text-teal-600 font-medium">· Open-ended</span>}
        </div>

        {/* Employee Count */}
        <button
          onClick={() => setShowEmployees(v => !v)}
          className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors mb-3"
        >
          <Users size={11} />
          {allocation.allocatedEmployees.length} Employee{allocation.allocatedEmployees.length !== 1 ? 's' : ''} Allocated
          <ChevronDown size={11} className={`transition-transform ${showEmployees ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showEmployees && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="flex flex-wrap gap-1.5">
                {allocatedEmps.slice(0, 8).map(emp => (
                  <div key={emp.id} className="flex items-center gap-1.5 px-2 py-1 bg-teal-50 border border-teal-200 rounded-lg">
                    <div className="w-5 h-5 rounded bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-[9px]">{emp.avatar}</div>
                    <span className="text-[10px] font-medium text-teal-800">{emp.name}</span>
                  </div>
                ))}
                {allocatedEmps.length > 8 && (
                  <div className="flex items-center px-2 py-1 bg-accent rounded-lg">
                    <span className="text-[10px] text-muted-foreground">+{allocatedEmps.length - 8} more</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {allocation.remarks && (
          <p className="text-[11px] text-muted-foreground italic mb-3 truncate">{allocation.remarks}</p>
        )}

        <div className="flex items-center gap-1 pt-3 border-t border-border">
          <button onClick={() => onManageBalances(allocation)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-teal-50 text-teal-700 transition-colors">
            <Hash size={12} /> Opening Balances
          </button>
          <button onClick={() => onEdit(allocation)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors">
            <Pencil size={12} /> Edit
          </button>
          <button onClick={() => onDelete(allocation.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Opening Balance Manager Modal ──────────────────────────────────────────────

interface BalCell { opening: number; accrued: number; used: number; pending: number; encashed: number; lapsed: number; }

interface OpeningBalanceModalProps {
  allocation: PolicyAllocation;
  employees: Employee[];
  onClose: () => void;
}

const emptyCell = (): BalCell => ({ opening: 0, accrued: 0, used: 0, pending: 0, encashed: 0, lapsed: 0 });

const OpeningBalanceModal = ({ allocation, employees, onClose }: OpeningBalanceModalProps) => {
  const { canEdit } = useMasterAccess();
  const [entitlements, setEntitlements] = useState<PolicyEntitlementLite[]>([]);
  const [balances, setBalances] = useState<Record<string, Record<string, BalCell>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const year = fyStartYear(allocation.effectiveFrom);

  const coveredEmployees = useMemo(
    () => employees.filter(e => allocation.allocatedEmployees.includes(e.id)),
    [employees, allocation.allocatedEmployees]
  );

  const visibleEmployees = useMemo(
    () => coveredEmployees.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeId.toLowerCase().includes(search.toLowerCase())
    ),
    [coveredEmployees, search]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const ents = await loadPolicyEntitlements(allocation.policyId);
      const empIds = allocation.allocatedEmployees;
      const typeIds = ents.map(e => e.leaveTypeId);
      let rows: Record<string, any>[] = [];
      if (empIds.length && typeIds.length) {
        const { data } = await lpadb.from('leave_balances')
          .select('employee_id, leave_type_id, opening_balance, accrued, used, pending, encashed, lapsed')
          .in('employee_id', empIds).in('leave_type_id', typeIds).eq('year', year);
        rows = (data ?? []) as Record<string, any>[];
      }
      const map: Record<string, Record<string, BalCell>> = {};
      empIds.forEach(id => { map[id] = {}; ents.forEach(ent => { map[id][ent.leaveTypeId] = emptyCell(); }); });
      rows.forEach(r => {
        if (!map[r.employee_id]) map[r.employee_id] = {};
        map[r.employee_id][r.leave_type_id] = {
          opening: Number(r.opening_balance ?? 0), accrued: Number(r.accrued ?? 0), used: Number(r.used ?? 0),
          pending: Number(r.pending ?? 0), encashed: Number(r.encashed ?? 0), lapsed: Number(r.lapsed ?? 0),
        };
      });
      if (active) { setEntitlements(ents); setBalances(map); setLoading(false); }
    })();
    return () => { active = false; };
  }, [allocation.policyId, allocation.allocatedEmployees, year]);

  const setOpening = (empId: string, typeId: string, val: number) => {
    setBalances(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [typeId]: { ...(prev[empId]?.[typeId] ?? emptyCell()), opening: val } },
    }));
  };

  const fillColumn = (typeId: string, days: number) => {
    setBalances(prev => {
      const next = { ...prev };
      visibleEmployees.forEach(e => {
        next[e.id] = { ...next[e.id], [typeId]: { ...(next[e.id]?.[typeId] ?? emptyCell()), opening: days } };
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    setSaving(true);
    const rows: Record<string, unknown>[] = [];
    coveredEmployees.forEach(emp => {
      entitlements.forEach(ent => {
        const cell = balances[emp.id]?.[ent.leaveTypeId] ?? emptyCell();
        const opening = Number(cell.opening) || 0;
        const closing = opening + cell.accrued - cell.used - cell.pending - cell.encashed - cell.lapsed;
        rows.push({
          employee_id: emp.id, leave_type_id: ent.leaveTypeId, year,
          opening_balance: opening, accrued: cell.accrued, used: cell.used, pending: cell.pending,
          encashed: cell.encashed, lapsed: cell.lapsed, closing_balance: closing,
          updated_at: new Date().toISOString(),
        });
      });
    });
    const { error } = rows.length
      ? await lpadb.from('leave_balances').upsert(rows, { onConflict: 'employee_id,leave_type_id,year' })
      : { error: null };
    setSaving(false);
    if (error) { toast.error(`Could not save opening balances: ${error.message}`); return; }
    toast.success(`Opening balances saved for ${coveredEmployees.length} employee(s).`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-5xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-teal-50 to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <Hash size={20} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-teal-900">Manage Opening Balances — {allocation.policyName}</h2>
              <p className="text-xs text-teal-600">Set the opening leave balance per employee for the applied leave types · FY {year}–{year + 1}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employees..."
              className="w-full pl-9 pr-4 py-2.5 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
              <RefreshCw size={16} className="animate-spin" /> Loading balances…
            </div>
          ) : entitlements.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                This policy has no leave-type entitlements configured. Add entitlements in the <strong>Leave Policy Master</strong> first.
              </p>
            </div>
          ) : coveredEmployees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No employees are covered by this allocation.</div>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold sticky left-0 bg-accent/50 z-10 min-w-[200px]">Employee</th>
                    {entitlements.map(ent => (
                      <th key={ent.leaveTypeId} className="px-3 py-3 font-semibold text-center min-w-[130px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{ent.leaveTypeName || ent.leaveTypeCode}</span>
                          <span className="text-[9px] font-normal text-muted-foreground normal-case">Entitlement: {ent.daysPerYear}/yr</span>
                          <button
                            type="button"
                            onClick={() => fillColumn(ent.leaveTypeId, ent.daysPerYear)}
                            className="text-[9px] font-semibold text-teal-600 hover:underline normal-case"
                          >
                            Fill entitlement
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-2.5 sticky left-0 bg-card z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{emp.avatar}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{emp.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{emp.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      {entitlements.map(ent => (
                        <td key={ent.leaveTypeId} className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={balances[emp.id]?.[ent.leaveTypeId]?.opening ?? 0}
                            onChange={e => setOpening(emp.id, ent.leaveTypeId, e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-20 px-2 py-1.5 text-sm text-center bg-accent/40 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {visibleEmployees.length === 0 && (
                    <tr><td colSpan={entitlements.length + 1} className="text-center py-8 text-muted-foreground text-sm">No employees match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <p className="text-xs text-muted-foreground">{coveredEmployees.length} employee(s) · {entitlements.length} leave type(s)</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || loading || entitlements.length === 0 || coveredEmployees.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <><RefreshCw size={15} className="animate-spin" /> Saving…</> : <><Save size={15} /> Save Opening Balances</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface LeavePolicyAllocationProps {
  onBack: () => void;
}

export default function LeavePolicyAllocation({ onBack }: LeavePolicyAllocationProps) {
  const { canEdit } = useMasterAccess();
  const [allocations, setAllocations] = useState<PolicyAllocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [policies, setPolicies] = useState<AvailablePolicy[]>([]);
  const refreshAllocations = React.useCallback(() => { void loadAllocations().then(setAllocations); }, []);
  useEffect(() => {
    let a = true;
    void loadAllocationEmployees().then(r => { if (a) setEmployees(r); });
    void loadAvailablePolicies().then(r => { if (a) setPolicies(r); });
    void loadAllocations().then(r => { if (a) setAllocations(r); });
    return () => { a = false; };
  }, []);
  const [modal, setModal] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<PolicyAllocation | null>(null);
  const [balanceModal, setBalanceModal] = useState<PolicyAllocation | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Draft'>('All');
  const [activeView, setActiveView] = useState<'allocations' | 'employees'>('allocations');
  const [empSearch, setEmpSearch] = useState('');
  const [empPolicyFilter, setEmpPolicyFilter] = useState('All');

  const filteredAllocations = useMemo(() =>
    allocations
      .filter(a => a.policyName.toLowerCase().includes(search.toLowerCase()) || a.policyCode.toLowerCase().includes(search.toLowerCase()))
      .filter(a => statusFilter === 'All' || a.status === statusFilter),
    [allocations, search, statusFilter]
  );

  // Each employee's current policy is derived from the active allocations covering them.
  const employeesWithPolicy = useMemo(() => {
    const map = new Map<string, string>();
    allocations.filter(a => a.status === 'Active').forEach(a =>
      a.allocatedEmployees.forEach(id => { if (!map.has(id)) map.set(id, a.policyName); })
    );
    return employees.map(e => ({ ...e, currentPolicy: map.get(e.id) ?? '' }));
  }, [employees, allocations]);

  const filteredEmployees = useMemo(() =>
    employeesWithPolicy
      .filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase()) || e.employeeId.toLowerCase().includes(empSearch.toLowerCase()))
      .filter(e => empPolicyFilter === 'All' || (empPolicyFilter === 'Unallocated' ? !e.currentPolicy : e.currentPolicy === empPolicyFilter)),
    [employeesWithPolicy, empSearch, empPolicyFilter]
  );

  const openAdd = () => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    setEditingAllocation(null);
    setModal(true);
  };

  const openEdit = (allocation: PolicyAllocation) => {
    setEditingAllocation(allocation);
    setModal(true);
  };

  const handleSave = async (data: Omit<PolicyAllocation, 'id' | 'createdAt'>) => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    const row = allocationToRow(data);
    const year = fyStartYear(data.effectiveFrom);
    if (editingAllocation) {
      const { error } = await lpadb.from('leave_policy_allocations').update(row).eq('id', editingAllocation.id);
      if (error) { toast.error(`Could not update allocation: ${error.message}`); return; }
      // Apply the policy to the (possibly changed) set of covered employees.
      const applied = await applyPolicyToEmployees(data.policyId, data.allocatedEmployees, year);
      if (applied.error) toast.error(`Allocation saved, but applying balances failed: ${applied.error}`);
      toast.success('Policy allocation updated and applied.');
      setModal(false);
      refreshAllocations();
    } else {
      const { data: inserted, error } = await lpadb.from('leave_policy_allocations').insert(row).select('*').single();
      if (error) { toast.error(`Could not save allocation: ${error.message}`); return; }
      // Apply the policy: create leave_balances rows for each covered employee × leave type.
      const applied = await applyPolicyToEmployees(data.policyId, data.allocatedEmployees, year);
      if (applied.error) toast.error(`Allocation saved, but applying balances failed: ${applied.error}`);
      toast.success(`Leave policy applied to ${data.allocatedEmployees.length} employee(s). Set their opening balances below.`);
      setModal(false);
      refreshAllocations();
      // Jump straight into managing the opening balances for the new allocation.
      if (inserted) setBalanceModal(rowToAllocation(inserted as Record<string, any>));
    }
  };

  const deleteAllocation = async (id: string) => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    const { error } = await lpadb.from('leave_policy_allocations').delete().eq('id', id);
    if (error) { toast.error(`Could not delete allocation: ${error.message}`); return; }
    toast.info('Policy allocation removed.');
    refreshAllocations();
  };

  const toggleStatus = async (id: string) => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    const current = allocations.find(a => a.id === id);
    if (!current) return;
    const next = current.status === 'Active' ? 'Inactive' : 'Active';
    const { error } = await lpadb.from('leave_policy_allocations')
      .update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(`Could not update status: ${error.message}`); return; }
    refreshAllocations();
  };

  const totalAllocated = new Set(allocations.flatMap(a => a.allocatedEmployees)).size;
  const activeAllocations = allocations.filter(a => a.status === 'Active').length;
  const unallocatedCount = employees.filter(e => !allocations.some(a => a.allocatedEmployees.includes(e.id) && a.status === 'Active')).length;

  const uniquePolicies = [...new Set(employeesWithPolicy.map(e => e.currentPolicy).filter(Boolean))];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-teal-100 rounded-lg">
                <UserCheck size={22} className="text-teal-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Leave Policy Allocation</h1>
                <p className="text-xs text-muted-foreground">Allocate leave policies to employees filtered by Type, Group, Category, Section, Grade, Designation, and Department.</p>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-md text-sm font-medium"
              >
                <Plus size={16} /> New Allocation
              </button>
            )}
          </div>
          {!canEdit && <div className="mt-3"><ViewOnlyBanner /></div>}
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Allocations', value: allocations.length, sub: `${activeAllocations} active`, color: 'bg-teal-100', iconColor: 'text-teal-600', icon: UserCheck },
              { label: 'Employees Covered', value: totalAllocated, sub: `of ${employees.length} total`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Unallocated', value: unallocatedCount, sub: 'No active policy', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: AlertCircle },
              { label: 'Policies Used', value: new Set(allocations.map(a => a.policyId)).size, sub: `of ${policies.length} available`, color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: BookOpen },
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

          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <Info size={17} className="text-teal-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-teal-800">Leave Policy Allocation — How it works</p>
              <p className="text-xs text-teal-700 mt-0.5">
                Create allocations to assign leave policies to groups of employees. Use filters like <strong>Employee Type, Group, Category, Section, Grade, Designation, and Department</strong> to target specific employee segments. You can also select <strong>All Employees</strong> for a company-wide allocation. Each allocation tracks which employees are covered and the effective period.
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-accent/50 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveView('allocations')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === 'allocations' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <BookOpen size={15} /> Allocations
            </button>
            <button
              onClick={() => setActiveView('employees')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === 'employees' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Users size={15} /> Employee View
            </button>
          </div>

          {/* ── Allocations View ── */}
          {activeView === 'allocations' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input type="text" placeholder="Search allocations..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                  <option value="All">All Status</option>
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Draft</option>
                </select>
                <div className="ml-auto text-xs text-muted-foreground">{filteredAllocations.length} allocations</div>
              </div>

              {filteredAllocations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredAllocations.map(allocation => (
                    <AllocationCard
                      key={allocation.id}
                      allocation={allocation}
                      employees={employees}
                      onEdit={openEdit}
                      onDelete={deleteAllocation}
                      onToggleStatus={toggleStatus}
                      onManageBalances={setBalanceModal}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <UserCheck size={28} className="text-teal-600" />
                  </div>
                  <p className="font-semibold text-muted-foreground">No allocations found</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-5">Create your first policy allocation to get started</p>
                  <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium mx-auto">
                    <Plus size={15} /> New Allocation
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Employee View ── */}
          {activeView === 'employees' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input type="text" placeholder="Search employees..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                </div>
                <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={empPolicyFilter} onChange={e => setEmpPolicyFilter(e.target.value)}>
                  <option value="All">All Policies</option>
                  {uniquePolicies.map(p => <option key={p}>{p}</option>)}
                  <option value="Unallocated">Unallocated</option>
                </select>
                <div className="ml-auto text-xs text-muted-foreground">{filteredEmployees.length} employees</div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">Department</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Grade</th>
                        <th className="px-4 py-3 font-semibold">Current Policy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredEmployees.map((emp, i) => {
                        const hasPolicy = allocations.some(a => a.allocatedEmployees.includes(emp.id) && a.status === 'Active');
                        return (
                          <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{emp.avatar}</div>
                                <div>
                                  <p className="text-sm font-medium">{emp.name}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono">{emp.employeeId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{emp.department}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{emp.employeeType}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{emp.employeeGrade}</td>
                            <td className="px-4 py-3">
                              {hasPolicy ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 size={11} /> {emp.currentPolicy}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                  <AlertCircle size={11} /> Not Allocated
                                </span>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <AllocationFormModal
            onClose={() => setModal(false)}
            onSave={handleSave}
            employees={employees}
            policies={policies}
            editingAllocation={editingAllocation}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {balanceModal && (
          <OpeningBalanceModal
            allocation={balanceModal}
            employees={employees}
            onClose={() => setBalanceModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}