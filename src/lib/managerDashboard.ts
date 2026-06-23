// Manager Dashboard data layer. A manager is an employee with direct reports
// (employees.reporting_manager_id = them). They see team attendance and act as
// FIRST-LEVEL approver (records manager_status; HR still finalizes) on their direct
// reports' Leaves / Loans / Reimbursements / Resignations, and view Increments.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { loadPendingApprovalsForApprover, type PendingApproval } from './employeeExit';
import { loadPayrollPeriods } from './attendancePeriods';

const mdb = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const nameOf = (e: { first_name?: string | null; middle_name?: string | null; last_name?: string | null } | null) =>
  e ? [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') : '';

export interface TeamMember { id: string; code: string; name: string; designation: string; department: string }

/** Active direct reports of a manager. */
export async function loadDirectReports(managerId: string): Promise<TeamMember[]> {
  const { data } = await mdb.from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, status, designation:designations(name), department:departments(name)')
    .eq('reporting_manager_id', managerId).neq('status', 'Inactive').order('first_name');
  return ((data ?? []) as Array<Record<string, any>>).map(e => ({
    id: e.id, code: e.employee_id ?? '', name: nameOf(e),
    designation: e.designation?.name ?? '—', department: e.department?.name ?? '—',
  }));
}

/** True when the employee has at least one active direct report (→ show the Manager tab). */
export async function isManager(employeeId?: string | null): Promise<boolean> {
  if (!employeeId) return false;
  const { count } = await mdb.from('employees').select('id', { count: 'exact', head: true })
    .eq('reporting_manager_id', employeeId).neq('status', 'Inactive');
  return (count ?? 0) > 0;
}

export interface TeamAttendance { employeeId: string; name: string; code: string; present: number; absent: number; leave: number; lop: number; halfDay: number; otHours: number }

/** Per-report attendance summary for the current payroll period. */
export async function loadTeamAttendance(managerId: string): Promise<{ periodName: string; rows: TeamAttendance[] }> {
  const reports = await loadDirectReports(managerId);
  if (reports.length === 0) return { periodName: '', rows: [] };
  const periods = await loadPayrollPeriods();
  const today = new Date().toISOString().split('T')[0];
  const period = periods.find(p => p.fromDate <= today && (p.toDate ?? '9999') >= today) ?? periods[0];
  const rows: TeamAttendance[] = reports.map(r => ({ employeeId: r.id, name: r.name, code: r.code, present: 0, absent: 0, leave: 0, lop: 0, halfDay: 0, otHours: 0 }));
  const byId = new Map(rows.map(r => [r.employeeId, r]));
  if (period) {
    const { data } = await mdb.from('attendance_records')
      .select('employee_id, status, overtime_hours')
      .in('employee_id', reports.map(r => r.id)).gte('attendance_date', period.fromDate).lte('attendance_date', period.toDate ?? period.fromDate);
    ((data ?? []) as Array<Record<string, any>>).forEach(a => {
      const row = byId.get(a.employee_id); if (!row) return;
      const s = String(a.status ?? '');
      if (s === 'Present') row.present++;
      else if (s === 'Absent') row.absent++;
      else if (s === 'LOP' || s === 'Loss of Pay') row.lop++;
      else if (s === 'Half Day') row.halfDay++;
      else if (/leave/i.test(s)) row.leave++;
      row.otHours += num(a.overtime_hours);
    });
  }
  return { periodName: period?.name ?? '', rows };
}

// ─── Approvals inbox ──────────────────────────────────────────────────────────

export interface MgrLeave { id: string; employeeId: string; name: string; code: string; leaveType: string; fromDate: string; toDate: string; days: number; reason: string; status: string }
export interface MgrLoan { id: string; employeeId: string; name: string; code: string; loanType: string; principal: number; tenure: number; emi: number; purpose: string; status: string }
export interface MgrReimb { id: string; employeeId: string; name: string; code: string; category: string; description: string; amount: number; hasBill: boolean; status: string }
export interface MgrIncrement { id: string; employeeId: string; name: string; code: string; title: string; oldCtc: number; newCtc: number; revStatus: string }

export interface ManagerApprovals {
  leaves: MgrLeave[];
  loans: MgrLoan[];
  reimbursements: MgrReimb[];
  resignations: PendingApproval[];
  increments: MgrIncrement[];
}

export async function loadManagerApprovals(managerId: string): Promise<ManagerApprovals> {
  const reports = await loadDirectReports(managerId);
  const ids = reports.map(r => r.id);
  if (ids.length === 0) {
    const resignations = await loadPendingApprovalsForApprover(managerId);
    return { leaves: [], loans: [], reimbursements: [], resignations, increments: [] };
  }
  const empSel = 'employee:employees!{fk}(employee_id, first_name, middle_name, last_name)';
  const [{ data: lv }, { data: ln }, { data: rb }, { data: inc }, resignations] = await Promise.all([
    mdb.from('leave_requests').select(`id, employee_id, leave_type_id, from_date, to_date, days, reason, status, manager_status, leave_type:leave_types(name), ${empSel.replace('{fk}', 'leave_requests_employee_id_fkey')}`)
      .in('employee_id', ids).eq('manager_status', 'Pending').order('created_at', { ascending: false }),
    mdb.from('loans').select(`id, employee_id, loan_type_id, principal_amount, tenure_months, emi_amount, purpose, status, manager_status, loan_type:loan_types(name), ${empSel.replace('{fk}', 'loans_employee_id_fkey')}`)
      .in('employee_id', ids).eq('manager_status', 'Pending').order('created_at', { ascending: false }),
    mdb.from('reimbursement_claims').select(`id, employee_id, category, description, amount, has_bill, status, manager_status, ${empSel.replace('{fk}', 'reimbursement_claims_employee_id_fkey')}`)
      .in('employee_id', ids).eq('manager_status', 'Pending').order('created_at', { ascending: false }),
    mdb.from('salary_revision_items').select(`id, employee_id, old_ctc_monthly, new_ctc_monthly, revision:salary_revisions(title, status), ${empSel.replace('{fk}', 'salary_revision_items_employee_id_fkey')}`)
      .in('employee_id', ids).order('created_at', { ascending: false }).limit(50),
    loadPendingApprovalsForApprover(managerId),
  ]);

  const leaves: MgrLeave[] = ((lv ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id, employeeId: r.employee_id, name: nameOf(r.employee), code: r.employee?.employee_id ?? '',
    leaveType: r.leave_type?.name ?? '—', fromDate: r.from_date ?? '', toDate: r.to_date ?? '', days: num(r.days), reason: r.reason ?? '', status: r.status ?? 'Pending',
  }));
  const loans: MgrLoan[] = ((ln ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id, employeeId: r.employee_id, name: nameOf(r.employee), code: r.employee?.employee_id ?? '',
    loanType: r.loan_type?.name ?? '—', principal: num(r.principal_amount), tenure: num(r.tenure_months), emi: num(r.emi_amount), purpose: r.purpose ?? '', status: r.status ?? 'Pending',
  }));
  const reimbursements: MgrReimb[] = ((rb ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id, employeeId: r.employee_id, name: nameOf(r.employee), code: r.employee?.employee_id ?? '',
    category: r.category ?? 'general', description: r.description ?? '', amount: num(r.amount), hasBill: Boolean(r.has_bill), status: r.status ?? 'Pending',
  }));
  const increments: MgrIncrement[] = ((inc ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id, employeeId: r.employee_id, name: nameOf(r.employee), code: r.employee?.employee_id ?? '',
    title: r.revision?.title ?? 'Salary Revision', oldCtc: num(r.old_ctc_monthly), newCtc: num(r.new_ctc_monthly), revStatus: r.revision?.status ?? '',
  }));
  return { leaves, loans, reimbursements, resignations, increments };
}

// ─── First-level actions (record manager recommendation) ──────────────────────

async function actManager(table: string, id: string, decision: 'Approved' | 'Rejected', managerId: string, remarks?: string): Promise<{ error: string | null }> {
  const { error } = await mdb.from(table).update({
    manager_status: decision, manager_id: managerId, manager_acted_on: new Date().toISOString(), manager_remarks: remarks ?? null,
  } as never).eq('id', id);
  return { error: error?.message ?? null };
}
export const managerActLeave = (id: string, decision: 'Approved' | 'Rejected', managerId: string, remarks?: string) => actManager('leave_requests', id, decision, managerId, remarks);
export const managerActLoan = (id: string, decision: 'Approved' | 'Rejected', managerId: string, remarks?: string) => actManager('loans', id, decision, managerId, remarks);
export const managerActReimbursement = (id: string, decision: 'Approved' | 'Rejected', managerId: string, remarks?: string) => actManager('reimbursement_claims', id, decision, managerId, remarks);

/** Total pending first-level approvals (for the nav badge). */
export async function pendingCount(managerId: string): Promise<number> {
  const a = await loadManagerApprovals(managerId);
  return a.leaves.length + a.loans.length + a.reimbursements.length + a.resignations.length;
}
