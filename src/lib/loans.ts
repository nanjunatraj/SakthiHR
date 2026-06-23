// Shared Loan & Advance data layer — every figure is read from / written to the
// DB (loans, loan_types, loan_emi_schedule). No mock data. The HR Loans page and
// the Employee Self-Service portal both consume this module so the lifecycle
// (apply → approve → disburse → EMI schedule → close) stays consistent.

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;

export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const isoToday = () => new Date().toISOString().split('T')[0];
const nowIso = () => new Date().toISOString();

export type LoanApprovalWorkflow = 'SingleHR' | 'TwoStage' | 'AutoWithinLimits';
export type LoanStatus = 'Pending' | 'Approved' | 'Active' | 'Closed' | 'Rejected';
export type ApprovalStage = 'manager' | 'hr' | 'single';

export interface UiLoanType {
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
}

export interface UiLoan {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  loanTypeId: string;
  loanTypeName: string;
  approvalWorkflow: LoanApprovalWorkflow;
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  emiAmount: number;
  disbursedDate: string;
  appliedDate: string;
  status: LoanStatus;
  purpose: string;
  paidEMIs: number;
  outstandingBalance: number;
  managerStatus: string;
  hrStatus: string;
  managerRemarks: string;
  hrRemarks: string;
  autoApproved: boolean;
  remarks: string;
}

export interface EmiRow {
  id: string;
  loanId: string;
  monthNumber: number;
  dueDate: string;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  isPaid: boolean;
  paidDate: string | null;
  paidAmount: number;
}

// ─── EMI maths ────────────────────────────────────────────────────────────────

/** Reducing-balance EMI; flat principal/tenure when interest-free (rate = 0). */
export function calcEMI(principal: number, ratePct: number, tenure: number): number {
  if (tenure <= 0) return 0;
  if (ratePct <= 0) return principal / tenure;
  const r = ratePct / 12 / 100;
  return (principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Amortisation rows for loan_emi_schedule (without id/loan_id). Due dates run
 *  monthly starting one month after the disbursement date. */
export function buildScheduleRows(principal: number, ratePct: number, tenure: number, startDateIso: string) {
  const emi = round2(calcEMI(principal, ratePct, tenure));
  const rows: Array<{ month_number: number; due_date: string; emi_amount: number; principal_component: number; interest_component: number; is_paid: boolean; paid_amount: number }> = [];
  let balance = principal;
  const start = new Date(startDateIso + 'T00:00:00');
  for (let i = 1; i <= tenure; i++) {
    const interest = ratePct <= 0 ? 0 : round2(balance * (ratePct / 12 / 100));
    let principalPart = round2(emi - interest);
    if (i === tenure) principalPart = round2(balance); // settle rounding on the last EMI
    balance = round2(balance - principalPart);
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    rows.push({
      month_number: i,
      due_date: due.toISOString().split('T')[0],
      emi_amount: i === tenure ? round2(principalPart + interest) : emi,
      principal_component: principalPart,
      interest_component: interest,
      is_paid: false,
      paid_amount: 0,
    });
  }
  return rows;
}

// ─── Row → UI mappers ───────────────────────────────────────────────────────

interface LoanTypeDbRow {
  id: string; name: string | null; code: string | null; max_amount: number | null;
  max_tenure_months: number | null; interest_rate: number | null; is_interest_free: boolean | null;
  eligibility_months: number | null; max_amount_multiplier: number | null; deduction_head: string | null;
  approval_workflow: string | null; is_active: boolean | null; description: string | null;
}

function toUiLoanType(r: LoanTypeDbRow): UiLoanType {
  return {
    id: r.id, name: r.name ?? '', code: r.code ?? '', maxAmount: num(r.max_amount),
    maxTenureMonths: num(r.max_tenure_months), interestRate: num(r.interest_rate),
    isInterestFree: Boolean(r.is_interest_free), eligibilityMonths: num(r.eligibility_months),
    maxAmountMultiplier: num(r.max_amount_multiplier), deductionHead: r.deduction_head ?? '',
    approvalWorkflow: (r.approval_workflow as LoanApprovalWorkflow) ?? 'SingleHR',
    isActive: Boolean(r.is_active), description: r.description ?? '',
  };
}

interface LoanDbRow {
  id: string; employee_id: string; loan_type_id: string; principal_amount: number | null;
  interest_rate: number | null; tenure_months: number | null; emi_amount: number | null;
  disbursed_date: string | null; applied_date: string | null; status: string | null; purpose: string | null;
  paid_emis: number | null; outstanding_balance: number | null; manager_status: string | null;
  hr_status: string | null; manager_remarks: string | null; hr_remarks: string | null;
  auto_approved: boolean | null; remarks: string | null;
  employees: { first_name: string | null; last_name: string | null; employee_id: string | null } | null;
  loan_types: { name: string | null; approval_workflow: string | null } | null;
}

function toUiLoan(r: LoanDbRow): UiLoan {
  const name = [r.employees?.first_name, r.employees?.last_name].filter(Boolean).join(' ') || (r.employees?.employee_id ?? 'Employee');
  return {
    id: r.id, employeeId: r.employee_id, employeeName: name, employeeCode: r.employees?.employee_id ?? '',
    loanTypeId: r.loan_type_id, loanTypeName: r.loan_types?.name ?? '—',
    approvalWorkflow: (r.loan_types?.approval_workflow as LoanApprovalWorkflow) ?? 'SingleHR',
    principalAmount: num(r.principal_amount), interestRate: num(r.interest_rate), tenureMonths: num(r.tenure_months),
    emiAmount: num(r.emi_amount), disbursedDate: r.disbursed_date ?? '', appliedDate: r.applied_date ?? '',
    status: (r.status as LoanStatus) ?? 'Pending', purpose: r.purpose ?? '', paidEMIs: num(r.paid_emis),
    outstandingBalance: num(r.outstanding_balance), managerStatus: r.manager_status ?? 'NA',
    hrStatus: r.hr_status ?? 'Pending', managerRemarks: r.manager_remarks ?? '', hrRemarks: r.hr_remarks ?? '',
    autoApproved: Boolean(r.auto_approved), remarks: r.remarks ?? '',
  };
}

const LOAN_SELECT =
  'id, employee_id, loan_type_id, principal_amount, interest_rate, tenure_months, emi_amount, disbursed_date, applied_date, status, purpose, paid_emis, outstanding_balance, manager_status, hr_status, manager_remarks, hr_remarks, auto_approved, remarks, employees!loans_employee_id_fkey(first_name, last_name, employee_id), loan_types(name, approval_workflow)';

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Active loan/advance types (for application dropdowns). */
export function useActiveLoanTypes() {
  const [loanTypes, setLoanTypes] = useState<UiLoanType[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await db.from('loan_types').select('*').order('name');
    const all = ((data ?? []) as LoanTypeDbRow[]).map(toUiLoanType);
    setLoanTypes(all.filter(t => t.isActive));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase.channel('realtime:loan_types_lib')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_types' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  return { loanTypes, loading, reload: load };
}

/** Loans, optionally scoped to one employee (self-service). Realtime.
 *  Pass `scoped: true` to require an employeeId — when none is set yet the hook
 *  returns an empty list instead of fetching every loan (used in self-service). */
export function useLoans(opts: { employeeId?: string; scoped?: boolean } = {}) {
  const { employeeId, scoped } = opts;
  const [loans, setLoans] = useState<UiLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (scoped && !employeeId) { setLoans([]); setLoading(false); return; }
    let q = db.from('loans').select(LOAN_SELECT).order('applied_date', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data } = await q;
    setLoans(((data ?? []) as unknown as LoanDbRow[]).map(toUiLoan));
    setLoading(false);
  }, [employeeId, scoped]);

  useEffect(() => {
    void load();
    const ch = supabase.channel(`realtime:loans_lib:${employeeId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, employeeId]);

  return { loans, loading, reload: load };
}

/** EMI schedule for a single loan. */
export async function fetchSchedule(loanId: string): Promise<EmiRow[]> {
  const { data } = await db.from('loan_emi_schedule').select('*').eq('loan_id', loanId).order('month_number');
  return ((data ?? []) as Array<Record<string, unknown>>).map(r => ({
    id: r.id as string, loanId: r.loan_id as string, monthNumber: num(r.month_number), dueDate: (r.due_date as string) ?? '',
    emiAmount: num(r.emi_amount), principalComponent: num(r.principal_component), interestComponent: num(r.interest_component),
    isPaid: Boolean(r.is_paid), paidDate: (r.paid_date as string) ?? null, paidAmount: num(r.paid_amount),
  }));
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function insertScheduleRows(loanId: string, principal: number, ratePct: number, tenure: number, startIso: string): Promise<string | null> {
  const rows = buildScheduleRows(principal, ratePct, tenure, startIso).map(r => ({ ...r, loan_id: loanId }));
  const { error } = await db.from('loan_emi_schedule').insert(rows as never);
  return error?.message ?? null;
}

export interface ApplyLoanParams {
  employeeId: string;
  loanType: UiLoanType;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  purpose: string;
}

/** Submit a loan application. The status it lands in is driven by the loan
 *  type's approval workflow (SingleHR / TwoStage / AutoWithinLimits). */
export async function applyLoan(p: ApplyLoanParams): Promise<{ error: string | null }> {
  const wf = p.loanType.approvalWorkflow;
  const rate = p.loanType.isInterestFree ? 0 : p.interestRate;
  const withinLimits = p.principal <= p.loanType.maxAmount && p.tenureMonths <= p.loanType.maxTenureMonths;
  const autoApprove = wf === 'AutoWithinLimits' && withinLimits;
  const today = isoToday();
  const emi = Math.round(calcEMI(p.principal, rate, p.tenureMonths));

  const row: Record<string, unknown> = {
    employee_id: p.employeeId,
    loan_type_id: p.loanType.id,
    principal_amount: p.principal,
    interest_rate: rate,
    tenure_months: p.tenureMonths,
    emi_amount: emi,
    applied_date: today,
    purpose: p.purpose.trim() || null,
    paid_emis: 0,
    outstanding_balance: p.principal,
    manager_status: wf === 'TwoStage' ? 'Pending' : 'NA',
    hr_status: autoApprove ? 'Approved' : 'Pending',
    auto_approved: autoApprove,
    status: autoApprove ? 'Active' : 'Pending',
    disbursed_date: autoApprove ? today : null,
    approved_on: autoApprove ? nowIso() : null,
    remarks: autoApprove ? 'Auto-approved within loan-type limits.' : null,
    updated_at: nowIso(),
  };

  const { data, error } = await db.from('loans').insert(row as never).select('id').single();
  if (error) return { error: error.message };
  if (autoApprove && data?.id) {
    const e2 = await insertScheduleRows((data as { id: string }).id, p.principal, rate, p.tenureMonths, today);
    if (e2) return { error: e2 };
  }
  return { error: null };
}

function overall(manager: string, hr: string): LoanStatus {
  if (manager === 'Rejected' || hr === 'Rejected') return 'Rejected';
  if (hr === 'Approved' && (manager === 'Approved' || manager === 'NA')) return 'Approved';
  return 'Pending';
}

/** Record an approval decision at a given stage. When the loan becomes fully
 *  approved it is disbursed (status → Active) and its EMI schedule is generated. */
export async function decideLoan(loan: UiLoan, stage: ApprovalStage, decision: 'Approved' | 'Rejected', remarks: string): Promise<{ error: string | null }> {
  let managerStatus = loan.managerStatus;
  let hrStatus = loan.hrStatus;
  const patch: Record<string, unknown> = { updated_at: nowIso() };

  if (stage === 'manager') {
    managerStatus = decision;
    patch.manager_status = decision;
    patch.manager_acted_on = nowIso();
    patch.manager_remarks = remarks.trim() || null;
  } else {
    // 'hr' or 'single' both resolve the HR-side decision
    hrStatus = decision;
    patch.hr_status = decision;
    patch.hr_acted_on = nowIso();
    patch.hr_remarks = remarks.trim() || null;
  }

  const status = overall(managerStatus, hrStatus);
  patch.status = status;
  if (decision === 'Rejected') patch.remarks = remarks.trim() || 'Application rejected.';

  // Final approval → disburse now.
  const willDisburse = status === 'Approved';
  if (willDisburse) {
    const today = isoToday();
    patch.status = 'Active';
    patch.disbursed_date = today;
    patch.approved_on = nowIso();
    patch.outstanding_balance = loan.principalAmount;
    patch.paid_emis = 0;
  }

  const { error } = await db.from('loans').update(patch as never).eq('id', loan.id);
  if (error) return { error: error.message };

  if (willDisburse) {
    // Replace any stale schedule, then generate a fresh amortisation.
    await db.from('loan_emi_schedule').delete().eq('loan_id', loan.id);
    const e2 = await insertScheduleRows(loan.id, loan.principalAmount, loan.interestRate, loan.tenureMonths, isoToday());
    if (e2) return { error: e2 };
  }
  return { error: null };
}
