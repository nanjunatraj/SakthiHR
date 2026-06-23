// Statutory Bonus (Payment of Bonus Act) + Gratuity computations. Both read the
// org-wide Payroll Settings (pf_esi_config) and derive each employee's Basic from
// their current salary assignment + structure. No mock data.

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { loadDbStructures } from './salaryAssignments';
import { computeSalaryBreakdown, type SalaryStructure } from '../data/salaryStructures';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const round0 = (n: number) => Math.round(n);

// ─── Shared: each employee's Basic / gross from their current assignment ───────

export interface EmpSalaryBasis {
  employeeId: string;
  employeeCode: string;
  name: string;
  doj: string;            // date of joining (YYYY-MM-DD)
  basicMonthly: number;   // PF/bonus/gratuity base
  grossMonthly: number;
}

async function loadSalaryBasis(): Promise<EmpSalaryBasis[]> {
  const [{ data: assignRows }, structures] = await Promise.all([
    db.from('employee_salary_assignments')
      .select('employee_id, salary_structure_id, ctc_monthly, component_values, employees!employee_salary_assignments_employee_id_fkey(employee_id, first_name, last_name, status, date_of_joining)')
      .eq('is_current', true),
    loadDbStructures(),
  ]);
  const byId = new Map(structures.map((s: SalaryStructure) => [s.id, s]));
  const rows = (assignRows ?? []) as unknown as Array<{
    employee_id: string; salary_structure_id: string; ctc_monthly: number | null; component_values: Record<string, number> | null;
    employees: { employee_id: string | null; first_name: string | null; last_name: string | null; status: string | null; date_of_joining: string | null } | null;
  }>;
  return rows
    .filter(r => r.employees && r.employees.status !== 'Inactive' && byId.has(r.salary_structure_id))
    .map(r => {
      const b = computeSalaryBreakdown(byId.get(r.salary_structure_id)!, num(r.ctc_monthly), r.component_values ?? {});
      const name = [r.employees?.first_name, r.employees?.last_name].filter(Boolean).join(' ') || (r.employees?.employee_id ?? 'Employee');
      return {
        employeeId: r.employee_id, employeeCode: r.employees?.employee_id ?? '', name,
        doj: r.employees?.date_of_joining ?? '', basicMonthly: round0(b.basicMonthly), grossMonthly: round0(b.grossMonthly + b.totalReimbursements),
      };
    });
}

const yearsBetween = (fromIso: string, toIso: string): number => {
  if (!fromIso) return 0;
  const from = new Date(fromIso + 'T00:00:00');
  const to = new Date(toIso + 'T00:00:00');
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.max(0, (to.getTime() - from.getTime()) / (365.25 * 24 * 3600 * 1000));
};

// ─── Bonus (statutory) ─────────────────────────────────────────────────────────

export interface BonusConfig { enabled: boolean; percentage: number; wageCeiling: number; eligibilityLimit: number; exgratiaEnabled: boolean; exgratiaPercentage: number }

export interface BonusRow extends EmpSalaryBasis {
  eligible: boolean;
  isExgratia: boolean;     // paid as ex-gratia (above eligibility wage)
  bonusBase: number;       // min(Basic+DA, wage ceiling)
  monthlyBonus: number;    // monthly bonus OR ex-gratia paid
  annualBonus: number;
}

export interface BonusData { loading: boolean; config: BonusConfig; rows: BonusRow[]; }

export function useBonusData(): BonusData & { reload: () => Promise<void> } {
  const [state, setState] = useState<BonusData>({ loading: true, config: { enabled: false, percentage: 8.33, wageCeiling: 7000, eligibilityLimit: 21000, exgratiaEnabled: false, exgratiaPercentage: 8.33 }, rows: [] });
  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    const [{ data: cfg }, basis] = await Promise.all([
      db.from('pf_esi_config').select('bonus_enabled, bonus_percentage, bonus_wage_ceiling, bonus_eligibility_limit, bonus_exgratia_enabled, bonus_exgratia_percentage').limit(1).maybeSingle(),
      loadSalaryBasis(),
    ]);
    const c = (cfg ?? {}) as Record<string, unknown>;
    const config: BonusConfig = {
      enabled: Boolean(c.bonus_enabled), percentage: cfg ? num(c.bonus_percentage) : 8.33,
      wageCeiling: cfg ? num(c.bonus_wage_ceiling) : 7000, eligibilityLimit: cfg ? num(c.bonus_eligibility_limit) : 21000,
      exgratiaEnabled: Boolean(c.bonus_exgratia_enabled), exgratiaPercentage: cfg ? (num(c.bonus_exgratia_percentage) || 8.33) : 8.33,
    };
    const rows: BonusRow[] = basis.map(e => {
      const eligible = config.eligibilityLimit <= 0 || e.basicMonthly <= config.eligibilityLimit;
      const bonusBase = Math.min(e.basicMonthly, config.wageCeiling || e.basicMonthly);
      const isExgratia = !eligible && config.exgratiaEnabled;
      const rate = isExgratia ? config.exgratiaPercentage : config.percentage;
      const monthlyBonus = (eligible || isExgratia) ? round0((rate / 100) * bonusBase) : 0;
      return { ...e, eligible, isExgratia, bonusBase, monthlyBonus, annualBonus: monthlyBonus * 12 };
    }).sort((a, b) => a.name.localeCompare(b.name));
    setState({ loading: false, config, rows });
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { ...state, reload: load };
}

// ─── Gratuity ───────────────────────────────────────────────────────────────────

export interface GratuityConfig { enabled: boolean; formula: string; minYears: number; accrualEnabled: boolean }

export interface GratuityRow extends EmpSalaryBasis {
  yearsOfService: number;
  accrued: number;          // 15/26 × Basic × completed years (provision)
  eligibleForPayout: boolean;
}

export interface GratuityData { loading: boolean; config: GratuityConfig; rows: GratuityRow[]; }

/** Gratuity = (15/26) × monthly Basic × years of service. */
export function gratuityAmount(basicMonthly: number, years: number): number {
  return round0((15 / 26) * basicMonthly * years);
}

export function useGratuityData(): GratuityData & { reload: () => Promise<void> } {
  const [state, setState] = useState<GratuityData>({ loading: true, config: { enabled: false, formula: '', minYears: 5, accrualEnabled: true }, rows: [] });
  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    const [{ data: cfg }, basis] = await Promise.all([
      db.from('pf_esi_config').select('gratuity_enabled, gratuity_formula, gratuity_min_years, gratuity_accrual_enabled').limit(1).maybeSingle(),
      loadSalaryBasis(),
    ]);
    const c = (cfg ?? {}) as Record<string, unknown>;
    const config: GratuityConfig = {
      enabled: Boolean(c.gratuity_enabled), formula: (c.gratuity_formula as string) ?? '(Basic + DA) × 15/26 × Years of Service',
      minYears: cfg ? num(c.gratuity_min_years) : 5, accrualEnabled: cfg ? Boolean(c.gratuity_accrual_enabled) : true,
    };
    const today = new Date().toISOString().split('T')[0];
    const rows: GratuityRow[] = basis.map(e => {
      const yos = yearsBetween(e.doj, today);
      return { ...e, yearsOfService: yos, accrued: gratuityAmount(e.basicMonthly, yos), eligibleForPayout: yos >= config.minYears };
    }).sort((a, b) => b.yearsOfService - a.yearsOfService);
    setState({ loading: false, config, rows });
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { ...state, reload: load };
}

export interface GratuitySettlement { employeeId: string; settlementDate: string; yearsOfService: number; lastBasic: number; gratuityAmount: number; formula: string; remarks?: string }

/** Record a gratuity exit settlement. */
export async function recordGratuitySettlement(s: GratuitySettlement): Promise<{ error: string | null }> {
  const { error } = await db.from('gratuity_settlements').insert({
    employee_id: s.employeeId, settlement_date: s.settlementDate, years_of_service: s.yearsOfService,
    last_basic: s.lastBasic, gratuity_amount: s.gratuityAmount, formula: s.formula, remarks: s.remarks ?? null,
  } as never);
  return { error: error?.message ?? null };
}
