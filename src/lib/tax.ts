// Income-tax / TDS computation. Slab rates are read from the DB (tds_slabs),
// configured per financial year + regime in Payroll Setup. The only statutory
// constants kept in code are the standard-deduction amounts (which the slab
// table can't express). Everything else is data-driven.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export type TaxRegime = 'New' | 'Old';

/** Standard deduction on salary income (FY 2024-25 onward). */
export const STANDARD_DEDUCTION: Record<TaxRegime, number> = { New: 75000, Old: 50000 };

export interface TaxSlab {
  fromAmount: number;
  toAmount: number;       // 0 or >= 1e9 means "and above"
  taxRate: number;        // %
  surchargeRate: number;  // %
  cessRate: number;       // % (health & education cess)
}

/** Indian financial year ("2025-26") for a date — FY starts 1 April. */
export function financialYearOf(dateIso: string): string {
  const d = new Date(dateIso + (dateIso.length <= 10 ? 'T00:00:00' : ''));
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // Jan–Mar belongs to prior FY
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Months elapsed in the FY up to and including the given month (Apr=1 … Mar=12). */
export function fyMonthIndex(dateIso: string): number {
  const d = new Date(dateIso + (dateIso.length <= 10 ? 'T00:00:00' : ''));
  return ((d.getMonth() - 3 + 12) % 12) + 1;
}

/** Annual tax on a taxable income given the slab set (already filtered to one
 *  regime + FY + applicable category), inclusive of surcharge & cess.
 *  Slabs are treated as marginal brackets. */
export function annualTaxFromSlabs(taxableIncome: number, slabs: TaxSlab[]): number {
  if (taxableIncome <= 0 || slabs.length === 0) return 0;
  const ordered = [...slabs].sort((a, b) => a.fromAmount - b.fromAmount);
  let tax = 0;
  let maxSurcharge = 0;
  let cess = 0;
  for (const s of ordered) {
    const upper = s.toAmount && s.toAmount < 1e9 ? s.toAmount : Infinity;
    if (taxableIncome <= s.fromAmount) continue;
    const slabIncome = Math.min(taxableIncome, upper) - s.fromAmount;
    if (slabIncome <= 0) continue;
    tax += (slabIncome * s.taxRate) / 100;
    // Surcharge/cess of the top applicable bracket govern (cess is uniform, 4%).
    maxSurcharge = Math.max(maxSurcharge, s.surchargeRate);
    cess = s.cessRate || cess;
  }
  const surcharge = (tax * maxSurcharge) / 100;
  const withSurcharge = tax + surcharge;
  const cessAmt = (withSurcharge * cess) / 100;
  return Math.round(withSurcharge + cessAmt);
}

export interface MonthlyTdsInput {
  /** Taxable gross for the current month (after exempt allowances). */
  monthlyTaxableGross: number;
  /** TDS already deducted earlier in this FY. */
  ytdTdsDeducted: number;
  /** Projected/known taxable gross already earned earlier this FY (excl. current month). */
  ytdTaxableGross: number;
  /** 1 = April … 12 = March. */
  fyMonth: number;
  regime: TaxRegime;
  slabs: TaxSlab[];
}

export interface MonthlyTdsResult {
  annualTaxableIncome: number;
  standardDeduction: number;
  annualTax: number;
  monthlyTds: number;
}

/**
 * Annualised-projection monthly TDS:
 *  projectedAnnualGross = ytdGross + monthlyGross × remaining months
 *  taxable = projectedAnnualGross − standard deduction
 *  annualTax = slab tax (incl. surcharge + cess)
 *  monthlyTds = (annualTax − ytdTdsDeducted) / remaining months
 */
export function computeMonthlyTds(p: MonthlyTdsInput): MonthlyTdsResult {
  const remaining = Math.max(1, 12 - p.fyMonth + 1);
  const projectedAnnualGross = p.ytdTaxableGross + p.monthlyTaxableGross * remaining;
  const std = STANDARD_DEDUCTION[p.regime];
  const annualTaxable = Math.max(0, projectedAnnualGross - std);
  const annualTax = annualTaxFromSlabs(annualTaxable, p.slabs);
  const monthlyTds = Math.max(0, Math.round((annualTax - p.ytdTdsDeducted) / remaining));
  return { annualTaxableIncome: annualTaxable, standardDeduction: std, annualTax, monthlyTds };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

interface SlabRow { regime: string | null; gender: string | null; from_amount: number | null; to_amount: number | null; tax_rate: number | null; surcharge_rate: number | null; cess_rate: number | null; }

/** Load the slab set for a financial year + regime (+ optional category), from DB. */
export async function loadSlabs(financialYear: string, regime: TaxRegime, appliesTo: string = 'All'): Promise<TaxSlab[]> {
  const { data } = await db.from('tds_slabs').select('regime, gender, from_amount, to_amount, tax_rate, surcharge_rate, cess_rate')
    .eq('financial_year', financialYear).eq('regime', regime);
  const rows = (data ?? []) as SlabRow[];
  // Prefer category-specific rows; fall back to 'All' when none match the category.
  const forCategory = rows.filter(r => (r.gender ?? 'All') === appliesTo);
  const chosen = forCategory.length > 0 ? forCategory : rows.filter(r => (r.gender ?? 'All') === 'All');
  return chosen.map(r => ({
    fromAmount: num(r.from_amount), toAmount: num(r.to_amount), taxRate: num(r.tax_rate),
    surchargeRate: num(r.surcharge_rate), cessRate: num(r.cess_rate),
  }));
}
