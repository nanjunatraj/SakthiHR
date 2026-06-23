// Employee Exit (separation) framework. Full lifecycle: initiate → clearances +
// asset handover → auto-computed Full & Final settlement → relieving. Reuses the
// existing salary assignment, gratuity, leave-balance, loan and asset data. No mocks.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { getEmployeeAssignment, loadDbStructures } from './salaryAssignments';
import { computeSalaryBreakdown, type SalaryStructure } from '../data/salaryStructures';
import { gratuityAmount } from './statutoryBenefits';

const xdb = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);
const round0 = (n: number) => Math.round(n);

export const EXIT_TYPES = ['Resignation', 'Termination', 'Retirement', 'Absconding', 'End of Contract', 'Death', 'Retrenchment', 'Layoff'] as const;
export type ExitType = typeof EXIT_TYPES[number];

/** Standard clearance departments seeded for every exit. */
export const CLEARANCE_DEPARTMENTS = ['Reporting Manager', 'IT', 'Finance', 'Admin', 'HR', 'Assets'] as const;

export type ExitStatus = 'Initiated' | 'In Clearance' | 'Settled' | 'Relieved' | 'Cancelled';
export type ClearanceStatus = 'Pending' | 'Cleared' | 'NA';
export type SettlementStatus = 'Draft' | 'Finalised';

export interface ExitRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  doj: string;
  noticePeriodDays: number;
  exitType: ExitType;
  resignationDate: string;
  lastWorkingDay: string;
  noticeDays: number;
  noticeServed: boolean;
  reason: string;
  status: ExitStatus;
  rehireEligible: boolean;
  remarks: string;
  submittedBy: 'employee' | 'hr';
  noticeWaived: boolean;
  acceptanceIssued: boolean;
  reportingManagerId: string | null;
  stepFlags: Record<string, boolean>;
  reportDeadline: string;
  createdAt: string;
}

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Skipped';
export interface ExitApproval { id: string; level: number; role: string; approverEmployeeId: string | null; approverName: string; status: ApprovalStatus; remarks: string; actedAt: string }

export interface ExitClearance { id: string; department: string; status: ClearanceStatus; remarks: string; clearedAt: string }

export interface ExitSettlement {
  id?: string;
  exitId: string;
  pendingSalary: number;
  leaveEncashDays: number;
  leaveEncashAmount: number;
  gratuityAmount: number;
  bonusAmount: number;
  loanRecovery: number;
  noticeRecovery: number;
  otherAdditions: number;
  otherDeductions: number;
  netSettlement: number;
  settledOn: string;
  status: SettlementStatus;
  remarks: string;
}

const daysBetween = (fromIso: string, toIso: string): number => {
  if (!fromIso || !toIso) return 0;
  const a = new Date(fromIso + 'T00:00:00').getTime();
  const b = new Date(toIso + 'T00:00:00').getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / (24 * 3600 * 1000)));
};

// ─── Exit records ─────────────────────────────────────────────────────────────

function rowToExit(r: Record<string, any>): ExitRecord {
  const e = r.employee ?? {};
  const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || (e.employee_id ?? 'Employee');
  return {
    id: r.id, employeeId: r.employee_id, employeeCode: e.employee_id ?? '', name,
    department: e.department?.name ?? '—', designation: e.designation?.name ?? '—', doj: e.date_of_joining ?? '',
    noticePeriodDays: num(e.notice_period_days),
    exitType: (r.exit_type ?? 'Resignation') as ExitType, resignationDate: r.resignation_date ?? '',
    lastWorkingDay: r.last_working_day ?? '', noticeDays: num(r.notice_days), noticeServed: !!r.notice_served,
    reason: r.reason ?? '', status: (r.status ?? 'Initiated') as ExitStatus, rehireEligible: !!r.rehire_eligible,
    remarks: r.remarks ?? '', submittedBy: (r.submitted_by === 'employee' ? 'employee' : 'hr'),
    noticeWaived: !!r.notice_waived, acceptanceIssued: !!r.acceptance_issued, reportingManagerId: e.reporting_manager_id ?? null,
    stepFlags: (r.step_flags && typeof r.step_flags === 'object') ? r.step_flags as Record<string, boolean> : {}, reportDeadline: r.report_deadline ?? '',
    createdAt: r.created_at ?? '',
  };
}

const EXIT_SELECT = 'id, employee_id, exit_type, resignation_date, last_working_day, notice_days, notice_served, reason, status, rehire_eligible, remarks, submitted_by, notice_waived, acceptance_issued, step_flags, report_deadline, created_at, employee:employees!employee_exits_employee_id_fkey(employee_id, first_name, middle_name, last_name, date_of_joining, notice_period_days, reporting_manager_id, designation:designations(name), department:departments(name))';

export async function loadExits(): Promise<ExitRecord[]> {
  const { data } = await xdb.from('employee_exits').select(EXIT_SELECT).order('created_at', { ascending: false });
  return ((data ?? []) as Record<string, any>[]).map(rowToExit);
}

export async function loadExit(id: string): Promise<ExitRecord | null> {
  const { data } = await xdb.from('employee_exits').select(EXIT_SELECT).eq('id', id).maybeSingle();
  return data ? rowToExit(data as Record<string, any>) : null;
}

export interface NewExit {
  employeeId: string;
  exitType: ExitType;
  resignationDate: string;
  lastWorkingDay: string;
  noticeDays: number;
  noticeServed: boolean;
  reason?: string;
  remarks?: string;
  rehireEligible?: boolean;
  submittedBy?: 'employee' | 'hr';
}

export async function createExit(x: NewExit): Promise<{ error: string | null; id?: string }> {
  if (!x.employeeId) return { error: 'Select an employee.' };
  const { data, error } = await xdb.from('employee_exits').insert({
    employee_id: x.employeeId, exit_type: x.exitType, resignation_date: x.resignationDate || null,
    last_working_day: x.lastWorkingDay || null, notice_days: num(x.noticeDays), notice_served: x.noticeServed,
    reason: x.reason ?? null, remarks: x.remarks ?? null, rehire_eligible: x.rehireEligible ?? true,
    submitted_by: x.submittedBy ?? 'hr', status: 'In Clearance', updated_at: new Date().toISOString(),
  } as never).select('id').single();
  if (error || !data) return { error: error?.message ?? 'Failed to create exit.' };
  const exitId = (data as { id: string }).id;
  // Seed the standard clearances.
  await xdb.from('exit_clearances').insert(CLEARANCE_DEPARTMENTS.map(d => ({ exit_id: exitId, department: d, status: 'Pending' })) as never);
  // Resignation has a 3-level approval chain.
  if (x.exitType === 'Resignation') await seedApprovals(exitId, x.employeeId);
  return { error: null, id: exitId };
}

/** Resignation submitted by the employee from Self-Service. */
export async function submitResignation(p: { employeeId: string; lastWorkingDay: string; reason?: string }): Promise<{ error: string | null; id?: string }> {
  const { data: emp } = await xdb.from('employees').select('notice_period_days').eq('id', p.employeeId).maybeSingle();
  const notice = num((emp as any)?.notice_period_days) || 30;
  return createExit({
    employeeId: p.employeeId, exitType: 'Resignation', resignationDate: new Date().toISOString().slice(0, 10),
    lastWorkingDay: p.lastWorkingDay, noticeDays: notice, noticeServed: true, reason: p.reason, submittedBy: 'employee',
  });
}

export async function updateExit(id: string, patch: Partial<NewExit>): Promise<{ error: string | null }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.exitType !== undefined) row.exit_type = patch.exitType;
  if (patch.resignationDate !== undefined) row.resignation_date = patch.resignationDate || null;
  if (patch.lastWorkingDay !== undefined) row.last_working_day = patch.lastWorkingDay || null;
  if (patch.noticeDays !== undefined) row.notice_days = num(patch.noticeDays);
  if (patch.noticeServed !== undefined) row.notice_served = patch.noticeServed;
  if (patch.reason !== undefined) row.reason = patch.reason;
  if (patch.remarks !== undefined) row.remarks = patch.remarks;
  if (patch.rehireEligible !== undefined) row.rehire_eligible = patch.rehireEligible;
  const { error } = await xdb.from('employee_exits').update(row).eq('id', id);
  return { error: error?.message ?? null };
}

export async function cancelExit(id: string): Promise<{ error: string | null }> {
  const { error } = await xdb.from('employee_exits').update({ status: 'Cancelled', updated_at: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}

// ─── Clearances ───────────────────────────────────────────────────────────────

export async function loadClearances(exitId: string): Promise<ExitClearance[]> {
  const { data } = await xdb.from('exit_clearances').select('id, department, status, remarks, cleared_at').eq('exit_id', exitId).order('created_at');
  return ((data ?? []) as Record<string, any>[]).map(r => ({
    id: r.id, department: r.department, status: (r.status ?? 'Pending') as ClearanceStatus, remarks: r.remarks ?? '', clearedAt: r.cleared_at ?? '',
  }));
}

export async function setClearance(id: string, status: ClearanceStatus, remarks?: string): Promise<{ error: string | null }> {
  const { error } = await xdb.from('exit_clearances').update({
    status, remarks: remarks ?? null, cleared_at: status === 'Cleared' ? new Date().toISOString() : null,
  } as never).eq('id', id);
  return { error: error?.message ?? null };
}

// ─── Full & Final computation ─────────────────────────────────────────────────

/** Current monthly Basic & Gross for an employee, from their salary assignment. */
async function salaryBasis(empId: string): Promise<{ basic: number; gross: number }> {
  const [assignment, structures] = await Promise.all([getEmployeeAssignment(empId), loadDbStructures()]);
  if (!assignment) return { basic: 0, gross: 0 };
  const structure = (structures as SalaryStructure[]).find(s => s.id === assignment.structureId);
  if (!structure) return { basic: 0, gross: 0 };
  const b = computeSalaryBreakdown(structure, assignment.ctcMonthly, assignment.componentValues);
  return { basic: round0(b.basicMonthly), gross: round0(b.grossMonthly + b.totalReimbursements) };
}

/** Suggested Full & Final based on the employee's real salary, tenure, leave & loans. */
export async function computeFnF(exit: ExitRecord): Promise<ExitSettlement> {
  const { basic, gross } = await salaryBasis(exit.employeeId);
  const perDayBasic = basic / 30;
  const perDayGross = gross / 30;

  // Gratuity — only when 5+ years (Payment of Gratuity Act); else 0.
  const years = exit.doj && exit.lastWorkingDay ? daysBetween(exit.doj, exit.lastWorkingDay) / 365.25 : 0;
  const gratuity = years >= 5 ? gratuityAmount(basic, years) : 0;

  // Leave encashment — sum of current-year closing balances × per-day Basic.
  const { data: lb } = await xdb.from('leave_balances').select('closing_balance').eq('employee_id', exit.employeeId);
  const leaveDays = ((lb ?? []) as Record<string, any>[]).reduce((s, r) => s + num(r.closing_balance), 0);
  const leaveAmount = round0(leaveDays * perDayBasic);

  // Loan / advance recovery — outstanding on active loans.
  const { data: loans } = await xdb.from('loans').select('outstanding_balance').eq('employee_id', exit.employeeId).eq('status', 'Active');
  const loanRecovery = round0(((loans ?? []) as Record<string, any>[]).reduce((s, r) => s + num(r.outstanding_balance), 0));

  // Pending salary — gross for the days worked in the last-working-day month (HR can edit).
  const lwdDay = exit.lastWorkingDay ? new Date(exit.lastWorkingDay + 'T00:00:00').getDate() : 0;
  const pendingSalary = round0(perDayGross * lwdDay);

  // Notice recovery — shortfall days when notice not served.
  const served = daysBetween(exit.resignationDate, exit.lastWorkingDay);
  const shortfall = exit.noticeServed ? 0 : Math.max(0, num(exit.noticeDays) - served);
  const noticeRecovery = round0(shortfall * perDayBasic);

  const net = pendingSalary + leaveAmount + gratuity - loanRecovery - noticeRecovery;
  return {
    exitId: exit.id, pendingSalary, leaveEncashDays: round0(leaveDays), leaveEncashAmount: leaveAmount,
    gratuityAmount: gratuity, bonusAmount: 0, loanRecovery, noticeRecovery, otherAdditions: 0, otherDeductions: 0,
    netSettlement: Math.max(0, net), settledOn: new Date().toISOString().slice(0, 10), status: 'Draft', remarks: '',
  };
}

export function netOfSettlement(s: ExitSettlement): number {
  return Math.round(
    num(s.pendingSalary) + num(s.leaveEncashAmount) + num(s.gratuityAmount) + num(s.bonusAmount) + num(s.otherAdditions)
    - num(s.loanRecovery) - num(s.noticeRecovery) - num(s.otherDeductions),
  );
}

export async function loadSettlement(exitId: string): Promise<ExitSettlement | null> {
  const { data } = await xdb.from('exit_settlements').select('*').eq('exit_id', exitId).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, any>;
  return {
    id: r.id, exitId: r.exit_id, pendingSalary: num(r.pending_salary), leaveEncashDays: num(r.leave_encash_days),
    leaveEncashAmount: num(r.leave_encash_amount), gratuityAmount: num(r.gratuity_amount), bonusAmount: num(r.bonus_amount),
    loanRecovery: num(r.loan_recovery), noticeRecovery: num(r.notice_recovery), otherAdditions: num(r.other_additions),
    otherDeductions: num(r.other_deductions), netSettlement: num(r.net_settlement), settledOn: r.settled_on ?? '',
    status: (r.status ?? 'Draft') as SettlementStatus, remarks: r.remarks ?? '',
  };
}

export async function saveSettlement(s: ExitSettlement, finalise = false): Promise<{ error: string | null }> {
  const net = netOfSettlement(s);
  const row = {
    exit_id: s.exitId, pending_salary: num(s.pendingSalary), leave_encash_days: num(s.leaveEncashDays),
    leave_encash_amount: num(s.leaveEncashAmount), gratuity_amount: num(s.gratuityAmount), bonus_amount: num(s.bonusAmount),
    loan_recovery: num(s.loanRecovery), notice_recovery: num(s.noticeRecovery), other_additions: num(s.otherAdditions),
    other_deductions: num(s.otherDeductions), net_settlement: net, settled_on: s.settledOn || new Date().toISOString().slice(0, 10),
    status: finalise ? 'Finalised' : 'Draft', remarks: s.remarks ?? null, updated_at: new Date().toISOString(),
  };
  const { error } = await xdb.from('exit_settlements').upsert(row as never, { onConflict: 'exit_id' });
  if (error) return { error: error.message };
  if (finalise) await xdb.from('employee_exits').update({ status: 'Settled', updated_at: new Date().toISOString() }).eq('id', s.exitId);
  return { error: null };
}

// ─── Resignation approval chain ───────────────────────────────────────────────

export const APPROVAL_LEVELS = [
  { level: 1, role: 'Reporting Manager' },
  { level: 2, role: 'Next-Level / Work-Location Manager' },
  { level: 3, role: 'HR Manager' },
] as const;

const empNameById = async (id: string | null): Promise<{ id: string | null; name: string }> => {
  if (!id) return { id: null, name: '' };
  const { data } = await xdb.from('employees').select('first_name, middle_name, last_name, employee_id').eq('id', id).maybeSingle();
  const r = data as Record<string, any> | null;
  return { id, name: r ? ([r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ') || r.employee_id || '') : '' };
};

/** Resolve the 3 approvers for an employee: reporting manager, the manager's manager, HR (admin). */
export async function resolveApprovers(employeeId: string): Promise<Array<{ id: string | null; name: string }>> {
  const { data: emp } = await xdb.from('employees').select('reporting_manager_id').eq('id', employeeId).maybeSingle();
  const mgrId = (emp as any)?.reporting_manager_id ?? null;
  const mgr = await empNameById(mgrId);
  let nextId: string | null = null;
  if (mgrId) { const { data: m2 } = await xdb.from('employees').select('reporting_manager_id').eq('id', mgrId).maybeSingle(); nextId = (m2 as any)?.reporting_manager_id ?? null; }
  const next = await empNameById(nextId);
  return [mgr, next, { id: null, name: '' }];   // L3 (HR) acted by HR admin
}

export async function seedApprovals(exitId: string, employeeId: string): Promise<void> {
  const approvers = await resolveApprovers(employeeId);
  await xdb.from('exit_approvals').insert(APPROVAL_LEVELS.map((l, i) => ({
    exit_id: exitId, level: l.level, role: l.role,
    approver_employee_id: approvers[i]?.id ?? null, approver_name: approvers[i]?.name || null, status: 'Pending',
  })) as never);
}

export async function loadApprovals(exitId: string): Promise<ExitApproval[]> {
  const { data } = await xdb.from('exit_approvals').select('id, level, role, approver_employee_id, approver_name, status, remarks, acted_at').eq('exit_id', exitId).order('level');
  return ((data ?? []) as Record<string, any>[]).map(r => ({
    id: r.id, level: num(r.level), role: r.role, approverEmployeeId: r.approver_employee_id ?? null,
    approverName: r.approver_name ?? '', status: (r.status ?? 'Pending') as ApprovalStatus, remarks: r.remarks ?? '', actedAt: r.acted_at ?? '',
  }));
}

/** Approve/reject one level. Only the lowest still-Pending level is actionable. */
export async function actApproval(id: string, decision: 'Approved' | 'Rejected', approverName: string, remarks?: string): Promise<{ error: string | null }> {
  const { error } = await xdb.from('exit_approvals').update({
    status: decision, approver_name: approverName || null, remarks: remarks ?? null, acted_at: new Date().toISOString(),
  } as never).eq('id', id);
  return { error: error?.message ?? null };
}

export interface PendingApproval { approvalId: string; exitId: string; level: number; role: string; employeeName: string; employeeCode: string; exitType: string; lastWorkingDay: string }

/** Exits awaiting THIS employee's approval (the lowest pending level whose approver is them). */
export async function loadPendingApprovalsForApprover(approverId: string): Promise<PendingApproval[]> {
  if (!approverId) return [];
  const { data } = await xdb.from('exit_approvals')
    .select('id, level, role, exit_id, exit:employee_exits!exit_approvals_exit_id_fkey(status, exit_type, last_working_day, employee:employees!employee_exits_employee_id_fkey(employee_id, first_name, middle_name, last_name))')
    .eq('approver_employee_id', approverId).eq('status', 'Pending');
  const rows = (data ?? []) as Record<string, any>[];
  const out: PendingApproval[] = [];
  for (const r of rows) {
    const ex = r.exit; if (!ex || ex.status === 'Cancelled' || ex.status === 'Relieved') continue;
    // Only actionable if all lower levels are already Approved.
    const { data: lowers } = await xdb.from('exit_approvals').select('status').eq('exit_id', r.exit_id).lt('level', r.level);
    if (((lowers ?? []) as Record<string, any>[]).some(l => l.status !== 'Approved')) continue;
    const e = ex.employee ?? {};
    out.push({ approvalId: r.id, exitId: r.exit_id, level: num(r.level), role: r.role,
      employeeName: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || e.employee_id || 'Employee',
      employeeCode: e.employee_id ?? '', exitType: ex.exit_type ?? '', lastWorkingDay: ex.last_working_day ?? '' });
  }
  return out;
}

export async function issueAcceptance(exitId: string): Promise<{ error: string | null }> {
  const { error } = await xdb.from('employee_exits').update({ acceptance_issued: true, updated_at: new Date().toISOString() }).eq('id', exitId);
  return { error: error?.message ?? null };
}
export async function waiveNotice(exitId: string, waived: boolean): Promise<{ error: string | null }> {
  const { error } = await xdb.from('employee_exits').update({ notice_waived: waived, updated_at: new Date().toISOString() }).eq('id', exitId);
  return { error: error?.message ?? null };
}

/** Mark a per-type workflow flag (show-cause / abandonment / retirement notice / condolence). */
export async function setStepFlag(exit: ExitRecord, key: string, value: boolean): Promise<{ error: string | null }> {
  const next = { ...exit.stepFlags, [key]: value };
  const { error } = await xdb.from('employee_exits').update({ step_flags: next, updated_at: new Date().toISOString() } as never).eq('id', exit.id);
  return { error: error?.message ?? null };
}
export async function setReportDeadline(exitId: string, date: string): Promise<{ error: string | null }> {
  const { error } = await xdb.from('employee_exits').update({ report_deadline: date || null, updated_at: new Date().toISOString() } as never).eq('id', exitId);
  return { error: error?.message ?? null };
}

// ─── Step state machine (derived) ─────────────────────────────────────────────

export interface StepDef { key: string; label: string }
const RESIGNATION_STEPS: StepDef[] = [
  { key: 'submitted', label: 'Resignation Submitted' },
  { key: 'mgr_approval', label: 'Reporting Manager Approval' },
  { key: 'next_approval', label: 'Next-Level / Work-Location Approval' },
  { key: 'hr_approval', label: 'HR Manager Approval' },
  { key: 'acceptance', label: 'Resignation Acceptance Letter' },
  { key: 'notice', label: 'Notice Period' },
  { key: 'clearance', label: 'Clearances' },
  { key: 'fnf', label: 'Full & Final Settlement' },
  { key: 'exit_docs', label: 'Exit Documents' },
  { key: 'relieved', label: 'Relieved' },
];
const DIRECT_STEPS: StepDef[] = [
  { key: 'clearance', label: 'Clearances' },
  { key: 'fnf', label: 'Full & Final Settlement' },
  { key: 'exit_docs', label: 'Exit Documents' },
  { key: 'relieved', label: 'Relieved' },
];
const ABSCONDING_STEPS: StepDef[] = [
  { key: 'show_cause', label: 'Show-Cause Notice' },
  { key: 'abandonment', label: 'Termination (Abandonment)' },
  { key: 'clearance', label: 'Clearances & Asset Recovery' },
  { key: 'fnf', label: 'Full & Final Settlement' },
  { key: 'exit_docs', label: 'Exit Documents' },
  { key: 'relieved', label: 'Relieved' },
];
const RETIREMENT_STEPS: StepDef[] = [
  { key: 'retirement_notice', label: 'Notice of Retirement' },
  { key: 'clearance', label: 'Clearances' },
  { key: 'fnf', label: 'Full & Final Settlement' },
  { key: 'exit_docs', label: 'Relieving Documents' },
  { key: 'relieved', label: 'Relieved' },
];
const DEATH_STEPS: StepDef[] = [
  { key: 'condolence', label: 'Condolence Letter (Nominee)' },
  { key: 'clearance', label: 'Clearances & Asset Recovery' },
  { key: 'fnf', label: 'Full & Final Settlement' },
  { key: 'relieved', label: 'Relieved' },
];
export const stepsFor = (exitType: ExitType): StepDef[] =>
  exitType === 'Resignation' ? RESIGNATION_STEPS
  : exitType === 'Absconding' ? ABSCONDING_STEPS
  : exitType === 'Retirement' ? RETIREMENT_STEPS
  : exitType === 'Death' ? DEATH_STEPS
  : DIRECT_STEPS;

export interface StepCtx { approvals: ExitApproval[]; clearances: ExitClearance[]; settlement: ExitSettlement | null; hasResignationLetter: boolean }

/** Whether a given step is complete, given the current sub-state. */
export function isStepDone(key: string, exit: ExitRecord, ctx: StepCtx): boolean {
  const approvalDone = (lvl: number) => ctx.approvals.find(a => a.level === lvl)?.status === 'Approved';
  switch (key) {
    case 'submitted': return ctx.hasResignationLetter;
    case 'mgr_approval': return approvalDone(1);
    case 'next_approval': return approvalDone(2);
    case 'hr_approval': return approvalDone(3);
    case 'acceptance': return exit.acceptanceIssued;
    case 'notice': return exit.noticeWaived || exit.status === 'Settled' || exit.status === 'Relieved';
    case 'show_cause': return !!exit.stepFlags.show_cause_issued;
    case 'abandonment': return !!exit.stepFlags.termination_issued;
    case 'retirement_notice': return !!exit.stepFlags.retirement_notice_issued;
    case 'condolence': return !!exit.stepFlags.condolence_sent;
    case 'clearance': return ctx.clearances.length > 0 && ctx.clearances.every(c => c.status === 'Cleared' || c.status === 'NA');
    case 'fnf': return ctx.settlement?.status === 'Finalised';
    case 'exit_docs': return exit.status === 'Relieved';
    case 'relieved': return exit.status === 'Relieved';
    default: return false;
  }
}

/** The first not-done step (the active step). */
export function currentStep(exit: ExitRecord, ctx: StepCtx): string {
  const steps = stepsFor(exit.exitType);
  return (steps.find(s => !isStepDone(s.key, exit, ctx)) ?? steps[steps.length - 1]).key;
}

// ─── Relieving ────────────────────────────────────────────────────────────────

/** Final step — mark inactive, set relieving date, exit → Relieved, BLOCK LOGIN and
 *  reassign the relieved employee's direct reports to the next level up. */
export async function relieveEmployee(exit: ExitRecord): Promise<{ error: string | null }> {
  const { error: e1 } = await xdb.from('employees').update({
    status: 'Inactive', relieving_date: exit.lastWorkingDay || new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString(),
  } as never).eq('id', exit.employeeId);
  if (e1) return { error: e1.message };
  // Block the system login for this employee.
  await xdb.from('system_users').update({ status: 'Inactive' } as never).eq('employee_id', exit.employeeId);
  // Update the hierarchy: move direct reports to the relieved employee's own manager.
  await xdb.from('employees').update({ reporting_manager_id: exit.reportingManagerId, updated_at: new Date().toISOString() } as never).eq('reporting_manager_id', exit.employeeId);
  const { error } = await xdb.from('employee_exits').update({ status: 'Relieved', updated_at: new Date().toISOString() }).eq('id', exit.id);
  return { error: error?.message ?? null };
}
