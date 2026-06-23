// DB-driven payroll run. Reads each active employee's current salary assignment
// (employee_salary_assignments → salary_structures → components), computes the
// monthly breakdown, layers in the Loan/Advance EMI deduction (active loans, minus
// approved EMI-skip requests for the period), then PERSISTS payroll_runs +
// payroll_entries and advances each loan's EMI schedule. Payslips, registers and
// reports read those payroll_entries rows, so the loan EMI flows everywhere.

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import {
  computeSalaryBreakdown, type SalaryStructure, type SalaryStructureComponent,
  type SalaryBreakdown,
} from '../data/salaryStructures';
import type { ComponentType, CalculationBasis, ComponentValueType } from '../data/salaryStructures';
import { computeMonthlyTds, loadSlabs, fyMonthIndex, type TaxRegime, type TaxSlab } from './tax';
import {
  loadStatutorySettings, resolveEffectiveStatutory, computeStatutory, ptForGross, wageBaseFromComponents,
  type StatutorySettings, type StatutoryOverrides, type PtSlab,
} from './statutory';
import { loadClosedReimbursementByEmployee } from './reimbursements';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RunCandidate {
  employeeId: string;          // employees.id (uuid)
  employeeName: string;
  employeeCode: string;
  structureId: string;
  structureCode: string;
  ctcMonthly: number;
  breakdown: SalaryBreakdown;
  loanEmi: number;             // total EMI deducted this period
  loanIds: string[];           // active, non-skipped loans contributing EMI
  skipped: boolean;            // at least one loan skipped this period
  tds: number;                 // auto-computed income tax / TDS for this month
  regime: TaxRegime;
  // Statutory deductions computed from Payroll Settings + per-employee overrides.
  pfEmployee: number; pfEmployer: number;
  esiEmployee: number; esiEmployer: number;
  pt: number;
  // Overtime earning computed from attendance OT hours × the OT salary component config.
  overtimeHours: number;
  overtimeAmount: number;
  // Attendance day-counts for the period (shown on the payslip).
  workingDays: number; presentDays: number; leaveDays: number; absentDays: number;
  // Closed reimbursement claims for this period (paid on top of gross).
  reimbursementAmount: number;
  // Salary-revision arrears targeted at this period (paid on top of gross).
  arrearsAmount: number;
  // Approved deduction-module entries recovered through linked component heads.
  linkedDeductions: number;
  deductionBreakdown: Record<string, number>;
}

export interface RunTotals { totalEmployees: number; totalGross: number; totalDeductions: number; totalNet: number; }

// ─── Build SalaryStructure objects from DB rows ───────────────────────────────

interface SscRow {
  salary_structure_id: string; salary_component_id: string; value: number | null;
  calculation_basis: string | null; sort_order: number | null; value_type: string | null;
  custom_values: unknown; selected_custom_value: number | null; formula: string | null;
  salary_components: { name: string | null; code: string | null; type: string | null; calculation_basis: string | null; statutory_type: string | null } | null;
}

function toComponent(r: SscRow): SalaryStructureComponent {
  const meta = r.salary_components;
  let customValues: number[] = [];
  if (Array.isArray(r.custom_values)) customValues = (r.custom_values as unknown[]).map(Number).filter(n => !Number.isNaN(n));
  else if (typeof r.custom_values === 'string') { try { const p = JSON.parse(r.custom_values); if (Array.isArray(p)) customValues = p.map(Number); } catch { /* ignore */ } }
  return {
    componentId: r.salary_component_id,
    componentName: meta?.name ?? '',
    componentCode: meta?.code ?? '',
    componentType: (meta?.type as ComponentType) ?? 'Earning',
    calculationBasis: (r.calculation_basis as CalculationBasis) ?? (meta?.calculation_basis as CalculationBasis) ?? 'Fixed',
    valueType: (r.value_type as ComponentValueType) ?? 'fixed',
    value: num(r.value),
    customValues,
    selectedCustomValue: num(r.selected_custom_value),
    formula: r.formula ?? '',
    statutoryType: (meta?.statutory_type as SalaryStructureComponent['statutoryType']) ?? 'none',
  };
}

// ─── Candidate computation (preview + run input) ──────────────────────────────

async function loadCandidates(periodId: string): Promise<RunCandidate[]> {
  // 1) Current salary assignments → employees + structure ref.
  const { data: assignRows } = await db
    .from('employee_salary_assignments')
    .select('employee_id, salary_structure_id, ctc_monthly, component_values, statutory_overrides, vpf_percentage, employees!employee_salary_assignments_employee_id_fkey(first_name, last_name, employee_id, status, tax_regime, work_location:work_locations(state)), salary_structures(code)')
    .eq('is_current', true);
  const assignments = (assignRows ?? []) as unknown as Array<{
    employee_id: string; salary_structure_id: string; ctc_monthly: number | null; component_values: Record<string, number> | null; statutory_overrides: StatutoryOverrides | null; vpf_percentage: number | null;
    employees: { first_name: string | null; last_name: string | null; employee_id: string | null; status: string | null; tax_regime: string | null; work_location: { state: string | null } | null } | null;
    salary_structures: { code: string | null } | null;
  }>;
  const active = assignments.filter(a => a.employees && a.employees.status !== 'Inactive' && a.salary_structure_id);
  if (active.length === 0) return [];

  // 2) Components for the involved structures.
  const structureIds = [...new Set(active.map(a => a.salary_structure_id))];
  const { data: sscRows } = await db
    .from('salary_structure_components')
    .select('salary_structure_id, salary_component_id, value, calculation_basis, sort_order, value_type, custom_values, selected_custom_value, formula, salary_components(name, code, type, calculation_basis, statutory_type)')
    .in('salary_structure_id', structureIds);
  const byStructure = new Map<string, SalaryStructure>();
  for (const sid of structureIds) {
    const comps = ((sscRows ?? []) as unknown as SscRow[])
      .filter(r => r.salary_structure_id === sid)
      .sort((a, b) => num(a.sort_order) - num(b.sort_order))
      .map(toComponent);
    byStructure.set(sid, { id: sid, name: '', code: '', applicableTo: [], components: comps, isActive: true, description: '' });
  }

  // 3) Active loans + approved skips for this period.
  const { data: loanRows } = await db.from('loans').select('id, employee_id, emi_amount, outstanding_balance').eq('status', 'Active');
  const loans = (loanRows ?? []) as Array<{ id: string; employee_id: string; emi_amount: number | null; outstanding_balance: number | null }>;
  const { data: skipRows } = await db.from('loan_emi_skip_requests').select('loan_id').eq('payroll_period_id', periodId).eq('status', 'Approved');
  const skippedLoanIds = new Set((skipRows ?? []).map((r: { loan_id: string }) => r.loan_id));

  const loansByEmp = new Map<string, typeof loans>();
  for (const l of loans) { if (!loansByEmp.has(l.employee_id)) loansByEmp.set(l.employee_id, []); loansByEmp.get(l.employee_id)!.push(l); }

  // 4) Income tax / TDS context: FY of this period, prior YTD gross + TDS within the FY,
  //    and the slab sets for each regime (loaded once).
  const { data: periodRow } = await db.from('payroll_periods').select('financial_year, from_date, to_date').eq('id', periodId).single();
  const fy = (periodRow as { financial_year: string | null } | null)?.financial_year || '';
  const fromDate = (periodRow as { from_date: string | null } | null)?.from_date || new Date().toISOString().split('T')[0];
  const toDate = (periodRow as { to_date: string | null } | null)?.to_date || fromDate;
  const fyMonth = fyMonthIndex(fromDate);

  // Overtime: the active OT salary component config + each employee's OT hours from attendance in the period.
  const { data: otCompRows } = await db.from('salary_components')
    .select('overtime_multiplier, overtime_hours_per_month').eq('is_overtime', true).eq('is_active', true).limit(1);
  const otComp = (otCompRows ?? [])[0] as { overtime_multiplier: number | null; overtime_hours_per_month: number | null } | undefined;
  const otMultiplier = otComp ? num(otComp.overtime_multiplier) || 2 : 0;
  const otHoursDivisor = otComp ? num(otComp.overtime_hours_per_month) || 208 : 208;
  const otHoursByEmp = new Map<string, number>();
  // Per-employee attendance day-counts for the period (working/present/leave/absent),
  // derived from attendance_records.status — persisted onto each entry so the payslip shows them.
  const attendanceByEmp = new Map<string, { working: number; present: number; leave: number; absent: number }>();
  {
    const { data: attRows } = await db.from('attendance_records').select('employee_id, overtime_hours, status')
      .gte('attendance_date', fromDate).lte('attendance_date', toDate);
    for (const a of (attRows ?? []) as Array<{ employee_id: string; overtime_hours: number | null; status: string | null }>) {
      if (otComp) otHoursByEmp.set(a.employee_id, (otHoursByEmp.get(a.employee_id) ?? 0) + num(a.overtime_hours));
      const att = attendanceByEmp.get(a.employee_id) ?? { working: 0, present: 0, leave: 0, absent: 0 };
      const s = (a.status ?? '').trim().toLowerCase();
      if (s) {
        // Working Days = the full period (Present + Leave + LOP + Holidays); every dated
        // record counts as one period day. Holidays (weekly offs + declared holidays) are
        // derived on the payslip as Working − Present − Leave − LOP.
        att.working += 1;
        if (s.includes('holiday') || s.includes('weekend') || s.includes('week off') || s === 'wo' || s === 'off') {
          // Holiday / weekly off — counted in working days only (shown as Holidays).
        } else if (s.includes('half')) {
          att.present += 0.5; att.absent += 0.5;
        } else if (s.includes('absent') || s.includes('lop') || s.includes('loss of pay')) {
          att.absent += 1;
        } else if (s.includes('leave')) {
          att.leave += 1;
        } else {
          // Present / On-Duty / WFH / any other worked status.
          att.present += 1;
        }
      }
      attendanceByEmp.set(a.employee_id, att);
    }
  }

  // Closed reimbursement claims for this period — paid out on top of gross.
  const reimbByEmp = await loadClosedReimbursementByEmployee(periodId);

  // Pending salary-revision arrears targeted at this period — paid on top of gross.
  const arrearsByEmp = new Map<string, number>();
  const { data: arrearsRows } = await db.from('salary_revision_arrears')
    .select('employee_id, arrears_amount').eq('target_period_id', periodId).eq('status', 'Pending');
  for (const r of (arrearsRows ?? []) as Array<{ employee_id: string; arrears_amount: number | null }>) {
    arrearsByEmp.set(r.employee_id, (arrearsByEmp.get(r.employee_id) ?? 0) + num(r.arrears_amount));
  }

  // Approved Deductions-module entries for this period (Damages/Fines/Canteen/Society/
  // Donations/Other), recovered through the salary component linked to each category
  // (salary_components.deduction_source). Loan-advances are excluded (handled via loan EMI).
  const dedHeadByCategory = new Map<string, string>();
  const DEFAULT_DED_HEAD: Record<string, string> = {
    'damages-loss': 'Damages & Loss', 'fines': 'Fines', 'canteen': 'Canteen',
    'society': 'Society', 'donations': 'Donations / Campaign', 'other-deductions': 'Other Deductions',
  };
  const { data: linkedComps } = await db.from('salary_components')
    .select('name, deduction_source').not('deduction_source', 'is', null).eq('is_active', true);
  for (const lc of (linkedComps ?? []) as Array<{ name: string; deduction_source: string }>) {
    if (lc.deduction_source && lc.deduction_source !== 'loan-advances') dedHeadByCategory.set(lc.deduction_source, lc.name);
  }
  // Per-employee breakdown { head -> amount } and total.
  const dedBreakdownByEmp = new Map<string, Record<string, number>>();
  const dedTotalByEmp = new Map<string, number>();
  const { data: dedRows } = await db.from('deduction_entries')
    .select('employee_id, category, amount, status')
    .eq('payroll_period_id', periodId).in('status', ['Applied', 'Approved by Employee']);
  for (const d of (dedRows ?? []) as Array<{ employee_id: string; category: string; amount: number | null }>) {
    if (d.category === 'loan-advances') continue;
    const head = dedHeadByCategory.get(d.category) ?? DEFAULT_DED_HEAD[d.category] ?? 'Other Deductions';
    const bd = dedBreakdownByEmp.get(d.employee_id) ?? {};
    bd[head] = round2((bd[head] ?? 0) + num(d.amount));
    dedBreakdownByEmp.set(d.employee_id, bd);
    dedTotalByEmp.set(d.employee_id, (dedTotalByEmp.get(d.employee_id) ?? 0) + num(d.amount));
  }

  const { data: fyPeriods } = await db.from('payroll_periods').select('id').eq('financial_year', fy);
  const fyPeriodIds = (fyPeriods ?? []).map((r: { id: string }) => r.id).filter(id => id !== periodId);
  const ytdByEmp = new Map<string, { gross: number; tds: number }>();
  if (fyPeriodIds.length > 0) {
    const { data: priorEntries } = await db.from('payroll_entries').select('employee_id, gross_salary, tds').in('payroll_period_id', fyPeriodIds);
    for (const e of (priorEntries ?? []) as Array<{ employee_id: string; gross_salary: number | null; tds: number | null }>) {
      const cur = ytdByEmp.get(e.employee_id) ?? { gross: 0, tds: 0 };
      cur.gross += num(e.gross_salary); cur.tds += num(e.tds);
      ytdByEmp.set(e.employee_id, cur);
    }
  }
  const slabCache = new Map<TaxRegime, TaxSlab[]>();
  const slabsFor = async (regime: TaxRegime): Promise<TaxSlab[]> => {
    if (!slabCache.has(regime)) slabCache.set(regime, fy ? await loadSlabs(fy, regime, 'All') : []);
    return slabCache.get(regime)!;
  };

  // 5) Statutory context: org-wide Payroll Settings + all PT slabs grouped by state.
  const statSettings: StatutorySettings = await loadStatutorySettings();
  const { data: ptRows } = await db.from('professional_tax_slabs').select('state, gender, from_amount, to_amount, monthly_amount, is_active').eq('is_active', true);
  const ptByState = new Map<string, PtSlab[]>();
  for (const r of (ptRows ?? []) as Array<Record<string, unknown>>) {
    const st = (r.state as string) ?? '';
    const slab: PtSlab = { state: st, gender: (r.gender as string) ?? 'All', fromAmount: num(r.from_amount), toAmount: num(r.to_amount), monthlyAmount: num(r.monthly_amount), isActive: Boolean(r.is_active) };
    if (!ptByState.has(st)) ptByState.set(st, []);
    ptByState.get(st)!.push(slab);
  }

  return Promise.all(active.map(async a => {
    const structure = byStructure.get(a.salary_structure_id)!;
    const ctcMonthly = num(a.ctc_monthly);
    const breakdown = computeSalaryBreakdown(structure, ctcMonthly, a.component_values ?? {});
    const empLoans = loansByEmp.get(a.employee_id) ?? [];
    const contributing = empLoans.filter(l => !skippedLoanIds.has(l.id));
    const loanEmi = contributing.reduce((s, l) => s + Math.min(num(l.emi_amount), num(l.outstanding_balance) || num(l.emi_amount)), 0);
    const name = [a.employees?.first_name, a.employees?.last_name].filter(Boolean).join(' ') || (a.employees?.employee_id ?? 'Employee');

    // Auto TDS — annualised projection. Taxable monthly gross ≈ gross (earnings).
    const regime: TaxRegime = (a.employees?.tax_regime === 'Old' ? 'Old' : 'New');
    const slabs = await slabsFor(regime);
    const ytd = ytdByEmp.get(a.employee_id) ?? { gross: 0, tds: 0 };
    const tdsRes = computeMonthlyTds({
      monthlyTaxableGross: breakdown.grossMonthly,
      ytdTaxableGross: ytd.gross,
      ytdTdsDeducted: ytd.tds,
      fyMonth, regime, slabs,
    });

    // Statutory PF/ESI/PT from Payroll Settings + per-employee overrides + state PT slab.
    // PF/ESI wage bases come from the components configured in Payroll Settings
    // (fallback: Basic for PF, gross for ESI when none configured).
    const eff = resolveEffectiveStatutory(statSettings, a.statutory_overrides ?? null);
    const ptMonthly = ptForGross(ptByState.get(a.employees?.work_location?.state ?? '') ?? [], breakdown.grossMonthly);
    const pfWages = wageBaseFromComponents(breakdown.lineItems, statSettings.pfWageComponents, breakdown.basicMonthly);
    const esiWages = wageBaseFromComponents(breakdown.lineItems, statSettings.esiWageComponents, breakdown.grossMonthly);
    const stat = computeStatutory(pfWages, esiWages, eff, ptMonthly, num(a.vpf_percentage));

    // Overtime pay = OT hours × (Basic ÷ standard hours/month) × multiplier.
    const otHours = otHoursByEmp.get(a.employee_id) ?? 0;
    const overtimeAmount = otHours > 0 && otMultiplier > 0
      ? round2(otHours * (breakdown.basicMonthly / otHoursDivisor) * otMultiplier) : 0;
    const att = attendanceByEmp.get(a.employee_id) ?? { working: 0, present: 0, leave: 0, absent: 0 };

    return {
      employeeId: a.employee_id, employeeName: name, employeeCode: a.employees?.employee_id ?? '',
      structureId: a.salary_structure_id, structureCode: a.salary_structures?.code ?? '',
      ctcMonthly, breakdown, loanEmi: round2(loanEmi),
      loanIds: contributing.map(l => l.id),
      skipped: empLoans.some(l => skippedLoanIds.has(l.id)),
      tds: tdsRes.monthlyTds, regime,
      // Employee PF on the wage includes Voluntary PF.
      pfEmployee: stat.pfEmployee + stat.vpf, pfEmployer: stat.pfEmployer,
      esiEmployee: stat.esiEmployee, esiEmployer: stat.esiEmployer, pt: stat.pt,
      overtimeHours: round2(otHours), overtimeAmount,
      workingDays: att.working, presentDays: att.present, leaveDays: att.leave, absentDays: att.absent,
      reimbursementAmount: round2(reimbByEmp.get(a.employee_id) ?? 0),
      arrearsAmount: round2(arrearsByEmp.get(a.employee_id) ?? 0),
      linkedDeductions: round2(dedTotalByEmp.get(a.employee_id) ?? 0),
      deductionBreakdown: dedBreakdownByEmp.get(a.employee_id) ?? {},
    };
  }));
}

/** Preview hook for the Run Payroll modal. */
export function useRunCandidates(periodId: string | null) {
  const [candidates, setCandidates] = useState<RunCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!periodId) { setCandidates([]); setLoading(false); return; }
    setLoading(true);
    setCandidates(await loadCandidates(periodId));
    setLoading(false);
  }, [periodId]);
  useEffect(() => { void load(); }, [load]);
  return { candidates, loading, reload: load };
}

const amt = (b: SalaryBreakdown, code: string, type: 'earnings' | 'deductions' | 'reimbursements') =>
  b[type].find(l => l.componentCode === code)?.amount ?? 0;

const STATUTORY_DEDUCTION_TYPES = ['pf', 'esi', 'professional_tax', 'income_tax'];
// PF/ESI/PT and income tax are computed centrally (Payroll Settings + slabs), so the
// structure's own statutory deduction components are dropped here to avoid double counting.
const otherStructureDeductions = (c: RunCandidate) =>
  c.breakdown.deductions.filter(l => !STATUTORY_DEDUCTION_TYPES.includes(l.statutoryType ?? 'none')).reduce((s, l) => s + l.amount, 0);
const statutoryDeductions = (c: RunCandidate) => c.pfEmployee + c.esiEmployee + c.pt + c.tds;
export const totalDeductionsOf = (c: RunCandidate) => otherStructureDeductions(c) + statutoryDeductions(c) + c.loanEmi + c.linkedDeductions;
/** Gross including structure reimbursements, overtime earning and closed reimbursement claims. */
export const grossOf = (c: RunCandidate) => c.breakdown.grossMonthly + c.breakdown.totalReimbursements + c.overtimeAmount + c.reimbursementAmount + c.arrearsAmount;
export const netOf = (c: RunCandidate) => Math.max(0, grossOf(c) - totalDeductionsOf(c));

export function totalsOf(candidates: RunCandidate[]): RunTotals {
  return {
    totalEmployees: candidates.length,
    totalGross: candidates.reduce((s, c) => s + grossOf(c), 0),
    totalDeductions: candidates.reduce((s, c) => s + totalDeductionsOf(c), 0),
    totalNet: candidates.reduce((s, c) => s + netOf(c), 0),
  };
}

// ─── Map a breakdown to payroll_entries columns ───────────────────────────────

const KNOWN_EARNINGS = ['BASIC', 'HRA', 'SPEC', 'CONV', 'MED'];

function entryRow(runId: string, periodId: string, c: RunCandidate): Record<string, unknown> {
  const b = c.breakdown;
  // Overtime pay rides in other_earnings so gross/net include it.
  const otherEarnings = b.earnings.filter(l => !KNOWN_EARNINGS.includes(l.componentCode)).reduce((s, l) => s + l.amount, 0)
    + b.reimbursements.filter(l => l.componentCode !== 'LTA').reduce((s, l) => s + l.amount, 0)
    + c.overtimeAmount + c.reimbursementAmount;
  const otherDeductions = round2(otherStructureDeductions(c));
  const totalDeductions = round2(totalDeductionsOf(c));
  const netSalary = round2(netOf(c));
  return {
    payroll_run_id: runId, employee_id: c.employeeId, payroll_period_id: periodId,
    basic_salary: round2(b.basicMonthly),
    hra: round2(amt(b, 'HRA', 'earnings')),
    special_allowance: round2(amt(b, 'SPEC', 'earnings')),
    conveyance_allowance: round2(amt(b, 'CONV', 'earnings')),
    medical_allowance: round2(amt(b, 'MED', 'earnings')),
    lta: round2(amt(b, 'LTA', 'reimbursements')),
    other_earnings: round2(otherEarnings),
    arrears: round2(c.arrearsAmount),
    gross_salary: round2(grossOf(c)),
    pf_employee: round2(c.pfEmployee),
    esi_employee: round2(c.esiEmployee),
    professional_tax: round2(c.pt),
    tds: round2(c.tds),
    loan_emi: round2(c.loanEmi),
    advance_recovery: 0,
    other_deductions: otherDeductions,
    deduction_breakdown: Object.keys(c.deductionBreakdown).length ? c.deductionBreakdown : null,
    total_deductions: totalDeductions,
    net_salary: netSalary,
    pf_employer: round2(c.pfEmployer),
    esi_employer: round2(c.esiEmployer),
    working_days: c.workingDays, present_days: round2(c.presentDays), absent_days: round2(c.absentDays), leave_days: round2(c.leaveDays), overtime_hours: round2(c.overtimeHours),
    status: 'Draft',
    remarks: c.skipped ? 'One or more loan EMIs skipped this period (approved).' : null,
    updated_at: new Date().toISOString(),
  };
}

// ─── Advance a single loan's EMI schedule after a successful run ──────────────

async function advanceLoan(loanId: string): Promise<void> {
  const { data: loanData } = await db.from('loans').select('id, tenure_months, paid_emis, outstanding_balance, emi_amount').eq('id', loanId).single();
  if (!loanData) return;
  const loan = loanData as { id: string; tenure_months: number | null; paid_emis: number | null; outstanding_balance: number | null; emi_amount: number | null };

  // Mark the next unpaid scheduled EMI as paid.
  const { data: nextRows } = await db.from('loan_emi_schedule')
    .select('id, principal_component, emi_amount, month_number')
    .eq('loan_id', loanId).eq('is_paid', false).order('month_number').limit(1);
  const next = (nextRows ?? [])[0] as { id: string; principal_component: number | null; emi_amount: number | null } | undefined;
  let principalPaid = num(loan.emi_amount);
  if (next) {
    principalPaid = num(next.principal_component) || num(next.emi_amount);
    await db.from('loan_emi_schedule').update({ is_paid: true, paid_date: new Date().toISOString().split('T')[0], paid_amount: num(next.emi_amount) }).eq('id', next.id);
  }

  const paidEmis = num(loan.paid_emis) + 1;
  const outstanding = Math.max(0, round2(num(loan.outstanding_balance) - principalPaid));
  const closed = paidEmis >= num(loan.tenure_months) || outstanding <= 0;
  await db.from('loans').update({
    paid_emis: paidEmis,
    outstanding_balance: outstanding,
    status: closed ? 'Closed' : 'Active',
    updated_at: new Date().toISOString(),
  }).eq('id', loanId);
}

// ─── Persist the run ──────────────────────────────────────────────────────────

/** Persist a payroll run for the period: writes payroll_runs + payroll_entries
 *  and advances each contributing loan's EMI schedule. Returns the run id. */
export async function persistPayrollRun(periodId: string, candidates: RunCandidate[]): Promise<{ runId: string | null; error: string | null }> {
  if (candidates.length === 0) return { runId: null, error: 'No employees with a current salary structure to process.' };
  const totals = totalsOf(candidates);

  // Remove any prior draft run for this period so re-runs don't duplicate.
  const { data: priorRuns } = await db.from('payroll_runs').select('id, status').eq('payroll_period_id', periodId);
  for (const r of (priorRuns ?? []) as Array<{ id: string; status: string }>) {
    if (r.status === 'Draft') {
      await db.from('payroll_entries').delete().eq('payroll_run_id', r.id);
      await db.from('payroll_runs').delete().eq('id', r.id);
    }
  }

  const { data: runData, error: runErr } = await db.from('payroll_runs').insert({
    payroll_period_id: periodId,
    run_date: new Date().toISOString(),
    status: 'Draft',
    total_employees: totals.totalEmployees,
    total_gross: round2(totals.totalGross),
    total_deductions: round2(totals.totalDeductions),
    total_net: round2(totals.totalNet),
    total_employer_pf: round2(candidates.reduce((s, c) => s + c.pfEmployer, 0)),
    total_employer_esi: round2(candidates.reduce((s, c) => s + c.esiEmployer, 0)),
    updated_at: new Date().toISOString(),
  } as never).select('id').single();
  if (runErr) return { runId: null, error: runErr.message };
  const runId = (runData as { id: string }).id;

  const entries = candidates.map(c => entryRow(runId, periodId, c));
  const { error: entryErr } = await db.from('payroll_entries').insert(entries as never);
  if (entryErr) return { runId, error: entryErr.message };

  // Advance EMI schedules for every contributing loan (skips were already excluded).
  for (const c of candidates) for (const loanId of c.loanIds) await advanceLoan(loanId);

  // Mark salary-revision arrears paid in this period as settled.
  await db.from('salary_revision_arrears').update({ status: 'Paid', paid_run_id: runId } as never)
    .eq('target_period_id', periodId).eq('status', 'Pending');

  return { runId, error: null };
}

// ─── Reading persisted runs (period list status + employee-wise details) ───────

export interface PeriodRunSummary {
  status: string;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  runDate: string | null;
}

/** Latest payroll run per period → used to show real run status/totals in the period list. */
export async function loadPeriodRunSummaries(): Promise<Map<string, PeriodRunSummary>> {
  const { data } = await db
    .from('payroll_runs')
    .select('payroll_period_id, status, total_employees, total_gross, total_deductions, total_net, run_date')
    .order('run_date', { ascending: false });
  const m = new Map<string, PeriodRunSummary>();
  for (const r of (data ?? []) as Array<Record<string, any>>) {
    if (m.has(r.payroll_period_id)) continue; // first row per period = latest run
    m.set(r.payroll_period_id, {
      status: r.status ?? 'Draft',
      totalEmployees: num(r.total_employees), totalGross: num(r.total_gross),
      totalDeductions: num(r.total_deductions), totalNet: num(r.total_net),
      runDate: r.run_date ?? null,
    });
  }
  return m;
}

export interface RunEntry {
  employeeId: string; name: string; code: string;
  basic: number; gross: number;
  pfEmployee: number; esiEmployee: number; pt: number; tds: number;
  loanEmi: number; otherDeductions: number; totalDeductions: number; net: number;
  status: string;
}

/** Load the latest run's employee-wise entries for a period (the saved calculations). */
export async function loadRunEntries(periodId: string): Promise<{ runId: string | null; runStatus: string | null; runDate: string | null; entries: RunEntry[] }> {
  const { data: runRows } = await db
    .from('payroll_runs').select('id, status, run_date')
    .eq('payroll_period_id', periodId).order('run_date', { ascending: false }).limit(1);
  const run = (runRows ?? [])[0] as { id: string; status: string; run_date: string | null } | undefined;
  if (!run) return { runId: null, runStatus: null, runDate: null, entries: [] };
  const { data } = await db
    .from('payroll_entries')
    .select('employee_id, basic_salary, gross_salary, pf_employee, esi_employee, professional_tax, tds, loan_emi, other_deductions, total_deductions, net_salary, status, employees(first_name, middle_name, last_name, employee_id)')
    .eq('payroll_run_id', run.id);
  const entries: RunEntry[] = ((data ?? []) as Array<Record<string, any>>).map(r => {
    const e = r.employees ?? {};
    const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || (e.employee_id ?? 'Employee');
    return {
      employeeId: r.employee_id, name, code: e.employee_id ?? '',
      basic: num(r.basic_salary), gross: num(r.gross_salary),
      pfEmployee: num(r.pf_employee), esiEmployee: num(r.esi_employee), pt: num(r.professional_tax), tds: num(r.tds),
      loanEmi: num(r.loan_emi), otherDeductions: num(r.other_deductions), totalDeductions: num(r.total_deductions),
      net: num(r.net_salary), status: r.status ?? 'Draft',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { runId: run.id, runStatus: run.status, runDate: run.run_date, entries };
}

/** Approve the latest run for a period (Draft → Approved) and lock its entries. */
export async function approvePayrollRun(periodId: string): Promise<{ error: string | null }> {
  const { data: runRows } = await db
    .from('payroll_runs').select('id').eq('payroll_period_id', periodId).order('run_date', { ascending: false }).limit(1);
  const run = (runRows ?? [])[0] as { id: string } | undefined;
  if (!run) return { error: 'No payroll run found to approve.' };
  // Note: approved_by is intentionally left untouched — its FK references a users table
  // the browser auth uid may not satisfy; status + timestamp are what the workflow needs.
  const e1 = await db.from('payroll_runs').update({
    status: 'Approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } as never).eq('id', run.id);
  if (e1.error) return { error: e1.error.message };
  await db.from('payroll_entries').update({ status: 'Approved', updated_at: new Date().toISOString() } as never).eq('payroll_run_id', run.id);
  return { error: null };
}
