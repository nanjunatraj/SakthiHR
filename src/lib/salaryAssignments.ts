// DB-backed salary structure assignments. A single source of truth shared by
// the Salary Structure Assignment module and the Employee Master salary tab:
// assigning a structure writes employee_salary_assignments (with per-employee
// component_values), and Employee Master loads that same row so the structure is
// "copied" to the employee and can be personalised (Variable / Custom values).

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type {
  SalaryStructure, SalaryStructureComponent, ComponentType, CalculationBasis, ComponentValueType, StatutoryType,
} from '../data/salaryStructures';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

// ─── DB → rich SalaryStructure[] ──────────────────────────────────────────────

interface SscRow {
  salary_structure_id: string; salary_component_id: string; value: number | null;
  calculation_basis: string | null; sort_order: number | null; value_type: string | null;
  custom_values: unknown; selected_custom_value: number | null; formula: string | null;
  salary_components: { name: string | null; code: string | null; type: string | null; calculation_basis: string | null; statutory_type: string | null; round_off: string | null } | null;
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
    statutoryType: (meta?.statutory_type as StatutoryType) ?? 'none',
    roundOff: (meta?.round_off as SalaryStructureComponent['roundOff']) ?? 'nearest_1',
  };
}

/** Load every salary structure (with components) from the DB as rich SalaryStructure objects. */
export async function loadDbStructures(): Promise<SalaryStructure[]> {
  const [{ data: structRows }, { data: sscRows }] = await Promise.all([
    db.from('salary_structures').select('id, name, code, applicable_to, is_active, description').order('name'),
    db.from('salary_structure_components').select('salary_structure_id, salary_component_id, value, calculation_basis, sort_order, value_type, custom_values, selected_custom_value, formula, salary_components(name, code, type, calculation_basis, statutory_type, round_off)'),
  ]);
  const ssc = (sscRows ?? []) as unknown as SscRow[];
  return ((structRows ?? []) as Array<Record<string, unknown>>).map(st => ({
    id: st.id as string,
    name: (st.name as string) ?? '',
    code: (st.code as string) ?? '',
    applicableTo: (st.applicable_to as string[]) ?? [],
    isActive: st.is_active !== false,
    description: (st.description as string) ?? '',
    components: ssc.filter(r => r.salary_structure_id === st.id).sort((a, b) => num(a.sort_order) - num(b.sort_order)).map(toComponent),
  }));
}

/** Session-cached live list of DB salary structures. */
let structureCache: SalaryStructure[] | null = null;
export function useDbStructures(): SalaryStructure[] {
  const [rows, setRows] = useState<SalaryStructure[]>(() => structureCache ?? []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const s = await loadDbStructures();
      structureCache = s;
      if (active) setRows(s);
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

// ─── Per-employee assignment ──────────────────────────────────────────────────

export interface EmployeeAssignment {
  structureId: string;
  structureName: string;
  structureCode: string;
  ctcMonthly: number;
  componentValues: Record<string, number>;
  vpfPercentage: number;
}

/** The current salary assignment for an employee (or null). */
export async function getEmployeeAssignment(empId: string): Promise<EmployeeAssignment | null> {
  const { data } = await db.from('employee_salary_assignments')
    .select('salary_structure_id, ctc_monthly, component_values, vpf_percentage, is_current, salary_structures(name, code)')
    .eq('employee_id', empId).eq('is_current', true)
    .order('effective_from', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const r = data as unknown as { salary_structure_id: string; ctc_monthly: number | null; component_values: Record<string, number> | null; vpf_percentage: number | null; salary_structures: { name: string | null; code: string | null } | null };
  return {
    structureId: r.salary_structure_id,
    structureName: r.salary_structures?.name ?? '',
    structureCode: r.salary_structures?.code ?? '',
    ctcMonthly: num(r.ctc_monthly),
    componentValues: r.component_values ?? {},
    vpfPercentage: num(r.vpf_percentage),
  };
}

export interface UpsertAssignmentParams {
  empId: string;
  structureId: string;
  ctcMonthly: number;
  componentValues: Record<string, number>;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  /** Per-employee PF/ESI/PT eligibility, rates & ceilings (overrides Payroll Settings). */
  statutoryOverrides?: Record<string, unknown> | null;
  /** Voluntary PF % for this employee. */
  vpfPercentage?: number;
}

/**
 * Supersede the employee's current assignment WITHOUT deleting history (unlike
 * upsertEmployeeAssignment): close the open row (is_current=false, effective_to =
 * day before the new effective_from) and insert the new current row. Used by the
 * Salary Revision module so the revision trail is preserved.
 */
export async function supersedeEmployeeAssignment(p: {
  empId: string;
  structureId: string;
  ctcMonthly: number;
  componentValues: Record<string, number>;
  effectiveFrom: string;
  statutoryOverrides?: Record<string, unknown> | null;
  vpfPercentage?: number;
}): Promise<{ error: string | null }> {
  if (!p.empId || !p.structureId) return { error: 'Missing employee or structure.' };
  const d = new Date(p.effectiveFrom);
  d.setDate(d.getDate() - 1);
  const dayBefore = d.toISOString().split('T')[0];
  const close = await db.from('employee_salary_assignments')
    .update({ is_current: false, effective_to: dayBefore } as never)
    .eq('employee_id', p.empId).eq('is_current', true);
  if (close.error) return { error: close.error.message };
  const { error } = await db.from('employee_salary_assignments').insert({
    employee_id: p.empId,
    salary_structure_id: p.structureId,
    ctc_annual: Math.round(p.ctcMonthly * 12),
    ctc_monthly: Math.round(p.ctcMonthly),
    effective_from: p.effectiveFrom,
    effective_to: null,
    is_current: true,
    component_values: p.componentValues ?? {},
    statutory_overrides: p.statutoryOverrides ?? null,
    vpf_percentage: p.vpfPercentage ?? 0,
  } as never);
  return { error: error?.message ?? null };
}

/** Make this the employee's current assignment (replaces any prior current row). */
export async function upsertEmployeeAssignment(p: UpsertAssignmentParams): Promise<{ error: string | null }> {
  if (!p.empId || !p.structureId) return { error: null };
  const del = await db.from('employee_salary_assignments').delete().eq('employee_id', p.empId);
  if (del.error) return { error: del.error.message };
  const { error } = await db.from('employee_salary_assignments').insert({
    employee_id: p.empId,
    salary_structure_id: p.structureId,
    ctc_annual: Math.round(p.ctcMonthly * 12),
    ctc_monthly: Math.round(p.ctcMonthly),
    effective_from: p.effectiveFrom || new Date().toISOString().split('T')[0],
    effective_to: p.effectiveTo ?? null,
    is_current: true,
    component_values: p.componentValues ?? {},
    statutory_overrides: p.statutoryOverrides ?? null,
    vpf_percentage: p.vpfPercentage ?? 0,
  } as never);
  return { error: error?.message ?? null };
}
