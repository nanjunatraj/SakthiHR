import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const pdb = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

// ─── Stages ─────────────────────────────────────────────────────────────────────

export type StageKey = 'leaves' | 'overtime' | 'deductions' | 'loans' | 'fund_contribution' | 'reimbursement' | 'arrears' | 'attendance';
export interface PreStage { key: StageKey; label: string; seq: number }

export const PRE_STAGES: PreStage[] = [
  { key: 'leaves', label: 'Leaves', seq: 1 },
  { key: 'overtime', label: 'Overtime', seq: 2 },
  { key: 'deductions', label: 'Deductions', seq: 3 },
  { key: 'loans', label: 'Loans & Advances', seq: 4 },
  { key: 'fund_contribution', label: 'Fund Contribution', seq: 5 },
  { key: 'reimbursement', label: 'Reimbursement', seq: 6 },
  { key: 'arrears', label: 'Arrears', seq: 7 },
  { key: 'attendance', label: 'Attendance Close', seq: 8 },
];

/** Deduction categories shown as groups in the Deductions stage (loan-advances handled by the Loans stage). */
export const DEDUCTION_GROUPS: { key: string; label: string }[] = [
  { key: 'damages-loss', label: 'Damage & Loss' },
  { key: 'fines', label: 'Fines' },
  { key: 'canteen', label: 'Canteen' },
  { key: 'society', label: 'Society' },
  { key: 'donations', label: 'Donations / Campaign' },
  { key: 'other-deductions', label: 'Other Deductions' },
];
export const dedGroupLabel = (k: string) => DEDUCTION_GROUPS.find(g => g.key === k)?.label ?? k;

// ─── Employee meta + period helpers ──────────────────────────────────────────────

interface Meta { code: string; name: string; department: string; designation: string }
async function loadMeta(): Promise<Map<string, Meta>> {
  const { data } = await pdb.from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, designation:designations(name), department:departments(name), status')
    .order('first_name');
  const m = new Map<string, Meta>();
  ((data ?? []) as Record<string, any>[]).forEach(e => m.set(e.id, {
    code: e.employee_id ?? '', name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
    department: e.department?.name ?? '—', designation: e.designation?.name ?? '—',
  }));
  return m;
}

export interface PeriodInfo { id: string; name: string; fromDate: string; toDate: string; status: string }
export async function loadPeriod(periodId: string): Promise<PeriodInfo | null> {
  const { data } = await pdb.from('payroll_periods').select('id, name, from_date, to_date, status').eq('id', periodId).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, any>;
  return { id: r.id, name: r.name ?? '', fromDate: r.from_date ?? '', toDate: r.to_date ?? '', status: r.status ?? 'Open' };
}

async function latestRunId(periodId: string): Promise<string | null> {
  const { data } = await pdb.from('payroll_runs').select('id').eq('payroll_period_id', periodId).order('run_date', { ascending: false }).limit(1);
  return ((data ?? [])[0] as { id: string } | undefined)?.id ?? null;
}

// ─── Stage status (close / reopen / completion) ──────────────────────────────────

export async function loadStageStatus(periodId: string): Promise<Record<StageKey, 'Open' | 'Closed'>> {
  const out = { leaves: 'Open', overtime: 'Open', deductions: 'Open', loans: 'Open', fund_contribution: 'Open', reimbursement: 'Open', arrears: 'Open', attendance: 'Open' } as Record<StageKey, 'Open' | 'Closed'>;
  const { data } = await pdb.from('payroll_precheck_stages').select('stage, status').eq('payroll_period_id', periodId);
  ((data ?? []) as Record<string, any>[]).forEach(r => { if (r.stage in out) out[r.stage as StageKey] = r.status === 'Closed' ? 'Closed' : 'Open'; });
  return out;
}

export async function setStage(periodId: string, stage: StageKey, status: 'Open' | 'Closed'): Promise<{ error: string | null }> {
  const { error } = await pdb.from('payroll_precheck_stages').upsert({
    payroll_period_id: periodId, stage, status, closed_at: status === 'Closed' ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }, { onConflict: 'payroll_period_id,stage' });
  return { error: error?.message ?? null };
}

/** period → { closed, total, allClosed } for gating the Run Payroll button. */
export async function loadPrecheckCompletion(): Promise<Map<string, { closed: number; total: number; allClosed: boolean }>> {
  const { data } = await pdb.from('payroll_precheck_stages').select('payroll_period_id, stage, status').eq('status', 'Closed');
  const byPeriod = new Map<string, Set<string>>();
  ((data ?? []) as Record<string, any>[]).forEach(r => {
    const s = byPeriod.get(r.payroll_period_id) ?? new Set<string>(); s.add(r.stage); byPeriod.set(r.payroll_period_id, s);
  });
  const out = new Map<string, { closed: number; total: number; allClosed: boolean }>();
  byPeriod.forEach((set, pid) => out.set(pid, { closed: set.size, total: PRE_STAGES.length, allClosed: set.size >= PRE_STAGES.length }));
  return out;
}

// ─── 1) Leaves ───────────────────────────────────────────────────────────────────

export interface LeaveRow { id: string; employeeId: string; name: string; code: string; department: string; leaveType: string; fromDate: string; toDate: string; days: number; reason: string; status: string }
export async function loadLeaves(period: PeriodInfo): Promise<LeaveRow[]> {
  const meta = await loadMeta();
  const { data } = await pdb.from('leave_requests')
    .select('id, employee_id, from_date, to_date, days, reason, status, leave_type:leave_types(name)')
    .lte('from_date', period.toDate).gte('to_date', period.fromDate).order('from_date');
  return ((data ?? []) as Record<string, any>[]).map(r => {
    const m = meta.get(r.employee_id);
    return { id: r.id, employeeId: r.employee_id, name: m?.name ?? '—', code: m?.code ?? '', department: m?.department ?? '—',
      leaveType: r.leave_type?.name ?? '—', fromDate: r.from_date ?? '', toDate: r.to_date ?? '', days: num(r.days), reason: r.reason ?? '', status: r.status ?? 'Pending' };
  });
}
export async function setLeaveStatus(id: string, status: 'Approved' | 'Rejected'): Promise<{ error: string | null }> {
  const { error } = await pdb.from('leave_requests').update({ status, approved_on: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}
export async function rejectAllPendingLeaves(period: PeriodInfo): Promise<{ error: string | null; count: number }> {
  const rows = (await loadLeaves(period)).filter(l => /pending/i.test(l.status));
  if (!rows.length) return { error: null, count: 0 };
  const { error } = await pdb.from('leave_requests').update({ status: 'Rejected', updated_at: new Date().toISOString() }).in('id', rows.map(r => r.id));
  return { error: error?.message ?? null, count: rows.length };
}

// ─── 2) Overtime ─────────────────────────────────────────────────────────────────

export interface OtRow { employeeId: string; name: string; code: string; department: string; otHours: number; otAmount: number }
export async function loadOvertime(period: PeriodInfo): Promise<OtRow[]> {
  const meta = await loadMeta();
  const { data: otCompRows } = await pdb.from('salary_components').select('overtime_multiplier, overtime_hours_per_month').eq('is_overtime', true).eq('is_active', true).limit(1);
  const otComp = (otCompRows ?? [])[0] as { overtime_multiplier: number | null; overtime_hours_per_month: number | null } | undefined;
  const mult = otComp ? num(otComp.overtime_multiplier) || 2 : 2;
  const divisor = otComp ? num(otComp.overtime_hours_per_month) || 208 : 208;
  const basicBy = new Map<string, number>();
  const runId = await latestRunId(period.id);
  if (runId) {
    const { data: ents } = await pdb.from('payroll_entries').select('employee_id, basic_salary').eq('payroll_run_id', runId);
    ((ents ?? []) as Record<string, any>[]).forEach(e => basicBy.set(e.employee_id, num(e.basic_salary)));
  }
  const { data: att } = await pdb.from('attendance_records').select('employee_id, overtime_hours').gte('attendance_date', period.fromDate).lte('attendance_date', period.toDate);
  const hoursBy = new Map<string, number>();
  ((att ?? []) as Record<string, any>[]).forEach(a => hoursBy.set(a.employee_id, (hoursBy.get(a.employee_id) ?? 0) + num(a.overtime_hours)));
  return [...hoursBy.entries()].filter(([, h]) => h > 0).map(([empId, h]) => {
    const m = meta.get(empId); const basic = basicBy.get(empId) ?? 0;
    return { employeeId: empId, name: m?.name ?? '—', code: m?.code ?? '', department: m?.department ?? '—', otHours: h, otAmount: Math.round((basic / divisor) * mult * h) };
  });
}

// ─── Arrears (salary-revision arrears targeted at this period) ────────────────────

export interface ArrearsRow { id: string; employeeId: string; name: string; code: string; department: string; backPeriod: string; paidGross: number; revisedGross: number; arrears: number; status: string }
export async function loadArrears(period: PeriodInfo): Promise<ArrearsRow[]> {
  const meta = await loadMeta();
  const { data } = await pdb.from('salary_revision_arrears')
    .select('id, employee_id, period_name, paid_gross, revised_gross, arrears_amount, status')
    .eq('target_period_id', period.id).order('employee_id');
  return ((data ?? []) as Record<string, any>[]).map(r => {
    const m = meta.get(r.employee_id);
    return {
      id: r.id, employeeId: r.employee_id, name: m?.name ?? '—', code: m?.code ?? '', department: m?.department ?? '—',
      backPeriod: r.period_name ?? '', paidGross: num(r.paid_gross), revisedGross: num(r.revised_gross),
      arrears: num(r.arrears_amount), status: r.status ?? 'Pending',
    };
  });
}

// ─── 3) Deductions (grouped) ─────────────────────────────────────────────────────

export interface DeductionRow { id: string; employeeId: string; name: string; code: string; category: string; description: string; amount: number; status: string; referenceNo: string }
async function loadDeductionsByCategories(period: PeriodInfo, categories: string[]): Promise<DeductionRow[]> {
  const meta = await loadMeta();
  const { data } = await pdb.from('deduction_entries')
    .select('id, employee_id, category, description, amount, status, reference_no')
    .eq('payroll_period_id', period.id).in('category', categories).order('created_at', { ascending: false });
  return ((data ?? []) as Record<string, any>[]).map(r => {
    const m = meta.get(r.employee_id);
    return { id: r.id, employeeId: r.employee_id, name: m?.name ?? '—', code: m?.code ?? '', category: r.category ?? '', description: r.description ?? '', amount: num(r.amount), status: r.status ?? 'Draft', referenceNo: r.reference_no ?? '' };
  });
}
export const loadDeductions = (period: PeriodInfo) => loadDeductionsByCategories(period, DEDUCTION_GROUPS.map(g => g.key));
export async function approveDeduction(id: string): Promise<{ error: string | null }> {
  const { error } = await pdb.from('deduction_entries').update({ status: 'Approved by Employee', employee_approval_status: 'Approved', employee_approval_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}
/** Approve every not-yet-approved deduction for a period (optionally a single category group). */
export async function fullApproveDeductions(period: PeriodInfo, category?: string): Promise<{ error: string | null; count: number }> {
  const rows = (await loadDeductionsByCategories(period, category ? [category] : DEDUCTION_GROUPS.map(g => g.key)))
    .filter(d => !/approved/i.test(d.status));
  if (!rows.length) return { error: null, count: 0 };
  const { error } = await pdb.from('deduction_entries').update({ status: 'Approved by Employee', employee_approval_status: 'Approved', employee_approval_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', rows.map(r => r.id));
  return { error: error?.message ?? null, count: rows.length };
}

// ─── 4) Loans & Advances ─────────────────────────────────────────────────────────

export interface LoanRow { id: string; employeeId: string; name: string; code: string; emi: number; outstanding: number; paidEmis: number; tenure: number; skipId: string | null; skipStatus: string | null }
export async function loadLoans(period: PeriodInfo): Promise<LoanRow[]> {
  const meta = await loadMeta();
  const { data: loans } = await pdb.from('loans').select('id, employee_id, emi_amount, outstanding_balance, paid_emis, tenure_months').eq('status', 'Active');
  const { data: skips } = await pdb.from('loan_emi_skip_requests').select('id, loan_id, status, hr_status, manager_status').eq('payroll_period_id', period.id);
  const skipByLoan = new Map<string, Record<string, any>>();
  ((skips ?? []) as Record<string, any>[]).forEach(s => skipByLoan.set(s.loan_id, s));
  return ((loans ?? []) as Record<string, any>[]).map(l => {
    const m = meta.get(l.employee_id); const sk = skipByLoan.get(l.id);
    return { id: l.id, employeeId: l.employee_id, name: m?.name ?? '—', code: m?.code ?? '', emi: num(l.emi_amount), outstanding: num(l.outstanding_balance), paidEmis: num(l.paid_emis), tenure: num(l.tenure_months),
      skipId: sk?.id ?? null, skipStatus: sk ? (sk.status ?? sk.hr_status ?? sk.manager_status ?? 'Pending') : null };
  });
}
export async function overrideSkip(skipId: string, decision: 'Approved' | 'Rejected'): Promise<{ error: string | null }> {
  const { error } = await pdb.from('loan_emi_skip_requests').update({ status: decision, hr_status: decision, hr_acted_on: new Date().toISOString(), hr_remarks: 'Overridden during Pre-Payroll check', updated_at: new Date().toISOString() }).eq('id', skipId);
  return { error: error?.message ?? null };
}

// ─── 5) Fund Contribution ────────────────────────────────────────────────────────

export interface FundRow { id: string; kind: 'VPF' | 'NPS' | 'Society'; employeeId: string; name: string; code: string; detail: string; amount: number; status: string }
export async function loadFundContributions(period: PeriodInfo): Promise<FundRow[]> {
  const meta = await loadMeta();
  const out: FundRow[] = [];
  // Voluntary PF % per employee (current assignment).
  const { data: asg } = await pdb.from('employee_salary_assignments').select('employee_id, vpf_percentage').eq('is_current', true);
  ((asg ?? []) as Record<string, any>[]).forEach(a => {
    const v = num(a.vpf_percentage);
    if (v > 0) { const m = meta.get(a.employee_id); out.push({ id: `vpf-${a.employee_id}`, kind: 'VPF', employeeId: a.employee_id, name: m?.name ?? '—', code: m?.code ?? '', detail: `Voluntary PF @ ${v}% of Basic`, amount: 0, status: 'Configured' }); }
  });
  // Society / welfare fund deductions needing employee approval.
  const society = await loadDeductionsByCategories(period, ['society']);
  society.forEach(d => out.push({ id: d.id, kind: 'Society', employeeId: d.employeeId, name: d.name, code: d.code, detail: d.description || 'Society / welfare fund', amount: d.amount, status: d.status }));
  return out;
}

// ─── 6) Attendance Close ─────────────────────────────────────────────────────────

export interface AttRow { employeeId: string; name: string; code: string; department: string; workingDays: number; marked: number; unmarked: number }
function datesInRange(from: string, to: string): string[] {
  const out: string[] = []; const d = new Date(from + 'T00:00:00'); const end = new Date(to + 'T00:00:00');
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  while (d <= end) { out.push(fmt(d)); d.setDate(d.getDate() + 1); }
  return out;
}
/** Per-employee marked vs non-marked working days (holidays/weekly-offs excluded). */
export async function loadAttendanceClose(period: PeriodInfo): Promise<{ rows: AttRow[]; workingDates: string[] }> {
  const meta = await loadMeta();
  const { data: hol } = await pdb.from('holidays').select('holiday_date, type').gte('holiday_date', period.fromDate).lte('holiday_date', period.toDate);
  const nonWorking = new Set<string>(((hol ?? []) as Record<string, any>[]).map(h => h.holiday_date));
  const workingDates = datesInRange(period.fromDate, period.toDate).filter(d => !nonWorking.has(d));
  const { data: att } = await pdb.from('attendance_records').select('employee_id, attendance_date').gte('attendance_date', period.fromDate).lte('attendance_date', period.toDate);
  const markedBy = new Map<string, Set<string>>();
  ((att ?? []) as Record<string, any>[]).forEach(a => { const s = markedBy.get(a.employee_id) ?? new Set<string>(); s.add(a.attendance_date); markedBy.set(a.employee_id, s); });
  // Only active employees.
  const rows: AttRow[] = [...meta.entries()].map(([empId, m]) => {
    const marked = workingDates.filter(d => markedBy.get(empId)?.has(d)).length;
    return { employeeId: empId, name: m.name, code: m.code, department: m.department, workingDays: workingDates.length, marked, unmarked: workingDates.length - marked };
  });
  return { rows, workingDates };
}
/** Mark every non-marked working day of every active employee as Loss of Pay. Idempotent. */
export async function markUnmarkedAsLOP(period: PeriodInfo): Promise<{ error: string | null; count: number }> {
  const { rows, workingDates } = await loadAttendanceClose(period);
  const { data: att } = await pdb.from('attendance_records').select('employee_id, attendance_date').gte('attendance_date', period.fromDate).lte('attendance_date', period.toDate);
  const has = new Set(((att ?? []) as Record<string, any>[]).map(a => `${a.employee_id}|${a.attendance_date}`));
  const inserts: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (r.unmarked === 0) continue;
    for (const d of workingDates) {
      if (!has.has(`${r.employeeId}|${d}`)) inserts.push({ employee_id: r.employeeId, attendance_date: d, status: 'LOP', remarks: 'Auto-marked Loss of Pay (Pre-Payroll attendance close)' });
    }
  }
  if (!inserts.length) return { error: null, count: 0 };
  const { error } = await pdb.from('attendance_records').insert(inserts);
  return { error: error?.message ?? null, count: inserts.length };
}
