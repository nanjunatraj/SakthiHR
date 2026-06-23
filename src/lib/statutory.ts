// Statutory deduction computation (PF, ESI, Professional Tax) driven by the
// org-wide Payroll Settings (pf_esi_config) with optional per-employee overrides
// (employee_salary_assignments.statutory_overrides). Honors wage ceilings, the PF
// wage base rule, and the ESI eligibility ceiling. PT comes from the state slabs.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Org-wide settings (subset of pf_esi_config used for computation) ──────────

export interface StatutorySettings {
  pfEnabled: boolean;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfWageCeiling: number;
  pfApplyOn: 'Ceiling' | 'Actual';
  esiEnabled: boolean;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  esiWageCeiling: number;
  ptEnabled: boolean;
  /** Salary-component CODES whose amounts make up the PF / ESI wage base. Empty ⇒
   *  default behaviour (PF on Basic, ESI on gross). */
  pfWageComponents: string[];
  esiWageComponents: string[];
}

export const DEFAULT_STATUTORY_SETTINGS: StatutorySettings = {
  pfEnabled: true, pfEmployeeRate: 12, pfEmployerRate: 12, pfWageCeiling: 15000, pfApplyOn: 'Ceiling',
  esiEnabled: true, esiEmployeeRate: 0.75, esiEmployerRate: 3.25, esiWageCeiling: 21000,
  ptEnabled: true, pfWageComponents: [], esiWageComponents: [],
};

const toCodeList = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : []);

/** Sum the earning line items whose component code is in `codes` (the configured wage base);
 *  if no components are configured, fall back to the default base (Basic for PF, gross for ESI). */
export function wageBaseFromComponents(
  lineItems: Array<{ componentCode: string; componentType: string; amount: number }>,
  codes: string[],
  fallback: number,
): number {
  if (!codes || codes.length === 0) return fallback;
  const set = new Set(codes.map(c => c.toUpperCase()));
  return lineItems
    .filter(l => l.componentType === 'Earning' && set.has((l.componentCode || '').toUpperCase()))
    .reduce((s, l) => s + (l.amount || 0), 0);
}

export async function loadStatutorySettings(): Promise<StatutorySettings> {
  const { data } = await db.from('pf_esi_config')
    .select('pf_enabled, pf_employee_rate, pf_employer_rate, pf_wage_ceiling, pf_apply_on, esi_enabled, esi_employee_rate, esi_employer_rate, esi_wage_ceiling, professional_tax_enabled, pf_wage_components, esi_wage_components')
    .limit(1).maybeSingle();
  if (!data) return { ...DEFAULT_STATUTORY_SETTINGS };
  const r = data as Record<string, unknown>;
  return {
    pfEnabled: Boolean(r.pf_enabled), pfEmployeeRate: num(r.pf_employee_rate), pfEmployerRate: num(r.pf_employer_rate),
    pfWageCeiling: num(r.pf_wage_ceiling), pfApplyOn: (r.pf_apply_on as 'Ceiling' | 'Actual') ?? 'Ceiling',
    esiEnabled: Boolean(r.esi_enabled), esiEmployeeRate: num(r.esi_employee_rate), esiEmployerRate: num(r.esi_employer_rate),
    esiWageCeiling: num(r.esi_wage_ceiling), ptEnabled: Boolean(r.professional_tax_enabled),
    pfWageComponents: toCodeList(r.pf_wage_components), esiWageComponents: toCodeList(r.esi_wage_components),
  };
}

// Extra config (gratuity / bonus) needed for the CTC composition in the breakdown.
export interface PayrollSettingsForBreakdown {
  statutory: StatutorySettings;
  gratuityEnabled: boolean;
  bonusEnabled: boolean;
  bonusPercentage: number;
  bonusMinPercentage: number;   // statutory minimum (8.33%) — used for the CTC composition
  bonusMaxPercentage: number;   // statutory maximum (20%)
  bonusWageCeiling: number;     // bonus computed on min(bonus wages, this) — e.g. ₹7,000
  bonusEligibilityLimit: number; // eligible only when bonus wages ≤ this — e.g. ₹21,000
  bonusWageComponents: string[]; // component codes that make up the bonus wage base
  bonusExgratiaEnabled: boolean;    // pay ex-gratia to employees above the eligibility wage
  bonusExgratiaPercentage: number;  // ex-gratia % (on the bonus wage base, capped at the ceiling)
}

/** Live Payroll Settings (statutory + gratuity/bonus) for the salary breakdown / CTC. */
export function usePayrollSettingsForBreakdown(): PayrollSettingsForBreakdown | null {
  const [s, setS] = useState<PayrollSettingsForBreakdown | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await db.from('pf_esi_config').select('*').limit(1).maybeSingle();
      if (!active) return;
      const r = (data ?? {}) as Record<string, unknown>;
      setS({
        statutory: data ? {
          pfEnabled: Boolean(r.pf_enabled), pfEmployeeRate: num(r.pf_employee_rate), pfEmployerRate: num(r.pf_employer_rate),
          pfWageCeiling: num(r.pf_wage_ceiling), pfApplyOn: (r.pf_apply_on as 'Ceiling' | 'Actual') ?? 'Ceiling',
          esiEnabled: Boolean(r.esi_enabled), esiEmployeeRate: num(r.esi_employee_rate), esiEmployerRate: num(r.esi_employer_rate),
          esiWageCeiling: num(r.esi_wage_ceiling), ptEnabled: Boolean(r.professional_tax_enabled),
          pfWageComponents: toCodeList(r.pf_wage_components), esiWageComponents: toCodeList(r.esi_wage_components),
        } : { ...DEFAULT_STATUTORY_SETTINGS },
        gratuityEnabled: data ? Boolean(r.gratuity_enabled) : false,
        bonusEnabled: data ? Boolean(r.bonus_enabled) : false,
        bonusPercentage: data ? num(r.bonus_percentage) : 8.33,
        bonusMinPercentage: data ? (num(r.bonus_min_percentage) || 8.33) : 8.33,
        bonusMaxPercentage: data ? (num(r.bonus_max_percentage) || 20) : 20,
        bonusWageCeiling: data ? num(r.bonus_wage_ceiling) : 7000,
        bonusEligibilityLimit: data ? num(r.bonus_eligibility_limit) : 21000,
        bonusWageComponents: toCodeList(r.bonus_wage_components),
        bonusExgratiaEnabled: data ? Boolean(r.bonus_exgratia_enabled) : false,
        bonusExgratiaPercentage: data ? (num(r.bonus_exgratia_percentage) || 8.33) : 8.33,
      });
    })();
    return () => { active = false; };
  }, []);
  return s;
}

// ─── Per-employee overrides + effective resolution ────────────────────────────

export interface StatutoryOverrides {
  pf?: { eligible?: boolean; employeeRate?: number; employerRate?: number; ceiling?: number; applyOn?: 'Ceiling' | 'Actual' };
  esi?: { eligible?: boolean; employeeRate?: number; employerRate?: number; ceiling?: number };
  pt?: { eligible?: boolean };
}

export interface EffectiveStatutory {
  pf: { eligible: boolean; employeeRate: number; employerRate: number; ceiling: number; applyOn: 'Ceiling' | 'Actual' };
  esi: { eligible: boolean; employeeRate: number; employerRate: number; ceiling: number };
  pt: { eligible: boolean };
}

const pick = <T,>(o: T | undefined, def: T): T => (o === undefined || o === null ? def : o);

/** Merge org settings with the per-employee overrides into the effective values. */
export function resolveEffectiveStatutory(s: StatutorySettings, ov?: StatutoryOverrides | null): EffectiveStatutory {
  return {
    pf: {
      eligible: pick(ov?.pf?.eligible, s.pfEnabled),
      employeeRate: pick(ov?.pf?.employeeRate, s.pfEmployeeRate),
      employerRate: pick(ov?.pf?.employerRate, s.pfEmployerRate),
      ceiling: pick(ov?.pf?.ceiling, s.pfWageCeiling),
      applyOn: pick(ov?.pf?.applyOn, s.pfApplyOn),
    },
    esi: {
      eligible: pick(ov?.esi?.eligible, s.esiEnabled),
      employeeRate: pick(ov?.esi?.employeeRate, s.esiEmployeeRate),
      employerRate: pick(ov?.esi?.employerRate, s.esiEmployerRate),
      ceiling: pick(ov?.esi?.ceiling, s.esiWageCeiling),
    },
    pt: { eligible: pick(ov?.pt?.eligible, s.ptEnabled) },
  };
}

// ─── PT slabs ─────────────────────────────────────────────────────────────────

export interface PtSlab { state: string; gender: string; fromAmount: number; toAmount: number; monthlyAmount: number; isActive: boolean }

/** Monthly PT for a gross, from the slab set (already filtered to the state). */
export function ptForGross(slabs: PtSlab[], grossMonthly: number): number {
  const active = slabs.filter(s => s.isActive);
  const hit = active.find(s => grossMonthly >= s.fromAmount && (s.toAmount === 0 || s.toAmount >= 99999999 || grossMonthly <= s.toAmount));
  return hit ? hit.monthlyAmount : 0;
}

/** Load PT slabs for a given state (falls back to slabs with no state match → none). */
export async function loadPtSlabs(state: string | null): Promise<PtSlab[]> {
  let q = db.from('professional_tax_slabs').select('state, gender, from_amount, to_amount, monthly_amount, is_active').eq('is_active', true);
  if (state) q = q.eq('state', state);
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, unknown>>).map(r => ({
    state: (r.state as string) ?? '', gender: (r.gender as string) ?? 'All',
    fromAmount: num(r.from_amount), toAmount: num(r.to_amount), monthlyAmount: num(r.monthly_amount),
    isActive: Boolean(r.is_active),
  }));
}

// ─── Computation ──────────────────────────────────────────────────────────────

export interface StatutoryResult {
  pfEmployee: number;   // statutory employee PF (excl. VPF)
  pfEmployer: number;
  vpf: number;          // voluntary PF (extra employee contribution)
  esiEmployee: number; esiEmployer: number;
  pt: number;
}

/** Combined employee PF deduction shown on the wage = statutory PF + VPF. */
export const employeePf = (r: StatutoryResult) => r.pfEmployee + r.vpf;

/**
 * Compute statutory deductions for one month.
 * @param basicMonthly   the PF wage base component (Basic[+DA])
 * @param grossMonthly   monthly gross (ESI base + PT slab lookup)
 * @param ptMonthly      resolved PT amount from the state slab (see ptForGross)
 * @param vpfPercentage  voluntary PF % (on the PF base, ceiling-aware)
 */
export function computeStatutory(basicMonthly: number, grossMonthly: number, eff: EffectiveStatutory, ptMonthly: number, vpfPercentage = 0): StatutoryResult {
  // PF — on min(base, ceiling) when applyOn = Ceiling, else on actual base.
  const pfBase = eff.pf.applyOn === 'Ceiling' ? Math.min(basicMonthly, eff.pf.ceiling) : basicMonthly;
  const pfEmployee = eff.pf.eligible ? round2((eff.pf.employeeRate / 100) * pfBase) : 0;
  const pfEmployer = eff.pf.eligible ? round2((eff.pf.employerRate / 100) * pfBase) : 0;
  // Voluntary PF — extra employee contribution on the same (ceiling-aware) PF base.
  const vpf = eff.pf.eligible && vpfPercentage > 0 ? round2((vpfPercentage / 100) * pfBase) : 0;

  // ESI — only when gross is within the eligibility ceiling.
  const esiApplicable = eff.esi.eligible && grossMonthly > 0 && grossMonthly <= eff.esi.ceiling;
  const esiEmployee = esiApplicable ? round2((eff.esi.employeeRate / 100) * grossMonthly) : 0;
  const esiEmployer = esiApplicable ? round2((eff.esi.employerRate / 100) * grossMonthly) : 0;

  // Professional Tax — from the state slab (already resolved), gated by eligibility.
  const pt = eff.pt.eligible ? round2(ptMonthly) : 0;

  return { pfEmployee, pfEmployer, vpf, esiEmployee, esiEmployer, pt };
}
