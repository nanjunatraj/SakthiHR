// Shared salary engine for the Salary Revision module and the "enter a target
// Net Take-Home" reverse entry. Mirrors the exact breakdown the Employee Master
// salary tab displays (src/pages/EmployeeMaster.tsx ~3622-3688): structure
// breakdown + ceiling-aware PF/ESI/PT statutory + VPF. Take-home is monotonic
// increasing in CTC, so a target on any basis is found by bisection.

import { computeSalaryBreakdown, roundTo, type SalaryStructure, type SalaryBreakdown, type RoundCode } from '../data/salaryStructures';
import {
  wageBaseFromComponents, ptForGross, resolveEffectiveStatutory, computeStatutory,
  type StatutorySettings, type PtSlab, type StatutoryOverrides, type StatutoryResult,
} from './statutory';

export type RevisionBasis = 'CTC' | 'Gross' | 'Net' | 'TakeHome';
export const REVISION_BASES: { key: RevisionBasis; label: string; hint: string }[] = [
  { key: 'CTC', label: 'CTC', hint: 'Monthly cost-to-company' },
  { key: 'Gross', label: 'Gross', hint: 'Sum of earnings' },
  { key: 'Net', label: 'Net (pre-statutory)', hint: 'Gross − structure deductions' },
  { key: 'TakeHome', label: 'Take-Home', hint: 'Gross − all deductions incl. PF/ESI/PT' },
];

export interface SalaryTotals {
  ctcMonthly: number;
  breakdown: SalaryBreakdown;
  statutory: StatutoryResult;
  totalDeductions: number; // structure deductions with PF/ESI/PT swapped for statutory + VPF
  gross: number;           // sum of earnings
  net: number;             // pre-statutory: gross + reimb − structure deductions
  takeHome: number;        // final: gross + reimb − (structure ded w/ statutory swap + VPF)
}

/** Full monthly totals for a candidate CTC — identical maths to the Employee Master salary tab. */
export function computeAllTotals(
  structure: SalaryStructure,
  ctcMonthly: number,
  componentValues: Record<string, number>,
  settings: StatutorySettings,
  ptSlabs: PtSlab[],
  overrides: StatutoryOverrides | null,
  vpfPercentage: number,
  netRoundOff: RoundCode = 'nearest_100',
): SalaryTotals {
  const breakdown = computeSalaryBreakdown(structure, ctcMonthly, componentValues);
  const pfWages = wageBaseFromComponents(breakdown.lineItems, settings.pfWageComponents, breakdown.basicMonthly);
  const esiWages = wageBaseFromComponents(breakdown.lineItems, settings.esiWageComponents, breakdown.grossMonthly);
  const ptMonthly = ptForGross(ptSlabs, breakdown.grossMonthly);
  const eff = resolveEffectiveStatutory(settings, overrides);
  const statutory = computeStatutory(pfWages, esiWages, eff, ptMonthly, vpfPercentage || 0);

  let totalDeductions = breakdown.deductions.reduce((s, l) => s + (
    l.statutoryType === 'pf' ? statutory.pfEmployee
    : l.statutoryType === 'esi' ? statutory.esiEmployee
    : l.statutoryType === 'professional_tax' ? statutory.pt
    : l.amount
  ), 0);
  if (statutory.vpf > 0) totalDeductions += statutory.vpf;

  const gross = breakdown.grossMonthly;
  const net = breakdown.netMonthly; // gross + reimb − structure deductions (pre-statutory)
  const takeHome = Math.max(0, roundTo(breakdown.grossMonthly + breakdown.totalReimbursements - totalDeductions, netRoundOff));
  return { ctcMonthly, breakdown, statutory, totalDeductions, gross, net, takeHome };
}

export function basisValue(t: SalaryTotals, basis: RevisionBasis): number {
  switch (basis) {
    case 'CTC': return t.ctcMonthly;
    case 'Gross': return t.gross;
    case 'Net': return t.net;
    case 'TakeHome': return t.takeHome;
  }
}

export interface SolveResult {
  ctcMonthly: number;
  componentValues: Record<string, number>;
  totals: SalaryTotals;
  achieved: number;
  /** Scale factor applied to the current CTC + component values to reach the target. */
  scale: number;
  /** True when the target couldn't be reached (e.g. only a fixed deduction, nothing scalable). */
  clamped: boolean;
}

/** Nearest value in `allowed` to `target`; falls back to `fallback` when the list is empty. */
const nearestAllowed = (allowed: number[], target: number, fallback: number): number =>
  allowed.length ? allowed.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), allowed[0]) : fallback;

/**
 * Scale per-employee component values by `k`, honouring each component's rule:
 *  • Custom — snap to the nearest value in the component's listed (allowed) values.
 *  • Variable — free amount, rounded to the nearest rupee.
 * (Fixed-valueType components aren't stored here — they keep the structure value.)
 */
const scaleValues = (structure: SalaryStructure, cv: Record<string, number>, k: number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(cv)) {
    const comp = structure.components.find(c => c.componentId === id);
    const scaled = v * k;
    out[id] = comp?.valueType === 'custom'
      ? nearestAllowed(comp.customValues ?? [], scaled, v)
      : Math.round(scaled);
  }
  return out;
};

/**
 * Employee-Master balancing rule: while Basic exceeds the sum of the OTHER earnings
 * (i.e. Basic > Gross − Basic), step the Custom-valued earning components up to their
 * next higher listed value — smallest step first — until Basic is no longer greater,
 * or no Custom component can go higher. Returns the adjusted component values.
 */
export function balanceBasicViaCustom(
  structure: SalaryStructure,
  ctcMonthly: number,
  componentValues: Record<string, number>,
): Record<string, number> {
  const cv = { ...componentValues };
  const customs = structure.components.filter(c => c.componentType === 'Earning' && c.valueType === 'custom' && (c.customValues?.length ?? 0) > 0);
  if (customs.length === 0) return cv;
  for (let iter = 0; iter < 100; iter++) {
    const bd = computeSalaryBreakdown(structure, ctcMonthly, cv);
    if (bd.basicMonthly <= bd.grossMonthly - bd.basicMonthly) break; // Basic ≤ rest of earnings → balanced
    let pick: { id: string; next: number; step: number } | null = null;
    for (const c of customs) {
      const cur = cv[c.componentId] ?? c.selectedCustomValue;
      const next = [...(c.customValues ?? [])].sort((a, b) => a - b).find(v => v > cur);
      if (next === undefined) continue;
      if (!pick || (next - cur) < pick.step) pick = { id: c.componentId, next, step: next - cur };
    }
    if (!pick) break; // no Custom component has a higher tier available
    cv[pick.id] = pick.next;
  }
  return cv;
}

/**
 * Solve for the salary that yields `target` on `basis`, starting from the employee's
 * CURRENT CTC + component values. A single scale factor `k` is applied to BOTH the CTC
 * and every (per-employee) component value, so the structure scales proportionally —
 * this works whether the components are percentage-based (scale via CTC) or fixed-₹
 * (scale via their stored value). `k` is found by bisection (take-home is piecewise
 * linear in `k` due to PF/ESI ceilings & PT slabs).
 */
export function solveForTarget(
  basis: RevisionBasis,
  target: number,
  structure: SalaryStructure,
  currentCtcMonthly: number,
  componentValues: Record<string, number>,
  settings: StatutorySettings,
  ptSlabs: PtSlab[],
  overrides: StatutoryOverrides | null,
  vpfPercentage: number,
  netRoundOff: RoundCode = 'nearest_100',
): SolveResult {
  const baseCtc = currentCtcMonthly > 0 ? currentCtcMonthly : Math.max(target, 1);
  const totalsAt = (k: number) => computeAllTotals(structure, Math.max(0, baseCtc * k), scaleValues(structure, componentValues, k), settings, ptSlabs, overrides, vpfPercentage, netRoundOff);
  const valAt = (k: number) => basisValue(totalsAt(k), basis);

  const finalize = (k: number): SolveResult => {
    const ctcMonthly = Math.round(baseCtc * k);
    const cv = scaleValues(structure, componentValues, k);
    const totals = computeAllTotals(structure, ctcMonthly, cv, settings, ptSlabs, overrides, vpfPercentage, netRoundOff);
    const achieved = basisValue(totals, basis);
    return { ctcMonthly, componentValues: cv, totals, achieved, scale: k, clamped: Math.abs(achieved - target) > Math.max(100, target * 0.01) };
  };

  if (target <= 0) return finalize(0);

  let lo = 0;
  let hi = Math.max(4, (target / Math.max(valAt(1), 1)) * 2);
  let guard = 0;
  while (valAt(hi) < target && guard++ < 20) hi *= 2;

  let k = hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = valAt(mid);
    if (v < target) lo = mid; else hi = mid;
    k = mid;
    if (Math.abs(v - target) <= 1) break;
  }
  return finalize(k);
}
