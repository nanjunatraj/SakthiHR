// Salary Revision data layer. A revision proposes a Percentage/Amount change on a
// basis (CTC/Gross/Net/TakeHome), effective from a payroll period, for a scope of
// employees. createRevision solves each employee's new CTC/components via the shared
// salarySolver; applyRevision supersedes their assignment (history-preserving).

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { loadDbStructures, supersedeEmployeeAssignment } from './salaryAssignments';
import { loadStatutorySettings, loadPtSlabs, type StatutorySettings, type PtSlab, type StatutoryOverrides } from './statutory';
import { computeAllTotals, solveForTarget, type RevisionBasis } from './salarySolver';
import type { SalaryStructure, RoundCode } from '../data/salaryStructures';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export type RevisionMethod = 'Percentage' | 'Amount';
export const REVISION_METHODS: RevisionMethod[] = ['Percentage', 'Amount'];
export type RevisionScope = 'all' | 'location' | 'department' | 'designation' | 'category' | 'selected';
export const REVISION_SCOPES: { key: RevisionScope; label: string }[] = [
  { key: 'all', label: 'All Employees' },
  { key: 'location', label: 'By Work Location' },
  { key: 'department', label: 'By Department' },
  { key: 'designation', label: 'By Designation' },
  { key: 'category', label: 'By Employee Category' },
  { key: 'selected', label: 'Selected Employees' },
];

export type RevisionStatus = 'Proposed' | 'Approved' | 'Rejected' | 'Applied' | 'Cancelled';

export interface Revision {
  id: string;
  title: string;
  basis: RevisionBasis;
  method: RevisionMethod;
  value: number;
  payrollPeriodId: string | null;
  periodName: string;
  effectiveFrom: string;
  scope: RevisionScope;
  scopeRef: { id?: string; ids?: string[]; label?: string } | null;
  status: RevisionStatus;
  proposedBy: string;
  approvedBy: string;
  approvedAt: string | null;
  remarks: string;
  createdAt: string;
  itemCount: number;
}

export interface RevisionItem {
  id: string;
  revisionId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  structureId: string | null;
  oldCtcMonthly: number; oldGross: number; oldNet: number; oldTakehome: number;
  newCtcMonthly: number; newGross: number; newNet: number; newTakehome: number;
  newComponentValues: Record<string, number>;
  status: 'Pending' | 'Applied' | 'Skipped';
}

const empName = (e: { first_name?: string | null; middle_name?: string | null; last_name?: string | null } | null) =>
  e ? [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') : '';

// ─── Loads ────────────────────────────────────────────────────────────────────

function rowToRevision(r: Record<string, any>, count = 0): Revision {
  return {
    id: r.id, title: r.title ?? '', basis: (r.basis ?? 'CTC') as RevisionBasis, method: (r.method ?? 'Percentage') as RevisionMethod,
    value: num(r.value), payrollPeriodId: r.payroll_period_id ?? null, periodName: r.payroll_periods?.name ?? '',
    effectiveFrom: r.effective_from ?? '', scope: (r.scope ?? 'all') as RevisionScope, scopeRef: r.scope_ref ?? null,
    status: (r.status ?? 'Proposed') as RevisionStatus, proposedBy: r.proposed_by ?? '', approvedBy: r.approved_by ?? '',
    approvedAt: r.approved_at ?? null, remarks: r.remarks ?? '', createdAt: r.created_at ?? '', itemCount: count,
  };
}

export async function loadRevisions(): Promise<Revision[]> {
  const [{ data: revs }, { data: items }] = await Promise.all([
    db.from('salary_revisions').select('*, payroll_periods(name)').order('created_at', { ascending: false }),
    db.from('salary_revision_items').select('revision_id'),
  ]);
  const counts = new Map<string, number>();
  ((items ?? []) as Array<{ revision_id: string }>).forEach(i => counts.set(i.revision_id, (counts.get(i.revision_id) ?? 0) + 1));
  return ((revs ?? []) as Array<Record<string, any>>).map(r => rowToRevision(r, counts.get(r.id) ?? 0));
}

export async function loadRevision(id: string): Promise<Revision | null> {
  const { data } = await db.from('salary_revisions').select('*, payroll_periods(name)').eq('id', id).maybeSingle();
  if (!data) return null;
  const { count } = await db.from('salary_revision_items').select('id', { count: 'exact', head: true }).eq('revision_id', id);
  return rowToRevision(data as Record<string, any>, count ?? 0);
}

export async function loadRevisionItems(revisionId: string): Promise<RevisionItem[]> {
  const { data } = await db.from('salary_revision_items')
    .select('*, employee:employees!salary_revision_items_employee_id_fkey(employee_id, first_name, middle_name, last_name)')
    .eq('revision_id', revisionId).order('created_at');
  return ((data ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id, revisionId: r.revision_id, employeeId: r.employee_id,
    employeeName: empName(r.employee), employeeCode: r.employee?.employee_id ?? '',
    structureId: r.structure_id ?? null,
    oldCtcMonthly: num(r.old_ctc_monthly), oldGross: num(r.old_gross), oldNet: num(r.old_net), oldTakehome: num(r.old_takehome),
    newCtcMonthly: num(r.new_ctc_monthly), newGross: num(r.new_gross), newNet: num(r.new_net), newTakehome: num(r.new_takehome),
    newComponentValues: (r.new_component_values && typeof r.new_component_values === 'object') ? r.new_component_values : {},
    status: (r.status ?? 'Pending') as RevisionItem['status'],
  }));
}

// ─── Scope resolution ─────────────────────────────────────────────────────────

interface ScopeEmployee { id: string; code: string; name: string; workLocationId: string | null }

async function resolveScopeEmployees(scope: RevisionScope, scopeRef: Revision['scopeRef']): Promise<ScopeEmployee[]> {
  let q = db.from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, work_location_id, department_id, designation_id, employee_category_id')
    .eq('status', 'Active');
  if (scope === 'location' && scopeRef?.id) q = q.eq('work_location_id', scopeRef.id);
  else if (scope === 'department' && scopeRef?.id) q = q.eq('department_id', scopeRef.id);
  else if (scope === 'designation' && scopeRef?.id) q = q.eq('designation_id', scopeRef.id);
  else if (scope === 'category' && scopeRef?.id) q = q.eq('employee_category_id', scopeRef.id);
  else if (scope === 'selected' && scopeRef?.ids?.length) q = q.in('id', scopeRef.ids);
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, any>>).map(e => ({
    id: e.id, code: e.employee_id ?? '', name: empName(e), workLocationId: e.work_location_id ?? null,
  }));
}

// ─── Build (preview) + create ──────────────────────────────────────────────────

export interface RevisionInput {
  title: string;
  basis: RevisionBasis;
  method: RevisionMethod;
  value: number;
  payrollPeriodId: string;
  scope: RevisionScope;
  scopeRef: Revision['scopeRef'];
  proposedBy?: string;
}

export interface PreviewItem {
  employeeId: string; employeeName: string; employeeCode: string; structureId: string;
  oldCtcMonthly: number; oldGross: number; oldNet: number; oldTakehome: number;
  newCtcMonthly: number; newGross: number; newNet: number; newTakehome: number;
  newComponentValues: Record<string, number>;
  oldBasis: number; newBasis: number; clamped: boolean;
}
export interface RevisionPreview { effectiveFrom: string; periodName: string; items: PreviewItem[]; skipped: string[] }

const basisOf = (t: { ctcMonthly: number; gross: number; net: number; takeHome: number }, basis: RevisionBasis) =>
  basis === 'CTC' ? t.ctcMonthly : basis === 'Gross' ? t.gross : basis === 'Net' ? t.net : t.takeHome;

/** Compute the per-employee old→new figures for a revision (no persistence). */
export async function buildRevisionPreview(input: RevisionInput): Promise<RevisionPreview> {
  const { data: period } = await db.from('payroll_periods').select('name, from_date').eq('id', input.payrollPeriodId).maybeSingle();
  const effectiveFrom = (period as { from_date?: string } | null)?.from_date ?? new Date().toISOString().split('T')[0];
  const periodName = (period as { name?: string } | null)?.name ?? '';

  const emps = await resolveScopeEmployees(input.scope, input.scopeRef);
  if (emps.length === 0) return { effectiveFrom, periodName, items: [], skipped: [] };

  const [structures, settings, { data: assignRows }, { data: locRows }, { data: estRow }] = await Promise.all([
    loadDbStructures(),
    loadStatutorySettings(),
    db.from('employee_salary_assignments')
      .select('employee_id, salary_structure_id, ctc_monthly, component_values, statutory_overrides, vpf_percentage')
      .in('employee_id', emps.map(e => e.id)).eq('is_current', true),
    db.from('work_locations').select('id, state'),
    db.from('establishment').select('net_roundoff').limit(1).maybeSingle(),
  ]);
  const netRoundOff = ((estRow as { net_roundoff?: string } | null)?.net_roundoff ?? 'nearest_100') as RoundCode;
  const structById = new Map<string, SalaryStructure>(structures.map(s => [s.id, s]));
  const assignByEmp = new Map<string, Record<string, any>>(((assignRows ?? []) as Array<Record<string, any>>).map(a => [a.employee_id, a]));
  const stateByLoc = new Map<string, string>(((locRows ?? []) as Array<{ id: string; state: string | null }>).map(l => [l.id, l.state ?? '']));

  // PT slabs cached per state.
  const slabCache = new Map<string, PtSlab[]>();
  const slabsForState = async (state: string): Promise<PtSlab[]> => {
    if (!state) return [];
    if (slabCache.has(state)) return slabCache.get(state)!;
    const s = await loadPtSlabs(state);
    slabCache.set(state, s);
    return s;
  };

  const items: PreviewItem[] = [];
  const skipped: string[] = [];
  for (const e of emps) {
    const a = assignByEmp.get(e.id);
    const struct = a ? structById.get(a.salary_structure_id) : undefined;
    if (!a || !struct) { skipped.push(`${e.name} (${e.code}) — no current salary structure`); continue; }
    const componentValues: Record<string, number> = (a.component_values && typeof a.component_values === 'object') ? a.component_values : {};
    const overrides = (a.statutory_overrides ?? null) as StatutoryOverrides | null;
    const vpf = num(a.vpf_percentage);
    const ptSlabs = await slabsForState(e.workLocationId ? (stateByLoc.get(e.workLocationId) ?? '') : '');

    const oldTotals = computeAllTotals(struct, num(a.ctc_monthly), componentValues, settings, ptSlabs, overrides, vpf, netRoundOff);
    const oldBasis = basisOf(oldTotals, input.basis);
    const target = input.method === 'Percentage' ? oldBasis * (1 + input.value / 100) : oldBasis + input.value;
    const solved = solveForTarget(input.basis, target, struct, num(a.ctc_monthly), componentValues, settings, ptSlabs, overrides, vpf, netRoundOff);
    const nt = solved.totals;
    items.push({
      employeeId: e.id, employeeName: e.name, employeeCode: e.code, structureId: a.salary_structure_id,
      oldCtcMonthly: oldTotals.ctcMonthly, oldGross: oldTotals.gross, oldNet: oldTotals.net, oldTakehome: oldTotals.takeHome,
      newCtcMonthly: solved.ctcMonthly, newGross: nt.gross, newNet: nt.net, newTakehome: nt.takeHome,
      newComponentValues: solved.componentValues,
      oldBasis, newBasis: basisOf(nt, input.basis), clamped: solved.clamped,
    });
  }
  return { effectiveFrom, periodName, items, skipped };
}

/** Persist a revision (status Proposed) + its solved per-employee items. */
export async function createRevision(input: RevisionInput): Promise<{ id: string | null; itemCount: number; error: string | null }> {
  const preview = await buildRevisionPreview(input);
  if (preview.items.length === 0) return { id: null, itemCount: 0, error: 'No eligible employees with a current salary structure in this scope.' };
  const { data: header, error: e1 } = await db.from('salary_revisions').insert({
    title: input.title || 'Salary Revision',
    basis: input.basis, method: input.method, value: input.value,
    payroll_period_id: input.payrollPeriodId, effective_from: preview.effectiveFrom,
    scope: input.scope, scope_ref: input.scopeRef ?? null, status: 'Proposed',
    proposed_by: input.proposedBy ?? 'HR',
  } as never).select('id').single();
  if (e1 || !header) return { id: null, itemCount: 0, error: e1?.message ?? 'Failed to create revision.' };
  const revId = (header as { id: string }).id;
  const rows = preview.items.map(it => ({
    revision_id: revId, employee_id: it.employeeId, structure_id: it.structureId,
    old_ctc_monthly: it.oldCtcMonthly, old_gross: it.oldGross, old_net: it.oldNet, old_takehome: it.oldTakehome,
    new_ctc_monthly: it.newCtcMonthly, new_gross: it.newGross, new_net: it.newNet, new_takehome: it.newTakehome,
    new_component_values: it.newComponentValues, status: 'Pending',
  }));
  const { error: e2 } = await db.from('salary_revision_items').insert(rows as never);
  if (e2) return { id: revId, itemCount: 0, error: e2.message };
  return { id: revId, itemCount: rows.length, error: null };
}

// ─── Approvals + apply ──────────────────────────────────────────────────────────

export async function approveRevision(id: string, approver: string): Promise<{ error: string | null }> {
  const { error } = await db.from('salary_revisions').update({ status: 'Approved', approved_by: approver || 'HR', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq('id', id);
  return { error: error?.message ?? null };
}
export async function rejectRevision(id: string, remarks: string): Promise<{ error: string | null }> {
  const { error } = await db.from('salary_revisions').update({ status: 'Rejected', remarks, updated_at: new Date().toISOString() } as never).eq('id', id);
  return { error: error?.message ?? null };
}
export async function cancelRevision(id: string): Promise<{ error: string | null }> {
  const { error } = await db.from('salary_revisions').update({ status: 'Cancelled', updated_at: new Date().toISOString() } as never).eq('id', id);
  return { error: error?.message ?? null };
}

/**
 * Apply an Approved revision: supersede each employee's current assignment (history-preserving),
 * then compute back-period arrears into the chosen payout period (when given).
 */
export async function applyRevision(id: string, targetPeriodId?: string): Promise<{ error: string | null; applied: number; arrears?: { count: number; total: number } }> {
  const rev = await loadRevision(id);
  if (!rev) return { error: 'Revision not found.', applied: 0 };
  if (rev.status !== 'Approved') return { error: 'Only an Approved revision can be applied.', applied: 0 };
  const items = await loadRevisionItems(id);
  const pending = items.filter(i => i.status === 'Pending');

  // Prior statutory_overrides / vpf to carry forward, keyed by employee.
  const { data: priorRows } = await db.from('employee_salary_assignments')
    .select('employee_id, statutory_overrides, vpf_percentage')
    .in('employee_id', pending.map(i => i.employeeId)).eq('is_current', true);
  const priorByEmp = new Map<string, Record<string, any>>(((priorRows ?? []) as Array<Record<string, any>>).map(p => [p.employee_id, p]));

  let applied = 0;
  for (const it of pending) {
    if (!it.structureId) continue;
    const prior = priorByEmp.get(it.employeeId);
    const { error } = await supersedeEmployeeAssignment({
      empId: it.employeeId, structureId: it.structureId,
      ctcMonthly: it.newCtcMonthly, componentValues: it.newComponentValues,
      effectiveFrom: rev.effectiveFrom,
      statutoryOverrides: (prior?.statutory_overrides ?? null) as Record<string, unknown> | null,
      vpfPercentage: num(prior?.vpf_percentage),
    });
    if (error) return { error, applied };
    await db.from('salary_revision_items').update({ status: 'Applied', applied_at: new Date().toISOString() } as never).eq('id', it.id);
    applied++;
  }
  // Back-period arrears into the chosen payout period (processed months only).
  let arrears: { count: number; total: number } | undefined;
  if (targetPeriodId) arrears = await computeRevisionArrears(rev, items, targetPeriodId);

  const { error } = await db.from('salary_revisions').update({ status: 'Applied', updated_at: new Date().toISOString() } as never).eq('id', id);
  return { error: error?.message ?? null, applied, arrears };
}

export interface ArrearsRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  periodId: string | null;
  periodName: string;
  paidGross: number;
  revisedGross: number;
  arrearsAmount: number;
  status: string;
}

/**
 * For each Applied item, compute arrears for every PROCESSED payroll period between the
 * revision's effective month and the payout period: arrears = revised gross − the gross
 * actually paid that month. Inserts one salary_revision_arrears row per (employee, period).
 */
export async function computeRevisionArrears(rev: Revision, items: RevisionItem[], targetPeriodId: string): Promise<{ count: number; total: number }> {
  const { data: tp } = await db.from('payroll_periods').select('from_date').eq('id', targetPeriodId).maybeSingle();
  const targetFrom = (tp as { from_date?: string } | null)?.from_date;
  if (!targetFrom || !rev.effectiveFrom) return { count: 0, total: 0 };

  // Back-periods: effective month .. before the payout period.
  const { data: periodRows } = await db.from('payroll_periods')
    .select('id, name, from_date')
    .gte('from_date', rev.effectiveFrom).lt('from_date', targetFrom).order('from_date');
  const backPeriods = (periodRows ?? []) as Array<{ id: string; name: string; from_date: string }>;
  if (backPeriods.length === 0) return { count: 0, total: 0 };

  const empIds = items.map(i => i.employeeId);
  const periodIds = backPeriods.map(p => p.id);
  // Gross actually paid: latest payroll_entries per (employee, period).
  const { data: entryRows } = await db.from('payroll_entries')
    .select('employee_id, payroll_period_id, gross_salary')
    .in('employee_id', empIds).in('payroll_period_id', periodIds);
  const paidByKey = new Map<string, number>();
  ((entryRows ?? []) as Array<Record<string, any>>).forEach(e => { paidByKey.set(`${e.employee_id}|${e.payroll_period_id}`, num(e.gross_salary)); });

  // Clear any prior arrears for this revision (idempotent re-apply).
  await db.from('salary_revision_arrears').delete().eq('revision_id', rev.id);

  const rows: Array<Record<string, unknown>> = [];
  let total = 0;
  for (const it of items) {
    for (const p of backPeriods) {
      const key = `${it.employeeId}|${p.id}`;
      if (!paidByKey.has(key)) continue;           // not processed for this employee → skip
      const paidGross = paidByKey.get(key)!;
      const arrears = Math.round((it.newGross - paidGross) * 100) / 100;
      if (arrears <= 0) continue;
      total += arrears;
      rows.push({
        revision_id: rev.id, employee_id: it.employeeId, period_id: p.id, period_name: p.name,
        paid_gross: paidGross, revised_gross: it.newGross, arrears_amount: arrears,
        target_period_id: targetPeriodId, status: 'Pending',
      });
    }
  }
  if (rows.length > 0) await db.from('salary_revision_arrears').insert(rows as never);
  return { count: rows.length, total: Math.round(total * 100) / 100 };
}

/** Arrears rows for a revision (joined with employee + period) — for the detail view + statement. */
export async function loadRevisionArrears(revisionId: string): Promise<ArrearsRow[]> {
  const { data } = await db.from('salary_revision_arrears')
    .select('*, employee:employees!salary_revision_arrears_employee_id_fkey(employee_id, first_name, middle_name, last_name)')
    .eq('revision_id', revisionId).order('employee_id').order('period_name');
  return ((data ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id, employeeId: r.employee_id, employeeName: empName(r.employee), employeeCode: r.employee?.employee_id ?? '',
    periodId: r.period_id ?? null, periodName: r.period_name ?? '',
    paidGross: num(r.paid_gross), revisedGross: num(r.revised_gross), arrearsAmount: num(r.arrears_amount),
    status: r.status ?? 'Pending',
  }));
}
