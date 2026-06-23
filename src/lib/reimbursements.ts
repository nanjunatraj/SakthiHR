// Reimbursement framework. Employees are reimbursed expenses (with or without
// bills); claims can be raised by the employee (self-service) or against the
// employee by HR, then verified & closed in the Pre-Payroll process. Closed claims
// for a period are paid out in payroll. No mock data.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const rdb = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);

export const REIMBURSEMENT_CATEGORIES = [
  'Travel', 'Conveyance', 'Fuel', 'Medical', 'Mobile / Telephone', 'Internet',
  'Food / Meals', 'Books & Periodicals', 'Training', 'Relocation', 'General',
] as const;

export type ReimbursementStatus = 'Pending' | 'Verified' | 'Rejected' | 'Closed' | 'Paid';

export interface ReimbursementClaim {
  id: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  periodId: string | null;
  category: string;
  description: string;
  amount: number;
  hasBill: boolean;
  billReference: string;
  referenceNo: string;
  raisedBy: 'employee' | 'hr';
  status: ReimbursementStatus;
  verifiedBy: string;
  verifiedAt: string;
  remarks: string;
  rejectionReason: string;
  createdAt: string;
}

interface Meta { code: string; name: string; department: string }
async function loadMeta(): Promise<Map<string, Meta>> {
  const { data } = await rdb.from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, department:departments(name)')
    .order('first_name');
  const m = new Map<string, Meta>();
  ((data ?? []) as Record<string, any>[]).forEach(e => m.set(e.id, {
    code: e.employee_id ?? '', name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
    department: e.department?.name ?? '—',
  }));
  return m;
}

function rowToClaim(r: Record<string, any>, meta: Map<string, Meta>): ReimbursementClaim {
  const m = meta.get(r.employee_id);
  return {
    id: r.id, employeeId: r.employee_id, employeeCode: m?.code ?? '', name: m?.name ?? '—', department: m?.department ?? '—',
    periodId: r.payroll_period_id ?? null, category: r.category ?? 'General', description: r.description ?? '',
    amount: num(r.amount), hasBill: !!r.has_bill, billReference: r.bill_reference ?? '', referenceNo: r.reference_no ?? '',
    raisedBy: (r.raised_by === 'hr' ? 'hr' : 'employee'), status: (r.status ?? 'Pending') as ReimbursementStatus,
    verifiedBy: r.verified_by ?? '', verifiedAt: r.verified_at ?? '', remarks: r.remarks ?? '',
    rejectionReason: r.rejection_reason ?? '', createdAt: r.created_at ?? '',
  };
}

/** All claims, optionally scoped to a payroll period. Newest first. */
export async function loadClaims(periodId?: string | null): Promise<ReimbursementClaim[]> {
  const meta = await loadMeta();
  let q = rdb.from('reimbursement_claims')
    .select('id, employee_id, payroll_period_id, category, description, amount, has_bill, bill_reference, reference_no, raised_by, status, verified_by, verified_at, remarks, rejection_reason, created_at')
    .order('created_at', { ascending: false });
  if (periodId) q = q.eq('payroll_period_id', periodId);
  const { data } = await q;
  return ((data ?? []) as Record<string, any>[]).map(r => rowToClaim(r, meta));
}

/** Claims for one employee (self-service). */
export async function loadEmployeeClaims(employeeId: string): Promise<ReimbursementClaim[]> {
  if (!employeeId) return [];
  const meta = await loadMeta();
  const { data } = await rdb.from('reimbursement_claims')
    .select('id, employee_id, payroll_period_id, category, description, amount, has_bill, bill_reference, reference_no, raised_by, status, verified_by, verified_at, remarks, rejection_reason, created_at')
    .eq('employee_id', employeeId).order('created_at', { ascending: false });
  return ((data ?? []) as Record<string, any>[]).map(r => rowToClaim(r, meta));
}

export interface NewClaim {
  employeeId: string;
  periodId?: string | null;
  category: string;
  description?: string;
  amount: number;
  hasBill?: boolean;
  billReference?: string;
  referenceNo?: string;
  raisedBy?: 'employee' | 'hr';
  remarks?: string;
}

export async function createClaim(c: NewClaim): Promise<{ error: string | null }> {
  if (!c.employeeId) return { error: 'Employee is required.' };
  const { error } = await rdb.from('reimbursement_claims').insert({
    employee_id: c.employeeId, payroll_period_id: c.periodId ?? null, category: c.category || 'General',
    description: c.description ?? null, amount: num(c.amount), has_bill: !!c.hasBill, bill_reference: c.billReference ?? null,
    reference_no: c.referenceNo ?? null, raised_by: c.raisedBy ?? 'employee', status: 'Pending', remarks: c.remarks ?? null,
    updated_at: new Date().toISOString(),
  } as never);
  return { error: error?.message ?? null };
}

/** The current payroll period id (period containing today, else the latest). Used so
 *  employee-raised claims land in the period the Pre-Payroll stage reviews. */
export async function loadCurrentPeriodId(): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: cur } = await rdb.from('payroll_periods').select('id')
    .lte('from_date', today).gte('to_date', today).limit(1).maybeSingle();
  if ((cur as any)?.id) return (cur as any).id;
  const { data: latest } = await rdb.from('payroll_periods').select('id').order('from_date', { ascending: false }).limit(1).maybeSingle();
  return (latest as any)?.id ?? null;
}

/** Resolve an employee_id from an Employee ID code (for bulk import). */
export async function employeeIdFromCode(code: string): Promise<string | null> {
  const { data } = await rdb.from('employees').select('id').eq('employee_id', code.trim()).maybeSingle();
  return (data as any)?.id ?? null;
}

export async function verifyClaim(id: string, by = 'HR'): Promise<{ error: string | null }> {
  const { error } = await rdb.from('reimbursement_claims').update({
    status: 'Verified', verified_by: by, verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function rejectClaim(id: string, reason: string): Promise<{ error: string | null }> {
  const { error } = await rdb.from('reimbursement_claims').update({
    status: 'Rejected', rejection_reason: reason || 'Rejected', updated_at: new Date().toISOString(),
  }).eq('id', id);
  return { error: error?.message ?? null };
}

/** Close = approved for payout in payroll. */
export async function closeClaim(id: string): Promise<{ error: string | null }> {
  const { error } = await rdb.from('reimbursement_claims').update({
    status: 'Closed', updated_at: new Date().toISOString(),
  }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function reopenClaim(id: string): Promise<{ error: string | null }> {
  const { error } = await rdb.from('reimbursement_claims').update({
    status: 'Pending', rejection_reason: null, updated_at: new Date().toISOString(),
  } as never).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteClaim(id: string): Promise<{ error: string | null }> {
  const { error } = await rdb.from('reimbursement_claims').delete().eq('id', id);
  return { error: error?.message ?? null };
}

/** Verify + close every not-yet-finalised claim of a period (bulk close for the stage). */
export async function closeAllForPeriod(periodId: string): Promise<{ error: string | null; count: number }> {
  const claims = (await loadClaims(periodId)).filter(c => c.status === 'Pending' || c.status === 'Verified');
  if (!claims.length) return { error: null, count: 0 };
  const { error } = await rdb.from('reimbursement_claims').update({
    status: 'Closed', verified_by: 'HR', verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).in('id', claims.map(c => c.id));
  return { error: error?.message ?? null, count: claims.length };
}

export interface ReimbursementSummary { total: number; pending: number; verified: number; closed: number; rejected: number; amountClosed: number }
export function summarise(claims: ReimbursementClaim[]): ReimbursementSummary {
  return {
    total: claims.length,
    pending: claims.filter(c => c.status === 'Pending').length,
    verified: claims.filter(c => c.status === 'Verified').length,
    closed: claims.filter(c => c.status === 'Closed' || c.status === 'Paid').length,
    rejected: claims.filter(c => c.status === 'Rejected').length,
    amountClosed: claims.filter(c => c.status === 'Closed' || c.status === 'Paid').reduce((s, c) => s + c.amount, 0),
  };
}

/** Per-employee total of Closed reimbursement claims for a period (paid out in payroll). */
export async function loadClosedReimbursementByEmployee(periodId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!periodId) return out;
  const { data } = await rdb.from('reimbursement_claims')
    .select('employee_id, amount, status').eq('payroll_period_id', periodId).eq('status', 'Closed');
  ((data ?? []) as Record<string, any>[]).forEach(r => out.set(r.employee_id, (out.get(r.employee_id) ?? 0) + num(r.amount)));
  return out;
}
