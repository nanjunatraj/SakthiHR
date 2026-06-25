import { formatDate as fmtTs } from '../../utils/date';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTable } from '../../hooks/useTable';
import BulkImport, { type CsvColumn } from './BulkImport';
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  Save,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  TrendingUp,
  RefreshCw,
  ArrowRightLeft,
  Banknote,
  Users,
  Shield,
  Copy,
  ToggleLeft,
  Filter,
  FileText,
  Clock,
  Star,
  Briefcase,
  Heart,
  Baby,
  Umbrella,
  Plane,
  GraduationCap,
  ChevronDown
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';

type LeaveCategory = 'Casual' | 'Sick' | 'Earned' | 'Maternity' | 'Paternity' | 'Bereavement' | 'Unpaid' | 'Compensatory' | 'Study' | 'Other';
type AccrualFrequency = 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annually' | 'None';
type AccrualBasis = 'Fixed' | 'Pro-Rata' | 'Working Days';
type CarryForwardPolicy = 'None' | 'Full' | 'Limited' | 'Percentage';
type EncashmentPolicy = 'None' | 'On Separation' | 'Annual' | 'On Request';
type GenderApplicability = 'All' | 'Male' | 'Female' | 'Other';

interface AccrualRule {
  frequency: AccrualFrequency;
  daysPerCycle: number;
  basis: AccrualBasis;
  maxAccrualPerYear: number;
  accrualStartMonth: number;
  waitingPeriodDays: number;
  accrueOnProbation: boolean;
}

interface CarryForwardRule {
  policy: CarryForwardPolicy;
  maxDaysCarryForward: number;
  percentageCarryForward: number;
  expiryMonths: number;
  carryForwardToNextYear: boolean;
}

interface EncashmentRule {
  policy: EncashmentPolicy;
  maxEncashmentDaysPerYear: number;
  minBalanceAfterEncashment: number;
  encashmentMultiplier: number;
  taxable: boolean;
}

interface EmployeeCategoryRule {
  categories: string[];
  genderApplicability: GenderApplicability;
  minServiceMonths: number;
  applicableToContractors: boolean;
  applicableToPartTime: boolean;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  category: LeaveCategory;
  color: string;
  description: string;
  maxDaysPerYear: number;
  maxConsecutiveDays: number;
  minDaysPerApplication: number;
  allowHalfDay: boolean;
  requiresDocumentation: boolean;
  documentationAfterDays: number;
  advanceNoticeDays: number;
  isPaid: boolean;
  isActive: boolean;
  /** Allow the balance to go negative (overdraft) when applying leave. */
  allowNegativeBalance: boolean;
  /** Max days the balance may go negative (0 = unlimited overdraft). */
  maxNegativeBalance: number;
  /** Allow an authorised approver to override / exceed the configured limits. */
  allowOverride: boolean;
  accrualRule: AccrualRule;
  carryForwardRule: CarryForwardRule;
  encashmentRule: EncashmentRule;
  employeeCategoryRule: EmployeeCategoryRule;
  createdAt: string;
}

const LEAVE_CATEGORIES: LeaveCategory[] = [
  'Casual', 'Sick', 'Earned', 'Maternity', 'Paternity',
  'Bereavement', 'Unpaid', 'Compensatory', 'Study', 'Other'
];

const ACCRUAL_FREQUENCIES: AccrualFrequency[] = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annually', 'None'];
const ACCRUAL_BASES: AccrualBasis[] = ['Fixed', 'Pro-Rata', 'Working Days'];
const CARRY_FORWARD_POLICIES: CarryForwardPolicy[] = ['None', 'Full', 'Limited', 'Percentage'];
const ENCASHMENT_POLICIES: EncashmentPolicy[] = ['None', 'On Separation', 'Annual', 'On Request'];
const GENDER_OPTIONS: GenderApplicability[] = ['All', 'Male', 'Female', 'Other'];

const EMPLOYEE_CATEGORIES = [
  'All Employees', 'Permanent', 'Probationary', 'Contract', 'Part-Time',
  'Trainee', 'Intern', 'Senior Management', 'Middle Management', 'Staff'
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const LEAVE_COLORS = [
  { value: 'blue', label: 'Blue', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', light: 'bg-blue-50' },
  { value: 'emerald', label: 'Green', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', light: 'bg-emerald-50' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', light: 'bg-amber-50' },
  { value: 'rose', label: 'Rose', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', light: 'bg-rose-50' },
  { value: 'violet', label: 'Purple', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', light: 'bg-violet-50' },
  { value: 'cyan', label: 'Cyan', bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500', light: 'bg-cyan-50' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', light: 'bg-orange-50' },
  { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', light: 'bg-indigo-50' },
  { value: 'teal', label: 'Teal', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', light: 'bg-teal-50' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500', light: 'bg-pink-50' },
];

const CATEGORY_ICONS: Record<LeaveCategory, React.ElementType> = {
  Casual: CalendarDays,
  Sick: Heart,
  Earned: Star,
  Maternity: Baby,
  Paternity: Baby,
  Bereavement: Umbrella,
  Unpaid: Banknote,
  Compensatory: ArrowRightLeft,
  Study: GraduationCap,
  Other: Briefcase,
};

const CATEGORY_STYLES: Record<LeaveCategory, { bg: string; text: string; border: string }> = {
  Casual: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Sick: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  Earned: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  Maternity: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  Paternity: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  Bereavement: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  Unpaid: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  Compensatory: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  Study: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  Other: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function todayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

// ─── Supabase row mapping (leave_types table) ──────────────────────────────────
type DbLeaveTypeRow = Record<string, unknown> & { id: string };

function rowToLeaveType(r: DbLeaveTypeRow): LeaveType {
  return {
    id: r.id,
    name: (r.name as string) ?? '',
    code: (r.code as string) ?? '',
    category: (r.category as LeaveCategory) ?? 'Other',
    color: (r.color as string) ?? 'blue',
    description: (r.description as string) ?? '',
    maxDaysPerYear: Number(r.max_days_per_year ?? 0),
    maxConsecutiveDays: Number(r.max_consecutive_days ?? 0),
    minDaysPerApplication: Number(r.min_days_per_application ?? 0),
    allowHalfDay: Boolean(r.allow_half_day),
    requiresDocumentation: Boolean(r.requires_documentation),
    documentationAfterDays: Number(r.documentation_after_days ?? 0),
    advanceNoticeDays: Number(r.advance_notice_days ?? 0),
    isPaid: Boolean(r.is_paid),
    isActive: Boolean(r.is_active),
    allowNegativeBalance: Boolean(r.allow_negative_balance),
    maxNegativeBalance: Number(r.max_negative_balance ?? 0),
    allowOverride: Boolean(r.allow_override),
    accrualRule: {
      frequency: (r.accrual_frequency as AccrualFrequency) ?? 'None',
      daysPerCycle: Number(r.accrual_days_per_cycle ?? 0),
      basis: (r.accrual_basis as AccrualBasis) ?? 'Fixed',
      maxAccrualPerYear: Number(r.max_accrual_per_year ?? 0),
      accrualStartMonth: Number(r.accrual_start_month ?? 1),
      waitingPeriodDays: Number(r.accrual_waiting_period_days ?? 0),
      accrueOnProbation: Boolean(r.accrue_on_probation),
    },
    carryForwardRule: {
      policy: (r.carry_forward_policy as CarryForwardPolicy) ?? 'None',
      maxDaysCarryForward: Number(r.max_days_carry_forward ?? 0),
      percentageCarryForward: Number(r.percentage_carry_forward ?? 0),
      expiryMonths: Number(r.carry_forward_expiry_months ?? 0),
      carryForwardToNextYear: Boolean(r.carry_forward_to_next_year),
    },
    encashmentRule: {
      policy: (r.encashment_policy as EncashmentPolicy) ?? 'None',
      maxEncashmentDaysPerYear: Number(r.max_encashment_days_per_year ?? 0),
      minBalanceAfterEncashment: Number(r.min_balance_after_encashment ?? 0),
      encashmentMultiplier: Number(r.encashment_multiplier ?? 1),
      taxable: Boolean(r.encashment_taxable),
    },
    employeeCategoryRule: {
      categories: (r.applicable_categories as string[]) ?? [],
      genderApplicability: (r.gender_applicability as GenderApplicability) ?? 'All',
      minServiceMonths: Number(r.min_service_months ?? 0),
      applicableToContractors: Boolean(r.applicable_to_contractors),
      applicableToPartTime: Boolean(r.applicable_to_part_time),
    },
    createdAt: r.created_at ? fmtTs(r.created_at as string) : '',
  };
}

function leaveTypeFormToRow(f: LeaveTypeFormData): Record<string, unknown> {
  return {
    name: f.name.trim(),
    code: f.code.trim(),
    category: f.category,
    color: f.color,
    description: f.description?.trim() || null,
    max_days_per_year: f.maxDaysPerYear || 0,
    max_consecutive_days: f.maxConsecutiveDays || 0,
    min_days_per_application: f.minDaysPerApplication || 0,
    allow_half_day: f.allowHalfDay,
    requires_documentation: f.requiresDocumentation,
    documentation_after_days: f.documentationAfterDays || 0,
    advance_notice_days: f.advanceNoticeDays || 0,
    is_paid: f.isPaid,
    is_active: f.isActive,
    allow_negative_balance: f.allowNegativeBalance,
    max_negative_balance: f.maxNegativeBalance || 0,
    allow_override: f.allowOverride,
    accrual_frequency: f.accrualRule.frequency,
    accrual_days_per_cycle: f.accrualRule.daysPerCycle || 0,
    accrual_basis: f.accrualRule.basis,
    max_accrual_per_year: f.accrualRule.maxAccrualPerYear || 0,
    accrual_start_month: f.accrualRule.accrualStartMonth || 1,
    accrual_waiting_period_days: f.accrualRule.waitingPeriodDays || 0,
    accrue_on_probation: f.accrualRule.accrueOnProbation,
    carry_forward_policy: f.carryForwardRule.policy,
    max_days_carry_forward: f.carryForwardRule.maxDaysCarryForward || 0,
    percentage_carry_forward: f.carryForwardRule.percentageCarryForward || 0,
    carry_forward_expiry_months: f.carryForwardRule.expiryMonths || 0,
    carry_forward_to_next_year: f.carryForwardRule.carryForwardToNextYear,
    encashment_policy: f.encashmentRule.policy,
    max_encashment_days_per_year: f.encashmentRule.maxEncashmentDaysPerYear || 0,
    min_balance_after_encashment: f.encashmentRule.minBalanceAfterEncashment || 0,
    encashment_multiplier: f.encashmentRule.encashmentMultiplier || 1,
    encashment_taxable: f.encashmentRule.taxable,
    applicable_categories: f.employeeCategoryRule.categories,
    gender_applicability: f.employeeCategoryRule.genderApplicability,
    min_service_months: f.employeeCategoryRule.minServiceMonths || 0,
    applicable_to_contractors: f.employeeCategoryRule.applicableToContractors,
    applicable_to_part_time: f.employeeCategoryRule.applicableToPartTime,
  };
}

function getColorStyle(colorValue: string) {
  return LEAVE_COLORS.find(c => c.value === colorValue) ?? LEAVE_COLORS[0];
}

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

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accentColor?: string;
  accentBg?: string;
}

const SectionHeader = ({ icon: Icon, title, subtitle, accentColor = 'text-primary', accentBg = 'bg-primary/10' }: SectionHeaderProps) => (
  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border">
    <div className={`p-2 ${accentBg} rounded-lg shrink-0`}>
      <Icon size={16} className={accentColor} />
    </div>
    <div>
      <h3 className="font-bold text-sm">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal = ({ title, onClose, children }: ModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 16 }}
      className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <X size={20} />
        </button>
      </div>
      {children}
    </motion.div>
  </div>
);

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

const Toggle = ({ value, onChange, label, description }: ToggleProps) => (
  <label className="flex items-center gap-3 cursor-pointer group">
    <div
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-primary' : 'bg-border'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
    <div>
      <span className="text-sm font-medium">{label}</span>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
    </div>
  </label>
);

interface LeaveTypeCardProps {
  leaveType: LeaveType;
  onEdit: (lt: LeaveType) => void;
  onDelete: (id: string) => void;
  onDuplicate: (lt: LeaveType) => void;
  onToggleStatus: (id: string) => void;
}

const LeaveTypeCard = ({ leaveType, onEdit, onDelete, onDuplicate, onToggleStatus }: LeaveTypeCardProps) => {
  const colorStyle = getColorStyle(leaveType.color);
  const CategoryIcon = CATEGORY_ICONS[leaveType.category];
  const catStyle = CATEGORY_STYLES[leaveType.category];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -3 }}
      className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all group overflow-hidden"
    >
      <div className={`h-1.5 w-full ${colorStyle.dot}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${colorStyle.bg} flex items-center justify-center`}>
              <CategoryIcon size={22} className={colorStyle.text} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">{leaveType.name}</h3>
                {leaveType.isPaid ? (
                  <span className="text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">Paid</span>
                ) : (
                  <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">Unpaid</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{leaveType.code}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                  {leaveType.category}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onToggleStatus(leaveType.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              leaveType.isActive
                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${leaveType.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            {leaveType.isActive ? 'Active' : 'Inactive'}
          </button>
        </div>

        {leaveType.description && (
          <p className="text-[11px] text-muted-foreground italic mb-4 line-clamp-2">{leaveType.description}</p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-accent/40 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Max/Year</p>
            <p className="text-sm font-bold">{leaveType.maxDaysPerYear}d</p>
          </div>
          <div className="bg-accent/40 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Accrual</p>
            <p className="text-sm font-bold">
              {leaveType.accrualRule.frequency === 'None' ? '—' : `${leaveType.accrualRule.daysPerCycle}d`}
            </p>
          </div>
          <div className={`${colorStyle.light} rounded-lg p-2.5 text-center`}>
            <p className={`text-[10px] font-medium uppercase tracking-wide mb-0.5 ${colorStyle.text}`}>Carry Fwd</p>
            <p className={`text-sm font-bold ${colorStyle.text}`}>
              {leaveType.carryForwardRule.policy === 'None' ? 'No' :
               leaveType.carryForwardRule.policy === 'Full' ? 'Full' :
               leaveType.carryForwardRule.policy === 'Limited' ? `${leaveType.carryForwardRule.maxDaysCarryForward}d` :
               `${leaveType.carryForwardRule.percentageCarryForward}%`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {leaveType.allowHalfDay && (
            <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">Half Day</span>
          )}
          {leaveType.requiresDocumentation && (
            <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">Docs Required</span>
          )}
          {leaveType.encashmentRule.policy !== 'None' && (
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full">Encashable</span>
          )}
          {leaveType.accrualRule.frequency !== 'None' && (
            <span className="text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full">
              {leaveType.accrualRule.frequency} Accrual
            </span>
          )}
          {leaveType.employeeCategoryRule.genderApplicability !== 'All' && (
            <span className="text-[10px] font-semibold bg-pink-50 text-pink-600 border border-pink-200 px-2 py-0.5 rounded-full">
              {leaveType.employeeCategoryRule.genderApplicability} Only
            </span>
          )}
        </div>

        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Applicable To</p>
          <div className="flex flex-wrap gap-1">
            {leaveType.employeeCategoryRule.categories.slice(0, 3).map(cat => (
              <span key={cat} className="text-[10px] font-medium bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                {cat}
              </span>
            ))}
            {leaveType.employeeCategoryRule.categories.length > 3 && (
              <span className="text-[10px] font-medium text-muted-foreground">
                +{leaveType.employeeCategoryRule.categories.length - 3} more
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 pt-3 border-t border-border">
          <button
            onClick={() => onEdit(leaveType)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={() => onDuplicate(leaveType)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors"
          >
            <Copy size={12} /> Duplicate
          </button>
          <button
            onClick={() => onDelete(leaveType.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
};

type FormTab = 'basic' | 'accrual' | 'carryforward' | 'encashment' | 'eligibility';

interface LeaveTypeFormData {
  name: string;
  code: string;
  category: LeaveCategory;
  color: string;
  description: string;
  maxDaysPerYear: number;
  maxConsecutiveDays: number;
  minDaysPerApplication: number;
  allowHalfDay: boolean;
  requiresDocumentation: boolean;
  documentationAfterDays: number;
  advanceNoticeDays: number;
  isPaid: boolean;
  isActive: boolean;
  allowNegativeBalance: boolean;
  maxNegativeBalance: number;
  allowOverride: boolean;
  accrualRule: AccrualRule;
  carryForwardRule: CarryForwardRule;
  encashmentRule: EncashmentRule;
  employeeCategoryRule: EmployeeCategoryRule;
}

const emptyForm = (): LeaveTypeFormData => ({
  name: '',
  code: '',
  category: 'Casual',
  color: 'blue',
  description: '',
  maxDaysPerYear: 12,
  maxConsecutiveDays: 3,
  minDaysPerApplication: 0.5,
  allowHalfDay: true,
  requiresDocumentation: false,
  documentationAfterDays: 0,
  advanceNoticeDays: 1,
  isPaid: true,
  isActive: true,
  allowNegativeBalance: false,
  maxNegativeBalance: 0,
  allowOverride: false,
  accrualRule: {
    frequency: 'Monthly',
    daysPerCycle: 1,
    basis: 'Fixed',
    maxAccrualPerYear: 12,
    accrualStartMonth: 1,
    waitingPeriodDays: 0,
    accrueOnProbation: true,
  },
  carryForwardRule: {
    policy: 'None',
    maxDaysCarryForward: 0,
    percentageCarryForward: 0,
    expiryMonths: 0,
    carryForwardToNextYear: false,
  },
  encashmentRule: {
    policy: 'None',
    maxEncashmentDaysPerYear: 0,
    minBalanceAfterEncashment: 0,
    encashmentMultiplier: 1,
    taxable: false,
  },
  employeeCategoryRule: {
    categories: ['All Employees'],
    genderApplicability: 'All',
    minServiceMonths: 0,
    applicableToContractors: false,
    applicableToPartTime: true,
  },
});

const LEAVE_TYPE_CATEGORIES: LeaveCategory[] = ['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Bereavement', 'Unpaid', 'Compensatory', 'Study', 'Other'];

const LEAVE_TYPE_CSV_COLUMNS: CsvColumn[] = [
  { header: 'Name', required: true, example: 'Casual Leave' },
  { header: 'Code', required: true, example: 'CL' },
  { header: 'Category', example: 'Casual', hint: LEAVE_TYPE_CATEGORIES.join(' / ') },
  { header: 'Description', example: 'Short-notice personal leave' },
  { header: 'Max Days Per Year', example: '12', hint: 'Number greater than 0' },
  { header: 'Is Paid', example: 'Yes', hint: 'Yes or No' },
  { header: 'Allow Half Day', example: 'Yes', hint: 'Yes or No' },
  { header: 'Advance Notice Days', example: '1', hint: 'Number' },
  { header: 'Status', example: 'Active', hint: 'Active or Inactive' },
];

interface LeaveTypeFormModalProps {
  title: string;
  form: LeaveTypeFormData;
  onChange: (key: keyof LeaveTypeFormData, value: any) => void;
  onAccrualChange: (key: keyof AccrualRule, value: any) => void;
  onCarryForwardChange: (key: keyof CarryForwardRule, value: any) => void;
  onEncashmentChange: (key: keyof EncashmentRule, value: any) => void;
  onEligibilityChange: (key: keyof EmployeeCategoryRule, value: any) => void;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
  existingCodes: string[];
  editingId?: string;
}

const LeaveTypeFormModal = ({
  title, form, onChange, onAccrualChange, onCarryForwardChange,
  onEncashmentChange, onEligibilityChange, onSave, onClose, saveLabel
}: LeaveTypeFormModalProps) => {
  const [activeTab, setActiveTab] = useState<FormTab>('basic');

  const formTabs: { key: FormTab; label: string; icon: React.ElementType }[] = [
    { key: 'basic', label: 'Basic', icon: FileText },
    { key: 'accrual', label: 'Accrual', icon: TrendingUp },
    { key: 'carryforward', label: 'Carry Forward', icon: ArrowRightLeft },
    { key: 'encashment', label: 'Encashment', icon: Banknote },
    { key: 'eligibility', label: 'Eligibility', icon: Users },
  ];

  const colorStyle = getColorStyle(form.color);

  const toggleCategory = (cat: string) => {
    const current = form.employeeCategoryRule.categories;
    if (cat === 'All Employees') {
      onEligibilityChange('categories', ['All Employees']);
      return;
    }
    const withoutAll = current.filter(c => c !== 'All Employees');
    const updated = withoutAll.includes(cat)
      ? withoutAll.filter(c => c !== cat)
      : [...withoutAll, cat];
    onEligibilityChange('categories', updated.length === 0 ? ['All Employees'] : updated);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex items-center gap-0.5 px-6 pt-4 border-b border-border bg-accent/10 overflow-x-auto">
        {formTabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all rounded-t-lg border-b-2 whitespace-nowrap ${
                isActive
                  ? 'text-primary border-primary bg-primary/5'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <TabIcon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-6 max-h-[60vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
          >
            {activeTab === 'basic' && (
              <div className="space-y-5">
                <SectionHeader icon={FileText} title="Leave Type Identity" subtitle="Name, code, category and basic settings" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Field label="Leave Type Name" required>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="e.g. Casual Leave, Sick Leave, Earned Leave"
                        value={form.name}
                        onChange={e => onChange('name', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Leave Code" required hint="Short unique code (e.g. CL, SL, EL)">
                    <input
                      type="text"
                      className={`${inputCls} font-mono uppercase`}
                      placeholder="e.g. CL"
                      maxLength={6}
                      value={form.code}
                      onChange={e => onChange('code', e.target.value.toUpperCase())}
                    />
                  </Field>
                  <Field label="Category" required>
                    <select
                      className={selectCls}
                      value={form.category}
                      onChange={e => onChange('category', e.target.value as LeaveCategory)}
                    >
                      {LEAVE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Description">
                      <textarea
                        className={`${inputCls} resize-none`}
                        rows={2}
                        placeholder="Brief description of this leave type"
                        value={form.description}
                        onChange={e => onChange('description', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Color">
                    <div className="flex gap-2 flex-wrap">
                      {LEAVE_COLORS.map(c => (
                        <button
                          key={c.value}
                          onClick={() => onChange('color', c.value)}
                          title={c.label}
                          className={`w-8 h-8 rounded-lg ${c.dot} border-2 transition-all ${
                            form.color === c.value ? 'border-foreground scale-110 shadow-md' : 'border-transparent hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </Field>
                  <Field label="Status">
                    <select
                      className={selectCls}
                      value={form.isActive ? 'Active' : 'Inactive'}
                      onChange={e => onChange('isActive', e.target.value === 'Active')}
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </Field>
                </div>

                <div className="border-t border-border pt-5">
                  <SectionHeader icon={Clock} title="Leave Limits & Rules" subtitle="Days, consecutive limits and application rules" accentColor="text-blue-600" accentBg="bg-blue-50" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Max Days Per Year" required hint="Total leave days allowed per year">
                      <input
                        type="number"
                        className={inputCls}
                        min={0}
                        max={365}
                        step={0.5}
                        value={form.maxDaysPerYear}
                        onChange={e => onChange('maxDaysPerYear', parseFloat(e.target.value) || 0)}
                      />
                    </Field>
                    <Field label="Max Consecutive Days" hint="Maximum days in a single application">
                      <input
                        type="number"
                        className={inputCls}
                        min={1}
                        max={365}
                        value={form.maxConsecutiveDays}
                        onChange={e => onChange('maxConsecutiveDays', parseInt(e.target.value) || 1)}
                      />
                    </Field>
                    <Field label="Min Days Per Application" hint="Minimum days per leave request">
                      <input
                        type="number"
                        className={inputCls}
                        min={0.5}
                        max={30}
                        step={0.5}
                        value={form.minDaysPerApplication}
                        onChange={e => onChange('minDaysPerApplication', parseFloat(e.target.value) || 0.5)}
                      />
                    </Field>
                    <Field label="Advance Notice (Days)" hint="Days in advance the leave must be applied">
                      <input
                        type="number"
                        className={inputCls}
                        min={0}
                        max={90}
                        value={form.advanceNoticeDays}
                        onChange={e => onChange('advanceNoticeDays', parseInt(e.target.value) || 0)}
                      />
                    </Field>
                    <Field label="Documentation After (Days)" hint="Require documents if leave exceeds this many days">
                      <input
                        type="number"
                        className={inputCls}
                        min={0}
                        max={30}
                        value={form.documentationAfterDays}
                        onChange={e => onChange('documentationAfterDays', parseInt(e.target.value) || 0)}
                        disabled={!form.requiresDocumentation}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <Toggle
                      value={form.isPaid}
                      onChange={v => onChange('isPaid', v)}
                      label="Paid Leave"
                      description="Employee receives salary during this leave"
                    />
                    <Toggle
                      value={form.allowHalfDay}
                      onChange={v => onChange('allowHalfDay', v)}
                      label="Allow Half Day"
                      description="Employee can apply for half-day leave"
                    />
                    <Toggle
                      value={form.requiresDocumentation}
                      onChange={v => onChange('requiresDocumentation', v)}
                      label="Requires Documentation"
                      description="Medical certificate or supporting document needed"
                    />
                  </div>

                  {/* Negative balance / override */}
                  <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-4">
                    <div className="flex items-center gap-2">
                      <ToggleLeft size={15} className="text-amber-600" />
                      <p className="text-sm font-bold text-amber-800">Negative Balance & Override</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Toggle
                        value={form.allowNegativeBalance}
                        onChange={v => onChange('allowNegativeBalance', v)}
                        label="Allow Negative Balance"
                        description="Permit applying leave beyond the available balance (overdraft)"
                      />
                      <Field label="Max Negative Balance (days)" hint="0 = unlimited overdraft">
                        <input
                          type="number"
                          className={inputCls}
                          min={0}
                          step={0.5}
                          value={form.maxNegativeBalance}
                          onChange={e => onChange('maxNegativeBalance', parseFloat(e.target.value) || 0)}
                          disabled={!form.allowNegativeBalance}
                        />
                      </Field>
                      <Toggle
                        value={form.allowOverride}
                        onChange={v => onChange('allowOverride', v)}
                        label="Allow Override"
                        description="Authorised approver can override / exceed the configured limits"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'accrual' && (
              <div className="space-y-5">
                <SectionHeader icon={TrendingUp} title="Accrual Rules" subtitle="How leave days are earned and accumulated" accentColor="text-violet-600" accentBg="bg-violet-50" />
                <div className="flex items-start gap-3 p-4 bg-violet-50 border border-violet-200 rounded-xl">
                  <Info size={16} className="text-violet-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-violet-700">
                    Accrual rules define how leave days are credited to employees over time. Set frequency to <strong>None</strong> for leave types that are granted as a lump sum (e.g. Maternity Leave).
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Accrual Frequency" required>
                    <select
                      className={selectCls}
                      value={form.accrualRule.frequency}
                      onChange={e => onAccrualChange('frequency', e.target.value as AccrualFrequency)}
                    >
                      {ACCRUAL_FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </Field>
                  <Field label="Accrual Basis">
                    <select
                      className={selectCls}
                      value={form.accrualRule.basis}
                      onChange={e => onAccrualChange('basis', e.target.value as AccrualBasis)}
                      disabled={form.accrualRule.frequency === 'None'}
                    >
                      {ACCRUAL_BASES.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </Field>
                  {form.accrualRule.frequency !== 'None' && (
                    <>
                      <Field label={`Days Per ${form.accrualRule.frequency === 'Monthly' ? 'Month' : form.accrualRule.frequency === 'Quarterly' ? 'Quarter' : form.accrualRule.frequency === 'Half-Yearly' ? 'Half Year' : 'Year'}`} required hint="Number of leave days credited per cycle">
                        <input
                          type="number"
                          className={inputCls}
                          min={0.5}
                          max={30}
                          step={0.5}
                          value={form.accrualRule.daysPerCycle}
                          onChange={e => onAccrualChange('daysPerCycle', parseFloat(e.target.value) || 0)}
                        />
                      </Field>
                      <Field label="Max Accrual Per Year" hint="Maximum days that can be accrued in a year">
                        <input
                          type="number"
                          className={inputCls}
                          min={0}
                          max={365}
                          step={0.5}
                          value={form.accrualRule.maxAccrualPerYear}
                          onChange={e => onAccrualChange('maxAccrualPerYear', parseFloat(e.target.value) || 0)}
                        />
                      </Field>
                      <Field label="Accrual Start Month" hint="Month from which accrual begins each year">
                        <select
                          className={selectCls}
                          value={form.accrualRule.accrualStartMonth}
                          onChange={e => onAccrualChange('accrualStartMonth', parseInt(e.target.value))}
                        >
                          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                      </Field>
                      <Field label="Waiting Period (Days)" hint="Days of service before accrual begins">
                        <input
                          type="number"
                          className={inputCls}
                          min={0}
                          max={365}
                          value={form.accrualRule.waitingPeriodDays}
                          onChange={e => onAccrualChange('waitingPeriodDays', parseInt(e.target.value) || 0)}
                        />
                      </Field>
                      <div className="md:col-span-2">
                        <Toggle
                          value={form.accrualRule.accrueOnProbation}
                          onChange={v => onAccrualChange('accrueOnProbation', v)}
                          label="Accrue During Probation"
                          description="Leave days are credited even during the probation period"
                        />
                      </div>
                    </>
                  )}
                </div>
                {form.accrualRule.frequency !== 'None' && (
                  <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl">
                    <p className="text-xs font-semibold text-violet-800 mb-1">Accrual Summary</p>
                    <p className="text-xs text-violet-700">
                      <strong>{form.accrualRule.daysPerCycle} days</strong> credited every <strong>{form.accrualRule.frequency.toLowerCase()}</strong> on a <strong>{form.accrualRule.basis}</strong> basis.
                      Maximum <strong>{form.accrualRule.maxAccrualPerYear} days/year</strong>.
                      {form.accrualRule.waitingPeriodDays > 0 && ` Waiting period: ${form.accrualRule.waitingPeriodDays} days.`}
                      {!form.accrualRule.accrueOnProbation && ' Does not accrue during probation.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'carryforward' && (
              <div className="space-y-5">
                <SectionHeader icon={ArrowRightLeft} title="Carry Forward Rules" subtitle="How unused leave balance is handled at year end" accentColor="text-emerald-600" accentBg="bg-emerald-50" />
                <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700">
                    Carry forward rules determine what happens to unused leave balance at the end of the leave year.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Field label="Carry Forward Policy" required>
                      <select
                        className={selectCls}
                        value={form.carryForwardRule.policy}
                        onChange={e => onCarryForwardChange('policy', e.target.value as CarryForwardPolicy)}
                      >
                        {CARRY_FORWARD_POLICIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </Field>
                  </div>
                  {form.carryForwardRule.policy !== 'None' && (
                    <>
                      {form.carryForwardRule.policy === 'Limited' && (
                        <Field label="Max Days to Carry Forward" hint="Maximum number of days that can be carried forward">
                          <input
                            type="number"
                            className={inputCls}
                            min={0}
                            max={365}
                            value={form.carryForwardRule.maxDaysCarryForward}
                            onChange={e => onCarryForwardChange('maxDaysCarryForward', parseInt(e.target.value) || 0)}
                          />
                        </Field>
                      )}
                      {form.carryForwardRule.policy === 'Percentage' && (
                        <Field label="Percentage to Carry Forward (%)" hint="Percentage of unused balance carried forward">
                          <input
                            type="number"
                            className={inputCls}
                            min={0}
                            max={100}
                            step={5}
                            value={form.carryForwardRule.percentageCarryForward}
                            onChange={e => onCarryForwardChange('percentageCarryForward', parseInt(e.target.value) || 0)}
                          />
                        </Field>
                      )}
                      <Field label="Expiry (Months)" hint="Carried forward balance expires after this many months (0 = no expiry)">
                        <input
                          type="number"
                          className={inputCls}
                          min={0}
                          max={24}
                          value={form.carryForwardRule.expiryMonths}
                          onChange={e => onCarryForwardChange('expiryMonths', parseInt(e.target.value) || 0)}
                        />
                      </Field>
                      <div className="md:col-span-2">
                        <Toggle
                          value={form.carryForwardRule.carryForwardToNextYear}
                          onChange={v => onCarryForwardChange('carryForwardToNextYear', v)}
                          label="Carry Forward to Next Year"
                          description="Unused balance is added to next year's opening balance"
                        />
                      </div>
                    </>
                  )}
                </div>
                {form.carryForwardRule.policy === 'None' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs text-muted-foreground">
                    <Info size={12} />
                    Unused leave balance will be forfeited at the end of the leave year.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'encashment' && (
              <div className="space-y-5">
                <SectionHeader icon={Banknote} title="Encashment Settings" subtitle="Rules for converting leave balance to cash" accentColor="text-amber-600" accentBg="bg-amber-50" />
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Leave encashment allows employees to convert unused leave balance into monetary compensation.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Field label="Encashment Policy" required>
                      <select
                        className={selectCls}
                        value={form.encashmentRule.policy}
                        onChange={e => onEncashmentChange('policy', e.target.value as EncashmentPolicy)}
                      >
                        {ENCASHMENT_POLICIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </Field>
                  </div>
                  {form.encashmentRule.policy !== 'None' && (
                    <>
                      <Field label="Max Encashment Days Per Year" hint="Maximum days that can be encashed in a year">
                        <input
                          type="number"
                          className={inputCls}
                          min={0}
                          max={365}
                          value={form.encashmentRule.maxEncashmentDaysPerYear}
                          onChange={e => onEncashmentChange('maxEncashmentDaysPerYear', parseInt(e.target.value) || 0)}
                        />
                      </Field>
                      <Field label="Min Balance After Encashment" hint="Minimum leave balance that must remain after encashment">
                        <input
                          type="number"
                          className={inputCls}
                          min={0}
                          max={365}
                          value={form.encashmentRule.minBalanceAfterEncashment}
                          onChange={e => onEncashmentChange('minBalanceAfterEncashment', parseInt(e.target.value) || 0)}
                        />
                      </Field>
                      <Field label="Encashment Multiplier" hint="Multiplier applied to daily salary for encashment">
                        <input
                          type="number"
                          className={inputCls}
                          min={0.5}
                          max={5}
                          step={0.25}
                          value={form.encashmentRule.encashmentMultiplier}
                          onChange={e => onEncashmentChange('encashmentMultiplier', parseFloat(e.target.value) || 1)}
                        />
                      </Field>
                      <div className="flex items-end">
                        <Toggle
                          value={form.encashmentRule.taxable}
                          onChange={v => onEncashmentChange('taxable', v)}
                          label="Encashment is Taxable"
                          description="Leave encashment amount is subject to income tax"
                        />
                      </div>
                    </>
                  )}
                </div>
                {form.encashmentRule.policy === 'None' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs text-muted-foreground">
                    <Info size={12} />
                    This leave type cannot be encashed.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'eligibility' && (
              <div className="space-y-5">
                <SectionHeader icon={Users} title="Employee Eligibility" subtitle="Define which employees are eligible for this leave type" accentColor="text-cyan-600" accentBg="bg-cyan-50" />
                <div className="flex items-start gap-3 p-4 bg-cyan-50 border border-cyan-200 rounded-xl">
                  <Info size={16} className="text-cyan-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-cyan-700">
                    Configure which employee categories, genders, and service conditions are eligible for this leave type.
                  </p>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">
                      Applicable Employee Categories
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {EMPLOYEE_CATEGORIES.map(cat => {
                        const isSelected = form.employeeCategoryRule.categories.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all text-left ${
                              isSelected
                                ? 'bg-primary/10 text-primary border-primary shadow-sm'
                                : 'bg-accent/30 text-muted-foreground border-border hover:border-primary/40 hover:bg-accent/60'
                            }`}
                          >
                            {isSelected && <CheckCircle2 size={12} className="shrink-0" />}
                            {!isSelected && <div className="w-3 h-3 rounded-full border-2 border-current opacity-30 shrink-0" />}
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Gender Applicability" hint="Restrict this leave to a specific gender">
                      <select
                        className={selectCls}
                        value={form.employeeCategoryRule.genderApplicability}
                        onChange={e => onEligibilityChange('genderApplicability', e.target.value as GenderApplicability)}
                      >
                        {GENDER_OPTIONS.map(g => <option key={g}>{g}</option>)}
                      </select>
                    </Field>
                    <Field label="Minimum Service (Months)" hint="Minimum months of service required to avail this leave">
                      <input
                        type="number"
                        className={inputCls}
                        min={0}
                        max={120}
                        value={form.employeeCategoryRule.minServiceMonths}
                        onChange={e => onEligibilityChange('minServiceMonths', parseInt(e.target.value) || 0)}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Toggle
                      value={form.employeeCategoryRule.applicableToContractors}
                      onChange={v => onEligibilityChange('applicableToContractors', v)}
                      label="Applicable to Contractors"
                      description="Contract employees can avail this leave type"
                    />
                    <Toggle
                      value={form.employeeCategoryRule.applicableToPartTime}
                      onChange={v => onEligibilityChange('applicableToPartTime', v)}
                      label="Applicable to Part-Time"
                      description="Part-time employees can avail this leave type"
                    />
                  </div>
                  {form.employeeCategoryRule.genderApplicability !== 'All' && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 border border-pink-200 rounded-lg text-xs text-pink-700">
                      <AlertCircle size={12} />
                      This leave type is restricted to <strong>{form.employeeCategoryRule.genderApplicability}</strong> employees only.
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
        <div className="flex items-center gap-2">
          {formTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-2 h-2 rounded-full transition-all ${activeTab === tab.key ? 'bg-primary w-4' : 'bg-border hover:bg-muted-foreground'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={onSave} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
            {saveLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface LeaveTypeMasterProps {
  onBack: () => void;
}

export default function LeaveTypeMaster({ onBack }: LeaveTypeMasterProps) {
  // Stored in and retrieved from the Supabase `leave_types` table only.
  const leaveTypesTable = useTable<DbLeaveTypeRow>('leave_types', { orderBy: { column: 'created_at', ascending: true } });
  const leaveTypes = useMemo(() => leaveTypesTable.rows.map(rowToLeaveType), [leaveTypesTable.rows]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<LeaveCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [paidFilter, setPaidFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');

  const [modal, setModal] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<LeaveTypeFormData>(emptyForm());

  const filteredLeaveTypes = useMemo(() => {
    return leaveTypes.filter(lt => {
      const matchSearch = lt.name.toLowerCase().includes(search.toLowerCase()) ||
        lt.code.toLowerCase().includes(search.toLowerCase()) ||
        lt.description.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'All' || lt.category === categoryFilter;
      const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' ? lt.isActive : !lt.isActive);
      const matchPaid = paidFilter === 'All' || (paidFilter === 'Paid' ? lt.isPaid : !lt.isPaid);
      return matchSearch && matchCategory && matchStatus && matchPaid;
    });
  }, [leaveTypes, search, categoryFilter, statusFilter, paidFilter]);

  const openAdd = () => {
    setEditingLeaveType(null);
    setForm(emptyForm());
    setModal(true);
  };

  const openEdit = (lt: LeaveType) => {
    setEditingLeaveType(lt);
    setForm({
      name: lt.name,
      code: lt.code,
      category: lt.category,
      color: lt.color,
      description: lt.description,
      maxDaysPerYear: lt.maxDaysPerYear,
      maxConsecutiveDays: lt.maxConsecutiveDays,
      minDaysPerApplication: lt.minDaysPerApplication,
      allowHalfDay: lt.allowHalfDay,
      requiresDocumentation: lt.requiresDocumentation,
      documentationAfterDays: lt.documentationAfterDays,
      advanceNoticeDays: lt.advanceNoticeDays,
      isPaid: lt.isPaid,
      isActive: lt.isActive,
      allowNegativeBalance: lt.allowNegativeBalance,
      maxNegativeBalance: lt.maxNegativeBalance,
      allowOverride: lt.allowOverride,
      accrualRule: { ...lt.accrualRule },
      carryForwardRule: { ...lt.carryForwardRule },
      encashmentRule: { ...lt.encashmentRule },
      employeeCategoryRule: { ...lt.employeeCategoryRule, categories: [...lt.employeeCategoryRule.categories] },
    });
    setModal(true);
  };

  const handleDuplicate = (lt: LeaveType) => {
    setEditingLeaveType(null);
    setForm({
      name: `${lt.name} (Copy)`,
      code: `${lt.code}2`,
      category: lt.category,
      color: lt.color,
      description: lt.description,
      maxDaysPerYear: lt.maxDaysPerYear,
      maxConsecutiveDays: lt.maxConsecutiveDays,
      minDaysPerApplication: lt.minDaysPerApplication,
      allowHalfDay: lt.allowHalfDay,
      requiresDocumentation: lt.requiresDocumentation,
      documentationAfterDays: lt.documentationAfterDays,
      advanceNoticeDays: lt.advanceNoticeDays,
      isPaid: lt.isPaid,
      isActive: false,
      allowNegativeBalance: lt.allowNegativeBalance,
      maxNegativeBalance: lt.maxNegativeBalance,
      allowOverride: lt.allowOverride,
      accrualRule: { ...lt.accrualRule },
      carryForwardRule: { ...lt.carryForwardRule },
      encashmentRule: { ...lt.encashmentRule },
      employeeCategoryRule: { ...lt.employeeCategoryRule, categories: [...lt.employeeCategoryRule.categories] },
    });
    setModal(true);
    toast.info('Leave type duplicated — review and save.');
  };

  const saveLeaveType = async () => {
    if (!form.name) { toast.error('Leave type name is required.'); return; }
    if (!form.code) { toast.error('Leave code is required.'); return; }
    if (form.maxDaysPerYear <= 0) { toast.error('Max days per year must be greater than 0.'); return; }

    const codeExists = leaveTypes.some(lt =>
      lt.code === form.code && (editingLeaveType ? lt.id !== editingLeaveType.id : true)
    );
    if (codeExists) { toast.error('Leave code already exists. Please use a unique code.'); return; }

    const row = leaveTypeFormToRow(form);
    const err = editingLeaveType
      ? (await leaveTypesTable.update(editingLeaveType.id, row)).error
      : (await leaveTypesTable.insert(row)).error;
    if (err) { toast.error(err); return; }
    toast.success(`Leave type ${editingLeaveType ? 'updated' : 'created'} successfully.`);
    setModal(false);
  };

  // Map one CSV row → the fields we accept on import (rest filled from defaults).
  const csvToLeaveType = (cells: Record<string, string>): Record<string, unknown> | { error: string } => {
    const catRaw = (cells['Category'] || 'Casual').trim();
    const category = LEAVE_TYPE_CATEGORIES.find(c => c.toLowerCase() === catRaw.toLowerCase());
    if (!category) return { error: `Invalid Category "${catRaw}"` };
    const maxRaw = cells['Max Days Per Year']?.trim();
    const maxDays = maxRaw ? Number(maxRaw) : 12;
    if (isNaN(maxDays) || maxDays <= 0) return { error: 'Max Days Per Year must be a number greater than 0' };
    const statusRaw = (cells['Status'] || 'Active').trim();
    if (!/^(active|inactive)$/i.test(statusRaw)) return { error: `Invalid Status "${statusRaw}"` };
    const adv = cells['Advance Notice Days']?.trim();
    if (adv && isNaN(Number(adv))) return { error: `Advance Notice Days "${adv}" is not a number` };
    if (leaveTypes.some(lt => lt.code.toLowerCase() === cells['Code'].trim().toLowerCase())) {
      return { error: `Code "${cells['Code'].trim()}" already exists` };
    }
    const yes = (v?: string) => /^(yes|true|1|y)$/i.test((v || '').trim());
    return {
      name: cells['Name'].trim(),
      code: cells['Code'].trim(),
      category,
      description: cells['Description']?.trim() || '',
      maxDaysPerYear: maxDays,
      isPaid: cells['Is Paid'] ? yes(cells['Is Paid']) : true,
      allowHalfDay: cells['Allow Half Day'] ? yes(cells['Allow Half Day']) : true,
      advanceNoticeDays: adv ? Number(adv) : 1,
      isActive: /^active$/i.test(statusRaw),
    };
  };

  const importLeaveType = async (rec: Record<string, unknown>): Promise<string | null> => {
    const form = { ...emptyForm(), ...(rec as Partial<LeaveTypeFormData>) };
    return (await leaveTypesTable.insert(leaveTypeFormToRow(form))).error;
  };

  const deleteLeaveType = async (id: string) => {
    const err = (await leaveTypesTable.remove(id)).error;
    if (err) { toast.error(err); return; }
    toast.info('Leave type deleted.');
  };

  const toggleStatus = async (id: string) => {
    const lt = leaveTypes.find(x => x.id === id);
    if (!lt) return;
    const err = (await leaveTypesTable.update(id, { is_active: !lt.isActive })).error;
    if (err) toast.error(err);
  };

  const activeCount = leaveTypes.filter(lt => lt.isActive).length;
  const paidCount = leaveTypes.filter(lt => lt.isPaid).length;
  const encashableCount = leaveTypes.filter(lt => lt.encashmentRule.policy !== 'None').length;
  const accrualCount = leaveTypes.filter(lt => lt.accrualRule.frequency !== 'None').length;

  const existingCodes = leaveTypes.map(lt => lt.code);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-rose-100 rounded-lg">
                <CalendarDays size={22} className="text-rose-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Leave Type Master</h1>
                <p className="text-xs text-muted-foreground">Define leave types with accrual rules, carry-forward limits, encashment settings, and eligibility.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BulkImport
                title="Leave Type"
                columns={LEAVE_TYPE_CSV_COLUMNS}
                toRecord={csvToLeaveType}
                insertRecord={importLeaveType}
              />
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"
              >
                <Plus size={16} /> Add Leave Type
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-rose-100 rounded-xl"><CalendarDays size={20} className="text-rose-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Types</p>
                <p className="font-bold text-lg mt-0.5">{leaveTypes.length}</p>
                <p className="text-[10px] text-muted-foreground">{activeCount} active</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-emerald-100 rounded-xl"><CheckCircle2 size={20} className="text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Paid Leave</p>
                <p className="font-bold text-lg mt-0.5">{paidCount}</p>
                <p className="text-[10px] text-muted-foreground">{leaveTypes.length - paidCount} unpaid</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-violet-100 rounded-xl"><TrendingUp size={20} className="text-violet-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">With Accrual</p>
                <p className="font-bold text-lg mt-0.5">{accrualCount}</p>
                <p className="text-[10px] text-muted-foreground">Auto-credited</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-amber-100 rounded-xl"><Banknote size={20} className="text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Encashable</p>
                <p className="font-bold text-lg mt-0.5">{encashableCount}</p>
                <p className="text-[10px] text-muted-foreground">Leave types</p>
              </div>
            </motion.div>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search leave types by name, code or description..."
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as LeaveCategory | 'All')}
            >
              <option value="All">All Categories</option>
              {LEAVE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
            >
              <option value="All">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={paidFilter}
              onChange={e => setPaidFilter(e.target.value as 'All' | 'Paid' | 'Unpaid')}
            >
              <option value="All">Paid & Unpaid</option>
              <option>Paid</option>
              <option>Unpaid</option>
            </select>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 size={13} className="text-green-500" />
              <span>{filteredLeaveTypes.length} of {leaveTypes.length} types</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter('All')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                categoryFilter === 'All'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-accent text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              All ({leaveTypes.length})
            </button>
            {LEAVE_CATEGORIES.map(cat => {
              const count = leaveTypes.filter(lt => lt.category === cat).length;
              if (count === 0) return null;
              const style = CATEGORY_STYLES[cat];
              const Icon = CATEGORY_ICONS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? 'All' : cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    categoryFilter === cat
                      ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-current`
                      : `${style.bg} ${style.text} ${style.border} hover:opacity-80`
                  }`}
                >
                  <Icon size={11} />
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {filteredLeaveTypes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredLeaveTypes.map(lt => (
                <LeaveTypeCard
                  key={lt.id}
                  leaveType={lt}
                  onEdit={openEdit}
                  onDelete={deleteLeaveType}
                  onDuplicate={handleDuplicate}
                  onToggleStatus={toggleStatus}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CalendarDays size={28} className="text-rose-600" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {search || categoryFilter !== 'All' || statusFilter !== 'All' || paidFilter !== 'All'
                  ? 'No leave types match your filters'
                  : 'No leave types defined yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                {search || categoryFilter !== 'All' || statusFilter !== 'All' || paidFilter !== 'All'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create your first leave type to get started'}
              </p>
              {!search && categoryFilter === 'All' && statusFilter === 'All' && paidFilter === 'All' && (
                <button
                  onClick={openAdd}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto"
                >
                  <Plus size={15} /> Add Leave Type
                </button>
              )}
            </div>
          )}

          {leaveTypes.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
                <FileText size={16} className="text-primary" />
                <h3 className="font-bold text-sm">Leave Type Overview</h3>
                <span className="ml-auto text-xs text-muted-foreground">{leaveTypes.length} types defined</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Leave Type</th>
                      <th className="px-4 py-3 font-semibold">Max Days</th>
                      <th className="px-4 py-3 font-semibold">Accrual</th>
                      <th className="px-4 py-3 font-semibold">Carry Forward</th>
                      <th className="px-4 py-3 font-semibold">Encashment</th>
                      <th className="px-4 py-3 font-semibold">Eligibility</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leaveTypes.map((lt, i) => {
                      const colorStyle = getColorStyle(lt.color);
                      const catStyle = CATEGORY_STYLES[lt.category];
                      const CategoryIcon = CATEGORY_ICONS[lt.category];
                      return (
                        <motion.tr
                          key={lt.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="hover:bg-accent/30 transition-colors group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-8 rounded-full ${colorStyle.dot}`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm">{lt.name}</p>
                                  {lt.isPaid ? (
                                    <span className="text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">Paid</span>
                                  ) : (
                                    <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">Unpaid</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{lt.code}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>{lt.category}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold">{lt.maxDaysPerYear}d</p>
                            <p className="text-[10px] text-muted-foreground">Max {lt.maxConsecutiveDays}d consecutive</p>
                          </td>
                          <td className="px-4 py-3">
                            {lt.accrualRule.frequency === 'None' ? (
                              <span className="text-xs text-muted-foreground">Lump Sum</span>
                            ) : (
                              <div>
                                <p className="text-xs font-medium">{lt.accrualRule.daysPerCycle}d/{lt.accrualRule.frequency.toLowerCase()}</p>
                                <p className="text-[10px] text-muted-foreground">{lt.accrualRule.basis}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lt.carryForwardRule.policy === 'None' ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              <div>
                                <p className="text-xs font-medium">{lt.carryForwardRule.policy}</p>
                                {lt.carryForwardRule.policy === 'Limited' && (
                                  <p className="text-[10px] text-muted-foreground">Max {lt.carryForwardRule.maxDaysCarryForward}d</p>
                                )}
                                {lt.carryForwardRule.policy === 'Percentage' && (
                                  <p className="text-[10px] text-muted-foreground">{lt.carryForwardRule.percentageCarryForward}%</p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lt.encashmentRule.policy === 'None' ? (
                              <span className="text-xs text-muted-foreground">Not allowed</span>
                            ) : (
                              <div>
                                <p className="text-xs font-medium">{lt.encashmentRule.policy}</p>
                                <p className="text-[10px] text-muted-foreground">{lt.encashmentRule.encashmentMultiplier}× rate</p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-xs font-medium">{lt.employeeCategoryRule.genderApplicability === 'All' ? 'All Genders' : `${lt.employeeCategoryRule.genderApplicability} Only`}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {lt.employeeCategoryRule.minServiceMonths > 0 ? `${lt.employeeCategoryRule.minServiceMonths}m service req.` : 'No service req.'}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{lt.createdAt}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleStatus(lt.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                                lt.isActive
                                  ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${lt.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {lt.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEdit(lt)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDuplicate(lt)}
                                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                onClick={() => deleteLeaveType(lt.id)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <LeaveTypeFormModal
            title={editingLeaveType ? `Edit Leave Type — ${editingLeaveType.name}` : 'Create New Leave Type'}
            form={form}
            onChange={(key, val) => setForm(f => ({ ...f, [key]: val }))}
            onAccrualChange={(key, val) => setForm(f => ({ ...f, accrualRule: { ...f.accrualRule, [key]: val } }))}
            onCarryForwardChange={(key, val) => setForm(f => ({ ...f, carryForwardRule: { ...f.carryForwardRule, [key]: val } }))}
            onEncashmentChange={(key, val) => setForm(f => ({ ...f, encashmentRule: { ...f.encashmentRule, [key]: val } }))}
            onEligibilityChange={(key, val) => setForm(f => ({ ...f, employeeCategoryRule: { ...f.employeeCategoryRule, [key]: val } }))}
            onSave={saveLeaveType}
            onClose={() => setModal(false)}
            saveLabel={editingLeaveType ? 'Save Changes' : 'Create Leave Type'}
            existingCodes={existingCodes}
            editingId={editingLeaveType?.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}