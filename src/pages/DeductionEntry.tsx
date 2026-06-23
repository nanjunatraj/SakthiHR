import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const ddb = supabase as unknown as SupabaseClient;
import {
  CircleDollarSign, Plus, Search, X, Save, CheckCircle2,
  AlertCircle, Info, Users, Calendar, ChevronDown, Trash2,
  Pencil, Eye, Filter, Download, Hash, DollarSign,
  HandCoins, AlertTriangle, Minus, UtensilsCrossed,
  Building2, SlidersHorizontal, Gift, CalendarRange,
  FileText, Clock, Lock, Unlock, RefreshCw,
  ChevronLeft, Bell, CheckCheck, XCircle, Send,
  ThumbsUp, ThumbsDown, MessageSquare, UserCheck
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { useCurrency } from '../context/CurrencyContext';
import { sendWhatsApp } from '../lib/credentials';
import { sendNotificationEmail } from '../lib/email';
import BulkImport, { type CsvColumn } from '../components/configuration/BulkImport';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeductionCategory =
  | 'loan-advances'
  | 'damages-loss'
  | 'fines'
  | 'canteen'
  | 'society'
  | 'other-deductions'
  | 'donations';

type DeductionStatus = 'Draft' | 'Pending Employee Approval' | 'Approved by Employee' | 'Rejected by Employee' | 'Applied';

// Categories that require employee approval
const REQUIRES_EMPLOYEE_APPROVAL: DeductionCategory[] = [
  'damages-loss',
  'fines',
  'canteen',
  'society',
  'other-deductions',
  'donations',
];

interface DeductionEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  avatar: string;
  category: DeductionCategory;
  description: string;
  amount: number;
  payrollPeriodId: string;
  payrollPeriodName: string;
  referenceNo: string;
  remarks: string;
  status: DeductionStatus;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  // Employee approval fields
  employeeApprovalRequired: boolean;
  employeeApprovalStatus?: 'Pending' | 'Approved' | 'Rejected';
  employeeApprovalAt?: string;
  employeeRejectionReason?: string;
  notificationSentAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEDUCTION_CATEGORIES: {
  key: DeductionCategory;
  label: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  description: string;
  requiresEmployeeApproval: boolean;
}[] = [
  {
    key: 'loan-advances',
    label: 'Loan & Advances',
    icon: HandCoins,
    color: 'bg-blue-100',
    iconColor: 'text-blue-600',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-200',
    description: 'EMI recovery for employee loans and salary advances',
    requiresEmployeeApproval: false,
  },
  {
    key: 'damages-loss',
    label: 'Damages & Loss',
    icon: AlertTriangle,
    color: 'bg-red-100',
    iconColor: 'text-red-600',
    accentBg: 'bg-red-50',
    accentText: 'text-red-700',
    accentBorder: 'border-red-200',
    description: 'Deductions for damages to company property or loss of assets',
    requiresEmployeeApproval: true,
  },
  {
    key: 'fines',
    label: 'Fines',
    icon: Minus,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
    accentBorder: 'border-amber-200',
    description: 'Disciplinary fines and penalty deductions',
    requiresEmployeeApproval: true,
  },
  {
    key: 'canteen',
    label: 'Canteen',
    icon: UtensilsCrossed,
    color: 'bg-orange-100',
    iconColor: 'text-orange-600',
    accentBg: 'bg-orange-50',
    accentText: 'text-orange-700',
    accentBorder: 'border-orange-200',
    description: 'Canteen meal charges and food subsidy recovery',
    requiresEmployeeApproval: true,
  },
  {
    key: 'society',
    label: 'Society',
    icon: Building2,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-200',
    description: 'Co-operative society and welfare fund deductions',
    requiresEmployeeApproval: true,
  },
  {
    key: 'other-deductions',
    label: 'Other Deductions',
    icon: SlidersHorizontal,
    color: 'bg-gray-100',
    iconColor: 'text-gray-600',
    accentBg: 'bg-gray-50',
    accentText: 'text-gray-700',
    accentBorder: 'border-gray-200',
    description: 'Miscellaneous deductions not covered by other categories',
    requiresEmployeeApproval: true,
  },
  {
    key: 'donations',
    label: 'Donations / Campaign',
    icon: Gift,
    color: 'bg-pink-100',
    iconColor: 'text-pink-600',
    accentBg: 'bg-pink-50',
    accentText: 'text-pink-700',
    accentBorder: 'border-pink-200',
    description: 'Voluntary donations and charitable contribution deductions',
    requiresEmployeeApproval: true,
  },
];

// Employees + payroll periods are loaded live from the DB (no hardcoded lists).
// Held at module scope so the various sub-components here can read them; the hook
// (called in the main component) populates them and forces a re-render on load.
interface EmployeeRef { id: string; employeeCode: string; name: string; department: string; designation: string; avatar: string; mobile: string; }
interface PeriodRef { id: string; name: string; code: string; fromDate: string; toDate: string; status: string; }

let EMPLOYEES: EmployeeRef[] = [];
let PAYROLL_PERIODS: PeriodRef[] = [];

const initialsOf = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

/** WhatsApp message asking the employee to approve a deduction in the Self-Service Portal. */
function deductionApprovalMessage(name: string, label: string, amount: number, description: string): string {
  return `Hello ${name}, a ${label} deduction of ₹${amount.toLocaleString('en-IN')} (${description || label}) has been proposed on your SakthiHR account.\n` +
    `Please log in to the Employee Self-Service Portal → Approvals to review and approve/reject it. Your approval authorises this deduction in payroll.`;
}

function useDeductionRefs() {
  const [, force] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [empRes, perRes] = await Promise.all([
        ddb.from('employees').select('id, employee_id, first_name, middle_name, last_name, mobile_number, designation:designations(name), department:departments(name)').order('first_name'),
        ddb.from('payroll_periods').select('id, name, code, from_date, to_date, status').order('from_date', { ascending: false }),
      ]);
      if (!active) return;
      EMPLOYEES = ((empRes.data ?? []) as Record<string, any>[]).map(e => {
        const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ');
        return { id: e.id, employeeCode: e.employee_id ?? '', name, department: e.department?.name ?? '—', designation: e.designation?.name ?? '—', avatar: initialsOf(name), mobile: e.mobile_number ?? '' };
      });
      PAYROLL_PERIODS = ((perRes.data ?? []) as Record<string, any>[]).map(p => ({ id: p.id, name: p.name ?? '', code: p.code ?? '', fromDate: p.from_date ?? '', toDate: p.to_date ?? '', status: p.status ?? 'Open' }));
      force(n => n + 1);
    })();
    return () => { active = false; };
  }, []);
}

const STATUS_STYLES: Record<DeductionStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  'Draft': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: FileText },
  'Pending Employee Approval': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  'Approved by Employee': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: CheckCircle2 },
  'Rejected by Employee': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
  'Applied': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle2 },
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

function todayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[now.getMonth()]}/${now.getFullYear()}`;
}

// Deduction entries persist to the `deduction_entries` table (DB-backed).
function rowToEntry(r: Record<string, any>): DeductionEntry {
  const e = r.employee ?? {};
  const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ');
  return {
    id: r.id,
    employeeId: r.employee_id ?? '',
    employeeName: name,
    employeeCode: e.employee_id ?? '',
    department: e.department?.name ?? '—',
    designation: e.designation?.name ?? '—',
    avatar: name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    category: r.category as DeductionCategory,
    description: r.description ?? '',
    amount: Number(r.amount ?? 0),
    payrollPeriodId: r.payroll_period_id ?? '',
    payrollPeriodName: r.payroll_period?.name ?? '',
    referenceNo: r.reference_no ?? '',
    remarks: r.remarks ?? '',
    status: (r.status as DeductionStatus) ?? 'Draft',
    createdAt: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    approvedBy: r.approved_by ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    employeeApprovalRequired: !!r.employee_approval_required,
    employeeApprovalStatus: (r.employee_approval_status as DeductionEntry['employeeApprovalStatus']) ?? undefined,
    employeeApprovalAt: r.employee_approval_at ?? undefined,
    employeeRejectionReason: r.employee_rejection_reason ?? undefined,
    notificationSentAt: r.notification_sent_at ?? undefined,
  };
}

async function loadDeductionEntries(): Promise<DeductionEntry[]> {
  const { data } = await ddb.from('deduction_entries')
    .select('*, employee:employee_id(employee_id, first_name, middle_name, last_name, designation:designations(name), department:departments(name)), payroll_period:payroll_period_id(name)')
    .order('created_at', { ascending: false });
  return ((data ?? []) as Record<string, any>[]).map(rowToEntry);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function getCategoryMeta(key: DeductionCategory) {
  return DEDUCTION_CATEGORIES.find(c => c.key === key) ?? DEDUCTION_CATEGORIES[0];
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

// ─── Employee Selector ────────────────────────────────────────────────────────

interface EmployeeSelectorProps {
  selectedId: string;
  onSelect: (emp: EmployeeRef) => void;
  onClear: () => void;
}

const EmployeeSelector = ({ selectedId, onSelect, onClear }: EmployeeSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedEmp = EMPLOYEES.find(e => e.id === selectedId);

  const filtered = EMPLOYEES.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <div
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${open ? 'border-primary bg-primary/5' : 'border-border bg-accent/50 hover:border-primary/40'}`}
      >
        {selectedEmp ? (
          <>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{selectedEmp.avatar}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selectedEmp.name}</p>
              <p className="text-[10px] text-muted-foreground">{selectedEmp.department} · {selectedEmp.employeeCode}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); onClear(); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Users size={16} className="text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground flex-1">Select Employee</span>
            <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, code, or department..."
                  className="w-full pl-8 pr-4 py-2 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No employees found</div>
              ) : (
                filtered.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => { onSelect(emp); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-primary/5 mb-1 ${selectedId === emp.id ? 'bg-primary/10 border border-primary/20' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{emp.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.department} · {emp.designation}</p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded shrink-0">{emp.employeeCode}</span>
                    {selectedId === emp.id && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Employee Approval Status Badge ──────────────────────────────────────────

interface ApprovalStatusBadgeProps {
  entry: DeductionEntry;
  compact?: boolean;
}

const ApprovalStatusBadge = ({ entry, compact = false }: ApprovalStatusBadgeProps) => {
  if (!entry.employeeApprovalRequired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
        Auto
      </span>
    );
  }

  if (entry.employeeApprovalStatus === 'Pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
        <Clock size={9} /> {compact ? 'Pending' : 'Awaiting Employee'}
      </span>
    );
  }

  if (entry.employeeApprovalStatus === 'Approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
        <ThumbsUp size={9} /> {compact ? 'Approved' : 'Employee Approved'}
      </span>
    );
  }

  if (entry.employeeApprovalStatus === 'Rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
        <ThumbsDown size={9} /> {compact ? 'Rejected' : 'Employee Rejected'}
      </span>
    );
  }

  return null;
};

// ─── Entry Form Modal ─────────────────────────────────────────────────────────

interface EntryFormData {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  avatar: string;
  description: string;
  amount: string;
  payrollPeriodId: string;
  payrollPeriodName: string;
  referenceNo: string;
  remarks: string;
}

interface EntryFormModalProps {
  category: DeductionCategory;
  editingEntry: DeductionEntry | null;
  onClose: () => void;
  onSave: (data: EntryFormData) => void;
}

const EntryFormModal = ({ category, editingEntry, onClose, onSave }: EntryFormModalProps) => {
  const { currencySymbol } = useCurrency();
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;

  const [form, setForm] = useState<EntryFormData>({
    employeeId: editingEntry?.employeeId ?? '',
    employeeName: editingEntry?.employeeName ?? '',
    employeeCode: editingEntry?.employeeCode ?? '',
    department: editingEntry?.department ?? '',
    designation: editingEntry?.designation ?? '',
    avatar: editingEntry?.avatar ?? '',
    description: editingEntry?.description ?? '',
    amount: editingEntry?.amount?.toString() ?? '',
    payrollPeriodId: editingEntry?.payrollPeriodId ?? 'PP004',
    payrollPeriodName: editingEntry?.payrollPeriodName ?? 'July 2025',
    referenceNo: editingEntry?.referenceNo ?? '',
    remarks: editingEntry?.remarks ?? '',
  });

  const handleEmployeeSelect = (emp: typeof EMPLOYEES[0]) => {
    setForm(f => ({
      ...f,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employeeCode,
      department: emp.department,
      designation: emp.designation,
      avatar: emp.avatar,
    }));
  };

  const handlePeriodChange = (periodId: string) => {
    const period = PAYROLL_PERIODS.find(p => p.id === periodId);
    setForm(f => ({
      ...f,
      payrollPeriodId: periodId,
      payrollPeriodName: period?.name ?? '',
    }));
  };

  const handleSave = () => {
    if (!form.employeeId) { toast.error('Please select an employee.'); return; }
    if (!form.description.trim()) { toast.error('Description is required.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Please enter a valid amount.'); return; }
    if (!form.payrollPeriodId) { toast.error('Please select a payroll period.'); return; }
    onSave(form);
  };

  const selectedPeriod = PAYROLL_PERIODS.find(p => p.id === form.payrollPeriodId);
  const isLockedPeriod = selectedPeriod?.status === 'Locked';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b border-border ${meta.accentBg}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <Icon size={20} className={meta.iconColor} />
            </div>
            <div>
              <h2 className={`text-base font-bold ${meta.accentText}`}>
                {editingEntry ? 'Edit' : 'Add'} {meta.label} Entry
              </h2>
              <p className={`text-xs ${meta.accentText} opacity-80`}>{meta.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/50 text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Employee Approval Notice */}
          {meta.requiresEmployeeApproval && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${meta.accentBg} ${meta.accentBorder}`}>
              <UserCheck size={16} className={`${meta.iconColor} shrink-0 mt-0.5`} />
              <div className="text-xs">
                <p className={`font-semibold ${meta.accentText} mb-0.5`}>Employee Approval Required</p>
                <p className={`${meta.accentText} opacity-80`}>
                  This deduction under <strong>{meta.label}</strong> requires employee acknowledgement before it can be applied to payroll. Once saved, a notification will be sent to the employee via the Self-Service Portal for their approval.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
              Select Employee <span className="text-destructive">*</span>
            </label>
            <EmployeeSelector
              selectedId={form.employeeId}
              onSelect={handleEmployeeSelect}
              onClear={() => setForm(f => ({ ...f, employeeId: '', employeeName: '', employeeCode: '', department: '', designation: '', avatar: '' }))}
            />
          </div>

          <Field label="Payroll Period" required hint="The deduction will be applied to the selected payroll period">
            <div className="relative">
              <CalendarRange size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                className={`${selectCls} pl-9`}
                value={form.payrollPeriodId}
                onChange={e => handlePeriodChange(e.target.value)}
              >
                {PAYROLL_PERIODS.map(p => (
                  <option key={p.id} value={p.id} disabled={p.status === 'Locked'}>
                    {p.name} ({p.status}){p.status === 'Locked' ? ' — Locked' : ''}
                  </option>
                ))}
              </select>
            </div>
            {isLockedPeriod && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <Lock size={12} className="shrink-0" />
                This period is locked. Please select an open period.
              </div>
            )}
          </Field>

          <Field label="Description" required hint="Brief description of the deduction reason">
            <input
              type="text"
              className={inputCls}
              placeholder={`e.g. ${
                category === 'loan-advances' ? 'Personal Loan EMI — Month 4' :
                category === 'damages-loss' ? 'Laptop screen damage recovery' :
                category === 'fines' ? 'Late attendance fine — 3 instances' :
                category === 'canteen' ? 'Canteen charges — July 2025' :
                category === 'society' ? 'Co-operative Society monthly contribution' :
                category === 'donations' ? 'PM Relief Fund donation' :
                'Miscellaneous deduction'
              }`}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </Field>

          <Field label={`Amount (${currencySymbol})`} required hint="Deduction amount to be applied in the selected payroll period">
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                className={`${inputCls} pl-9`}
                placeholder="e.g. 5000"
                min={0}
                step={0.01}
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </Field>

          <Field label="Reference Number" hint="Internal reference or voucher number for this deduction">
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                className={`${inputCls} pl-9 font-mono`}
                placeholder={`e.g. ${meta.label.toUpperCase().replace(/\s/g, '/')}/JUL/2025`}
                value={form.referenceNo}
                onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))}
              />
            </div>
          </Field>

          <Field label="Remarks">
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Optional additional remarks or notes"
              value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
            />
          </Field>

          {form.employeeId && form.amount && parseFloat(form.amount) > 0 && form.payrollPeriodId && !isLockedPeriod && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-3 p-4 rounded-xl border ${meta.accentBg} ${meta.accentBorder}`}
            >
              <Info size={16} className={`${meta.iconColor} shrink-0 mt-0.5`} />
              <div className="text-xs">
                <p className={`font-semibold ${meta.accentText} mb-0.5`}>
                  {meta.requiresEmployeeApproval ? 'Approval Workflow' : 'Payroll Impact'}
                </p>
                <p className={`${meta.accentText} opacity-80`}>
                  {meta.requiresEmployeeApproval
                    ? `A deduction of ${currencySymbol}${parseFloat(form.amount).toLocaleString('en-IN')} under ${meta.label} will be sent to ${form.employeeName || 'the selected employee'} for approval via the Self-Service Portal. The deduction will only be applied to ${form.payrollPeriodName} payroll after employee approval.`
                    : `A deduction of ${currencySymbol}${parseFloat(form.amount).toLocaleString('en-IN')} under ${meta.label} will be applied to ${form.employeeName || 'the selected employee'}'s payroll for ${form.payrollPeriodName}.`
                  }
                </p>
              </div>
            </motion.div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={isLockedPeriod}
            className={`flex items-center gap-2 px-6 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
              category === 'loan-advances' ? 'bg-blue-600' :
              category === 'damages-loss' ? 'bg-red-600' :
              category === 'fines' ? 'bg-amber-600' :
              category === 'canteen' ? 'bg-orange-600' :
              category === 'society' ? 'bg-violet-600' :
              category === 'donations' ? 'bg-pink-600' :
              'bg-gray-600'
            }`}
          >
            {meta.requiresEmployeeApproval ? (
              <><Send size={15} /> {editingEntry ? 'Save & Notify Employee' : 'Add & Send for Approval'}</>
            ) : (
              <><Save size={15} /> {editingEntry ? 'Save Changes' : 'Add Deduction'}</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Employee Approval Detail Modal ──────────────────────────────────────────

interface EmployeeApprovalDetailModalProps {
  entry: DeductionEntry;
  onClose: () => void;
  onResendNotification: (id: string) => void;
  onMarkApproved: (id: string) => void;
  onMarkRejected: (id: string, reason: string) => void;
}

const EmployeeApprovalDetailModal = ({ entry, onClose, onResendNotification, onMarkApproved, onMarkRejected }: EmployeeApprovalDetailModalProps) => {
  const { formatAmount } = useCurrency();
  const meta = getCategoryMeta(entry.category);
  const Icon = meta.icon;
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b border-border ${meta.accentBg}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <Icon size={18} className={meta.iconColor} />
            </div>
            <div>
              <h2 className={`text-base font-bold ${meta.accentText}`}>Employee Approval Status</h2>
              <p className={`text-xs ${meta.accentText} opacity-80`}>{entry.id} · {meta.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/50 text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Employee Info */}
          <div className="flex items-center gap-3 p-4 bg-accent/30 rounded-xl border border-border">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">{entry.avatar}</div>
            <div className="flex-1">
              <p className="font-bold text-sm">{entry.employeeName}</p>
              <p className="text-xs text-muted-foreground">{entry.department} · {entry.employeeCode}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-red-600">-{formatAmount(entry.amount)}</p>
              <p className="text-[10px] text-muted-foreground">{entry.payrollPeriodName}</p>
            </div>
          </div>

          {/* Deduction Details */}
          <div className="space-y-2">
            {[
              { label: 'Description', value: entry.description },
              { label: 'Reference No.', value: entry.referenceNo || '—' },
              { label: 'Created On', value: entry.createdAt },
              ...(entry.notificationSentAt ? [{ label: 'Notification Sent', value: entry.notificationSentAt }] : []),
              ...(entry.employeeApprovalAt ? [{ label: entry.employeeApprovalStatus === 'Approved' ? 'Approved On' : 'Rejected On', value: entry.employeeApprovalAt }] : []),
            ].map(row => (
              <div key={row.label} className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide w-32 shrink-0">{row.label}</span>
                <span className="text-sm font-medium text-right">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Approval Status */}
          <div className={`p-4 rounded-xl border ${
            entry.employeeApprovalStatus === 'Approved' ? 'bg-green-50 border-green-200' :
            entry.employeeApprovalStatus === 'Rejected' ? 'bg-red-50 border-red-200' :
            'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {entry.employeeApprovalStatus === 'Approved' ? (
                <><ThumbsUp size={16} className="text-green-600" /><p className="font-bold text-sm text-green-800">Employee Approved</p></>
              ) : entry.employeeApprovalStatus === 'Rejected' ? (
                <><ThumbsDown size={16} className="text-red-600" /><p className="font-bold text-sm text-red-800">Employee Rejected</p></>
              ) : (
                <><Clock size={16} className="text-amber-600" /><p className="font-bold text-sm text-amber-800">Awaiting Employee Approval</p></>
              )}
            </div>
            {entry.employeeApprovalStatus === 'Pending' && (
              <p className="text-xs text-amber-700">
                The employee has been notified via the Self-Service Portal. They need to log in and approve or reject this deduction.
              </p>
            )}
            {entry.employeeApprovalStatus === 'Rejected' && entry.employeeRejectionReason && (
              <div className="mt-2">
                <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1">Employee's Reason:</p>
                <p className="text-xs text-red-700 italic">"{entry.employeeRejectionReason}"</p>
              </div>
            )}
          </div>

          {/* Remarks */}
          {entry.remarks && (
            <div className="p-3 bg-accent/30 rounded-xl border border-border">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">HR Remarks</p>
              <p className="text-sm text-muted-foreground">{entry.remarks}</p>
            </div>
          )}

          {/* Manual Override for Rejected — HR can re-review */}
          {entry.employeeApprovalStatus === 'Rejected' && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-semibold mb-0.5">Employee Rejected This Deduction</p>
                <p>Review the employee's reason and either revise the deduction amount/description or escalate to management for a final decision.</p>
              </div>
            </div>
          )}

          {/* Manual Override — HR can mark as approved/rejected on behalf */}
          {entry.employeeApprovalStatus === 'Pending' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">HR Override (if employee is unavailable)</p>
              {!showRejectForm ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onMarkApproved(entry.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm flex-1 justify-center"
                  >
                    <ThumbsUp size={14} /> Mark as Approved
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors flex-1 justify-center"
                  >
                    <ThumbsDown size={14} /> Mark as Rejected
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Rejection Reason <span className="text-destructive">*</span></label>
                    <textarea
                      className={`${inputCls} resize-none`}
                      rows={2}
                      placeholder="Reason for rejection..."
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (!rejectionReason.trim()) { toast.error('Please provide a rejection reason.'); return; }
                        onMarkRejected(entry.id, rejectionReason);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
                    >
                      <ThumbsDown size={14} /> Confirm Rejection
                    </button>
                    <button onClick={() => setShowRejectForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          {entry.employeeApprovalStatus === 'Pending' && (
            <button
              onClick={() => onResendNotification(entry.id)}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <Bell size={14} /> Resend Notification
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Entry Row ────────────────────────────────────────────────────────────────

interface EntryRowProps {
  entry: DeductionEntry;
  index: number;
  onEdit: (e: DeductionEntry) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewApproval: (e: DeductionEntry) => void;
}

const EntryRow = ({ entry, index, onEdit, onDelete, onApprove, onReject, onViewApproval }: EntryRowProps) => {
  const { formatAmount } = useCurrency();
  const meta = getCategoryMeta(entry.category);
  const Icon = meta.icon;
  const statusStyle = STATUS_STYLES[entry.status];
  const StatusIcon = statusStyle.icon;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="hover:bg-accent/30 transition-colors group"
    >
      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{index + 1}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{entry.avatar}</div>
          <div>
            <p className="text-sm font-semibold">{entry.employeeName}</p>
            <p className="text-[10px] text-muted-foreground">{entry.department} · {entry.employeeCode}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-lg ${meta.color} flex items-center justify-center shrink-0`}>
            <Icon size={12} className={meta.iconColor} />
          </div>
          <div>
            <p className="text-xs font-semibold">{meta.label}</p>
            <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{entry.description}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <CalendarRange size={12} className="text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">{entry.payrollPeriodName}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-bold text-red-600">-{formatAmount(entry.amount)}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
          <StatusIcon size={10} />
          {entry.status}
        </span>
      </td>
      <td className="px-4 py-3">
        {entry.employeeApprovalRequired ? (
          <button
            onClick={() => onViewApproval(entry)}
            className="flex items-center gap-1"
          >
            <ApprovalStatusBadge entry={entry} compact />
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground">N/A</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.createdAt}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {entry.employeeApprovalRequired && (
            <button
              onClick={() => onViewApproval(entry)}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="View Approval Status"
            >
              <UserCheck size={13} />
            </button>
          )}
          {entry.status === 'Draft' && (
            <>
              <button
                onClick={() => onApprove(entry.id)}
                className="p-1.5 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors"
                title="Approve"
              >
                <CheckCircle2 size={13} />
              </button>
              <button
                onClick={() => onEdit(entry)}
                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {entry.status === 'Approved by Employee' && (
            <button
              onClick={() => onReject(entry.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
              title="Reject"
            >
              <X size={13} />
            </button>
          )}
          {(entry.status === 'Applied' || entry.status === 'Rejected by Employee' || entry.status === 'Pending Employee Approval') && (
            <span className="text-[10px] text-muted-foreground px-2">
              {entry.status === 'Applied' ? 'Applied' : entry.status === 'Rejected by Employee' ? 'Rejected' : 'Pending'}
            </span>
          )}
        </div>
      </td>
    </motion.tr>
  );
};

// ─── Period Summary ───────────────────────────────────────────────────────────

interface PeriodSummaryProps {
  entries: DeductionEntry[];
  periodId: string;
  formatAmount: (n: number) => string;
}

const BarChart3Icon = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const PeriodSummary = ({ entries, periodId, formatAmount }: PeriodSummaryProps) => {
  const periodEntries = entries.filter(e => e.payrollPeriodId === periodId);
  if (periodEntries.length === 0) return null;

  const byCategory = DEDUCTION_CATEGORIES.map(cat => ({
    ...cat,
    entries: periodEntries.filter(e => e.category === cat.key),
    total: periodEntries.filter(e => e.category === cat.key).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.entries.length > 0);

  const grandTotal = periodEntries.reduce((s, e) => s + e.amount, 0);
  const appliedTotal = periodEntries.filter(e => e.status === 'Applied').reduce((s, e) => s + e.amount, 0);
  const pendingApprovalTotal = periodEntries.filter(e => e.status === 'Pending Employee Approval').reduce((s, e) => s + e.amount, 0);
  const approvedByEmpTotal = periodEntries.filter(e => e.status === 'Approved by Employee').reduce((s, e) => s + e.amount, 0);
  const rejectedTotal = periodEntries.filter(e => e.status === 'Rejected by Employee').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
        <BarChart3Icon size={16} className="text-primary" />
        <h3 className="font-bold text-sm">Deduction Summary — {PAYROLL_PERIODS.find(p => p.id === periodId)?.name}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{periodEntries.length} entries · {formatAmount(grandTotal)} total</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-lg font-bold text-red-700">{formatAmount(grandTotal)}</p>
            <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide">Total Deductions</p>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
            <p className="text-lg font-bold text-green-700">{formatAmount(appliedTotal)}</p>
            <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Applied to Payroll</p>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <p className="text-lg font-bold text-amber-700">{formatAmount(pendingApprovalTotal + approvedByEmpTotal)}</p>
            <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Pending / Approved</p>
          </div>
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center">
            <p className="text-lg font-bold text-rose-700">{formatAmount(rejectedTotal)}</p>
            <p className="text-[10px] font-medium text-rose-600 uppercase tracking-wide">Rejected by Employee</p>
          </div>
        </div>
        <div className="space-y-2">
          {byCategory.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.key} className="flex items-center gap-3 px-4 py-3 bg-accent/30 rounded-xl border border-border">
                <div className={`w-7 h-7 rounded-lg ${cat.color} flex items-center justify-center shrink-0`}>
                  <Icon size={14} className={cat.iconColor} />
                </div>
                <span className="text-sm font-medium flex-1">{cat.label}</span>
                {cat.requiresEmployeeApproval && (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <UserCheck size={9} /> Emp. Approval
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">{cat.entries.length} entries</span>
                <span className="text-sm font-bold text-red-600">-{formatAmount(cat.total)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface DeductionEntryProps {
  category?: DeductionCategory;
  onBack?: () => void;
}

export default function DeductionEntry({ category: propCategory, onBack }: DeductionEntryProps) {
  const { formatAmount } = useCurrency();
  useDeductionRefs();

  const [activeCategory, setActiveCategory] = useState<DeductionCategory>(propCategory ?? 'loan-advances');
  // Keep the active category in sync when navigating directly between
  // deduction sub-routes (the component instance is reused by the router,
  // so the initial useState value alone would go stale).
  useEffect(() => {
    if (propCategory) setActiveCategory(propCategory);
  }, [propCategory]);
  const [entries, setEntries] = useState<DeductionEntry[]>([]);
  const refreshEntries = useCallback(() => { void loadDeductionEntries().then(setEntries); }, []);
  useEffect(() => { refreshEntries(); }, [refreshEntries]);
  const [entryModal, setEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DeductionEntry | null>(null);
  const [approvalDetailEntry, setApprovalDetailEntry] = useState<DeductionEntry | null>(null);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<DeductionStatus | 'All'>('All');
  const [activeView, setActiveView] = useState<'list' | 'summary'>('list');
  const [summaryPeriod, setSummaryPeriod] = useState('PP004');

  const activeMeta = getCategoryMeta(activeCategory);
  const ActiveIcon = activeMeta.icon;

  const filteredEntries = useMemo(() =>
    entries
      .filter(e => e.category === activeCategory)
      .filter(e => e.employeeName.toLowerCase().includes(search.toLowerCase()) || e.employeeCode.toLowerCase().includes(search.toLowerCase()))
      .filter(e => periodFilter === 'All' || e.payrollPeriodId === periodFilter)
      .filter(e => statusFilter === 'All' || e.status === statusFilter),
    [entries, activeCategory, search, periodFilter, statusFilter]
  );

  const categoryEntries = entries.filter(e => e.category === activeCategory);
  const totalAmount = categoryEntries.reduce((s, e) => s + e.amount, 0);
  const pendingApprovalCount = categoryEntries.filter(e => e.status === 'Pending Employee Approval').length;
  const approvedByEmpCount = categoryEntries.filter(e => e.status === 'Approved by Employee').length;
  const rejectedByEmpCount = categoryEntries.filter(e => e.status === 'Rejected by Employee').length;
  const appliedCount = categoryEntries.filter(e => e.status === 'Applied').length;

  const openAdd = () => {
    setEditingEntry(null);
    setEntryModal(true);
  };

  const openEdit = (entry: DeductionEntry) => {
    setEditingEntry(entry);
    setEntryModal(true);
  };

  const handleSave = async (data: EntryFormData) => {
    const requiresApproval = REQUIRES_EMPLOYEE_APPROVAL.includes(activeCategory);
    if (editingEntry) {
      const { error } = await ddb.from('deduction_entries').update({
        employee_id: data.employeeId, description: data.description, amount: parseFloat(data.amount) || 0,
        payroll_period_id: data.payrollPeriodId || null, reference_no: data.referenceNo || null, remarks: data.remarks || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingEntry.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Deduction entry updated.');
    } else {
      const { error } = await ddb.from('deduction_entries').insert({
        employee_id: data.employeeId, category: activeCategory, description: data.description, amount: parseFloat(data.amount) || 0,
        payroll_period_id: data.payrollPeriodId || null, reference_no: data.referenceNo || null, remarks: data.remarks || null,
        status: requiresApproval ? 'Pending Employee Approval' : 'Draft',
        employee_approval_required: requiresApproval,
        employee_approval_status: requiresApproval ? 'Pending' : null,
        notification_sent_at: requiresApproval ? new Date().toISOString() : null,
      });
      if (error) { toast.error(error.message); return; }
      let waSent = false;
      if (requiresApproval) {
        const emp = EMPLOYEES.find(e => e.id === data.employeeId);
        const approvalMsg = deductionApprovalMessage(data.employeeName, activeMeta.label, parseFloat(data.amount) || 0, data.description);
        const { error: waErr } = await sendWhatsApp({
          employeeId: data.employeeId, phone: emp?.mobile || null, category: 'deduction-approval',
          message: approvalMsg,
        });
        waSent = !!emp?.mobile && !waErr;
        // Also notify by email (alongside WhatsApp) — tracked in Email Communications.
        await sendNotificationEmail({
          employeeId: data.employeeId, toEmail: (emp as { email?: string } | undefined)?.email ?? null,
          category: activeCategory, subject: `${activeMeta.label} Deduction — Approval Requested`,
          message: `<p>${approvalMsg.replace(/\n/g, '<br/>')}</p>`,
        });
      }
      toast.success(requiresApproval
        ? `${activeMeta.label} deduction added for ${data.employeeName}. ${waSent ? 'A WhatsApp approval request was sent to the employee.' : 'Approval request queued (no mobile number on file).'}`
        : `${activeMeta.label} deduction added for ${data.employeeName}. It will be reflected in ${data.payrollPeriodName} payroll.`,
        { autoClose: 5000 });
    }
    setEntryModal(false);
    refreshEntries();
  };

  const updateEntry = async (id: string, patch: Record<string, unknown>, msg?: string, info = false) => {
    const { error } = await ddb.from('deduction_entries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (msg) (info ? toast.info : toast.success)(msg);
    refreshEntries();
  };

  const handleDelete = async (id: string) => {
    const { error } = await ddb.from('deduction_entries').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.info('Deduction entry deleted.');
    refreshEntries();
  };

  const handleApprove = (id: string) =>
    updateEntry(id, { status: 'Approved by Employee', approved_by: 'Admin', approved_at: new Date().toISOString() }, 'Deduction approved. It will be applied in the next payroll run.');

  const handleReject = (id: string) =>
    updateEntry(id, { status: 'Rejected by Employee' }, 'Deduction rejected.', true);

  const handleApproveAll = async () => {
    const draftIds = filteredEntries.filter(e => e.status === 'Draft').map(e => e.id);
    if (draftIds.length === 0) { toast.error('No draft entries to approve.'); return; }
    const { error } = await ddb.from('deduction_entries').update({ status: 'Approved by Employee', approved_by: 'Admin', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', draftIds);
    if (error) { toast.error(error.message); return; }
    toast.success(`${draftIds.length} deduction(s) approved.`);
    refreshEntries();
  };

  const handleResendNotification = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry) {
      const emp = EMPLOYEES.find(e => e.id === entry.employeeId);
      void sendWhatsApp({
        employeeId: entry.employeeId, phone: emp?.mobile || null, category: 'deduction-approval',
        message: deductionApprovalMessage(entry.employeeName, getCategoryMeta(entry.category).label, entry.amount, entry.description),
      });
    }
    void updateEntry(id, { notification_sent_at: new Date().toISOString() }, `WhatsApp approval request resent to ${entry?.employeeName}.`);
    setApprovalDetailEntry(null);
  };

  const handleMarkApproved = (id: string) => {
    const entry = entries.find(e => e.id === id);
    void updateEntry(id, { status: 'Approved by Employee', employee_approval_status: 'Approved', employee_approval_at: new Date().toISOString() }, `Deduction marked as approved on behalf of ${entry?.employeeName}.`);
    setApprovalDetailEntry(null);
  };

  const handleMarkRejected = (id: string, reason: string) => {
    const entry = entries.find(e => e.id === id);
    void updateEntry(id, { status: 'Rejected by Employee', employee_approval_status: 'Rejected', employee_approval_at: new Date().toISOString(), employee_rejection_reason: reason }, `Deduction marked as rejected on behalf of ${entry?.employeeName}.`, true);
    setApprovalDetailEntry(null);
  };

  // ── Bulk CSV import for the active deduction category ──
  const deductionImportColumns: CsvColumn[] = [
    { header: 'Employee Code', required: true, example: 'SMS0001', hint: 'Must match an existing Employee ID' },
    { header: 'Amount', required: true, example: '500', hint: 'Deduction amount (number)' },
    { header: 'Description', example: `${activeMeta.label} charge`, hint: 'Shown on the payslip / approval' },
    { header: 'Reference No', example: 'REF-001' },
    { header: 'Remarks', example: '' },
    { header: 'Payroll Period Code', example: '', hint: 'Optional — matches a Payroll Period code' },
  ];
  const deductionToRecord = (cells: Record<string, string>): Record<string, unknown> | { error: string } => {
    const code = (cells['Employee Code'] || '').trim();
    const emp = EMPLOYEES.find(e => e.employeeCode.toLowerCase() === code.toLowerCase());
    if (!emp) return { error: `Unknown Employee Code "${code}"` };
    const amount = parseFloat(cells['Amount']);
    if (!isFinite(amount) || amount <= 0) return { error: `Invalid amount "${cells['Amount']}"` };
    const periodCode = (cells['Payroll Period Code'] || '').trim();
    const period = periodCode ? PAYROLL_PERIODS.find(p => p.code.toLowerCase() === periodCode.toLowerCase()) : undefined;
    if (periodCode && !period) return { error: `Unknown Payroll Period code "${periodCode}"` };
    return {
      employee_id: emp.id, amount, description: cells['Description'] || '', reference_no: cells['Reference No'] || null,
      remarks: cells['Remarks'] || null, payroll_period_id: period?.id ?? null,
      _employeeName: emp.name, _mobile: emp.mobile,
    };
  };
  const insertDeductionImport = async (record: Record<string, unknown>): Promise<string | null> => {
    const requiresApproval = REQUIRES_EMPLOYEE_APPROVAL.includes(activeCategory);
    const { _employeeName, _mobile, ...row } = record as Record<string, any>;
    const { error } = await ddb.from('deduction_entries').insert({
      ...row, category: activeCategory,
      status: requiresApproval ? 'Pending Employee Approval' : 'Draft',
      employee_approval_required: requiresApproval,
      employee_approval_status: requiresApproval ? 'Pending' : null,
      notification_sent_at: requiresApproval ? new Date().toISOString() : null,
    });
    if (error) return error.message;
    if (requiresApproval) {
      await sendWhatsApp({
        employeeId: row.employee_id as string, phone: (_mobile as string) || null, category: 'deduction-approval',
        message: deductionApprovalMessage(_employeeName as string, activeMeta.label, Number(row.amount) || 0, (row.description as string) || ''),
      });
    }
    return null;
  };

  const draftCount = filteredEntries.filter(e => e.status === 'Draft').length;

  // Pending approvals across all categories
  const totalPendingApprovals = entries.filter(e => e.status === 'Pending Employee Approval').length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className={`p-2 ${activeMeta.color} rounded-lg`}>
                <ActiveIcon size={22} className={activeMeta.iconColor} />
              </div>
              <div>
                <h1 className="text-xl font-bold font-serif">Deductions — {activeMeta.label}</h1>
                <p className="text-xs text-muted-foreground">
                  {activeMeta.description}
                  {activeMeta.requiresEmployeeApproval && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-semibold">
                      <UserCheck size={11} /> Requires Employee Approval
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {totalPendingApprovals > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <Bell size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">{totalPendingApprovals} pending employee approval{totalPendingApprovals !== 1 ? 's' : ''}</span>
                </div>
              )}
              {draftCount > 0 && (
                <button onClick={handleApproveAll} className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium">
                  <CheckCircle2 size={15} /> Approve All ({draftCount})
                </button>
              )}
              <BulkImport
                title={`${activeMeta.label} Deduction`}
                columns={deductionImportColumns}
                toRecord={deductionToRecord}
                insertRecord={insertDeductionImport}
                onDone={refreshEntries}
              />
              <button
                onClick={openAdd}
                className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium ${
                  activeCategory === 'loan-advances' ? 'bg-blue-600' :
                  activeCategory === 'damages-loss' ? 'bg-red-600' :
                  activeCategory === 'fines' ? 'bg-amber-600' :
                  activeCategory === 'canteen' ? 'bg-orange-600' :
                  activeCategory === 'society' ? 'bg-violet-600' :
                  activeCategory === 'donations' ? 'bg-pink-600' :
                  'bg-gray-600'
                }`}
              >
                <Plus size={16} /> Add Entry
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Category Tabs */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Deduction Category</p>
            <div className="flex flex-wrap gap-2">
              {DEDUCTION_CATEGORIES.map(cat => {
                const CatIcon = cat.icon;
                const isActive = activeCategory === cat.key;
                const catCount = entries.filter(e => e.category === cat.key).length;
                const catPendingApproval = entries.filter(e => e.category === cat.key && e.status === 'Pending Employee Approval').length;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      isActive
                        ? `${cat.accentBg} ${cat.accentText} ${cat.accentBorder} shadow-sm`
                        : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:bg-accent/30'
                    }`}
                  >
                    <CatIcon size={15} />
                    {cat.label}
                    {cat.requiresEmployeeApproval && (
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full ${isActive ? `${cat.accentBg} ${cat.accentText}` : 'bg-amber-100 text-amber-700'}`}>
                        <UserCheck size={9} className="inline" />
                      </span>
                    )}
                    {catCount > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? `${cat.accentBg} ${cat.accentText}` : 'bg-accent text-muted-foreground'}`}>
                        {catCount}
                      </span>
                    )}
                    {catPendingApproval > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                        {catPendingApproval}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Entries', value: categoryEntries.length, sub: 'All periods', color: activeMeta.color, iconColor: activeMeta.iconColor, icon: ActiveIcon },
              { label: 'Total Amount', value: formatAmount(totalAmount), sub: 'All periods', color: 'bg-red-100', iconColor: 'text-red-600', icon: DollarSign },
              { label: 'Pending Approval', value: pendingApprovalCount, sub: 'Awaiting employee', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: Clock },
              { label: 'Emp. Approved', value: approvedByEmpCount, sub: 'Ready to apply', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: ThumbsUp },
              { label: 'Emp. Rejected', value: rejectedByEmpCount, sub: 'Needs review', color: 'bg-rose-100', iconColor: 'text-rose-600', icon: ThumbsDown },
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

          {/* Employee Approval Info Banner */}
          {activeMeta.requiresEmployeeApproval && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${activeMeta.accentBg} ${activeMeta.accentBorder}`}>
              <UserCheck size={17} className={`${activeMeta.iconColor} shrink-0 mt-0.5`} />
              <div>
                <p className={`text-sm font-semibold ${activeMeta.accentText}`}>{activeMeta.label} — Employee Approval Required</p>
                <p className={`text-xs ${activeMeta.accentText} opacity-80 mt-0.5`}>
                  Deductions under <strong>{activeMeta.label}</strong> require employee acknowledgement before being applied to payroll. When you add a deduction, the employee receives a notification in their <strong>Self-Service Portal</strong> to approve or reject it. Only approved deductions are included in the payroll run. Rejected deductions are flagged for HR review.
                </p>
              </div>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-accent/50 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveView('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === 'list' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <FileText size={15} /> Entry List
            </button>
            <button
              onClick={() => setActiveView('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === 'summary' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <BarChart3Icon size={15} /> Period Summary
            </button>
          </div>

          {/* ── List View ── */}
          {activeView === 'list' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Filters */}
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    placeholder="Search by employee name or code..."
                    className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
                  value={periodFilter}
                  onChange={e => setPeriodFilter(e.target.value)}
                >
                  <option value="All">All Periods</option>
                  {PAYROLL_PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                  className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as DeductionStatus | 'All')}
                >
                  <option value="All">All Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Pending Employee Approval">Pending Employee Approval</option>
                  <option value="Approved by Employee">Approved by Employee</option>
                  <option value="Rejected by Employee">Rejected by Employee</option>
                  <option value="Applied">Applied</option>
                </select>
                <div className="ml-auto text-xs text-muted-foreground">{filteredEntries.length} entries</div>
              </div>

              {/* Table */}
              {filteredEntries.length > 0 ? (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-10">#</th>
                          <th className="px-4 py-3 font-semibold">Employee</th>
                          <th className="px-4 py-3 font-semibold">Description</th>
                          <th className="px-4 py-3 font-semibold">Payroll Period</th>
                          <th className="px-4 py-3 font-semibold">Amount</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Emp. Approval</th>
                          <th className="px-4 py-3 font-semibold">Created</th>
                          <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredEntries.map((entry, i) => (
                          <EntryRow
                            key={entry.id}
                            entry={entry}
                            index={i}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onViewApproval={setApprovalDetailEntry}
                          />
                        ))}
                      </tbody>
                      <tfoot className="bg-accent/30 border-t-2 border-border">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            Total ({filteredEntries.length} entries)
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-red-700">
                              -{formatAmount(filteredEntries.reduce((s, e) => s + e.amount, 0))}
                            </span>
                          </td>
                          <td colSpan={4} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <div className={`w-16 h-16 ${activeMeta.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                    <ActiveIcon size={28} className={activeMeta.iconColor} />
                  </div>
                  <p className="font-semibold text-muted-foreground">
                    {search || periodFilter !== 'All' || statusFilter !== 'All'
                      ? 'No entries match your filters'
                      : `No ${activeMeta.label} entries yet`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 mb-5">
                    {search || periodFilter !== 'All' || statusFilter !== 'All'
                      ? 'Try adjusting your search or filter criteria'
                      : `Add a ${activeMeta.label} deduction entry to get started`}
                  </p>
                  {!search && periodFilter === 'All' && statusFilter === 'All' && (
                    <button
                      onClick={openAdd}
                      className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto ${
                        activeCategory === 'loan-advances' ? 'bg-blue-600' :
                        activeCategory === 'damages-loss' ? 'bg-red-600' :
                        activeCategory === 'fines' ? 'bg-amber-600' :
                        activeCategory === 'canteen' ? 'bg-orange-600' :
                        activeCategory === 'society' ? 'bg-violet-600' :
                        activeCategory === 'donations' ? 'bg-pink-600' :
                        'bg-gray-600'
                      }`}
                    >
                      <Plus size={15} /> Add {activeMeta.label} Entry
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Summary View ── */}
          {activeView === 'summary' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Select Period:</label>
                <div className="flex flex-wrap gap-2">
                  {PAYROLL_PERIODS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSummaryPeriod(p.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                        summaryPeriod === p.id
                          ? 'bg-primary text-primary-foreground border-primary shadow-md'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {p.status === 'Locked' ? <Lock size={13} /> : p.status === 'Closed' ? <CheckCircle2 size={13} /> : <Unlock size={13} />}
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <PeriodSummary
                entries={entries.filter(e => e.category === activeCategory)}
                periodId={summaryPeriod}
                formatAmount={formatAmount}
              />

              {/* All categories summary for the period */}
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
                  <CircleDollarSign size={16} className="text-primary" />
                  <h3 className="font-bold text-sm">All Deduction Categories — {PAYROLL_PERIODS.find(p => p.id === summaryPeriod)?.name}</h3>
                </div>
                <div className="p-5 space-y-3">
                  {DEDUCTION_CATEGORIES.map(cat => {
                    const CatIcon = cat.icon;
                    const catEntries = entries.filter(e => e.category === cat.key && e.payrollPeriodId === summaryPeriod);
                    const catTotal = catEntries.reduce((s, e) => s + e.amount, 0);
                    const catApplied = catEntries.filter(e => e.status === 'Applied').reduce((s, e) => s + e.amount, 0);
                    const catPendingApproval = catEntries.filter(e => e.status === 'Pending Employee Approval').length;
                    const catRejected = catEntries.filter(e => e.status === 'Rejected by Employee').length;

                    return (
                      <div
                        key={cat.key}
                        onClick={() => { setActiveCategory(cat.key); setActiveView('list'); setPeriodFilter(summaryPeriod); }}
                        className={`flex items-center gap-4 px-4 py-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-sm ${
                          activeCategory === cat.key ? `${cat.accentBg} ${cat.accentBorder}` : 'border-border bg-accent/20 hover:border-primary/30'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl ${cat.color} flex items-center justify-center shrink-0`}>
                          <CatIcon size={18} className={cat.iconColor} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm">{cat.label}</p>
                            {cat.requiresEmployeeApproval && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <UserCheck size={9} /> Emp. Approval
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{catEntries.length} entries</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {catPendingApproval > 0 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                              {catPendingApproval} pending
                            </span>
                          )}
                          {catRejected > 0 && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                              {catRejected} rejected
                            </span>
                          )}
                          {catEntries.length > 0 ? (
                            <div className="text-right">
                              <p className="text-sm font-bold text-red-600">-{formatAmount(catTotal)}</p>
                              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                                {catApplied > 0 && <span className="text-green-600">Applied: {formatAmount(catApplied)}</span>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No entries</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Grand Total */}
                  <div className="flex items-center justify-between px-4 py-4 bg-red-50 border-2 border-red-200 rounded-xl mt-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                        <CircleDollarSign size={18} className="text-red-600" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-red-800">Grand Total Deductions</p>
                        <p className="text-[10px] text-red-600">All categories combined</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-red-700">
                      -{formatAmount(entries.filter(e => e.payrollPeriodId === summaryPeriod).reduce((s, e) => s + e.amount, 0))}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Entry Form Modal */}
      <AnimatePresence>
        {entryModal && (
          <EntryFormModal
            category={activeCategory}
            editingEntry={editingEntry}
            onClose={() => setEntryModal(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      {/* Employee Approval Detail Modal */}
      <AnimatePresence>
        {approvalDetailEntry && (
          <EmployeeApprovalDetailModal
            entry={approvalDetailEntry}
            onClose={() => setApprovalDetailEntry(null)}
            onResendNotification={handleResendNotification}
            onMarkApproved={handleMarkApproved}
            onMarkRejected={handleMarkRejected}
          />
        )}
      </AnimatePresence>
    </div>
  );
}