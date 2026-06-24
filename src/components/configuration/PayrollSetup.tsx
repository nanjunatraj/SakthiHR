import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTable } from '../../hooks/useTable';
import { supabase } from '../../supabase/client';
import {
  Calculator, ChevronLeft, Plus, Pencil, Trash2, X, Search,
  CheckCircle2, AlertCircle, Info, DollarSign, Percent, TrendingUp,
  Receipt, Banknote, CreditCard, PiggyBank, FileText, Settings2,
  Tag, Layers, BarChart3, Wallet, Shield, Copy, ToggleLeft,
  ChevronRight, ArrowUpDown, Hash, Calendar, Users, Building2,
  Star, BookOpen, Briefcase, CalendarRange, CalendarDays, Clock,
  Lock, Unlock, RefreshCw, Filter, Download, List, UserCog,
  Edit3, Eye, Wand2, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';
import SalaryStructureAssignment from './SalaryStructureAssignment';
import { ROUND_OPTIONS, type StatutoryType, type BonusType, type RoundCode } from '../../data/salaryStructures';

// ─── Types ────────────────────────────────────────────────────────────────────

type PayrollSetupModule =
  | 'home'
  | 'salary-components'
  | 'pay-heads'
  | 'pf-esi'
  | 'tds-slabs'
  | 'professional-tax'
  | 'loan-types'
  | 'salary-structure'
  | 'salary-structure-assignment'
  | 'payroll-period';

type ComponentType = 'Earning' | 'Deduction' | 'Employer Contribution' | 'Reimbursement';
type CalculationBasis = 'Fixed' | 'Percentage of Basic' | 'Percentage of Gross' | 'Percentage of CTC' | 'Formula';

// Deduction sources a component can be linked to (mirrors the Deductions module categories).
type DeductionSource =
  | 'none' | 'loan-advances' | 'damages-loss' | 'fines' | 'canteen' | 'society' | 'donations' | 'other-deductions';
const DEDUCTION_SOURCE_OPTIONS: { value: DeductionSource; label: string }[] = [
  { value: 'none', label: 'Not linked' },
  { value: 'loan-advances', label: 'Loan & Advances' },
  { value: 'damages-loss', label: 'Damages & Loss' },
  { value: 'fines', label: 'Fines' },
  { value: 'canteen', label: 'Canteen' },
  { value: 'society', label: 'Society' },
  { value: 'donations', label: 'Donations / Campaign' },
  { value: 'other-deductions', label: 'Other Deductions' },
];
type TaxabilityType = 'Fully Taxable' | 'Partially Exempt' | 'Fully Exempt';
type PFApplicability = 'Applicable' | 'Not Applicable' | 'Optional';

// ─── Salary Component Value Type ──────────────────────────────────────────────
// Each component in a salary structure can be:
//   'fixed'    — a single fixed amount or percentage (the default)
//   'variable' — amount is set per employee in Salary Structure Assignment
//   'custom'   — one of a predefined list of allowed values

type ComponentValueType = 'fixed' | 'variable' | 'custom';

type PayrollPeriodStatus = 'Open' | 'Processing' | 'Closed' | 'Locked';
type PayrollFrequency = 'Monthly' | 'Weekly' | 'Bi-Weekly' | 'Quarterly';

interface PayrollPeriod {
  id: string;
  name: string;
  code: string;
  financialYear: string;
  frequency: PayrollFrequency;
  fromDate: string;
  toDate: string;
  paymentDate: string;
  status: PayrollPeriodStatus;
  description: string;
  isDefault: boolean;
  createdAt: string;
  closedAt?: string;
  closedBy?: string;
}

interface SalaryComponent {
  id: string;
  name: string;
  code: string;
  type: ComponentType;
  calculationBasis: CalculationBasis;
  value: number;
  formula: string;
  taxability: TaxabilityType;
  pfApplicability: PFApplicability;
  esiApplicability: PFApplicability;
  isActive: boolean;
  isSystemDefined: boolean;
  /** Statutory linkage (Basic / PF / ESI / Professional Tax / Income Tax) so payroll
   *  and breakdowns map this component to the right statutory head. */
  statutoryType: StatutoryType;
  /** Mark this component as the Bonus or Ex-gratia payout head. */
  bonusType: BonusType;
  /** Overtime earning: pay = OT hours × (Basic ÷ hours/month) × multiplier. */
  isOvertime: boolean;
  overtimeMultiplier: number;
  overtimeHoursPerMonth: number;
  /** Reimbursement head: closed reimbursement claims for the period are paid through it. */
  isReimbursement: boolean;
  /** Arrears head: salary-revision arrears for the period are paid through it. */
  isArrears: boolean;
  /** Deduction-source link: deductions of this category (Loan & Advances, Damages & Loss,
   *  Fines, Canteen, Society, Donations/Campaign, Other Deductions) are recovered through
   *  this component head. 'none' = not linked. */
  deductionSource: DeductionSource;
  /** Round-off applied to this component's computed amount. */
  roundOff: RoundCode;
  description: string;
  createdAt: string;
}

interface PayHead {
  id: string;
  name: string;
  code: string;
  type: 'Earning' | 'Deduction';
  ledgerGroup: string;
  isActive: boolean;
  description: string;
  createdAt: string;
}

interface PFESIConfig {
  pfEnabled: boolean;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfAdminCharges: number;
  pfEdliCharges: number;
  pfWageCeiling: number;
  pfApplyOnActualOrCeiling: 'Actual' | 'Ceiling';
  pfWageComponents: string[];
  esiEnabled: boolean;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  esiWageCeiling: number;
  esiWageComponents: string[];
  vpfEnabled: boolean;
  vpfMaxPercentage: number;
  npsEnabled: boolean;
  npsEmployeeRate: number;
  npsEmployerRate: number;
  gratuityEnabled: boolean;
  gratuityFormula: string;
  gratuityMinYears: number;
  gratuityAccrualEnabled: boolean;
  professionalTaxEnabled: boolean;
  bonusEnabled: boolean;
  bonusPercentage: number;
  bonusMinPercentage: number;
  bonusMaxPercentage: number;
  bonusWageCeiling: number;
  bonusEligibilityLimit: number;
  bonusWageComponents: string[];
  bonusExgratiaEnabled: boolean;
  bonusExgratiaPercentage: number;
}

interface TDSSlab {
  id: string;
  financialYear: string;
  regime: 'Old' | 'New';
  gender: 'All' | 'Male' | 'Female' | 'Senior Citizen' | 'Super Senior Citizen';
  fromAmount: number;
  toAmount: number;
  taxRate: number;
  surchargeRate: number;
  cessRate: number;
  description: string;
}

interface ProfessionalTaxSlab {
  id: string;
  state: string;
  gender: 'All' | 'Male' | 'Female';
  fromAmount: number;
  toAmount: number;
  monthlyAmount: number;
  specialNote: string;
  isActive: boolean;
}

interface LoanType {
  id: string;
  name: string;
  code: string;
  maxAmount: number;
  maxTenureMonths: number;
  interestRate: number;
  isInterestFree: boolean;
  eligibilityMonths: number;
  maxAmountMultiplier: number;
  deductionHead: string;
  approvalWorkflow: LoanApprovalWorkflow;
  isActive: boolean;
  description: string;
  createdAt: string;
}

type LoanApprovalWorkflow = 'SingleHR' | 'TwoStage' | 'AutoWithinLimits';

// ─── Salary Structure Component (with value type support) ─────────────────────

interface SalaryStructureComponent {
  componentId: string;
  componentName: string;
  componentCode: string;
  componentType: ComponentType;
  calculationBasis: CalculationBasis;
  // valueType determines how the value is set for this component in the structure
  valueType: ComponentValueType;
  // value is used when valueType === 'fixed'
  value: number;
  // customValues is the list of allowed values when valueType === 'custom'
  customValues: number[];
  // selectedCustomValue is the chosen default value from customValues
  selectedCustomValue: number;
  formula: string;
}

interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  applicableTo: string[];
  components: SalaryStructureComponent[];
  isActive: boolean;
  description: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPONENT_TYPES: ComponentType[] = ['Earning', 'Deduction', 'Employer Contribution', 'Reimbursement'];
const CALCULATION_BASES: CalculationBasis[] = ['Fixed', 'Percentage of Basic', 'Percentage of Gross', 'Percentage of CTC', 'Formula'];
const TAXABILITY_TYPES: TaxabilityType[] = ['Fully Taxable', 'Partially Exempt', 'Fully Exempt'];
const PF_APPLICABILITY: PFApplicability[] = ['Applicable', 'Not Applicable', 'Optional'];
const STATUTORY_LINKAGE_OPTIONS: { value: StatutoryType; label: string }[] = [
  { value: 'none', label: 'None (regular component)' },
  { value: 'basic', label: 'Basic — base for % components' },
  { value: 'pf', label: 'Provident Fund (PF)' },
  { value: 'esi', label: 'Employee State Insurance (ESI)' },
  { value: 'professional_tax', label: 'Professional Tax (PT)' },
  { value: 'income_tax', label: 'Income Tax / TDS' },
];
const PAYROLL_FREQUENCIES: PayrollFrequency[] = ['Monthly', 'Weekly', 'Bi-Weekly', 'Quarterly'];
const FINANCIAL_YEARS = ['2024-25', '2025-26', '2026-27', '2023-24'];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli', 'Daman & Diu', 'Delhi',
  'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const PERIOD_STATUS_STYLES: Record<PayrollPeriodStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Open: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: Unlock },
  Processing: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: RefreshCw },
  Closed: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: CheckCircle2 },
  Locked: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: Lock },
};

const COMPONENT_TYPE_STYLES: Record<ComponentType, { bg: string; text: string; border: string }> = {
  'Earning': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  'Deduction': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  'Employer Contribution': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'Reimbursement': { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
};

const LEDGER_GROUPS = [
  'Direct Expenses', 'Indirect Expenses', 'Current Liabilities',
  'Duties & Taxes', 'Provisions', 'Salary Payable', 'Other Expenses'
];

const EMPLOYEE_CATEGORIES = [
  'All Employees', 'Permanent', 'Probationary', 'Contract',
  'Management Staff', 'Technical Staff', 'Support Staff', 'Sales Force'
];

// ─── Value Type Configuration ─────────────────────────────────────────────────

const VALUE_TYPE_LABELS: Record<ComponentValueType, {
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}> = {
  fixed: {
    label: 'Fixed',
    description: 'A single preset amount or percentage applied to all employees',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
  },
  variable: {
    label: 'Variable (Employee-wise)',
    description: 'Value is set individually per employee in Salary Structure Assignment',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
  },
  custom: {
    label: 'Custom Listed Values',
    description: 'One of a predefined list of allowed values (e.g. ₹1,000 / ₹2,000 / ₹5,000)',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    badgeBorder: 'border-violet-200',
  },
};

// ─── Supabase row mapping (DB-only persistence) ────────────────────────────────
type DbRow = Record<string, unknown> & { id: string };
const num = (v: unknown, d = 0) => (v === null || v === undefined ? d : Number(v));
const fmtDate = (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-IN') : '');

function rowToPeriod(r: DbRow): PayrollPeriod {
  return {
    id: r.id,
    name: (r.name as string) ?? '',
    code: (r.code as string) ?? '',
    financialYear: (r.financial_year as string) ?? '',
    frequency: (r.frequency as PayrollFrequency) ?? 'Monthly',
    fromDate: (r.from_date as string) ?? '',
    toDate: (r.to_date as string) ?? '',
    paymentDate: (r.payment_date as string) ?? '',
    status: (r.status as PayrollPeriodStatus) ?? 'Open',
    description: (r.description as string) ?? '',
    isDefault: Boolean(r.is_default),
    createdAt: fmtDate(r.created_at),
    closedAt: r.closed_at ? fmtDate(r.closed_at) : undefined,
  };
}
function periodToRow(p: PayrollPeriod): Record<string, unknown> {
  return {
    name: p.name.trim(), code: p.code.trim(), financial_year: p.financialYear,
    frequency: p.frequency, from_date: p.fromDate || null, to_date: p.toDate || null,
    payment_date: p.paymentDate || null, status: p.status,
    description: p.description?.trim() || null, is_default: p.isDefault,
  };
}

function rowToComponent(r: DbRow): SalaryComponent {
  return {
    id: r.id, name: (r.name as string) ?? '', code: (r.code as string) ?? '',
    type: (r.type as ComponentType) ?? 'Earning',
    calculationBasis: (r.calculation_basis as CalculationBasis) ?? 'Fixed',
    value: num(r.value), formula: (r.formula as string) ?? '',
    taxability: (r.taxability as TaxabilityType) ?? 'Fully Taxable',
    pfApplicability: (r.pf_applicability as PFApplicability) ?? 'Not Applicable',
    esiApplicability: (r.esi_applicability as PFApplicability) ?? 'Not Applicable',
    isActive: Boolean(r.is_active), isSystemDefined: Boolean(r.is_system_defined),
    statutoryType: (r.statutory_type as StatutoryType) ?? (r.is_income_tax ? 'income_tax' : 'none'),
    bonusType: (r.bonus_type as BonusType) ?? 'none',
    isOvertime: Boolean(r.is_overtime),
    overtimeMultiplier: r.overtime_multiplier == null ? 2 : num(r.overtime_multiplier),
    overtimeHoursPerMonth: r.overtime_hours_per_month == null ? 208 : num(r.overtime_hours_per_month),
    isReimbursement: Boolean(r.is_reimbursement),
    isArrears: Boolean(r.is_arrears),
    deductionSource: (r.deduction_source as DeductionSource) ?? 'none',
    roundOff: (r.round_off as RoundCode) ?? 'nearest_1',
    description: (r.description as string) ?? '', createdAt: fmtDate(r.created_at),
  };
}
function componentToRow(c: SalaryComponent): Record<string, unknown> {
  return {
    name: c.name.trim(), code: c.code.trim(), type: c.type,
    calculation_basis: c.calculationBasis, value: num(c.value),
    formula: c.formula?.trim() || null, taxability: c.taxability,
    pf_applicability: c.pfApplicability, esi_applicability: c.esiApplicability,
    is_active: c.isActive, is_system_defined: c.isSystemDefined,
    statutory_type: c.statutoryType,
    is_income_tax: c.statutoryType === 'income_tax',
    bonus_type: c.bonusType,
    is_overtime: c.isOvertime,
    overtime_multiplier: num(c.overtimeMultiplier) || 2,
    overtime_hours_per_month: num(c.overtimeHoursPerMonth) || 208,
    is_reimbursement: c.isReimbursement,
    is_arrears: c.isArrears,
    deduction_source: c.deductionSource && c.deductionSource !== 'none' ? c.deductionSource : null,
    round_off: c.roundOff,
    description: c.description?.trim() || null,
  };
}

function rowToPayHead(r: DbRow): PayHead {
  return {
    id: r.id, name: (r.name as string) ?? '', code: (r.code as string) ?? '',
    type: (r.type as PayHead['type']) ?? 'Earning',
    ledgerGroup: (r.ledger_group as string) ?? '', isActive: Boolean(r.is_active),
    description: (r.description as string) ?? '', createdAt: fmtDate(r.created_at),
  };
}
function payHeadToRow(p: PayHead): Record<string, unknown> {
  return {
    name: p.name.trim(), code: p.code.trim(), type: p.type,
    ledger_group: p.ledgerGroup || null, is_active: p.isActive,
    description: p.description?.trim() || null,
  };
}

function rowToTdsSlab(r: DbRow): TDSSlab {
  return {
    id: r.id, financialYear: (r.financial_year as string) ?? '',
    regime: (r.regime as TDSSlab['regime']) ?? 'New',
    gender: (r.gender as TDSSlab['gender']) ?? 'All',
    fromAmount: num(r.from_amount), toAmount: num(r.to_amount), taxRate: num(r.tax_rate),
    surchargeRate: num(r.surcharge_rate), cessRate: num(r.cess_rate),
    description: (r.description as string) ?? '',
  };
}
function tdsSlabToRow(t: TDSSlab): Record<string, unknown> {
  return {
    financial_year: t.financialYear, regime: t.regime, gender: t.gender,
    from_amount: num(t.fromAmount), to_amount: num(t.toAmount), tax_rate: num(t.taxRate),
    surcharge_rate: num(t.surchargeRate), cess_rate: num(t.cessRate),
    description: t.description?.trim() || null,
  };
}

function rowToPtSlab(r: DbRow): ProfessionalTaxSlab {
  return {
    id: r.id, state: (r.state as string) ?? '',
    gender: (r.gender as ProfessionalTaxSlab['gender']) ?? 'All',
    fromAmount: num(r.from_amount), toAmount: num(r.to_amount), monthlyAmount: num(r.monthly_amount),
    specialNote: (r.special_note as string) ?? '', isActive: Boolean(r.is_active),
  };
}
function ptSlabToRow(s: ProfessionalTaxSlab): Record<string, unknown> {
  return {
    state: s.state.trim(), gender: s.gender,
    from_amount: num(s.fromAmount), to_amount: num(s.toAmount), monthly_amount: num(s.monthlyAmount),
    special_note: s.specialNote?.trim() || null, is_active: s.isActive,
    updated_at: new Date().toISOString(),
  };
}

function rowToLoanType(r: DbRow): LoanType {
  return {
    id: r.id, name: (r.name as string) ?? '', code: (r.code as string) ?? '',
    maxAmount: num(r.max_amount), maxTenureMonths: num(r.max_tenure_months),
    interestRate: num(r.interest_rate), isInterestFree: Boolean(r.is_interest_free),
    eligibilityMonths: num(r.eligibility_months), maxAmountMultiplier: num(r.max_amount_multiplier),
    deductionHead: (r.deduction_head as string) ?? '', isActive: Boolean(r.is_active),
    approvalWorkflow: (r.approval_workflow as LoanApprovalWorkflow) ?? 'SingleHR',
    description: (r.description as string) ?? '', createdAt: fmtDate(r.created_at),
  };
}
function loanTypeToRow(l: LoanType): Record<string, unknown> {
  return {
    name: l.name.trim(), code: l.code.trim(), max_amount: num(l.maxAmount),
    max_tenure_months: num(l.maxTenureMonths), interest_rate: num(l.interestRate),
    is_interest_free: l.isInterestFree, eligibility_months: num(l.eligibilityMonths),
    max_amount_multiplier: num(l.maxAmountMultiplier), deduction_head: l.deductionHead || null,
    approval_workflow: l.approvalWorkflow,
    is_active: l.isActive, description: l.description?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function rowToStructure(r: DbRow, sscRows: DbRow[], componentsById: Map<string, SalaryComponent>): SalaryStructure {
  const components: SalaryStructureComponent[] = sscRows
    .filter(s => s.salary_structure_id === r.id)
    .sort((a, b) => num(a.sort_order) - num(b.sort_order))
    .map(s => {
      const meta = componentsById.get(s.salary_component_id as string);
      return {
        componentId: (s.salary_component_id as string) ?? '',
        componentName: meta?.name ?? '',
        componentCode: meta?.code ?? '',
        componentType: meta?.type ?? 'Earning',
        calculationBasis: (s.calculation_basis as CalculationBasis) ?? meta?.calculationBasis ?? 'Fixed',
        valueType: (s.value_type as ComponentValueType) ?? 'fixed',
        value: num(s.value),
        customValues: (s.custom_values as number[]) ?? [],
        selectedCustomValue: num(s.selected_custom_value),
        formula: (s.formula as string) ?? '',
        statutoryType: meta?.statutoryType ?? 'none',
      };
    });
  return {
    id: r.id, name: (r.name as string) ?? '', code: (r.code as string) ?? '',
    applicableTo: (r.applicable_to as string[]) ?? [], components,
    isActive: Boolean(r.is_active), description: (r.description as string) ?? '',
    createdAt: fmtDate(r.created_at),
  };
}
function structureToRow(s: SalaryStructure): Record<string, unknown> {
  return {
    name: s.name.trim(), code: s.code.trim(), applicable_to: s.applicableTo,
    is_active: s.isActive, description: s.description?.trim() || null,
  };
}
function sscToRow(c: SalaryStructureComponent, structureId: string, i: number): Record<string, unknown> {
  return {
    salary_structure_id: structureId, salary_component_id: c.componentId,
    value: num(c.value), calculation_basis: c.calculationBasis, sort_order: i,
    value_type: c.valueType, custom_values: c.customValues ?? [],
    selected_custom_value: num(c.selectedCustomValue), formula: c.formula?.trim() || null,
  };
}

function rowToPfEsi(r: DbRow | undefined): PFESIConfig {
  return {
    pfEnabled: Boolean(r?.pf_enabled), pfEmployeeRate: num(r?.pf_employee_rate),
    pfEmployerRate: num(r?.pf_employer_rate), pfAdminCharges: num(r?.pf_admin_charges),
    pfEdliCharges: num(r?.pf_edli_charges), pfWageCeiling: num(r?.pf_wage_ceiling),
    pfApplyOnActualOrCeiling: (r?.pf_apply_on as 'Actual' | 'Ceiling') ?? 'Ceiling',
    pfWageComponents: Array.isArray(r?.pf_wage_components) ? (r!.pf_wage_components as unknown[]).map(String) : [],
    esiEnabled: Boolean(r?.esi_enabled), esiEmployeeRate: num(r?.esi_employee_rate),
    esiEmployerRate: num(r?.esi_employer_rate), esiWageCeiling: num(r?.esi_wage_ceiling),
    esiWageComponents: Array.isArray(r?.esi_wage_components) ? (r!.esi_wage_components as unknown[]).map(String) : [],
    vpfEnabled: Boolean(r?.vpf_enabled), vpfMaxPercentage: num(r?.vpf_max_percentage),
    npsEnabled: Boolean(r?.nps_enabled), npsEmployeeRate: num(r?.nps_employee_rate),
    npsEmployerRate: num(r?.nps_employer_rate), gratuityEnabled: Boolean(r?.gratuity_enabled),
    gratuityFormula: (r?.gratuity_formula as string) ?? '', gratuityMinYears: num(r?.gratuity_min_years),
    gratuityAccrualEnabled: r ? Boolean(r.gratuity_accrual_enabled) : true,
    professionalTaxEnabled: r ? Boolean(r.professional_tax_enabled) : true,
    bonusEnabled: Boolean(r?.bonus_enabled),
    bonusPercentage: r ? num(r.bonus_percentage) : 8.33,
    bonusMinPercentage: r ? (num(r.bonus_min_percentage) || 8.33) : 8.33,
    bonusMaxPercentage: r ? (num(r.bonus_max_percentage) || 20) : 20,
    bonusWageCeiling: r ? num(r.bonus_wage_ceiling) : 7000,
    bonusEligibilityLimit: r ? num(r.bonus_eligibility_limit) : 21000,
    bonusWageComponents: Array.isArray(r?.bonus_wage_components) ? (r!.bonus_wage_components as unknown[]).map(String) : [],
    bonusExgratiaEnabled: Boolean(r?.bonus_exgratia_enabled),
    bonusExgratiaPercentage: r ? (num(r.bonus_exgratia_percentage) || 8.33) : 8.33,
  };
}
function pfEsiToRow(c: PFESIConfig): Record<string, unknown> {
  return {
    pf_enabled: c.pfEnabled, pf_employee_rate: num(c.pfEmployeeRate), pf_employer_rate: num(c.pfEmployerRate),
    pf_admin_charges: num(c.pfAdminCharges), pf_edli_charges: num(c.pfEdliCharges),
    pf_wage_ceiling: num(c.pfWageCeiling), pf_apply_on: c.pfApplyOnActualOrCeiling,
    pf_wage_components: c.pfWageComponents ?? [],
    vpf_enabled: c.vpfEnabled, vpf_max_percentage: num(c.vpfMaxPercentage),
    esi_enabled: c.esiEnabled, esi_employee_rate: num(c.esiEmployeeRate), esi_employer_rate: num(c.esiEmployerRate),
    esi_wage_ceiling: num(c.esiWageCeiling), esi_wage_components: c.esiWageComponents ?? [], nps_enabled: c.npsEnabled,
    nps_employee_rate: num(c.npsEmployeeRate), nps_employer_rate: num(c.npsEmployerRate),
    gratuity_enabled: c.gratuityEnabled,
    // gratuity_formula is NOT NULL — never send null; fall back to the standard formula.
    gratuity_formula: c.gratuityFormula?.trim() || '(Basic + DA) × 15/26 × Years of Service',
    gratuity_min_years: num(c.gratuityMinYears),
    gratuity_accrual_enabled: c.gratuityAccrualEnabled,
    professional_tax_enabled: c.professionalTaxEnabled,
    bonus_enabled: c.bonusEnabled, bonus_percentage: num(c.bonusPercentage),
    bonus_min_percentage: num(c.bonusMinPercentage), bonus_max_percentage: num(c.bonusMaxPercentage),
    bonus_wage_components: c.bonusWageComponents ?? [],
    bonus_exgratia_enabled: c.bonusExgratiaEnabled, bonus_exgratia_percentage: num(c.bonusExgratiaPercentage),
    bonus_wage_ceiling: num(c.bonusWageCeiling), bonus_eligibility_limit: num(c.bonusEligibilityLimit),
    updated_at: new Date().toISOString(),
  };
}

// Diff a previous array against the next one and apply inserts/updates/deletes to a table.
async function syncTable<T extends { id: string }>(
  table: { insert: (v: Record<string, unknown>) => Promise<{ error: string | null }>;
           update: (id: string, v: Record<string, unknown>) => Promise<{ error: string | null }>;
           remove: (id: string) => Promise<{ error: string | null }>; },
  prev: T[], next: T[], toRow: (t: T) => Record<string, unknown>,
): Promise<string | null> {
  const prevById = new Map(prev.map(p => [p.id, p]));
  const nextIds = new Set(next.map(n => n.id));
  for (const p of prev) {
    if (!nextIds.has(p.id)) { const e = (await table.remove(p.id)).error; if (e) return e; }
  }
  for (const n of next) {
    const before = prevById.get(n.id);
    if (!before) { const e = (await table.insert(toRow(n))).error; if (e) return e; }
    else if (JSON.stringify(toRow(before)) !== JSON.stringify(toRow(n))) {
      const e = (await table.update(n.id, toRow(n))).error; if (e) return e;
    }
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getDayCount(fromDate: string, toDate: string): number {
  if (!fromDate || !toDate) return 0;
  const d1 = new Date(fromDate + 'T00:00:00');
  const d2 = new Date(toDate + 'T00:00:00');
  return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
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
      <Icon size={18} className={accentColor} />
    </div>
    <div>
      <h3 className="font-bold text-sm">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

interface ToggleSwitchProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

const ToggleSwitch = ({ value, onChange, label, description }: ToggleSwitchProps) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div onClick={() => onChange(!value)} className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-primary' : 'bg-border'}`}>
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
    <div>
      <span className="text-sm font-medium">{label}</span>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
    </div>
  </label>
);

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

const Modal = ({ title, onClose, children, wide }: ModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 16 }}
      className={`bg-card w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} rounded-2xl shadow-2xl border border-border overflow-hidden`}
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

// ─── Payroll Period Generator ─────────────────────────────────────────────────

type GeneratedPeriod = Omit<PayrollPeriod, 'id' | 'createdAt'>;

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/**
 * Build the full set of payroll periods that span an Indian financial year
 * (Apr 1 → Mar 31) for the chosen frequency. Returns draft periods (no id);
 * the caller dedupes by code, assigns ids and persists.
 *
 * @param paymentOffsetDays days after each period's To-Date that salary is paid.
 */
function generatePeriods(fy: string, freq: PayrollFrequency, paymentOffsetDays: number, status: PayrollPeriodStatus): GeneratedPeriod[] {
  const startYear = parseInt(fy.slice(0, 4), 10);
  if (Number.isNaN(startYear)) return [];
  const fyEnd = new Date(startYear + 1, 2, 31);
  const out: GeneratedPeriod[] = [];
  const payment = (end: Date) => isoDate(addDays(end, paymentOffsetDays));
  const base = (extra: Partial<GeneratedPeriod>): GeneratedPeriod => ({
    name: '', code: '', financialYear: fy, frequency: freq, fromDate: '', toDate: '',
    paymentDate: '', status, description: `Auto-generated ${freq} period for FY ${fy}`, isDefault: false, ...extra,
  });

  if (freq === 'Monthly') {
    for (let i = 0; i < 12; i++) {
      const mi = (3 + i) % 12;                 // Apr (3) … Mar (2)
      const yr = startYear + (3 + i >= 12 ? 1 : 0);
      const from = new Date(yr, mi, 1);
      const to = new Date(yr, mi + 1, 0);       // last day of that month
      out.push(base({ name: `${MONTHS_LONG[mi]} ${yr}`, code: `${MONTHS_SHORT[mi].toUpperCase()}-${yr}`, fromDate: isoDate(from), toDate: isoDate(to), paymentDate: payment(to) }));
    }
  } else if (freq === 'Quarterly') {
    const quarters = [
      { label: 'Q1', from: new Date(startYear, 3, 1), to: new Date(startYear, 5, 30) },
      { label: 'Q2', from: new Date(startYear, 6, 1), to: new Date(startYear, 8, 30) },
      { label: 'Q3', from: new Date(startYear, 9, 1), to: new Date(startYear, 11, 31) },
      { label: 'Q4', from: new Date(startYear + 1, 0, 1), to: new Date(startYear + 1, 2, 31) },
    ];
    quarters.forEach(q => out.push(base({ name: `${q.label} ${fy}`, code: `${q.label}-${fy}`, fromDate: isoDate(q.from), toDate: isoDate(q.to), paymentDate: payment(q.to) })));
  } else {
    // Weekly / Bi-Weekly: roll forward from Apr 1 in fixed steps, clamp final period to Mar 31.
    const step = freq === 'Weekly' ? 7 : 14;
    const prefix = freq === 'Weekly' ? 'WK' : 'FN';
    const noun = freq === 'Weekly' ? 'Week' : 'Fortnight';
    let from = new Date(startYear, 3, 1);
    let n = 1;
    while (from <= fyEnd) {
      let to = addDays(from, step - 1);
      if (to > fyEnd) to = new Date(fyEnd);
      const seq = String(n).padStart(2, '0');
      out.push(base({ name: `${noun} ${n} ${fy}`, code: `${prefix}${seq}-${fy}`, fromDate: isoDate(from), toDate: isoDate(to), paymentDate: payment(to) }));
      from = addDays(to, 1);
      n++;
    }
  }
  return out;
}

// ─── Payroll Period View ──────────────────────────────────────────────────────

interface PayrollPeriodViewProps {
  periods: PayrollPeriod[];
  onUpdate: (periods: PayrollPeriod[]) => void;
  onBack: () => void;
}

function PayrollPeriodView({ periods, onUpdate, onBack }: PayrollPeriodViewProps) {
  const [search, setSearch] = useState('');
  const [fyFilter, setFyFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<PayrollPeriodStatus | 'All'>('All');
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PayrollPeriod | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: 'close' | 'lock' | 'delete'; period: PayrollPeriod } | null>(null);
  const [genModal, setGenModal] = useState(false);
  const [genForm, setGenForm] = useState<{ financialYear: string; frequency: PayrollFrequency; paymentOffsetDays: number; status: PayrollPeriodStatus; setFirstDefault: boolean }>({
    financialYear: '2025-26', frequency: 'Monthly', paymentOffsetDays: 0, status: 'Open', setFirstDefault: false,
  });

  const emptyForm = (): Omit<PayrollPeriod, 'id' | 'createdAt'> => ({
    name: '', code: '', financialYear: '2025-26', frequency: 'Monthly',
    fromDate: '', toDate: '', paymentDate: '', status: 'Open',
    description: '', isDefault: false,
  });

  const [form, setForm] = useState<Omit<PayrollPeriod, 'id' | 'createdAt'>>(emptyForm());

  const uniqueFYs = [...new Set(periods.map(p => p.financialYear))];

  const filtered = useMemo(() =>
    periods
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
      .filter(p => fyFilter === 'All' || p.financialYear === fyFilter)
      .filter(p => statusFilter === 'All' || p.status === statusFilter)
      .sort((a, b) => a.fromDate.localeCompare(b.fromDate)),
    [periods, search, fyFilter, statusFilter]
  );

  const openCount = periods.filter(p => p.status === 'Open').length;
  const closedCount = periods.filter(p => p.status === 'Closed').length;
  const lockedCount = periods.filter(p => p.status === 'Locked').length;
  const defaultPeriod = periods.find(p => p.isDefault);

  const openAdd = () => { setEditingItem(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (item: PayrollPeriod) => {
    if (item.status === 'Locked') { toast.error('Locked periods cannot be edited.'); return; }
    setEditingItem(item);
    setForm({ name: item.name, code: item.code, financialYear: item.financialYear, frequency: item.frequency, fromDate: item.fromDate, toDate: item.toDate, paymentDate: item.paymentDate, status: item.status, description: item.description, isDefault: item.isDefault });
    setModal(true);
  };

  const saveItem = () => {
    if (!form.name.trim()) { toast.error('Period name is required.'); return; }
    if (!form.code.trim()) { toast.error('Period code is required.'); return; }
    if (!form.fromDate) { toast.error('From Date is required.'); return; }
    if (!form.toDate) { toast.error('To Date is required.'); return; }
    if (new Date(form.fromDate) > new Date(form.toDate)) { toast.error('From Date must be before To Date.'); return; }
    if (!form.paymentDate) { toast.error('Payment Date is required.'); return; }
    const codeExists = periods.some(p => p.code === form.code && (editingItem ? p.id !== editingItem.id : true));
    if (codeExists) { toast.error('Period code already exists.'); return; }
    let updatedPeriods = [...periods];
    if (form.isDefault) updatedPeriods = updatedPeriods.map(p => ({ ...p, isDefault: false }));
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const todayStr = `${String(now.getDate()).padStart(2,'0')}/${months[now.getMonth()]}/${now.getFullYear()}`;
    if (editingItem) {
      updatedPeriods = updatedPeriods.map(p => p.id === editingItem.id ? { ...p, ...form } : p);
      toast.success('Payroll period updated.');
    } else {
      const newPeriod: PayrollPeriod = { ...form, id: `PP${String(periods.length + 1).padStart(3, '0')}`, createdAt: todayStr };
      updatedPeriods = [...updatedPeriods, newPeriod];
      toast.success('Payroll period created.');
    }
    onUpdate(updatedPeriods);
    setModal(false);
  };

  const handleSetDefault = (id: string) => { onUpdate(periods.map(p => ({ ...p, isDefault: p.id === id }))); toast.success('Default period updated.'); };

  const handleStatusChange = (period: PayrollPeriod, newStatus: PayrollPeriodStatus) => {
    if (period.status === 'Locked') { toast.error('Locked periods cannot be changed.'); return; }
    if (newStatus === 'Closed' || newStatus === 'Locked') { setConfirmModal({ type: newStatus === 'Locked' ? 'lock' : 'close', period }); return; }
    onUpdate(periods.map(p => p.id === period.id ? { ...p, status: newStatus } : p));
    toast.success(`Period status changed to ${newStatus}.`);
  };

  const confirmAction = () => {
    if (!confirmModal) return;
    const { type, period } = confirmModal;
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const todayStr = `${String(now.getDate()).padStart(2,'0')}/${months[now.getMonth()]}/${now.getFullYear()}`;
    if (type === 'close') { onUpdate(periods.map(p => p.id === period.id ? { ...p, status: 'Closed', closedAt: todayStr, closedBy: 'Admin' } : p)); toast.success(`Period "${period.name}" closed.`); }
    else if (type === 'lock') { onUpdate(periods.map(p => p.id === period.id ? { ...p, status: 'Locked', closedAt: todayStr, closedBy: 'Admin' } : p)); toast.success(`Period "${period.name}" locked.`); }
    else if (type === 'delete') { if (period.status === 'Locked') { toast.error('Locked periods cannot be deleted.'); setConfirmModal(null); return; } onUpdate(periods.filter(p => p.id !== period.id)); toast.info('Period deleted.'); }
    setConfirmModal(null);
  };

  const handleDelete = (period: PayrollPeriod) => {
    if (period.status === 'Locked') { toast.error('Locked periods cannot be deleted.'); return; }
    setConfirmModal({ type: 'delete', period });
  };

  const existingCodes = useMemo(() => new Set(periods.map(p => p.code)), [periods]);
  const genPreview = useMemo(
    () => generatePeriods(genForm.financialYear, genForm.frequency, genForm.paymentOffsetDays, genForm.status),
    [genForm],
  );
  const genNewCount = genPreview.filter(p => !existingCodes.has(p.code)).length;

  const handleGenerate = () => {
    const fresh = genPreview.filter(p => !existingCodes.has(p.code));
    if (fresh.length === 0) { toast.info('All periods for this selection already exist — nothing to generate.'); return; }
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${MONTHS_SHORT[now.getMonth()]}/${now.getFullYear()}`;
    const created: PayrollPeriod[] = fresh.map((p, i) => ({ ...p, id: `PPGEN-${now.getTime()}-${i}`, createdAt: todayStr }));
    let merged = [...periods];
    if (genForm.setFirstDefault) { merged = merged.map(p => ({ ...p, isDefault: false })); created[0].isDefault = true; }
    merged = [...merged, ...created];
    onUpdate(merged);
    toast.success(`Generated ${created.length} payroll period${created.length > 1 ? 's' : ''} for FY ${genForm.financialYear}.`);
    setGenModal(false);
  };

  const handleFromDateChange = (date: string) => {
    setForm(f => {
      const updates: Partial<typeof f> = { fromDate: date };
      if (date && !f.name) {
        const d = new Date(date + 'T00:00:00');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        updates.name = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        updates.code = `${months[d.getMonth()].toUpperCase()}-${d.getFullYear()}`;
      }
      return { ...f, ...updates };
    });
  };

  const dayCount = getDayCount(form.fromDate, form.toDate);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-indigo-100 rounded-lg"><CalendarRange size={22} className="text-indigo-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Payroll Period Master</h1>
                <p className="text-xs text-muted-foreground">Define payroll periods with From and To Dates for each pay cycle.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setGenModal(true)} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
                <Wand2 size={16} /> Generate Periods
              </button>
              <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
                <Plus size={16} /> Add Period
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Open Periods', value: openCount, sub: 'Ready for processing', color: 'bg-green-100', iconColor: 'text-green-600', icon: Unlock },
              { label: 'Processing', value: periods.filter(p => p.status === 'Processing').length, sub: 'Currently running', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: RefreshCw },
              { label: 'Closed', value: closedCount, sub: 'Completed periods', color: 'bg-gray-100', iconColor: 'text-gray-600', icon: CheckCircle2 },
              { label: 'Locked', value: lockedCount, sub: 'Immutable records', color: 'bg-red-100', iconColor: 'text-red-600', icon: Lock },
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

          {defaultPeriod && (
            <div className="flex items-center gap-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="p-2.5 bg-white rounded-xl shadow-sm"><CalendarRange size={20} className="text-indigo-600" /></div>
              <div className="flex-1">
                <p className="font-bold text-sm text-indigo-800">Current Default Period: {defaultPeriod.name}</p>
                <p className="text-xs text-indigo-700 mt-0.5">{formatDate(defaultPeriod.fromDate)} → {formatDate(defaultPeriod.toDate)} · Payment: {formatDate(defaultPeriod.paymentDate)} · {getDayCount(defaultPeriod.fromDate, defaultPeriod.toDate)} days · FY {defaultPeriod.financialYear}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${PERIOD_STATUS_STYLES[defaultPeriod.status].bg} ${PERIOD_STATUS_STYLES[defaultPeriod.status].text} ${PERIOD_STATUS_STYLES[defaultPeriod.status].border}`}>{defaultPeriod.status}</span>
            </div>
          )}

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search periods..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
              <option value="All">All Financial Years</option>
              {uniqueFYs.map(fy => <option key={fy}>{fy}</option>)}
            </select>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="All">All Status</option>
              {(['Open', 'Processing', 'Closed', 'Locked'] as PayrollPeriodStatus[]).map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {periods.length} periods</div>
          </div>

          {filtered.length > 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Period</th>
                      <th className="px-5 py-3 font-semibold">From Date</th>
                      <th className="px-5 py-3 font-semibold">To Date</th>
                      <th className="px-5 py-3 font-semibold">Payment Date</th>
                      <th className="px-5 py-3 font-semibold">Period Status</th>
                      <th className="px-5 py-3 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((period, i) => {
                      const statusStyle = PERIOD_STATUS_STYLES[period.status];
                      const StatusIcon = statusStyle.icon;
                      return (
                        <motion.tr key={period.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm">{period.name}</p>
                              {period.isDefault && <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Star size={8} /> Default</span>}
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{period.code}</span>
                          </td>
                          <td className="px-5 py-4"><div className="flex items-center gap-1.5 text-sm font-medium"><Calendar size={12} className="text-indigo-500 shrink-0" />{formatDate(period.fromDate)}</div></td>
                          <td className="px-5 py-4"><div className="flex items-center gap-1.5 text-sm font-medium"><Calendar size={12} className="text-rose-500 shrink-0" />{formatDate(period.toDate)}</div></td>
                          <td className="px-5 py-4"><div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Banknote size={12} className="text-green-500 shrink-0" />{formatDate(period.paymentDate)}</div></td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                              <StatusIcon size={10} />{period.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {period.status !== 'Locked' && <button onClick={() => openEdit(period)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>}
                              {!period.isDefault && period.status === 'Open' && <button onClick={() => handleSetDefault(period.id)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-muted-foreground hover:text-indigo-600 transition-colors" title="Set Default"><Star size={13} /></button>}
                              {(period.status === 'Open' || period.status === 'Processing') && <button onClick={() => handleStatusChange(period, 'Closed')} className="p-1.5 rounded-lg hover:bg-gray-100 text-muted-foreground hover:text-gray-600 transition-colors" title="Close"><CheckCircle2 size={13} /></button>}
                              {period.status === 'Closed' && <button onClick={() => handleStatusChange(period, 'Locked')} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Lock"><Lock size={13} /></button>}
                              {period.status !== 'Locked' && <button onClick={() => handleDelete(period)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 size={13} /></button>}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><CalendarRange size={28} className="text-indigo-600" /></div>
              <p className="font-semibold text-muted-foreground">No payroll periods found</p>
              <button onClick={openAdd} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto"><Plus size={15} /> Add Period</button>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <Modal title={editingItem ? `Edit Period — ${editingItem.name}` : 'Create Payroll Period'} onClose={() => setModal(false)} wide>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="From Date" required hint="Start date of the payroll period">
                  <div className="relative"><Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="date" className={`${inputCls} pl-9`} value={form.fromDate} onChange={e => handleFromDateChange(e.target.value)} /></div>
                </Field>
                <Field label="To Date" required hint="End date of the payroll period">
                  <div className="relative"><Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="date" className={`${inputCls} pl-9`} value={form.toDate} min={form.fromDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} /></div>
                </Field>
                {form.fromDate && form.toDate && (
                  <div className="md:col-span-2">
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${new Date(form.fromDate) > new Date(form.toDate) ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-200'}`}>
                      {new Date(form.fromDate) > new Date(form.toDate) ? (
                        <><AlertCircle size={15} className="text-red-600 shrink-0" /><p className="text-xs font-semibold text-red-700">From Date must be before To Date.</p></>
                      ) : (
                        <><CalendarRange size={15} className="text-indigo-600 shrink-0" /><p className="text-xs text-indigo-700">Duration: <strong>{dayCount} days</strong> · {formatDate(form.fromDate)} → {formatDate(form.toDate)}</p></>
                      )}
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <Field label="Period Name" required><input type="text" className={inputCls} placeholder="e.g. July 2025" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
                </div>
                <Field label="Period Code" required><input type="text" className={`${inputCls} font-mono uppercase`} placeholder="e.g. JUL-2025" maxLength={12} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></Field>
                <Field label="Financial Year" required>
                  <select className={selectCls} value={form.financialYear} onChange={e => setForm(f => ({ ...f, financialYear: e.target.value }))}>
                    {FINANCIAL_YEARS.map(fy => <option key={fy}>{fy}</option>)}
                  </select>
                </Field>
                <Field label="Payroll Frequency" required>
                  <select className={selectCls} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as PayrollFrequency }))}>
                    {PAYROLL_FREQUENCIES.map(freq => <option key={freq}>{freq}</option>)}
                  </select>
                </Field>
                <Field label="Payment Date" required hint="Date on which salary will be disbursed">
                  <div className="relative"><Banknote size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="date" className={`${inputCls} pl-9`} value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} /></div>
                </Field>
                <Field label="Status">
                  <select className={selectCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PayrollPeriodStatus }))}>
                    <option>Open</option><option>Processing</option><option>Closed</option>
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Description"><textarea className={`${inputCls} resize-none`} rows={2} placeholder="Brief description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
                </div>
                <div className="md:col-span-2">
                  <ToggleSwitch value={form.isDefault} onChange={v => setForm(f => ({ ...f, isDefault: v }))} label="Set as Default Period" description="This period will be pre-selected when running payroll" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveItem} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">{editingItem ? 'Save Changes' : 'Create Period'}</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {genModal && (
          <Modal title="Payroll Period Generator" onClose={() => setGenModal(false)} wide>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                <Wand2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">Automatically create every period for a financial year (Apr 1 → Mar 31). Periods whose code already exists are skipped, so you can safely re-run.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Financial Year" required>
                  <select className={selectCls} value={genForm.financialYear} onChange={e => setGenForm(f => ({ ...f, financialYear: e.target.value }))}>
                    {FINANCIAL_YEARS.map(fy => <option key={fy}>{fy}</option>)}
                  </select>
                </Field>
                <Field label="Payroll Frequency" required hint="Determines how many periods are created">
                  <select className={selectCls} value={genForm.frequency} onChange={e => setGenForm(f => ({ ...f, frequency: e.target.value as PayrollFrequency }))}>
                    {PAYROLL_FREQUENCIES.map(freq => <option key={freq}>{freq}</option>)}
                  </select>
                </Field>
                <Field label="Payment Offset (days)" hint="Days after each period's To-Date that salary is paid">
                  <input type="number" min={0} max={31} className={inputCls} value={genForm.paymentOffsetDays} onChange={e => setGenForm(f => ({ ...f, paymentOffsetDays: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
                </Field>
                <Field label="Initial Status">
                  <select className={selectCls} value={genForm.status} onChange={e => setGenForm(f => ({ ...f, status: e.target.value as PayrollPeriodStatus }))}>
                    <option>Open</option><option>Processing</option><option>Closed</option>
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <ToggleSwitch value={genForm.setFirstDefault} onChange={v => setGenForm(f => ({ ...f, setFirstDefault: v }))} label="Set first new period as Default" description="Marks the earliest generated period as the default pay cycle" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview · {genPreview.length} period{genPreview.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs"><span className="font-bold text-indigo-600">{genNewCount} new</span><span className="text-muted-foreground"> · {genPreview.length - genNewCount} already exist</span></p>
                </div>
                <div className="rounded-xl border border-border divide-y divide-border max-h-64 overflow-y-auto">
                  {genPreview.map(p => {
                    const exists = existingCodes.has(p.code);
                    return (
                      <div key={p.code} className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${exists ? 'bg-accent/30 opacity-60' : ''}`}>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.name} <span className="font-mono text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{p.code}</span></p>
                          <p className="text-[11px] text-muted-foreground">{formatDate(p.fromDate)} → {formatDate(p.toDate)} · Pay {formatDate(p.paymentDate)}</p>
                        </div>
                        {exists
                          ? <span className="shrink-0 text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">Exists</span>
                          : <span className="shrink-0 text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">New</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 bg-accent/10">
              <p className="text-xs text-muted-foreground">{genNewCount > 0 ? `${genNewCount} period${genNewCount > 1 ? 's' : ''} will be created.` : 'Nothing to generate — all exist.'}</p>
              <div className="flex gap-3">
                <button onClick={() => setGenModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={handleGenerate} disabled={genNewCount === 0} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md disabled:opacity-40 disabled:cursor-not-allowed"><Wand2 size={15} /> Generate {genNewCount > 0 ? genNewCount : ''}</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className={`flex items-center gap-3 px-6 py-4 border-b border-border ${confirmModal.type === 'lock' ? 'bg-red-50' : confirmModal.type === 'close' ? 'bg-gray-50' : 'bg-destructive/5'}`}>
                {confirmModal.type === 'lock' ? <Lock size={20} className="text-red-600" /> : confirmModal.type === 'close' ? <CheckCircle2 size={20} className="text-gray-600" /> : <Trash2 size={20} className="text-destructive" />}
                <h2 className="text-base font-bold">{confirmModal.type === 'lock' ? 'Lock Payroll Period' : confirmModal.type === 'close' ? 'Close Payroll Period' : 'Delete Payroll Period'}</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-accent/30 rounded-xl border border-border">
                  <p className="font-bold text-sm">{confirmModal.period.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(confirmModal.period.fromDate)} → {formatDate(confirmModal.period.toDate)}</p>
                </div>
                <div className={`flex items-start gap-3 p-3 rounded-xl border ${confirmModal.type === 'lock' ? 'bg-red-50 border-red-200' : confirmModal.type === 'delete' ? 'bg-destructive/5 border-destructive/20' : 'bg-amber-50 border-amber-200'}`}>
                  <AlertCircle size={16} className={`shrink-0 mt-0.5 ${confirmModal.type === 'lock' ? 'text-red-600' : confirmModal.type === 'delete' ? 'text-destructive' : 'text-amber-600'}`} />
                  <p className={`text-xs ${confirmModal.type === 'lock' ? 'text-red-700' : confirmModal.type === 'delete' ? 'text-destructive' : 'text-amber-700'}`}>
                    {confirmModal.type === 'lock' ? 'Locking is irreversible. No further edits will be allowed.' : confirmModal.type === 'close' ? 'Closing marks this period as complete.' : 'This action cannot be undone.'}
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setConfirmModal(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={confirmAction} className={`px-6 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md ${confirmModal.type === 'lock' ? 'bg-red-600' : confirmModal.type === 'delete' ? 'bg-destructive' : 'bg-gray-600'}`}>
                  {confirmModal.type === 'lock' ? 'Lock Period' : confirmModal.type === 'close' ? 'Close Period' : 'Delete Period'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Salary Components View ───────────────────────────────────────────────────

interface SalaryComponentsViewProps {
  components: SalaryComponent[];
  onUpdate: (components: SalaryComponent[]) => void;
  onBack: () => void;
}

function SalaryComponentsView({ components, onUpdate, onBack }: SalaryComponentsViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ComponentType | 'All'>('All');
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SalaryComponent | null>(null);
  const emptyForm: Omit<SalaryComponent, 'id' | 'createdAt' | 'isSystemDefined'> = {
    name: '', code: '', type: 'Earning', calculationBasis: 'Fixed', value: 0, formula: '',
    taxability: 'Fully Taxable', pfApplicability: 'Not Applicable', esiApplicability: 'Not Applicable',
    isActive: true, statutoryType: 'none', bonusType: 'none', isOvertime: false, overtimeMultiplier: 2, overtimeHoursPerMonth: 208, isReimbursement: false, isArrears: false, deductionSource: 'none' as DeductionSource, roundOff: 'nearest_1' as RoundCode, description: '',
  };
  const [form, setForm] = useState<Omit<SalaryComponent, 'id' | 'createdAt' | 'isSystemDefined'>>(emptyForm);

  const filtered = useMemo(() =>
    components
      .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
      .filter(c => typeFilter === 'All' || c.type === typeFilter),
    [components, search, typeFilter]
  );

  const openAdd = () => { setEditingItem(null); setForm(emptyForm); setModal(true); };
  const openEdit = (item: SalaryComponent) => { setEditingItem(item); setForm({ name: item.name, code: item.code, type: item.type, calculationBasis: item.calculationBasis, value: item.value, formula: item.formula, taxability: item.taxability, pfApplicability: item.pfApplicability, esiApplicability: item.esiApplicability, isActive: item.isActive, statutoryType: item.statutoryType, bonusType: item.bonusType, isOvertime: item.isOvertime, overtimeMultiplier: item.overtimeMultiplier, overtimeHoursPerMonth: item.overtimeHoursPerMonth, isReimbursement: item.isReimbursement, isArrears: item.isArrears, deductionSource: item.deductionSource, roundOff: item.roundOff, description: item.description }); setModal(true); };

  const saveItem = () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (!form.code.trim()) { toast.error('Code is required.'); return; }
    const codeExists = components.some(c => c.code === form.code && (editingItem ? c.id !== editingItem.id : true));
    if (codeExists) { toast.error('Code already exists.'); return; }
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const todayStr = `${String(now.getDate()).padStart(2,'0')}/${months[now.getMonth()]}/${now.getFullYear()}`;
    if (editingItem) { onUpdate(components.map(c => c.id === editingItem.id ? { ...c, ...form } : c)); toast.success('Component updated.'); }
    else { onUpdate([...components, { ...form, id: `SC${String(components.length + 1).padStart(3, '0')}`, createdAt: todayStr, isSystemDefined: false }]); toast.success('Component added.'); }
    setModal(false);
  };

  const deleteItem = (id: string) => { const item = components.find(c => c.id === id); if (item?.isSystemDefined) { toast.error('System-defined components cannot be deleted.'); return; } onUpdate(components.filter(c => c.id !== id)); toast.info('Component deleted.'); };
  const toggleStatus = (id: string) => { onUpdate(components.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c)); };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign size={22} className="text-green-600" /></div>
              <div><h1 className="text-xl font-bold font-serif">Salary Components</h1><p className="text-xs text-muted-foreground">Define earnings, deductions, employer contributions, and reimbursements.</p></div>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"><Plus size={16} /> Add Component</button>
          </div>
        </div>
        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Earnings', value: components.filter(c => c.type === 'Earning').length, color: 'bg-green-100', iconColor: 'text-green-600', icon: TrendingUp },
              { label: 'Deductions', value: components.filter(c => c.type === 'Deduction').length, color: 'bg-red-100', iconColor: 'text-red-600', icon: ArrowUpDown },
              { label: 'Employer Contrib.', value: components.filter(c => c.type === 'Employer Contribution').length, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Building2 },
              { label: 'Reimbursements', value: components.filter(c => c.type === 'Reimbursement').length, color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Wallet },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={20} className={card.iconColor} /></div>
                <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p><p className="font-bold text-lg mt-0.5">{card.value}</p></div>
              </motion.div>
            ))}
          </div>
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search components..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
              <option value="All">All Types</option>
              {COMPONENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {components.length} components</div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Component</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Calculation</th>
                    <th className="px-4 py-3 font-semibold">Value</th>
                    <th className="px-4 py-3 font-semibold">Taxability</th>
                    <th className="px-4 py-3 font-semibold">PF / ESI</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((comp, i) => {
                    const typeStyle = COMPONENT_TYPE_STYLES[comp.type];
                    return (
                      <motion.tr key={comp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">{comp.name}</p>
                                {comp.isSystemDefined && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">System</span>}
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{comp.code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>{comp.type}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{comp.calculationBasis}</td>
                        <td className="px-4 py-3 font-bold text-sm">{comp.calculationBasis === 'Fixed' ? `₹${comp.value.toLocaleString('en-IN')}` : `${comp.value}%`}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${comp.taxability === 'Fully Taxable' ? 'bg-red-100 text-red-700 border-red-200' : comp.taxability === 'Fully Exempt' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>{comp.taxability}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${comp.pfApplicability === 'Applicable' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>PF</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${comp.esiApplicability === 'Applicable' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>ESI</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleStatus(comp.id)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${comp.isActive ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${comp.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />{comp.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(comp)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                            {!comp.isSystemDefined && <button onClick={() => deleteItem(comp.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <AnimatePresence>
        {modal && (
          <Modal title={editingItem ? `Edit Component — ${editingItem.name}` : 'Add Salary Component'} onClose={() => setModal(false)} wide>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Field label="Component Name" required><input type="text" className={inputCls} placeholder="e.g. Basic Salary, HRA" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field></div>
                <Field label="Code" required hint="Short unique identifier"><input type="text" className={`${inputCls} font-mono uppercase`} placeholder="e.g. BASIC" maxLength={10} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></Field>
                <Field label="Component Type" required><select className={selectCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ComponentType }))}>{COMPONENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Calculation Basis" required><select className={selectCls} value={form.calculationBasis} onChange={e => setForm(f => ({ ...f, calculationBasis: e.target.value as CalculationBasis }))}>{CALCULATION_BASES.map(b => <option key={b}>{b}</option>)}</select></Field>
                <Field label={form.calculationBasis === 'Fixed' ? 'Amount (₹)' : 'Percentage (%)'} required><input type="number" className={inputCls} min={0} step={form.calculationBasis === 'Fixed' ? 100 : 0.5} value={form.value} onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} /></Field>
                <Field label="Taxability"><select className={selectCls} value={form.taxability} onChange={e => setForm(f => ({ ...f, taxability: e.target.value as TaxabilityType }))}>{TAXABILITY_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Status"><select className={selectCls} value={form.isActive ? 'Active' : 'Inactive'} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'Active' }))}><option>Active</option><option>Inactive</option></select></Field>
                <Field label="PF Applicability"><select className={selectCls} value={form.pfApplicability} onChange={e => setForm(f => ({ ...f, pfApplicability: e.target.value as PFApplicability }))}>{PF_APPLICABILITY.map(p => <option key={p}>{p}</option>)}</select></Field>
                <Field label="ESI Applicability"><select className={selectCls} value={form.esiApplicability} onChange={e => setForm(f => ({ ...f, esiApplicability: e.target.value as PFApplicability }))}>{PF_APPLICABILITY.map(p => <option key={p}>{p}</option>)}</select></Field>
                <div className="col-span-2 p-3 rounded-xl border border-indigo-200 bg-indigo-50/60">
                  <Field label="Statutory Linkage" hint="Map this component to a statutory head so payroll & salary breakdowns compute and place it correctly (Basic drives % components; PF/ESI/PT/Income Tax flow to their deduction heads).">
                    <select className={selectCls} value={form.statutoryType} onChange={e => setForm(f => ({ ...f, statutoryType: e.target.value as StatutoryType }))}>
                      {STATUTORY_LINKAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="col-span-2 p-3 rounded-xl border border-rose-200 bg-rose-50/60">
                  <Field label="Bonus / Ex-gratia" hint="Mark this component as the Bonus or Ex-gratia payout head, so the computed statutory bonus (or ex-gratia, for employees above the eligibility wage) is placed here.">
                    <select className={selectCls} value={form.bonusType} onChange={e => setForm(f => ({ ...f, bonusType: e.target.value as BonusType }))}>
                      <option value="none">Not a bonus component</option>
                      <option value="bonus">Bonus</option>
                      <option value="exgratia">Ex-gratia</option>
                    </select>
                  </Field>
                </div>
                <div className="col-span-2 p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <input type="checkbox" checked={form.isOvertime} onChange={e => setForm(f => ({ ...f, isOvertime: e.target.checked, type: e.target.checked ? 'Earning' : f.type }))} className="rounded border-border" />
                    Overtime component
                    <span className="text-[10px] font-normal text-muted-foreground">— pay computed from attendance OT hours</span>
                  </label>
                  {form.isOvertime && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="OT Rate Multiplier (×)" hint="e.g. 2 = double the normal hourly rate"><input type="number" className={inputCls} min={1} step={0.25} value={form.overtimeMultiplier} onChange={e => setForm(f => ({ ...f, overtimeMultiplier: parseFloat(e.target.value) || 0 }))} /></Field>
                        <Field label="Standard Hours / Month" hint="Divisor for the hourly rate (e.g. 26 days × 8h = 208)"><input type="number" className={inputCls} min={1} step={1} value={form.overtimeHoursPerMonth} onChange={e => setForm(f => ({ ...f, overtimeHoursPerMonth: parseFloat(e.target.value) || 0 }))} /></Field>
                      </div>
                      <p className="text-[11px] text-amber-700">OT pay = OT hours × (Basic ÷ {form.overtimeHoursPerMonth || 208}) × {form.overtimeMultiplier || 2}. OT hours are read from approved attendance for the payroll period.</p>
                    </>
                  )}
                </div>
                <div className="col-span-2 p-3 rounded-xl border border-teal-200 bg-teal-50/60 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <input type="checkbox" checked={form.isReimbursement} onChange={e => setForm(f => ({ ...f, isReimbursement: e.target.checked, type: e.target.checked ? 'Reimbursement' : f.type }))} className="rounded border-border" />
                    Reimbursement component
                    <span className="text-[10px] font-normal text-muted-foreground">— pays out closed reimbursement claims for the period</span>
                  </label>
                  {form.isReimbursement && <p className="text-[11px] text-teal-700">Closed reimbursement claims (Pre-Payroll → Reimbursement) are paid through this head in the payroll run, on top of gross.</p>}
                </div>
                <div className="col-span-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <input type="checkbox" checked={form.isArrears} onChange={e => setForm(f => ({ ...f, isArrears: e.target.checked }))} className="rounded border-border" />
                    Arrears component
                    <span className="text-[10px] font-normal text-muted-foreground">— pays salary-revision arrears for the period</span>
                  </label>
                  {form.isArrears && <p className="text-[11px] text-emerald-700">Back-period arrears from an applied Salary Revision are paid through this head in the current run, on top of gross.</p>}
                </div>
                {form.type === 'Deduction' && (
                  <div className="col-span-2"><Field label="Linked Deduction Source" hint="Link this deduction head to a Deductions-module category so entries of that category (Loan & Advances, Damages & Loss, Fines, Canteen, Society, Donations/Campaign, Other Deductions) are recovered through this component.">
                    <select className={selectCls} value={form.deductionSource} onChange={e => setForm(f => ({ ...f, deductionSource: e.target.value as DeductionSource }))}>
                      {DEDUCTION_SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  {form.deductionSource !== 'none' && <p className="text-[11px] text-blue-700 mt-1">Deductions of type “{DEDUCTION_SOURCE_OPTIONS.find(o => o.value === form.deductionSource)?.label}” are recovered through this component head in the payroll run.</p>}
                  </div>
                )}
                <div><Field label="Round-Off / Round-Up" hint="Round-Off rounds to the nearest multiple; Round-Up always moves any fraction up to the next whole (e.g. 0.1 → ₹1).">
                  <select className={selectCls} value={form.roundOff} onChange={e => setForm(f => ({ ...f, roundOff: e.target.value as RoundCode }))}>
                    {ROUND_OPTIONS.filter(o => !o.group).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    <optgroup label="Round-Off (nearest)">
                      {ROUND_OPTIONS.filter(o => o.group === 'off').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                    <optgroup label="Round-Up (always up)">
                      {ROUND_OPTIONS.filter(o => o.group === 'up').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                  </select>
                </Field></div>
                <div className="col-span-2"><Field label="Description"><textarea className={`${inputCls} resize-none`} rows={2} placeholder="Brief description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveItem} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">{editingItem ? 'Save Changes' : 'Add Component'}</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Structure Component Row ──────────────────────────────────────────────────
// Handles Fixed / Variable (Employee-wise) / Custom Listed Values

interface StructureComponentRowProps {
  comp: SalaryStructureComponent;
  index: number;
  onUpdate: (updates: Partial<SalaryStructureComponent>) => void;
  onRemove: () => void;
}

const StructureComponentRow = ({ comp, index, onUpdate, onRemove }: StructureComponentRowProps) => {
  const [customValuesInput, setCustomValuesInput] = useState(comp.customValues.join(', '));
  const typeStyle = COMPONENT_TYPE_STYLES[comp.componentType];
  const vtConfig = VALUE_TYPE_LABELS[comp.valueType];

  const handleCustomValuesChange = (raw: string) => {
    setCustomValuesInput(raw);
    const parsed = raw
      .split(',')
      .map(v => parseFloat(v.trim()))
      .filter(v => !isNaN(v) && v >= 0); // 0 is allowed as a listed value & default
    onUpdate({
      customValues: parsed,
      selectedCustomValue: parsed.includes(comp.selectedCustomValue) ? comp.selectedCustomValue : (parsed[0] ?? 0),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
    >
      {/* Component Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-accent/20 border-b border-border">
        <div className={`w-8 h-8 rounded-lg ${typeStyle.bg} flex items-center justify-center shrink-0`}>
          <span className={`text-[10px] font-bold ${typeStyle.text}`}>{comp.componentCode}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{comp.componentName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>{comp.componentType}</span>
            <span className="text-[10px] text-muted-foreground">{comp.calculationBasis}</span>
          </div>
        </div>
        <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Value Type Selection */}
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">
            Value Type <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(VALUE_TYPE_LABELS) as [ComponentValueType, typeof VALUE_TYPE_LABELS[ComponentValueType]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => onUpdate({ valueType: key })}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                  comp.valueType === key
                    ? `${cfg.bg} ${cfg.border} shadow-sm`
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <span className={`text-xs font-bold ${comp.valueType === key ? cfg.color : 'text-foreground'}`}>{cfg.label}</span>
                <span className={`text-[10px] ${comp.valueType === key ? cfg.color : 'text-muted-foreground'} opacity-80 leading-tight`}>{cfg.description}</span>
                {comp.valueType === key && (
                  <CheckCircle2 size={12} className={cfg.color} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fixed Value Input */}
        {comp.valueType === 'fixed' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Field
              label={comp.calculationBasis === 'Fixed' ? 'Fixed Amount (₹)' : 'Percentage (%)'}
              hint={comp.calculationBasis === 'Fixed' ? 'This fixed amount applies to all employees using this structure' : 'This percentage applies to all employees using this structure'}
            >
              <div className="relative">
                {comp.calculationBasis === 'Fixed' ? (
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                ) : (
                  <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
                <input
                  type="number"
                  className={`${inputCls} pl-9`}
                  min={0}
                  step={comp.calculationBasis === 'Fixed' ? 100 : 0.5}
                  value={comp.value}
                  onChange={e => onUpdate({ value: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </Field>
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <Info size={12} className="text-blue-600 shrink-0" />
              <p className="text-[10px] text-blue-700">
                This component will use <strong>{comp.calculationBasis === 'Fixed' ? `₹${comp.value.toLocaleString('en-IN')}` : `${comp.value}%`}</strong> for all employees assigned to this structure.
              </p>
            </div>
          </motion.div>
        )}

        {/* Variable — Employee-wise value */}
        {comp.valueType === 'variable' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <UserCog size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-semibold mb-1">Variable — Set Per Employee in Salary Structure Assignment</p>
                <p>
                  The value for <strong>{comp.componentName}</strong> will be entered individually for each employee in the <strong>Salary Structure Assignment</strong> module. This allows different employees to have different values for this component (e.g. different Special Allowance amounts based on grade or negotiation).
                </p>
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-white/70 border border-amber-200 rounded-lg">
                  <ArrowUpDown size={11} className="text-amber-600 shrink-0" />
                  <p className="text-[10px] text-amber-700">
                    Go to <strong>Salary Structure Assignment → Edit Employee → Component Overrides</strong> to set the value for each employee.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Custom Listed Values */}
        {comp.valueType === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3">
            <div className="flex items-start gap-3 p-3 bg-violet-50 border border-violet-200 rounded-xl">
              <List size={14} className="text-violet-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-violet-700">
                Define a list of allowed values. During payroll assignment, one of these values must be selected for each employee.
              </p>
            </div>

            <Field
              label="Allowed Values (comma-separated)"
              hint="e.g. 1000, 2000, 3000, 5000 — Enter amounts in ₹ separated by commas"
            >
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. 1000, 2000, 3000, 5000"
                value={customValuesInput}
                onChange={e => handleCustomValuesChange(e.target.value)}
              />
            </Field>

            {comp.customValues.length > 0 && (
              <div>
                <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">
                  Available Values — Click to set default
                </label>
                <div className="flex flex-wrap gap-2">
                  {comp.customValues.map(val => (
                    <button
                      key={val}
                      onClick={() => onUpdate({ selectedCustomValue: val })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all ${
                        comp.selectedCustomValue === val
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100'
                      }`}
                    >
                      {comp.selectedCustomValue === val && <CheckCircle2 size={11} />}
                      ₹{val.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
                {comp.customValues.includes(comp.selectedCustomValue) && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                    <CheckCircle2 size={12} className="text-violet-600 shrink-0" />
                    <p className="text-[10px] text-violet-700">
                      Default selected value: <strong>₹{comp.selectedCustomValue.toLocaleString('en-IN')}</strong>. This can be overridden per employee in Salary Structure Assignment.
                    </p>
                  </div>
                )}
              </div>
            )}

            {comp.customValues.length === 0 && customValuesInput.trim() && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={12} className="text-red-600 shrink-0" />
                <p className="text-[10px] text-red-700">No valid values found. Please enter positive numbers separated by commas.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Salary Structure View ────────────────────────────────────────────────────

interface SalaryStructureViewProps {
  structures: SalaryStructure[];
  components: SalaryComponent[];
  onUpdate: (structures: SalaryStructure[]) => void;
  onBack: () => void;
}

function SalaryStructureView({ structures, components, onUpdate, onBack }: SalaryStructureViewProps) {
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SalaryStructure | null>(null);
  const [form, setForm] = useState<Omit<SalaryStructure, 'id' | 'createdAt'>>({
    name: '', code: '', applicableTo: ['All Employees'], components: [], isActive: true, description: '',
  });

  const earningComponents = components.filter(c => c.type === 'Earning' && c.isActive);
  const deductionComponents = components.filter(c => c.type === 'Deduction' && c.isActive);
  const reimbursementComponents = components.filter(c => c.type === 'Reimbursement' && c.isActive);

  const openAdd = () => { setEditingItem(null); setForm({ name: '', code: '', applicableTo: ['All Employees'], components: [], isActive: true, description: '' }); setModal(true); };
  const openEdit = (item: SalaryStructure) => {
    setEditingItem(item);
    setForm({
      name: item.name, code: item.code, applicableTo: [...item.applicableTo],
      components: item.components.map(c => ({ ...c, customValues: [...c.customValues] })),
      isActive: item.isActive, description: item.description,
    });
    setModal(true);
  };

  const saveItem = () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Name and Code are required.'); return; }
    // Validate custom value components
    for (const comp of form.components) {
      if (comp.valueType === 'custom' && comp.customValues.length === 0) {
        toast.error(`Component "${comp.componentName}" is set to Custom Listed Values but has no values defined.`);
        return;
      }
    }
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const todayStr = `${String(now.getDate()).padStart(2,'0')}/${months[now.getMonth()]}/${now.getFullYear()}`;
    if (editingItem) { onUpdate(structures.map(s => s.id === editingItem.id ? { ...s, ...form } : s)); toast.success('Salary structure updated.'); }
    else { onUpdate([...structures, { ...form, id: `SS${String(structures.length + 1).padStart(3, '0')}`, createdAt: todayStr }]); toast.success('Salary structure created.'); }
    setModal(false);
  };

  const deleteItem = (id: string) => { onUpdate(structures.filter(s => s.id !== id)); toast.info('Salary structure deleted.'); };

  const toggleCategory = (cat: string) => {
    const current = form.applicableTo;
    if (cat === 'All Employees') { setForm(f => ({ ...f, applicableTo: ['All Employees'] })); return; }
    const withoutAll = current.filter(c => c !== 'All Employees');
    const updated = withoutAll.includes(cat) ? withoutAll.filter(c => c !== cat) : [...withoutAll, cat];
    setForm(f => ({ ...f, applicableTo: updated.length === 0 ? ['All Employees'] : updated }));
  };

  const addComponent = (comp: SalaryComponent) => {
    if (form.components.find(c => c.componentId === comp.id)) { toast.error('Component already added.'); return; }
    const newComp: SalaryStructureComponent = {
      componentId: comp.id,
      componentName: comp.name,
      componentCode: comp.code,
      componentType: comp.type,
      calculationBasis: comp.calculationBasis,
      valueType: 'fixed',
      value: comp.value,
      customValues: [],
      selectedCustomValue: 0,
      formula: comp.formula,
    };
    setForm(f => ({ ...f, components: [...f.components, newComp] }));
  };

  const updateComponent = (componentId: string, updates: Partial<SalaryStructureComponent>) => {
    setForm(f => ({
      ...f,
      components: f.components.map(c => c.componentId === componentId ? { ...c, ...updates } : c),
    }));
  };

  const removeComponent = (componentId: string) => {
    setForm(f => ({ ...f, components: f.components.filter(c => c.componentId !== componentId) }));
  };

  // Helper to display value summary for a component
  const getValueSummary = (comp: SalaryStructureComponent): string => {
    if (comp.valueType === 'variable') return 'Variable (per employee)';
    if (comp.valueType === 'custom') {
      if (comp.customValues.length === 0) return 'Custom (no values)';
      return `Custom: ${comp.customValues.map(v => `₹${v.toLocaleString('en-IN')}`).join(', ')}`;
    }
    return comp.calculationBasis === 'Fixed'
      ? `₹${comp.value.toLocaleString('en-IN')}`
      : `${comp.value}%`;
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
                <h1 className="text-xl font-bold font-serif">Salary Structures</h1>
                <p className="text-xs text-muted-foreground">Create salary structure templates. Each component can be Fixed, Variable (per employee), or Custom Listed Values.</p>
              </div>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"><Plus size={16} /> Create Structure</button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-8 pt-6">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <Info size={17} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Component Value Types</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Each component in a salary structure can be configured as:
                <strong className="text-blue-700"> Fixed</strong> (same value for all employees),
                <strong className="text-amber-700"> Variable (Employee-wise)</strong> (set individually per employee in Salary Structure Assignment), or
                <strong className="text-violet-700"> Custom Listed Values</strong> (one of a predefined list like ₹1,000 / ₹2,000 / ₹5,000).
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 space-y-6">
          {structures.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {structures.map((ss, i) => (
                <motion.div key={ss.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className={`h-1.5 w-full ${ss.isActive ? 'bg-amber-400' : 'bg-gray-300'}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2"><h3 className="font-bold text-sm">{ss.name}</h3><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${ss.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${ss.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />{ss.isActive ? 'Active' : 'Inactive'}</span></div>
                        <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{ss.code}</span>
                      </div>
                    </div>
                    {ss.description && <p className="text-[11px] text-muted-foreground italic mb-3">{ss.description}</p>}
                    <div className="mb-3"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Applicable To</p><div className="flex flex-wrap gap-1">{ss.applicableTo.map(cat => <span key={cat} className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{cat}</span>)}</div></div>
                    <div className="mb-4">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Components ({ss.components.length})</p>
                      <div className="space-y-1.5">
                        {ss.components.slice(0, 5).map(comp => {
                          const vtConfig = VALUE_TYPE_LABELS[comp.valueType];
                          return (
                            <div key={comp.componentId} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{comp.componentName}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${vtConfig.badgeBg} ${vtConfig.badgeText} ${vtConfig.badgeBorder}`}>
                                  {comp.valueType === 'variable' ? 'Variable' : comp.valueType === 'custom' ? 'Custom' : 'Fixed'}
                                </span>
                              </div>
                              <span className="font-semibold text-muted-foreground">{getValueSummary(comp)}</span>
                            </div>
                          );
                        })}
                        {ss.components.length > 5 && <p className="text-[10px] text-muted-foreground">+{ss.components.length - 5} more components</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pt-3 border-t border-border">
                      <button onClick={() => openEdit(ss)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"><Pencil size={12} /> Edit</button>
                      <button onClick={() => deleteItem(ss.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto"><Trash2 size={12} /> Delete</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Layers size={28} className="text-amber-600" /></div>
              <p className="font-semibold text-muted-foreground">No salary structures defined yet</p>
              <button onClick={openAdd} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto"><Plus size={15} /> Create Structure</button>
            </div>
          )}
        </div>
      </main>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg"><Layers size={18} className="text-amber-600" /></div>
                  <div>
                    <h2 className="text-lg font-bold">{editingItem ? `Edit Structure — ${editingItem.name}` : 'Create Salary Structure'}</h2>
                    <p className="text-xs text-muted-foreground">Configure components with Fixed, Variable (per employee), or Custom Listed Values</p>
                  </div>
                </div>
                <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
              </div>

              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Structure Name" required>
                      <input type="text" className={inputCls} placeholder="e.g. Standard Structure" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Code" required>
                    <input type="text" className={`${inputCls} font-mono uppercase`} placeholder="e.g. STD" maxLength={8} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                  </Field>
                  <Field label="Status">
                    <select className={selectCls} value={form.isActive ? 'Active' : 'Inactive'} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'Active' }))}>
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </Field>
                  <div className="col-span-2">
                    <Field label="Description">
                      <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Brief description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </Field>
                  </div>
                </div>

                {/* Applicable To */}
                <div>
                  <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Applicable Employee Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {EMPLOYEE_CATEGORIES.map(cat => {
                      const isSelected = form.applicableTo.includes(cat);
                      return (
                        <button key={cat} onClick={() => toggleCategory(cat)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold transition-all ${isSelected ? 'bg-primary/10 text-primary border-primary shadow-sm' : 'bg-accent/30 text-muted-foreground border-border hover:border-primary/40'}`}>
                          {isSelected && <CheckCircle2 size={12} className="shrink-0" />}
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add Components */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Salary Components ({form.components.length})
                    </label>
                  </div>

                  {/* Add Earning Components */}
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-2">Add Earning Components</p>
                    <div className="flex flex-wrap gap-2">
                      {earningComponents.filter(c => !form.components.find(fc => fc.componentId === c.id)).map(comp => (
                        <button key={comp.id} onClick={() => addComponent(comp)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors">
                          <Plus size={11} /> {comp.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add Deduction Components */}
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-2">Add Deduction Components</p>
                    <div className="flex flex-wrap gap-2">
                      {deductionComponents.filter(c => !form.components.find(fc => fc.componentId === c.id)).map(comp => (
                        <button key={comp.id} onClick={() => addComponent(comp)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors">
                          <Plus size={11} /> {comp.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add Reimbursement Components */}
                  {reimbursementComponents.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-2">Add Reimbursement Components</p>
                      <div className="flex flex-wrap gap-2">
                        {reimbursementComponents.filter(c => !form.components.find(fc => fc.componentId === c.id)).map(comp => (
                          <button key={comp.id} onClick={() => addComponent(comp)} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-semibold hover:bg-violet-100 transition-colors">
                            <Plus size={11} /> {comp.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Component Configuration */}
                {form.components.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                      <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                        <Settings2 size={16} className="text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">Configure Component Values</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Set each component as <strong>Fixed</strong>, <strong>Variable (per employee)</strong>, or <strong>Custom Listed Values</strong>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {form.components.map((comp, i) => (
                        <StructureComponentRow
                          key={comp.componentId}
                          comp={comp}
                          index={i}
                          onUpdate={updates => updateComponent(comp.componentId, updates)}
                          onRemove={() => removeComponent(comp.componentId)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {form.components.length === 0 && (
                  <div className="text-center py-8 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                    <Layers size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">No components added yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Use the buttons above to add earning, deduction, or reimbursement components</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={saveItem} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                  {editingItem ? 'Save Changes' : 'Create Structure'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PF/ESI, Pay Heads, TDS, Loan Types — simplified stubs ───────────────────

function PayHeadsView({ payHeads, onUpdate, onBack }: { payHeads: PayHead[]; onUpdate: (p: PayHead[]) => void; onBack: () => void }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
            <div className="p-2 bg-blue-100 rounded-lg"><BookOpen size={22} className="text-blue-600" /></div>
            <div><h1 className="text-xl font-bold font-serif">Pay Heads</h1><p className="text-xs text-muted-foreground">Configure accounting pay heads and ledger groups for payroll journal entries.</p></div>
          </div>
        </div>
        <div className="px-8 py-6">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr><th className="px-4 py-3 font-semibold">#</th><th className="px-4 py-3 font-semibold">Pay Head</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Ledger Group</th><th className="px-4 py-3 font-semibold">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payHeads.map((ph, i) => (
                    <tr key={ph.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-4 py-3"><p className="font-semibold text-sm">{ph.name}</p><span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{ph.code}</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ph.type === 'Earning' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{ph.type}</span></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{ph.ledgerGroup}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${ph.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${ph.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />{ph.isActive ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PFESIView({ config, onUpdate, onBack, onManageSlabs }: { config: PFESIConfig; onUpdate: (c: PFESIConfig) => void; onBack: () => void; onManageSlabs: () => void }) {
  const [form, setForm] = useState<PFESIConfig>({ ...config });
  // Keep local form in sync when the underlying DB row first loads / changes.
  useEffect(() => { setForm({ ...config }); }, [config]);
  const handleSave = () => { onUpdate(form); };

  // Earning salary components — for the PF / ESI wage-base selectors.
  const [earnComps, setEarnComps] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from('salary_components').select('code, name, type, is_active').eq('type', 'Earning').order('name');
      if (active) setEarnComps(((data ?? []) as Array<Record<string, any>>).filter(c => c.is_active !== false && c.code).map(c => ({ code: c.code as string, name: (c.name as string) ?? (c.code as string) })));
    })();
    return () => { active = false; };
  }, []);
  const toggleWageComp = (field: 'pfWageComponents' | 'esiWageComponents' | 'bonusWageComponents', code: string) =>
    setForm(f => ({ ...f, [field]: (f[field] ?? []).includes(code) ? f[field].filter(c => c !== code) : [...(f[field] ?? []), code] }));
  const WageComponentPicker = ({ field, accent, fallback }: { field: 'pfWageComponents' | 'esiWageComponents' | 'bonusWageComponents'; accent: string; fallback: string }) => (
    <div className="mt-4">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Wage Components</p>
      <p className="text-[11px] text-muted-foreground mb-2">Select the earning components that make up these wages. Leave empty to use <strong>{fallback}</strong>.</p>
      <div className="flex flex-wrap gap-2">
        {earnComps.length === 0 && <span className="text-xs text-muted-foreground">No earning components defined in Salary Components.</span>}
        {earnComps.map(c => {
          const on = (form[field] ?? []).includes(c.code);
          return (
            <button key={c.code} type="button" onClick={() => toggleWageComp(field, c.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${on ? `${accent} text-white border-transparent` : 'bg-accent text-muted-foreground border-border hover:border-current'}`}>
              {c.name} <span className="opacity-60 font-mono">{c.code}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-emerald-100 rounded-lg"><Shield size={22} className="text-emerald-600" /></div>
              <div><h1 className="text-xl font-bold font-serif">Payroll Settings</h1><p className="text-xs text-muted-foreground">Statutory contributions & deductions (PF, ESI, PT, NPS), Gratuity and Bonus — org-wide defaults.</p></div>
            </div>
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"><CheckCircle2 size={16} /> Save Settings</button>
          </div>
        </div>
        <div className="px-8 py-6 max-w-3xl space-y-6">
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <SectionHeader icon={PiggyBank} title="Provident Fund (PF)" subtitle="EPFO contribution rates and wage ceiling" accentColor="text-emerald-600" accentBg="bg-emerald-100" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Enable PF</span>
              <div onClick={() => setForm(f => ({ ...f, pfEnabled: !f.pfEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.pfEnabled ? 'bg-primary' : 'bg-border'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.pfEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>
            </div>
            {form.pfEnabled && (
              <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Employee PF Rate (%)"><div className="relative"><Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="number" className={`${inputCls} pl-9`} min={0} max={100} step={0.5} value={form.pfEmployeeRate} onChange={e => setForm(f => ({ ...f, pfEmployeeRate: parseFloat(e.target.value) || 0 }))} /></div></Field>
                <Field label="Employer PF Rate (%)"><div className="relative"><Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="number" className={`${inputCls} pl-9`} min={0} max={100} step={0.5} value={form.pfEmployerRate} onChange={e => setForm(f => ({ ...f, pfEmployerRate: parseFloat(e.target.value) || 0 }))} /></div></Field>
                <Field label="PF Wage Ceiling (₹)"><input type="number" className={inputCls} min={0} step={500} value={form.pfWageCeiling} onChange={e => setForm(f => ({ ...f, pfWageCeiling: parseInt(e.target.value) || 0 }))} /></Field>
                <Field label="Apply PF On"><select className={selectCls} value={form.pfApplyOnActualOrCeiling} onChange={e => setForm(f => ({ ...f, pfApplyOnActualOrCeiling: e.target.value as 'Actual' | 'Ceiling' }))}><option value="Ceiling">Ceiling</option><option value="Actual">Actual Wages</option></select></Field>
              </div>
              <WageComponentPicker field="pfWageComponents" accent="bg-emerald-600" fallback="Basic only (then capped at the PF wage ceiling)" />
              </>
            )}
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <SectionHeader icon={CreditCard} title="Employee State Insurance (ESI)" subtitle="ESIC contribution rates and wage ceiling" accentColor="text-blue-600" accentBg="bg-blue-100" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Enable ESI</span>
              <div onClick={() => setForm(f => ({ ...f, esiEnabled: !f.esiEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.esiEnabled ? 'bg-primary' : 'bg-border'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.esiEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>
            </div>
            {form.esiEnabled && (
              <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Employee ESI Rate (%)"><input type="number" className={inputCls} min={0} max={10} step={0.25} value={form.esiEmployeeRate} onChange={e => setForm(f => ({ ...f, esiEmployeeRate: parseFloat(e.target.value) || 0 }))} /></Field>
                <Field label="Employer ESI Rate (%)"><input type="number" className={inputCls} min={0} max={10} step={0.25} value={form.esiEmployerRate} onChange={e => setForm(f => ({ ...f, esiEmployerRate: parseFloat(e.target.value) || 0 }))} /></Field>
                <Field label="ESI Wage Ceiling (₹)"><input type="number" className={inputCls} min={0} step={500} value={form.esiWageCeiling} onChange={e => setForm(f => ({ ...f, esiWageCeiling: parseInt(e.target.value) || 0 }))} /></Field>
              </div>
              <WageComponentPicker field="esiWageComponents" accent="bg-blue-600" fallback="Gross earnings" />
              </>
            )}
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <SectionHeader icon={Building2} title="Professional Tax (PT)" subtitle="State-wise professional tax deduction" accentColor="text-purple-600" accentBg="bg-purple-100" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Enable Professional Tax Deduction</span>
              <div onClick={() => setForm(f => ({ ...f, professionalTaxEnabled: !f.professionalTaxEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.professionalTaxEnabled ? 'bg-primary' : 'bg-border'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.professionalTaxEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>
            </div>
            {form.professionalTaxEnabled ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-purple-50 border border-purple-200">
                <p className="text-xs text-purple-700">Professional Tax is deducted as per the state-wise slabs. Define the slab amounts for each state in the Professional Tax module.</p>
                <button type="button" onClick={onManageSlabs} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors shadow-sm">Manage State Slabs <ChevronRight size={12} /></button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Professional Tax deduction is disabled — no PT will be deducted during payroll processing.</p>
            )}
          </div>

          {/* NPS */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <SectionHeader icon={PiggyBank} title="National Pension System (NPS)" subtitle="Optional NPS contribution rates" accentColor="text-teal-600" accentBg="bg-teal-100" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Enable NPS</span>
              <div onClick={() => setForm(f => ({ ...f, npsEnabled: !f.npsEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.npsEnabled ? 'bg-primary' : 'bg-border'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.npsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>
            </div>
            {form.npsEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Employee NPS Rate (%)"><input type="number" className={inputCls} min={0} max={100} step={0.5} value={form.npsEmployeeRate} onChange={e => setForm(f => ({ ...f, npsEmployeeRate: parseFloat(e.target.value) || 0 }))} /></Field>
                <Field label="Employer NPS Rate (%)"><input type="number" className={inputCls} min={0} max={100} step={0.5} value={form.npsEmployerRate} onChange={e => setForm(f => ({ ...f, npsEmployerRate: parseFloat(e.target.value) || 0 }))} /></Field>
              </div>
            )}
          </div>

          {/* Gratuity */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <SectionHeader icon={Wallet} title="Gratuity" subtitle="Gratuity formula, eligibility and accrual provision" accentColor="text-amber-600" accentBg="bg-amber-100" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Enable Gratuity</span>
              <div onClick={() => setForm(f => ({ ...f, gratuityEnabled: !f.gratuityEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.gratuityEnabled ? 'bg-primary' : 'bg-border'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.gratuityEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>
            </div>
            {form.gratuityEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Field label="Gratuity Formula" hint="Display formula used on the Gratuity statement"><input type="text" className={inputCls} value={form.gratuityFormula} onChange={e => setForm(f => ({ ...f, gratuityFormula: e.target.value }))} placeholder="(Basic + DA) × 15/26 × Years of Service" /></Field></div>
                <Field label="Min. Years for Eligibility"><input type="number" className={inputCls} min={0} max={15} value={form.gratuityMinYears} onChange={e => setForm(f => ({ ...f, gratuityMinYears: parseInt(e.target.value) || 0 }))} /></Field>
                <div className="flex items-end">
                  <div className="flex items-center justify-between gap-3 w-full p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-xs font-medium text-amber-800">Track monthly accrual / liability</span>
                    <div onClick={() => setForm(f => ({ ...f, gratuityAccrualEnabled: !f.gratuityAccrualEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${form.gratuityAccrualEnabled ? 'bg-amber-600' : 'bg-border'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.gratuityAccrualEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Statutory Bonus */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <SectionHeader icon={Receipt} title="Statutory Bonus (Bonus Act)" subtitle="Annual bonus percentage, wage ceiling & eligibility" accentColor="text-rose-600" accentBg="bg-rose-100" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Enable Statutory Bonus</span>
              <div onClick={() => setForm(f => ({ ...f, bonusEnabled: !f.bonusEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.bonusEnabled ? 'bg-primary' : 'bg-border'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.bonusEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>
            </div>
            {form.bonusEnabled && (
              <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Minimum Bonus (%)" hint="Statutory minimum (8.33%) — used in CTC"><div className="relative"><Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="number" className={`${inputCls} pl-9`} min={0} max={20} step={0.01} value={form.bonusMinPercentage} onChange={e => setForm(f => ({ ...f, bonusMinPercentage: parseFloat(e.target.value) || 0 }))} /></div></Field>
                <Field label="Maximum Bonus (%)" hint="Statutory maximum (20%)"><div className="relative"><Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="number" className={`${inputCls} pl-9`} min={0} max={100} step={0.01} value={form.bonusMaxPercentage} onChange={e => setForm(f => ({ ...f, bonusMaxPercentage: parseFloat(e.target.value) || 0 }))} /></div></Field>
                <Field label="Calculation Wage Ceiling (₹/mo)" hint="Bonus computed on min(bonus wages, this)"><input type="number" className={inputCls} min={0} step={500} value={form.bonusWageCeiling} onChange={e => setForm(f => ({ ...f, bonusWageCeiling: parseInt(e.target.value) || 0 }))} /></Field>
                <Field label="Bonus Eligibility Wages (₹/mo)" hint="Employees with bonus wages up to this are eligible"><input type="number" className={inputCls} min={0} step={1000} value={form.bonusEligibilityLimit} onChange={e => setForm(f => ({ ...f, bonusEligibilityLimit: parseInt(e.target.value) || 0 }))} /></Field>
              </div>
              <WageComponentPicker field="bonusWageComponents" accent="bg-rose-600" fallback="Basic only" />
              <div className="rounded-lg border border-border p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" checked={form.bonusExgratiaEnabled} onChange={e => setForm(f => ({ ...f, bonusExgratiaEnabled: e.target.checked }))} className="rounded border-border" />
                  Pay Ex-gratia to employees above the eligibility wage
                </label>
                <p className="text-xs text-muted-foreground">When enabled, employees whose bonus wages exceed the eligibility limit (and so are not eligible for statutory bonus) are instead paid ex-gratia at the rate below, on min(bonus wages, calculation ceiling).</p>
                {form.bonusExgratiaEnabled && (
                  <Field label="Ex-gratia (%)" hint="Applied to the bonus wage base (capped at the calculation ceiling)"><div className="relative max-w-xs"><Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="number" className={`${inputCls} pl-9`} min={0} max={100} step={0.01} value={form.bonusExgratiaPercentage} onChange={e => setForm(f => ({ ...f, bonusExgratiaPercentage: parseFloat(e.target.value) || 0 }))} /></div></Field>
                )}
              </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const PT_GENDERS: ProfessionalTaxSlab['gender'][] = ['All', 'Male', 'Female'];

function ProfessionalTaxView({ slabs, onUpdate, onBack }: { slabs: ProfessionalTaxSlab[]; onUpdate: (s: ProfessionalTaxSlab[]) => void; onBack: () => void }) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ProfessionalTaxSlab | null>(null);
  const [deleteItem, setDeleteItem] = useState<ProfessionalTaxSlab | null>(null);

  const emptyForm = (): Omit<ProfessionalTaxSlab, 'id'> => ({
    state: 'Tamil Nadu', gender: 'All', fromAmount: 0, toAmount: 0, monthlyAmount: 0, specialNote: '', isActive: true,
  });
  const [form, setForm] = useState<Omit<ProfessionalTaxSlab, 'id'>>(emptyForm());

  const usedStates = [...new Set(slabs.map(s => s.state))].sort();
  const filtered = useMemo(() =>
    slabs
      .filter(s => stateFilter === 'All' || s.state === stateFilter)
      .filter(s => s.state.toLowerCase().includes(search.toLowerCase()) || s.specialNote.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.state.localeCompare(b.state) || a.fromAmount - b.fromAmount),
    [slabs, stateFilter, search],
  );

  // Group filtered slabs by state for display.
  const grouped = useMemo(() => {
    const m = new Map<string, ProfessionalTaxSlab[]>();
    filtered.forEach(s => { if (!m.has(s.state)) m.set(s.state, []); m.get(s.state)!.push(s); });
    return [...m.entries()];
  }, [filtered]);

  const openAdd = () => { setEditingItem(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (s: ProfessionalTaxSlab) => {
    setEditingItem(s);
    setForm({ state: s.state, gender: s.gender, fromAmount: s.fromAmount, toAmount: s.toAmount, monthlyAmount: s.monthlyAmount, specialNote: s.specialNote, isActive: s.isActive });
    setModal(true);
  };

  const saveItem = () => {
    if (!form.state.trim()) { toast.error('State is required.'); return; }
    if (form.toAmount > 0 && form.fromAmount > form.toAmount) { toast.error('From amount must not exceed To amount.'); return; }
    let next: ProfessionalTaxSlab[];
    if (editingItem) {
      next = slabs.map(s => s.id === editingItem.id ? { ...s, ...form } : s);
      toast.success('Professional Tax slab updated.');
    } else {
      next = [...slabs, { ...form, id: `PT-${Date.now()}` }];
      toast.success('Professional Tax slab added.');
    }
    onUpdate(next);
    setModal(false);
  };

  const confirmDelete = () => {
    if (!deleteItem) return;
    onUpdate(slabs.filter(s => s.id !== deleteItem.id));
    toast.info('Professional Tax slab deleted.');
    setDeleteItem(null);
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-purple-100 rounded-lg"><Building2 size={22} className="text-purple-600" /></div>
              <div><h1 className="text-xl font-bold font-serif">Professional Tax Slabs</h1><p className="text-xs text-muted-foreground">Define state-wise professional tax slabs by monthly gross salary.</p></div>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"><Plus size={16} /> Add Slab</button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search states / notes..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              <option value="All">All States ({usedStates.length})</option>
              {usedStates.map(st => <option key={st}>{st}</option>)}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {slabs.length} slabs</div>
          </div>

          {grouped.length > 0 ? (
            <div className="space-y-6">
              {grouped.map(([state, stateSlabs]) => (
                <div key={state} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-accent/30 flex items-center gap-2">
                    <Building2 size={15} className="text-purple-600" />
                    <h3 className="font-bold text-sm">{state}</h3>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{stateSlabs.length} slab{stateSlabs.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr><th className="px-5 py-2.5 font-semibold">Monthly Gross Range</th><th className="px-5 py-2.5 font-semibold">Applies To</th><th className="px-5 py-2.5 font-semibold">PT / Month</th><th className="px-5 py-2.5 font-semibold">Note</th><th className="px-5 py-2.5 font-semibold">Status</th><th className="px-5 py-2.5 font-semibold text-center">Action</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stateSlabs.map(s => (
                          <tr key={s.id} className="hover:bg-accent/30 transition-colors group">
                            <td className="px-5 py-3 font-semibold text-sm">{fmt(s.fromAmount)} – {s.toAmount >= 99999999 || s.toAmount === 0 ? 'Above' : fmt(s.toAmount)}</td>
                            <td className="px-5 py-3 text-sm text-muted-foreground">{s.gender}</td>
                            <td className="px-5 py-3"><span className={`font-bold text-sm ${s.monthlyAmount === 0 ? 'text-green-600' : 'text-purple-700'}`}>{fmt(s.monthlyAmount)}</span></td>
                            <td className="px-5 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{s.specialNote || '—'}</td>
                            <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />{s.isActive ? 'Active' : 'Inactive'}</span></td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                                <button onClick={() => setDeleteItem(s)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Building2 size={28} className="text-purple-600" /></div>
              <p className="font-semibold text-muted-foreground">No professional tax slabs defined</p>
              <button onClick={openAdd} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto"><Plus size={15} /> Add Slab</button>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <Modal title={editingItem ? `Edit PT Slab — ${editingItem.state}` : 'Add Professional Tax Slab'} onClose={() => setModal(false)} wide>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="State" required>
                  <select className={selectCls} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                    {INDIAN_STATES.map(st => <option key={st}>{st}</option>)}
                  </select>
                </Field>
                <Field label="Applies To" hint="Slab applicability by gender">
                  <select className={selectCls} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value as ProfessionalTaxSlab['gender'] }))}>
                    {PT_GENDERS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Monthly Gross From (₹)" required>
                  <input type="number" min={0} step={1000} className={inputCls} value={form.fromAmount} onChange={e => setForm(f => ({ ...f, fromAmount: parseInt(e.target.value) || 0 }))} />
                </Field>
                <Field label="Monthly Gross To (₹)" hint="Use 0 (or leave blank) for the highest 'and above' slab">
                  <input type="number" min={0} step={1000} className={inputCls} value={form.toAmount} onChange={e => setForm(f => ({ ...f, toAmount: parseInt(e.target.value) || 0 }))} />
                </Field>
                <Field label="Professional Tax / Month (₹)" required>
                  <input type="number" min={0} step={10} className={inputCls} value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: parseInt(e.target.value) || 0 }))} />
                </Field>
                <Field label="Status">
                  <select className={selectCls} value={form.isActive ? 'Active' : 'Inactive'} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'Active' }))}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Special Note" hint="e.g. ₹300 levied only in February (Maharashtra / Tamil Nadu)">
                    <input type="text" className={inputCls} placeholder="Optional" value={form.specialNote} onChange={e => setForm(f => ({ ...f, specialNote: e.target.value }))} />
                  </Field>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveItem} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">{editingItem ? 'Save Changes' : 'Add Slab'}</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-destructive/5"><Trash2 size={20} className="text-destructive" /><h2 className="text-base font-bold">Delete PT Slab</h2></div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-accent/30 rounded-xl border border-border">
                  <p className="font-bold text-sm">{deleteItem.state} · {deleteItem.gender}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmt(deleteItem.fromAmount)} – {deleteItem.toAmount >= 99999999 || deleteItem.toAmount === 0 ? 'Above' : fmt(deleteItem.toAmount)} → {fmt(deleteItem.monthlyAmount)}/month</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border bg-destructive/5 border-destructive/20"><AlertCircle size={16} className="shrink-0 mt-0.5 text-destructive" /><p className="text-xs text-destructive">This action cannot be undone.</p></div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setDeleteItem(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="px-6 py-2 bg-destructive text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">Delete Slab</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TDS_APPLIES_TO: TDSSlab['gender'][] = ['All', 'Male', 'Female', 'Senior Citizen', 'Super Senior Citizen'];

function TDSSlabsView({ slabs, onUpdate, onBack }: { slabs: TDSSlab[]; onUpdate: (s: TDSSlab[]) => void; onBack: () => void }) {
  const fys = [...new Set([...slabs.map(s => s.financialYear), '2025-26'])].sort().reverse();
  const [regimeFilter, setRegimeFilter] = useState<'Old' | 'New'>('New');
  const [fyFilter, setFyFilter] = useState<string>(fys[0] ?? '2025-26');
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TDSSlab | null>(null);
  const [deleteItem, setDeleteItem] = useState<TDSSlab | null>(null);

  const emptyForm = (): Omit<TDSSlab, 'id'> => ({
    financialYear: fyFilter, regime: regimeFilter, gender: 'All',
    fromAmount: 0, toAmount: 0, taxRate: 0, surchargeRate: 0, cessRate: 4, description: '',
  });
  const [form, setForm] = useState<Omit<TDSSlab, 'id'>>(emptyForm());

  const filteredSlabs = slabs
    .filter(s => s.regime === regimeFilter && s.financialYear === fyFilter)
    .sort((a, b) => a.fromAmount - b.fromAmount);

  const openAdd = () => { setEditingItem(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (s: TDSSlab) => {
    setEditingItem(s);
    setForm({ financialYear: s.financialYear, regime: s.regime, gender: s.gender, fromAmount: s.fromAmount, toAmount: s.toAmount, taxRate: s.taxRate, surchargeRate: s.surchargeRate, cessRate: s.cessRate, description: s.description });
    setModal(true);
  };

  const saveItem = () => {
    if (form.toAmount > 0 && form.fromAmount > form.toAmount) { toast.error('From amount must not exceed To amount.'); return; }
    let next: TDSSlab[];
    if (editingItem) { next = slabs.map(s => s.id === editingItem.id ? { ...s, ...form } : s); toast.success('Tax slab updated.'); }
    else { next = [...slabs, { ...form, id: `TDS-${Date.now()}` }]; toast.success('Tax slab added.'); }
    onUpdate(next);
    setModal(false);
  };

  const confirmDelete = () => { if (!deleteItem) return; onUpdate(slabs.filter(s => s.id !== deleteItem.id)); toast.info('Tax slab deleted.'); setDeleteItem(null); };
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-rose-100 rounded-lg"><Receipt size={22} className="text-rose-600" /></div>
              <div><h1 className="text-xl font-bold font-serif">Income Tax / TDS Slab Configuration</h1><p className="text-xs text-muted-foreground">Define annual income-tax slabs per financial year and regime. Payroll computes TDS from these.</p></div>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"><Plus size={16} /> Add Slab</button>
          </div>
        </div>
        <div className="px-8 py-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-muted-foreground">Financial Year:</span>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
              {[...new Set([...fys, ...FINANCIAL_YEARS])].map(fy => <option key={fy}>{fy}</option>)}
            </select>
            <span className="text-sm font-bold text-muted-foreground ml-2">Regime:</span>
            <div className="flex items-center border border-border rounded-xl overflow-hidden">
              {(['New', 'Old'] as const).map(regime => <button key={regime} onClick={() => setRegimeFilter(regime)} className={`px-5 py-2 text-sm font-semibold transition-all ${regimeFilter === regime ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}>{regime} Regime</button>)}
            </div>
            <span className="ml-auto text-xs text-muted-foreground">{filteredSlabs.length} slab{filteredSlabs.length !== 1 ? 's' : ''}</span>
          </div>
          {filteredSlabs.length > 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr><th className="px-4 py-3 font-semibold">#</th><th className="px-4 py-3 font-semibold">Income Range (annual)</th><th className="px-4 py-3 font-semibold">Applies To</th><th className="px-4 py-3 font-semibold">Tax Rate</th><th className="px-4 py-3 font-semibold">Surcharge</th><th className="px-4 py-3 font-semibold">Cess</th><th className="px-4 py-3 font-semibold text-center">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSlabs.map((slab, i) => (
                      <tr key={slab.id} className="hover:bg-accent/30 transition-colors group">
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-sm">{fmt(slab.fromAmount)} – {slab.toAmount >= 999999999 || slab.toAmount === 0 ? 'Above' : fmt(slab.toAmount)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{slab.gender}</td>
                        <td className="px-4 py-3"><span className={`font-bold text-sm ${slab.taxRate === 0 ? 'text-green-600' : slab.taxRate <= 10 ? 'text-amber-600' : slab.taxRate <= 20 ? 'text-orange-600' : 'text-red-600'}`}>{slab.taxRate}%</span></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{slab.surchargeRate}%</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{slab.cessRate}%</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(slab)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteItem(slab)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Receipt size={28} className="text-rose-600" /></div>
              <p className="font-semibold text-muted-foreground">No tax slabs for {regimeFilter} Regime · FY {fyFilter}</p>
              <button onClick={openAdd} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto"><Plus size={15} /> Add Slab</button>
            </div>
          )}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">Payroll annualises each employee's projected income, applies the <strong>Standard Deduction</strong> (₹75,000 New / ₹50,000 Old), then these slab rates + cess for the employee's regime, and spreads the balance over the remaining months as monthly TDS.</p>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <Modal title={editingItem ? 'Edit Tax Slab' : 'Add Tax Slab'} onClose={() => setModal(false)} wide>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Financial Year" required>
                  <select className={selectCls} value={form.financialYear} onChange={e => setForm(f => ({ ...f, financialYear: e.target.value }))}>
                    {[...new Set([...fys, ...FINANCIAL_YEARS])].map(fy => <option key={fy}>{fy}</option>)}
                  </select>
                </Field>
                <Field label="Tax Regime" required>
                  <select className={selectCls} value={form.regime} onChange={e => setForm(f => ({ ...f, regime: e.target.value as TDSSlab['regime'] }))}>
                    <option value="New">New Regime</option><option value="Old">Old Regime</option>
                  </select>
                </Field>
                <Field label="Applies To" hint="Use Senior/Super Senior for Old-regime age slabs">
                  <select className={selectCls} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value as TDSSlab['gender'] }))}>
                    {TDS_APPLIES_TO.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <div />
                <Field label="Income From (₹/yr)" required><input type="number" min={0} step={10000} className={inputCls} value={form.fromAmount} onChange={e => setForm(f => ({ ...f, fromAmount: parseInt(e.target.value) || 0 }))} /></Field>
                <Field label="Income To (₹/yr)" hint="0 = no upper limit ('and above')"><input type="number" min={0} step={10000} className={inputCls} value={form.toAmount} onChange={e => setForm(f => ({ ...f, toAmount: parseInt(e.target.value) || 0 }))} /></Field>
                <Field label="Tax Rate (%)" required><input type="number" min={0} max={50} step={1} className={inputCls} value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))} /></Field>
                <Field label="Surcharge (%)"><input type="number" min={0} max={50} step={1} className={inputCls} value={form.surchargeRate} onChange={e => setForm(f => ({ ...f, surchargeRate: parseFloat(e.target.value) || 0 }))} /></Field>
                <Field label="Health & Education Cess (%)"><input type="number" min={0} max={10} step={0.5} className={inputCls} value={form.cessRate} onChange={e => setForm(f => ({ ...f, cessRate: parseFloat(e.target.value) || 0 }))} /></Field>
                <div />
                <div className="md:col-span-2"><Field label="Description"><input type="text" className={inputCls} placeholder="e.g. ₹3L–₹6L @ 5% (New Regime)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveItem} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">{editingItem ? 'Save Changes' : 'Add Slab'}</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-destructive/5"><Trash2 size={20} className="text-destructive" /><h2 className="text-base font-bold">Delete Tax Slab</h2></div>
              <div className="p-6"><div className="p-4 bg-accent/30 rounded-xl border border-border"><p className="font-bold text-sm">{deleteItem.regime} Regime · FY {deleteItem.financialYear}</p><p className="text-xs text-muted-foreground mt-1">{fmt(deleteItem.fromAmount)} – {deleteItem.toAmount >= 999999999 || deleteItem.toAmount === 0 ? 'Above' : fmt(deleteItem.toAmount)} @ {deleteItem.taxRate}%</p></div></div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setDeleteItem(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="px-6 py-2 bg-destructive text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LOAN_WORKFLOW_META: Record<LoanApprovalWorkflow, { label: string; badge: string; hint: string }> = {
  SingleHR: { label: 'Single HR / Admin approval', badge: 'bg-blue-100 text-blue-700 border-blue-200', hint: 'HR/Admin reviews and approves & disburses in one step.' },
  TwoStage: { label: 'Two-stage (Manager → HR)', badge: 'bg-violet-100 text-violet-700 border-violet-200', hint: 'Reporting manager approves first, then HR approves & disburses.' },
  AutoWithinLimits: { label: 'Auto-approve within limits', badge: 'bg-green-100 text-green-700 border-green-200', hint: 'Auto-approved if within max amount & tenure; otherwise routed to HR.' },
};
const LOAN_WORKFLOWS: LoanApprovalWorkflow[] = ['SingleHR', 'TwoStage', 'AutoWithinLimits'];

function LoanTypesView({ loanTypes, onUpdate, onBack }: { loanTypes: LoanType[]; onUpdate: (l: LoanType[]) => void; onBack: () => void }) {
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LoanType | null>(null);
  const [deleteItem, setDeleteItem] = useState<LoanType | null>(null);

  const emptyForm = (): Omit<LoanType, 'id' | 'createdAt'> => ({
    name: '', code: '', maxAmount: 100000, maxTenureMonths: 12, interestRate: 10, isInterestFree: false,
    eligibilityMonths: 6, maxAmountMultiplier: 0, deductionHead: 'Loan Recovery', approvalWorkflow: 'SingleHR',
    isActive: true, description: '',
  });
  const [form, setForm] = useState<Omit<LoanType, 'id' | 'createdAt'>>(emptyForm());

  const openAdd = () => { setEditingItem(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (lt: LoanType) => {
    setEditingItem(lt);
    setForm({ name: lt.name, code: lt.code, maxAmount: lt.maxAmount, maxTenureMonths: lt.maxTenureMonths, interestRate: lt.interestRate, isInterestFree: lt.isInterestFree, eligibilityMonths: lt.eligibilityMonths, maxAmountMultiplier: lt.maxAmountMultiplier, deductionHead: lt.deductionHead, approvalWorkflow: lt.approvalWorkflow, isActive: lt.isActive, description: lt.description });
    setModal(true);
  };

  const saveItem = () => {
    if (!form.name.trim()) { toast.error('Loan type name is required.'); return; }
    if (!form.code.trim()) { toast.error('Loan type code is required.'); return; }
    const codeExists = loanTypes.some(l => l.code.toLowerCase() === form.code.trim().toLowerCase() && (editingItem ? l.id !== editingItem.id : true));
    if (codeExists) { toast.error('Loan type code already exists.'); return; }
    const cleaned = { ...form, interestRate: form.isInterestFree ? 0 : form.interestRate };
    let next: LoanType[];
    if (editingItem) {
      next = loanTypes.map(l => l.id === editingItem.id ? { ...l, ...cleaned } : l);
      toast.success('Loan type updated.');
    } else {
      next = [...loanTypes, { ...cleaned, id: `LT-${Date.now()}`, createdAt: '' }];
      toast.success('Loan type created.');
    }
    onUpdate(next);
    setModal(false);
  };

  const confirmDelete = () => {
    if (!deleteItem) return;
    onUpdate(loanTypes.filter(l => l.id !== deleteItem.id));
    toast.info('Loan type deleted.');
    setDeleteItem(null);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-violet-100 rounded-lg"><CreditCard size={22} className="text-violet-600" /></div>
              <div><h1 className="text-xl font-bold font-serif">Loan & Advance Types</h1><p className="text-xs text-muted-foreground">Configure loan types, rates, tenure & eligibility limits, and the approval workflow.</p></div>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"><Plus size={16} /> Add Loan Type</button>
          </div>
        </div>
        <div className="px-8 py-6">
          {loanTypes.length === 0 ? (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><CreditCard size={28} className="text-violet-600" /></div>
              <p className="font-semibold text-muted-foreground">No loan / advance types defined</p>
              <button onClick={openAdd} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto"><Plus size={15} /> Add Loan Type</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {loanTypes.map((lt, i) => (
                <motion.div key={lt.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden group">
                  <div className={`h-1.5 w-full ${lt.isActive ? 'bg-violet-400' : 'bg-gray-300'}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div><div className="flex items-center gap-2"><h3 className="font-bold text-sm">{lt.name}</h3>{lt.isInterestFree && <span className="text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">Interest-Free</span>}</div><span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{lt.code}</span></div>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(lt)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteItem(lt)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${lt.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${lt.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />{lt.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-accent/40 rounded-lg p-2.5 text-center"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Max Amount</p><p className="text-sm font-bold">₹{(lt.maxAmount / 1000).toFixed(0)}K</p></div>
                      <div className="bg-accent/40 rounded-lg p-2.5 text-center"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Max Tenure</p><p className="text-sm font-bold">{lt.maxTenureMonths}m</p></div>
                      <div className="bg-accent/40 rounded-lg p-2.5 text-center"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Interest</p><p className="text-sm font-bold">{lt.isInterestFree ? '0%' : `${lt.interestRate}%`}</p></div>
                      <div className="bg-accent/40 rounded-lg p-2.5 text-center"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Eligibility</p><p className="text-sm font-bold">{lt.eligibilityMonths}m</p></div>
                    </div>
                    <div className="mb-2"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${LOAN_WORKFLOW_META[lt.approvalWorkflow].badge}`}><ShieldCheck size={10} /> {LOAN_WORKFLOW_META[lt.approvalWorkflow].label}</span></div>
                    {lt.description && <p className="text-[11px] text-muted-foreground italic truncate">{lt.description}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <Modal title={editingItem ? `Edit Loan Type — ${editingItem.name}` : 'Add Loan / Advance Type'} onClose={() => setModal(false)} wide>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Name" required><input type="text" className={inputCls} placeholder="e.g. Personal Loan" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
                <Field label="Code" required><input type="text" className={`${inputCls} font-mono uppercase`} placeholder="e.g. PL" maxLength={12} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></Field>
                <Field label="Max Amount (₹)" required><input type="number" min={0} step={1000} className={inputCls} value={form.maxAmount} onChange={e => setForm(f => ({ ...f, maxAmount: parseInt(e.target.value) || 0 }))} /></Field>
                <Field label="Max Tenure (months)" required><input type="number" min={1} max={120} className={inputCls} value={form.maxTenureMonths} onChange={e => setForm(f => ({ ...f, maxTenureMonths: parseInt(e.target.value) || 0 }))} /></Field>
                <Field label="Interest Rate (% p.a.)" hint="Disabled when interest-free"><input type="number" min={0} max={36} step={0.5} disabled={form.isInterestFree} className={`${inputCls} ${form.isInterestFree ? 'opacity-50' : ''}`} value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: parseFloat(e.target.value) || 0 }))} /></Field>
                <Field label="Eligibility (months of service)"><input type="number" min={0} className={inputCls} value={form.eligibilityMonths} onChange={e => setForm(f => ({ ...f, eligibilityMonths: parseInt(e.target.value) || 0 }))} /></Field>
                <Field label="Max Amount Multiplier" hint="Cap = multiplier × monthly gross (0 = ignore)"><input type="number" min={0} step={0.5} className={inputCls} value={form.maxAmountMultiplier} onChange={e => setForm(f => ({ ...f, maxAmountMultiplier: parseFloat(e.target.value) || 0 }))} /></Field>
                <Field label="Deduction Head"><input type="text" className={inputCls} placeholder="e.g. Loan Recovery" value={form.deductionHead} onChange={e => setForm(f => ({ ...f, deductionHead: e.target.value }))} /></Field>
                <div className="md:col-span-2">
                  <Field label="Approval Workflow" required hint={LOAN_WORKFLOW_META[form.approvalWorkflow].hint}>
                    <select className={selectCls} value={form.approvalWorkflow} onChange={e => setForm(f => ({ ...f, approvalWorkflow: e.target.value as LoanApprovalWorkflow }))}>
                      {LOAN_WORKFLOWS.map(w => <option key={w} value={w}>{LOAN_WORKFLOW_META[w].label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="md:col-span-2"><ToggleSwitch value={form.isInterestFree} onChange={v => setForm(f => ({ ...f, isInterestFree: v, interestRate: v ? 0 : f.interestRate }))} label="Interest-Free Advance" description="No interest is charged; EMI = principal ÷ tenure" /></div>
                <div className="md:col-span-2"><ToggleSwitch value={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} label="Active" description="Available for new loan applications" /></div>
                <div className="md:col-span-2"><Field label="Description"><textarea className={`${inputCls} resize-none`} rows={2} placeholder="Brief description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveItem} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">{editingItem ? 'Save Changes' : 'Create Loan Type'}</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-destructive/5"><Trash2 size={20} className="text-destructive" /><h2 className="text-base font-bold">Delete Loan Type</h2></div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-accent/30 rounded-xl border border-border"><p className="font-bold text-sm">{deleteItem.name} <span className="font-mono text-[10px] text-muted-foreground">{deleteItem.code}</span></p></div>
                <div className="flex items-start gap-3 p-3 rounded-xl border bg-destructive/5 border-destructive/20"><AlertCircle size={16} className="shrink-0 mt-0.5 text-destructive" /><p className="text-xs text-destructive">Existing loans of this type are not affected, but it will no longer be selectable. This cannot be undone.</p></div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setDeleteItem(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="px-6 py-2 bg-destructive text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Payroll Setup Sub-Modules ────────────────────────────────────────────────

const PAYROLL_MODULES = [
  { key: 'payroll-period' as PayrollSetupModule, title: 'Payroll Period', description: 'Define payroll periods with From and To Dates, payment dates, and manage period lifecycle from Open to Locked.', icon: CalendarRange, color: 'bg-indigo-100', iconColor: 'text-indigo-600', tags: ['From Date', 'To Date', 'Payment Date', 'Period Lifecycle'] },
  { key: 'salary-components' as PayrollSetupModule, title: 'Salary Components', description: 'Define earnings, deductions, employer contributions, and reimbursements with calculation rules.', icon: DollarSign, color: 'bg-green-100', iconColor: 'text-green-600', tags: ['Earnings', 'Deductions', 'PF/ESI', 'Reimbursements'] },
  { key: 'pay-heads' as PayrollSetupModule, title: 'Pay Heads', description: 'Configure accounting pay heads and ledger groups for payroll journal entries.', icon: BookOpen, color: 'bg-blue-100', iconColor: 'text-blue-600', tags: ['Ledger Groups', 'Accounting', 'Journal Entries'] },
  { key: 'pf-esi' as PayrollSetupModule, title: 'Payroll Settings', description: 'Configure PF, ESI, Professional Tax, NPS, Gratuity and Statutory Bonus rates, ceilings and applicability.', icon: Shield, color: 'bg-emerald-100', iconColor: 'text-emerald-600', tags: ['PF', 'ESI', 'PT', 'NPS', 'Gratuity', 'Bonus'] },
  { key: 'tds-slabs' as PayrollSetupModule, title: 'TDS / Income Tax Slabs', description: 'Define income tax slabs for Old and New tax regimes with surcharge and cess rates.', icon: Receipt, color: 'bg-rose-100', iconColor: 'text-rose-600', tags: ['Old Regime', 'New Regime', 'Surcharge', 'Cess'] },
  { key: 'professional-tax' as PayrollSetupModule, title: 'Professional Tax', description: 'Define state-wise professional tax slabs by monthly gross salary. Enable/disable PT deduction in Payroll Settings.', icon: Building2, color: 'bg-purple-100', iconColor: 'text-purple-600', tags: ['State-wise', 'Slabs', 'Monthly PT'] },
  { key: 'loan-types' as PayrollSetupModule, title: 'Loan & Advance Types', description: 'Configure loan types, interest rates, tenure limits, and eligibility criteria for employee loans.', icon: CreditCard, color: 'bg-violet-100', iconColor: 'text-violet-600', tags: ['Interest Rates', 'Tenure', 'Eligibility', 'Advances'] },
  {
    key: 'salary-structure' as PayrollSetupModule,
    title: 'Salary Structures',
    description: 'Create salary structure templates. Each component can be Fixed, Variable (set per employee), or Custom Listed Values (e.g. ₹1,000 / ₹2,000 / ₹5,000).',
    icon: Layers,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    tags: ['Fixed', 'Variable (Employee-wise)', 'Custom Listed Values', 'CTC Breakup'],
  },
  { key: 'salary-structure-assignment' as PayrollSetupModule, title: 'Salary Structure Assignment', description: 'Assign salary structures to employees with CTC amounts, component overrides (including variable component values), and effective dates.', icon: Users, color: 'bg-orange-100', iconColor: 'text-orange-600', tags: ['Employee-wise CTC', 'Variable Values', 'Component Overrides', 'Effective Dates'] },
];

// ─── Main Payroll Setup Component ─────────────────────────────────────────────

interface PayrollSetupProps {
  onBack: () => void;
}

export default function PayrollSetup({ onBack }: PayrollSetupProps) {
  const [activeModule, setActiveModule] = useState<PayrollSetupModule>('home');

  // All payroll-setup data is stored in and retrieved from Supabase only.
  const periodsTable = useTable<DbRow>('payroll_periods', { orderBy: { column: 'from_date', ascending: true } });
  const componentsTable = useTable<DbRow>('salary_components', { orderBy: { column: 'created_at', ascending: true } });
  const payHeadsTable = useTable<DbRow>('pay_heads', { orderBy: { column: 'created_at', ascending: true } });
  const tdsTable = useTable<DbRow>('tds_slabs', { orderBy: { column: 'from_amount', ascending: true } });
  const ptTable = useTable<DbRow>('professional_tax_slabs', { orderBy: { column: 'state', ascending: true } });
  const loanTypesTable = useTable<DbRow>('loan_types', { orderBy: { column: 'created_at', ascending: true } });
  const structuresTable = useTable<DbRow>('salary_structures', { orderBy: { column: 'created_at', ascending: true } });
  const sscTable = useTable<DbRow>('salary_structure_components');
  const pfEsiTable = useTable<DbRow>('pf_esi_config');

  const payrollPeriods = useMemo(() => periodsTable.rows.map(rowToPeriod), [periodsTable.rows]);
  const components = useMemo(() => componentsTable.rows.map(rowToComponent), [componentsTable.rows]);
  const payHeads = useMemo(() => payHeadsTable.rows.map(rowToPayHead), [payHeadsTable.rows]);
  const tdsSlabs = useMemo(() => tdsTable.rows.map(rowToTdsSlab), [tdsTable.rows]);
  const ptSlabs = useMemo(() => ptTable.rows.map(rowToPtSlab), [ptTable.rows]);
  const loanTypes = useMemo(() => loanTypesTable.rows.map(rowToLoanType), [loanTypesTable.rows]);
  const componentsById = useMemo(() => new Map(components.map(c => [c.id, c])), [components]);
  const salaryStructures = useMemo(
    () => structuresTable.rows.map(r => rowToStructure(r, sscTable.rows, componentsById)),
    [structuresTable.rows, sscTable.rows, componentsById],
  );
  const pfEsiConfig = useMemo(() => rowToPfEsi(pfEsiTable.rows[0]), [pfEsiTable.rows]);

  const reportErr = (e: string | null) => { if (e) toast.error(e); };

  const savePeriods = async (next: PayrollPeriod[]) => reportErr(await syncTable(periodsTable, payrollPeriods, next, periodToRow));
  const saveComponents = async (next: SalaryComponent[]) => reportErr(await syncTable(componentsTable, components, next, componentToRow));
  const savePayHeads = async (next: PayHead[]) => reportErr(await syncTable(payHeadsTable, payHeads, next, payHeadToRow));
  const saveTdsSlabs = async (next: TDSSlab[]) => reportErr(await syncTable(tdsTable, tdsSlabs, next, tdsSlabToRow));
  const savePtSlabs = async (next: ProfessionalTaxSlab[]) => reportErr(await syncTable(ptTable, ptSlabs, next, ptSlabToRow));
  const saveLoanTypes = async (next: LoanType[]) => reportErr(await syncTable(loanTypesTable, loanTypes, next, loanTypeToRow));

  const savePfEsi = async (next: PFESIConfig) => {
    const existing = pfEsiTable.rows[0];
    const { error } = existing
      ? await supabase.from('pf_esi_config').update(pfEsiToRow(next) as never).eq('id', existing.id)
      : await supabase.from('pf_esi_config').insert(pfEsiToRow(next) as never);
    if (error) { toast.error(error.message); return; }
    await pfEsiTable.refetch();
    toast.success('Payroll Settings saved.');
  };

  // Salary structures: sync headers, then replace each structure's component rows.
  const saveStructures = async (next: SalaryStructure[]) => {
    const headerErr = await syncTable(structuresTable, salaryStructures, next, structureToRow);
    if (headerErr) { toast.error(headerErr); return; }
    // Resolve real structure ids (a freshly-inserted structure has a temp id until refetch).
    await structuresTable.refetch();
    const idByCode = new Map(structuresTable.rows.map(r => [(r.code as string), r.id]));
    for (const s of next) {
      const structureId = (salaryStructures.find(x => x.id === s.id)?.id) ?? idByCode.get(s.code.trim()) ?? s.id;
      const delErr = (await supabase.from('salary_structure_components').delete().eq('salary_structure_id', structureId)).error;
      if (delErr) { toast.error(delErr.message); return; }
      if (s.components.length > 0) {
        const insErr = (await supabase.from('salary_structure_components')
          .insert(s.components.map((c, i) => sscToRow(c, structureId, i)) as never)).error;
        if (insErr) { toast.error(insErr.message); return; }
      }
    }
    await sscTable.refetch();
  };

  if (activeModule === 'payroll-period') return <PayrollPeriodView periods={payrollPeriods} onUpdate={savePeriods} onBack={() => setActiveModule('home')} />;
  if (activeModule === 'salary-components') return <SalaryComponentsView components={components} onUpdate={saveComponents} onBack={() => setActiveModule('home')} />;
  if (activeModule === 'pay-heads') return <PayHeadsView payHeads={payHeads} onUpdate={savePayHeads} onBack={() => setActiveModule('home')} />;
  if (activeModule === 'pf-esi') return <PFESIView config={pfEsiConfig} onUpdate={savePfEsi} onBack={() => setActiveModule('home')} onManageSlabs={() => setActiveModule('professional-tax')} />;
  if (activeModule === 'tds-slabs') return <TDSSlabsView slabs={tdsSlabs} onUpdate={saveTdsSlabs} onBack={() => setActiveModule('home')} />;
  if (activeModule === 'professional-tax') return <ProfessionalTaxView slabs={ptSlabs} onUpdate={savePtSlabs} onBack={() => setActiveModule('home')} />;
  if (activeModule === 'loan-types') return <LoanTypesView loanTypes={loanTypes} onUpdate={saveLoanTypes} onBack={() => setActiveModule('home')} />;
  if (activeModule === 'salary-structure') return <SalaryStructureView structures={salaryStructures} components={components} onUpdate={saveStructures} onBack={() => setActiveModule('home')} />;
  if (activeModule === 'salary-structure-assignment') return <SalaryStructureAssignment onBack={() => setActiveModule('home')} />;

  const totalComponents = components.length;
  const activeComponents = components.filter(c => c.isActive).length;
  const openPeriods = payrollPeriods.filter(p => p.status === 'Open').length;
  const defaultPeriod = payrollPeriods.find(p => p.isDefault);

  // Count variable components across all structures
  const variableComponentCount = salaryStructures.reduce((s, ss) =>
    s + ss.components.filter(c => c.valueType === 'variable').length, 0
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
            <div className="p-2 bg-amber-100 rounded-lg"><Calculator size={22} className="text-amber-600" /></div>
            <div>
              <h1 className="text-xl font-bold font-serif">Payroll Setup</h1>
              <p className="text-xs text-muted-foreground">Configure payroll periods, salary components, structures (Fixed / Variable per employee / Custom Listed Values), assignments, statutory deductions, and tax slabs.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Payroll Periods', value: payrollPeriods.length, sub: `${openPeriods} open · ${defaultPeriod ? defaultPeriod.name : 'No default'}`, color: 'bg-indigo-100', iconColor: 'text-indigo-600', icon: CalendarRange },
              { label: 'Salary Components', value: totalComponents, sub: `${activeComponents} active`, color: 'bg-green-100', iconColor: 'text-green-600', icon: DollarSign },
              { label: 'PF / ESI', value: `${[pfEsiConfig.pfEnabled, pfEsiConfig.esiEnabled].filter(Boolean).length} of 2`, sub: 'Enabled', color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: Shield },
              { label: 'Variable Components', value: variableComponentCount, sub: 'Set per employee', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: UserCog },
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

          {/* Variable Component Info Banner */}
          {variableComponentCount > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <UserCog size={17} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Variable Components Configured</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  <strong>{variableComponentCount}</strong> component{variableComponentCount !== 1 ? 's' : ''} across salary structures are set as <strong>Variable (Employee-wise)</strong>. These values must be set individually for each employee in the <strong>Salary Structure Assignment</strong> module under Component Overrides.
                </p>
              </div>
              <button
                onClick={() => setActiveModule('salary-structure-assignment')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm shrink-0"
              >
                Set Employee Values <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Value Types Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Info size={17} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Salary Structure — Component Value Types</p>
              <p className="text-xs text-blue-700 mt-0.5">
                In the Salary Structure Master, each component can now be configured as:
                <strong className="text-blue-700"> Fixed</strong> (same value for all employees),
                <strong className="text-amber-700"> Variable (Employee-wise)</strong> (set individually per employee in Salary Structure Assignment), or
                <strong className="text-violet-700"> Custom Listed Values</strong> (one of a predefined list like ₹1,000 / ₹2,000 / ₹5,000).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {PAYROLL_MODULES.map((mod, i) => {
              const Icon = mod.icon;
              const getBadge = () => {
                if (mod.key === 'payroll-period') return `${payrollPeriods.length} periods`;
                if (mod.key === 'salary-components') return `${totalComponents} components`;
                if (mod.key === 'pay-heads') return `${payHeads.length} heads`;
                if (mod.key === 'pf-esi') return `${[pfEsiConfig.pfEnabled, pfEsiConfig.esiEnabled, pfEsiConfig.npsEnabled, pfEsiConfig.gratuityEnabled].filter(Boolean).length} enabled`;
                if (mod.key === 'tds-slabs') return `${tdsSlabs.length} slabs`;
                if (mod.key === 'professional-tax') return pfEsiConfig.professionalTaxEnabled ? `${ptSlabs.length} slabs` : 'Disabled';
                if (mod.key === 'loan-types') return `${loanTypes.filter(l => l.isActive).length} types`;
                if (mod.key === 'salary-structure') return `${salaryStructures.length} structures`;
                if (mod.key === 'salary-structure-assignment') return 'Employee-wise';
                return '';
              };
              return (
                <motion.button
                  key={mod.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setActiveModule(mod.key)}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all p-6 text-left group overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${mod.color} rounded-xl`}><Icon size={24} className={mod.iconColor} /></div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">{getBadge()}</span>
                      <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                  <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{mod.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mod.tags.map(tag => (
                      <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        tag === 'Fixed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        tag === 'Variable (Employee-wise)' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        tag === 'Custom Listed Values' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                        tag === 'Variable Values' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-accent text-muted-foreground border-border'
                      }`}>{tag}</span>
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
              <BarChart3 size={16} className="text-primary" />
              <h3 className="font-bold text-sm">Payroll Setup Overview</h3>
              <span className="ml-auto text-xs text-muted-foreground">Configuration status across all modules</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr><th className="px-4 py-3 font-semibold">Module</th><th className="px-4 py-3 font-semibold">Records</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { key: 'payroll-period', label: 'Payroll Periods', count: `${payrollPeriods.length} periods (${openPeriods} open)`, ok: payrollPeriods.length > 0 },
                    { key: 'salary-components', label: 'Salary Components', count: `${totalComponents} (${activeComponents} active)`, ok: totalComponents > 0 },
                    { key: 'pay-heads', label: 'Pay Heads', count: `${payHeads.length} heads`, ok: payHeads.length > 0 },
                    { key: 'pf-esi', label: 'Payroll Settings', count: `${[pfEsiConfig.pfEnabled, pfEsiConfig.esiEnabled].filter(Boolean).length} of 2 enabled`, ok: pfEsiConfig.pfEnabled || pfEsiConfig.esiEnabled },
                    { key: 'tds-slabs', label: 'TDS Slabs', count: `${tdsSlabs.length} slabs (New + Old)`, ok: tdsSlabs.length > 0 },
                    { key: 'professional-tax', label: 'Professional Tax', count: pfEsiConfig.professionalTaxEnabled ? `${ptSlabs.length} state-wise slabs` : 'Deduction disabled', ok: !pfEsiConfig.professionalTaxEnabled || ptSlabs.length > 0 },
                    { key: 'loan-types', label: 'Loan Types', count: `${loanTypes.filter(l => l.isActive).length} active types`, ok: loanTypes.length > 0 },
                    { key: 'salary-structure', label: 'Salary Structures (Fixed/Variable/Custom)', count: `${salaryStructures.filter(s => s.isActive).length} active · ${variableComponentCount} variable components`, ok: salaryStructures.length > 0 },
                    { key: 'salary-structure-assignment', label: 'Salary Structure Assignment (Variable Values)', count: 'Employee-wise CTC & variable component values', ok: true },
                  ].map((row, i) => (
                    <motion.tr key={row.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-sm">{row.label}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.count}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.ok ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${row.ok ? 'bg-green-500' : 'bg-amber-500'}`} />{row.ok ? 'Configured' : 'Not Set'}</span></td>
                      <td className="px-4 py-3"><button onClick={() => setActiveModule(row.key as PayrollSetupModule)} className="text-xs font-semibold text-primary hover:underline">Configure →</button></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}