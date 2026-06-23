// ─────────────────────────────────────────────────────────────────────────────
// Shared Salary Structure model + computation engine
//
// This module is the single source of truth for salary structures and the
// per-employee salary configuration. It is consumed by:
//   • Employee Master  → "Salary Structure" tab (writes per-employee values)
//   • Payroll          → "Run Payroll" (reads per-employee values to compute pay)
//
// A salary structure is a template of components. Each component declares HOW its
// value is set for an employee, via `valueType`:
//   • 'fixed'    — a single preset amount/percentage applied to every employee
//   • 'variable' — the amount is entered individually per employee
//   • 'custom'   — the employee must pick one of a predefined list of allowed values
// ─────────────────────────────────────────────────────────────────────────────

export type ComponentType = 'Earning' | 'Deduction' | 'Employer Contribution' | 'Reimbursement';
export type CalculationBasis = 'Fixed' | 'Percentage of Basic' | 'Percentage of Gross' | 'Percentage of CTC' | 'Formula';
export type ComponentValueType = 'fixed' | 'variable' | 'custom';

/** Statutory role a component is linked to (set in Salary Component Master). */
export type StatutoryType = 'none' | 'basic' | 'pf' | 'esi' | 'professional_tax' | 'income_tax';

/** Marks a component as the Bonus or Ex-gratia payout head (set in Salary Component Master). */
export type BonusType = 'none' | 'bonus' | 'exgratia';

export interface SalaryStructureComponent {
  componentId: string;
  componentName: string;
  componentCode: string;
  componentType: ComponentType;
  calculationBasis: CalculationBasis;
  /** Determines how the value is resolved for an employee. */
  valueType: ComponentValueType;
  /** Used when valueType === 'fixed' (amount when basis is Fixed, otherwise a %). */
  value: number;
  /** Allowed values when valueType === 'custom'. */
  customValues: number[];
  /** Default pick from customValues when valueType === 'custom'. */
  selectedCustomValue: number;
  formula: string;
  /** Statutory linkage (Basic / PF / ESI / PT / Income Tax) — for proper mapping. */
  statutoryType?: StatutoryType;
  /** Per-component round-off (from the Salary Component definition). */
  roundOff?: RoundCode;
}

/** Round-off mode applied to a component amount or the net take-home. */
export type RoundCode = 'none' | 'nearest_1' | 'nearest_10' | 'nearest_100';
export const ROUND_OPTIONS: { value: RoundCode; label: string }[] = [
  { value: 'none', label: 'None (exact)' },
  { value: 'nearest_1', label: 'Nearest ₹1' },
  { value: 'nearest_10', label: 'Nearest ₹10' },
  { value: 'nearest_100', label: 'Nearest ₹100' },
];
/** Round a value to the nearest multiple per the code. Default nearest ₹1. */
export function roundTo(value: number, code: RoundCode = 'nearest_1'): number {
  switch (code) {
    case 'none': return value;
    case 'nearest_10': return Math.round(value / 10) * 10;
    case 'nearest_100': return Math.round(value / 100) * 100;
    case 'nearest_1':
    default: return Math.round(value);
  }
}

export interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  applicableTo: string[];
  components: SalaryStructureComponent[];
  isActive: boolean;
  description: string;
}

/** Per-employee salary configuration produced by the Employee Master tab. */
export interface EmployeeSalaryStructure {
  structureId: string;
  structureName: string;
  structureCode: string;
  /** Monthly CTC — drives percentage-based components. */
  ctcMonthly: number;
  /**
   * Resolved per-employee component values keyed by componentId.
   * Only 'variable' and 'custom' components require an entry; 'fixed'
   * components always use the structure-level value.
   */
  componentValues: Record<string, number>;
  /** Voluntary PF % (extra employee PF on the PF base). */
  vpfPercentage: number;
}

// ─── Value Type Presentation ──────────────────────────────────────────────────

export const VALUE_TYPE_META: Record<ComponentValueType, {
  label: string;
  shortLabel: string;
  description: string;
  text: string;
  bg: string;
  border: string;
}> = {
  fixed: {
    label: 'Fixed',
    shortLabel: 'Fixed',
    description: 'Preset amount applied to all employees — not editable here.',
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  variable: {
    label: 'Variable (Employee-wise)',
    shortLabel: 'Variable',
    description: 'Enter the amount for this employee.',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  custom: {
    label: 'Custom Listed Values',
    shortLabel: 'Custom',
    description: 'Pick one of the allowed values for this employee.',
    text: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
};

export const COMPONENT_TYPE_META: Record<ComponentType, { text: string; bg: string; border: string }> = {
  'Earning': { text: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200' },
  'Deduction': { text: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' },
  'Employer Contribution': { text: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200' },
  'Reimbursement': { text: 'text-violet-700', bg: 'bg-violet-100', border: 'border-violet-200' },
};

// ─── Salary Structures (templates with value-type rules) ──────────────────────

export const SALARY_STRUCTURES: SalaryStructure[] = [
  {
    id: 'SS001', name: 'Standard Structure', code: 'STD', applicableTo: ['Permanent', 'Probationary'],
    isActive: true, description: 'Standard salary structure for permanent and probationary employees',
    components: [
      { componentId: 'SC001', componentName: 'Basic Salary', componentCode: 'BASIC', componentType: 'Earning', calculationBasis: 'Percentage of CTC', valueType: 'fixed', value: 40, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC002', componentName: 'House Rent Allowance', componentCode: 'HRA', componentType: 'Earning', calculationBasis: 'Percentage of Basic', valueType: 'fixed', value: 50, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC003', componentName: 'Special Allowance', componentCode: 'SPEC', componentType: 'Earning', calculationBasis: 'Fixed', valueType: 'variable', value: 5000, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC004', componentName: 'Conveyance Allowance', componentCode: 'CONV', componentType: 'Earning', calculationBasis: 'Fixed', valueType: 'fixed', value: 1600, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC005', componentName: 'Medical Allowance', componentCode: 'MED', componentType: 'Earning', calculationBasis: 'Fixed', valueType: 'custom', value: 1250, customValues: [1250, 2000, 2500], selectedCustomValue: 1250, formula: '' },
      { componentId: 'SC006', componentName: 'Provident Fund (Employee)', componentCode: 'PF_EMP', componentType: 'Deduction', calculationBasis: 'Percentage of Basic', valueType: 'fixed', value: 12, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC007', componentName: 'ESI (Employee)', componentCode: 'ESI_EMP', componentType: 'Deduction', calculationBasis: 'Percentage of Gross', valueType: 'fixed', value: 0.75, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC008', componentName: 'Professional Tax', componentCode: 'PT', componentType: 'Deduction', calculationBasis: 'Fixed', valueType: 'fixed', value: 200, customValues: [], selectedCustomValue: 0, formula: '' },
    ],
  },
  {
    id: 'SS002', name: 'Contract Structure', code: 'CONT', applicableTo: ['Contract', 'Intern'],
    isActive: true, description: 'Simplified salary structure for contract and intern employees',
    components: [
      { componentId: 'SC001', componentName: 'Basic Salary', componentCode: 'BASIC', componentType: 'Earning', calculationBasis: 'Percentage of CTC', valueType: 'fixed', value: 60, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC003', componentName: 'Special Allowance', componentCode: 'SPEC', componentType: 'Earning', calculationBasis: 'Fixed', valueType: 'variable', value: 3000, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC008', componentName: 'Professional Tax', componentCode: 'PT', componentType: 'Deduction', calculationBasis: 'Fixed', valueType: 'fixed', value: 200, customValues: [], selectedCustomValue: 0, formula: '' },
    ],
  },
  {
    id: 'SS003', name: 'Senior Management Structure', code: 'SMGMT', applicableTo: ['Management Staff'],
    isActive: true, description: 'Salary structure for senior management with reimbursements',
    components: [
      { componentId: 'SC001', componentName: 'Basic Salary', componentCode: 'BASIC', componentType: 'Earning', calculationBasis: 'Percentage of CTC', valueType: 'fixed', value: 35, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC002', componentName: 'House Rent Allowance', componentCode: 'HRA', componentType: 'Earning', calculationBasis: 'Percentage of Basic', valueType: 'fixed', value: 50, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC003', componentName: 'Special Allowance', componentCode: 'SPEC', componentType: 'Earning', calculationBasis: 'Fixed', valueType: 'variable', value: 15000, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC004', componentName: 'Conveyance Allowance', componentCode: 'CONV', componentType: 'Earning', calculationBasis: 'Fixed', valueType: 'fixed', value: 3200, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC011', componentName: 'LTA', componentCode: 'LTA', componentType: 'Reimbursement', calculationBasis: 'Fixed', valueType: 'custom', value: 10000, customValues: [10000, 15000, 25000], selectedCustomValue: 10000, formula: '' },
      { componentId: 'SC006', componentName: 'Provident Fund (Employee)', componentCode: 'PF_EMP', componentType: 'Deduction', calculationBasis: 'Percentage of Basic', valueType: 'fixed', value: 12, customValues: [], selectedCustomValue: 0, formula: '' },
      { componentId: 'SC008', componentName: 'Professional Tax', componentCode: 'PT', componentType: 'Deduction', calculationBasis: 'Fixed', valueType: 'fixed', value: 200, customValues: [], selectedCustomValue: 0, formula: '' },
    ],
  },
];

export function getStructureById(id: string): SalaryStructure | undefined {
  return SALARY_STRUCTURES.find(s => s.id === id);
}

// ─── Computation Engine ───────────────────────────────────────────────────────

/**
 * Resolve the effective input value for a component, honoring its value-type rule
 * and any per-employee override. 'fixed' always uses the structure value; 'variable'
 * and 'custom' use the per-employee value when present (falling back to the
 * structure default otherwise).
 */
export function resolveComponentValue(
  comp: SalaryStructureComponent,
  componentValues: Record<string, number> = {}
): number {
  const empValue = componentValues[comp.componentId];
  switch (comp.valueType) {
    case 'fixed':
      return comp.value;
    case 'variable':
      return empValue ?? comp.value;
    case 'custom':
      return empValue ?? comp.selectedCustomValue;
    default:
      return comp.value;
  }
}

/** Raw (unrounded) component amount; rounding is applied by the caller per-component. */
function computeAmount(basis: CalculationBasis, value: number, ctcMonthly: number, basicMonthly: number, grossMonthly: number): number {
  switch (basis) {
    case 'Fixed': return value;
    case 'Percentage of CTC': return (value / 100) * ctcMonthly;
    case 'Percentage of Basic': return (value / 100) * basicMonthly;
    case 'Percentage of Gross': return (value / 100) * grossMonthly;
    default: return value;
  }
}

export interface SalaryLineItem {
  componentId: string;
  componentName: string;
  componentCode: string;
  componentType: ComponentType;
  calculationBasis: CalculationBasis;
  valueType: ComponentValueType;
  /** The resolved input value (₹ amount for Fixed basis, % otherwise). */
  inputValue: number;
  /** The computed monthly ₹ amount. */
  amount: number;
  statutoryType?: StatutoryType;
}

export interface SalaryBreakdown {
  lineItems: SalaryLineItem[];
  earnings: SalaryLineItem[];
  deductions: SalaryLineItem[];
  reimbursements: SalaryLineItem[];
  employerContributions: SalaryLineItem[];
  basicMonthly: number;
  grossMonthly: number;        // sum of Earnings
  totalDeductions: number;     // sum of Deductions (employee)
  totalReimbursements: number; // sum of Reimbursements
  netMonthly: number;          // gross + reimbursements − deductions
}

/**
 * Compute a full monthly salary breakdown for an employee using their assigned
 * structure, monthly CTC, and per-employee component values.
 */
export function computeSalaryBreakdown(
  structure: SalaryStructure,
  ctcMonthly: number,
  componentValues: Record<string, number> = {}
): SalaryBreakdown {
  // 1) Basic first — it is the base for percentage-of-basic components. Prefer the
  // explicit statutory linkage (set in Salary Component Master); fall back to code/name.
  const basicComp = structure.components.find(c => c.statutoryType === 'basic')
    ?? structure.components.find(c => /^bas/i.test(c.componentCode) || /\bbasic\b/i.test(c.componentName));
  const basicMonthly = basicComp
    ? roundTo(computeAmount(basicComp.calculationBasis, resolveComponentValue(basicComp, componentValues), ctcMonthly, 0, 0), basicComp.roundOff)
    : 0;

  // 2) Gross from earnings (excludes reimbursements & deductions), each per-component rounded.
  const grossMonthly = structure.components
    .filter(c => c.componentType === 'Earning')
    .reduce((sum, c) => sum + roundTo(computeAmount(c.calculationBasis, resolveComponentValue(c, componentValues), ctcMonthly, basicMonthly, 0), c.roundOff), 0);

  // 3) Build line items with final amounts (per-component round-off from the component definition).
  const lineItems: SalaryLineItem[] = structure.components.map(c => {
    const inputValue = resolveComponentValue(c, componentValues);
    return {
      componentId: c.componentId,
      componentName: c.componentName,
      componentCode: c.componentCode,
      componentType: c.componentType,
      calculationBasis: c.calculationBasis,
      valueType: c.valueType,
      inputValue,
      amount: roundTo(computeAmount(c.calculationBasis, inputValue, ctcMonthly, basicMonthly, grossMonthly), c.roundOff),
      statutoryType: c.statutoryType,
    };
  });

  const earnings = lineItems.filter(l => l.componentType === 'Earning');
  const deductions = lineItems.filter(l => l.componentType === 'Deduction');
  const reimbursements = lineItems.filter(l => l.componentType === 'Reimbursement');
  const employerContributions = lineItems.filter(l => l.componentType === 'Employer Contribution');

  const totalDeductions = deductions.reduce((s, l) => s + l.amount, 0);
  const totalReimbursements = reimbursements.reduce((s, l) => s + l.amount, 0);
  const netMonthly = Math.max(0, grossMonthly + totalReimbursements - totalDeductions);

  return {
    lineItems, earnings, deductions, reimbursements, employerContributions,
    basicMonthly, grossMonthly, totalDeductions, totalReimbursements, netMonthly,
  };
}

/** A component is configurable per employee only when it is Variable or Custom. */
export function isConfigurable(comp: SalaryStructureComponent): boolean {
  return comp.valueType === 'variable' || comp.valueType === 'custom';
}

/**
 * Build the initial per-employee component values for a structure, seeding
 * configurable components with their structure-level defaults.
 */
export function defaultComponentValues(structure: SalaryStructure): Record<string, number> {
  const values: Record<string, number> = {};
  structure.components.forEach(c => {
    if (c.valueType === 'variable') values[c.componentId] = c.value;
    else if (c.valueType === 'custom') values[c.componentId] = c.selectedCustomValue;
  });
  return values;
}

export function emptyEmployeeSalaryStructure(): EmployeeSalaryStructure {
  return { structureId: '', structureName: '', structureCode: '', ctcMonthly: 0, componentValues: {}, vpfPercentage: 0 };
}

// ─── Per-Employee Store (localStorage bridge) ─────────────────────────────────
// Employee Master writes the per-employee config here on save; Payroll reads it
// when running payroll. Seeded with demo employees so payroll has data out of box.

const STORE_KEY = 'hrms.employeeSalaryStructures';

export interface StoredEmployeeSalary extends EmployeeSalaryStructure {
  employeeId: string;
  employeeName: string;
}

// No seed data — the store starts empty and is populated only by real saves
// from Employee Master → Salary Structure.
function readStore(): StoredEmployeeSalary[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredEmployeeSalary[];
  } catch {
    return [];
  }
}

function writeStore(rows: StoredEmployeeSalary[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(rows));
  } catch {
    // ignore — store is best-effort in this prototype
  }
}

/** All employees that currently have a salary structure configured. */
export function getAllEmployeeSalaries(): StoredEmployeeSalary[] {
  return readStore().filter(r => r.structureId);
}

export function getEmployeeSalary(employeeId: string): StoredEmployeeSalary | undefined {
  return readStore().find(r => r.employeeId === employeeId);
}

/** Insert or update the per-employee salary config (keyed by employeeId). */
export function saveEmployeeSalary(row: StoredEmployeeSalary): void {
  const rows = readStore();
  const idx = rows.findIndex(r => r.employeeId === row.employeeId);
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  writeStore(rows);
}
