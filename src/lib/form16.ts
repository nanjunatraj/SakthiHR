// Form 16 (Part B-style annual TDS certificate) data + document. Everything is
// aggregated live from payroll_entries for the financial year — no mock data.
// Empty payroll ⇒ no certificates.

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { STANDARD_DEDUCTION, type TaxRegime } from './tax';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export interface Form16Row {
  employeeId: string;
  employeeCode: string;
  name: string;
  pan: string;
  regime: TaxRegime;
  designation: string;
  grossSalary: number;       // total gross paid in the FY
  standardDeduction: number; // by regime
  professionalTax: number;   // u/s 16 — total PT
  pfDeducted: number;        // total employee PF (info)
  taxableIncome: number;     // gross − std − PT
  tdsDeducted: number;       // total TDS deducted in the FY
  monthsPaid: number;        // # of payroll entries
}

export interface Employer {
  name: string;
  address: string;
  tan: string;
  pan: string;
}

export interface Form16Data {
  loading: boolean;
  fys: string[];
  rows: Form16Row[];
  employer: Employer;
}

interface EntryRow { employee_id: string; gross_salary: number | null; professional_tax: number | null; pf_employee: number | null; tds: number | null; }

export function useForm16Data(fy: string | null): Form16Data & { reload: () => Promise<void> } {
  const [state, setState] = useState<Form16Data>({ loading: true, fys: [], rows: [], employer: { name: '', address: '', tan: '', pan: '' } });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));

    // Employer (establishment single row) + a TAN from any work location.
    const [{ data: estData }, { data: locData }] = await Promise.all([
      db.from('establishment').select('name, address_line1, address_line2, city, state, pincode').limit(1).maybeSingle(),
      db.from('work_locations').select('tan_no, pan_no').not('tan_no', 'is', null).limit(1).maybeSingle(),
    ]);
    const est = estData as { name: string | null; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; pincode: string | null } | null;
    const employer: Employer = {
      name: est?.name ?? '—',
      address: [est?.address_line1, est?.address_line2, est?.city, est?.state, est?.pincode].filter(Boolean).join(', '),
      tan: (locData as { tan_no: string | null } | null)?.tan_no ?? '',
      pan: (locData as { pan_no: string | null } | null)?.pan_no ?? '',
    };

    // FY list from payroll periods that actually have entries.
    const { data: periodRows } = await db.from('payroll_periods').select('id, financial_year');
    const periods = (periodRows ?? []) as Array<{ id: string; financial_year: string | null }>;
    const allFys = [...new Set(periods.map(p => p.financial_year).filter(Boolean) as string[])].sort().reverse();

    if (!fy) { setState({ loading: false, fys: allFys, rows: [], employer }); return; }

    const fyPeriodIds = periods.filter(p => p.financial_year === fy).map(p => p.id);
    if (fyPeriodIds.length === 0) { setState({ loading: false, fys: allFys, rows: [], employer }); return; }

    const { data: entryRows } = await db.from('payroll_entries')
      .select('employee_id, gross_salary, professional_tax, pf_employee, tds')
      .in('payroll_period_id', fyPeriodIds);
    const entries = (entryRows ?? []) as EntryRow[];

    const agg = new Map<string, { gross: number; pt: number; pf: number; tds: number; months: number }>();
    for (const e of entries) {
      const a = agg.get(e.employee_id) ?? { gross: 0, pt: 0, pf: 0, tds: 0, months: 0 };
      a.gross += num(e.gross_salary); a.pt += num(e.professional_tax); a.pf += num(e.pf_employee); a.tds += num(e.tds); a.months += 1;
      agg.set(e.employee_id, a);
    }

    const empIds = [...agg.keys()];
    let employees: Array<{ id: string; employee_id: string | null; first_name: string | null; last_name: string | null; tax_regime: string | null; designation: { name: string | null } | null }> = [];
    let statutory: Array<{ employee_id: string; pan_no: string | null }> = [];
    if (empIds.length > 0) {
      const [{ data: empData }, { data: statData }] = await Promise.all([
        db.from('employees').select('id, employee_id, first_name, last_name, tax_regime, designation:designations(name)').in('id', empIds),
        db.from('employee_statutory').select('employee_id, pan_no').in('employee_id', empIds),
      ]);
      employees = (empData ?? []) as unknown as typeof employees;
      statutory = (statData ?? []) as unknown as typeof statutory;
    }
    const panByEmp = new Map(statutory.map(s => [s.employee_id, s.pan_no ?? '']));

    const rows: Form16Row[] = employees.map(emp => {
      const a = agg.get(emp.id)!;
      const regime: TaxRegime = emp.tax_regime === 'Old' ? 'Old' : 'New';
      const std = STANDARD_DEDUCTION[regime];
      const taxable = Math.max(0, a.gross - std - a.pt);
      return {
        employeeId: emp.id,
        employeeCode: emp.employee_id ?? '',
        name: [emp.first_name, emp.last_name].filter(Boolean).join(' ') || (emp.employee_id ?? 'Employee'),
        pan: panByEmp.get(emp.id) ?? '',
        regime,
        designation: emp.designation?.name ?? '',
        grossSalary: a.gross, standardDeduction: std, professionalTax: a.pt, pfDeducted: a.pf,
        taxableIncome: taxable, tdsDeducted: a.tds, monthsPaid: a.months,
      };
    }).sort((x, y) => x.name.localeCompare(y.name));

    setState({ loading: false, fys: allFys, rows, employer });
  }, [fy]);

  useEffect(() => { void load(); }, [load]);
  return { ...state, reload: load };
}

async function loadEmployer(): Promise<Employer> {
  const [{ data: estData }, { data: locData }] = await Promise.all([
    db.from('establishment').select('name, address_line1, address_line2, city, state, pincode').limit(1).maybeSingle(),
    db.from('work_locations').select('tan_no, pan_no').not('tan_no', 'is', null).limit(1).maybeSingle(),
  ]);
  const est = estData as { name: string | null; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; pincode: string | null } | null;
  return {
    name: est?.name ?? '—',
    address: [est?.address_line1, est?.address_line2, est?.city, est?.state, est?.pincode].filter(Boolean).join(', '),
    tan: (locData as { tan_no: string | null } | null)?.tan_no ?? '',
    pan: (locData as { pan_no: string | null } | null)?.pan_no ?? '',
  };
}

/** Financial years (with gross + TDS totals) for one employee — for self-service. */
export interface EmployeeFyTotal { fy: string; gross: number; tds: number; months: number; }
export async function getEmployeeForm16Years(employeeId: string): Promise<EmployeeFyTotal[]> {
  const { data: periodRows } = await db.from('payroll_periods').select('id, financial_year');
  const periods = (periodRows ?? []) as Array<{ id: string; financial_year: string | null }>;
  const fyByPeriod = new Map(periods.map(p => [p.id, p.financial_year ?? '']));
  const { data: entryRows } = await db.from('payroll_entries')
    .select('payroll_period_id, gross_salary, tds').eq('employee_id', employeeId);
  const byFy = new Map<string, EmployeeFyTotal>();
  for (const e of (entryRows ?? []) as Array<{ payroll_period_id: string; gross_salary: number | null; tds: number | null }>) {
    const fy = fyByPeriod.get(e.payroll_period_id) || '';
    if (!fy) continue;
    const t = byFy.get(fy) ?? { fy, gross: 0, tds: 0, months: 0 };
    t.gross += num(e.gross_salary); t.tds += num(e.tds); t.months += 1;
    byFy.set(fy, t);
  }
  return [...byFy.values()].sort((a, b) => b.fy.localeCompare(a.fy));
}

/** Build the Form 16 row + employer for a single employee + FY (self-service download). */
export async function getEmployeeForm16(employeeId: string, fy: string): Promise<{ row: Form16Row; employer: Employer } | null> {
  const employer = await loadEmployer();
  const { data: periodRows } = await db.from('payroll_periods').select('id').eq('financial_year', fy);
  const ids = (periodRows ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return null;
  const { data: entryRows } = await db.from('payroll_entries')
    .select('gross_salary, professional_tax, pf_employee, tds').eq('employee_id', employeeId).in('payroll_period_id', ids);
  const entries = (entryRows ?? []) as EntryRow[];
  if (entries.length === 0) return null;
  const agg = entries.reduce((a, e) => ({ gross: a.gross + num(e.gross_salary), pt: a.pt + num(e.professional_tax), pf: a.pf + num(e.pf_employee), tds: a.tds + num(e.tds), months: a.months + 1 }), { gross: 0, pt: 0, pf: 0, tds: 0, months: 0 });

  const { data: empData } = await db.from('employees').select('employee_id, first_name, last_name, tax_regime, designation:designations(name)').eq('id', employeeId).maybeSingle();
  const emp = empData as unknown as { employee_id: string | null; first_name: string | null; last_name: string | null; tax_regime: string | null; designation: { name: string | null } | null } | null;
  const { data: statData } = await db.from('employee_statutory').select('pan_no').eq('employee_id', employeeId).maybeSingle();
  const regime: TaxRegime = emp?.tax_regime === 'Old' ? 'Old' : 'New';
  const std = STANDARD_DEDUCTION[regime];
  const row: Form16Row = {
    employeeId, employeeCode: emp?.employee_id ?? '',
    name: [emp?.first_name, emp?.last_name].filter(Boolean).join(' ') || (emp?.employee_id ?? 'Employee'),
    pan: (statData as { pan_no: string | null } | null)?.pan_no ?? '', regime,
    designation: emp?.designation?.name ?? '',
    grossSalary: agg.gross, standardDeduction: std, professionalTax: agg.pt, pfDeducted: agg.pf,
    taxableIncome: Math.max(0, agg.gross - std - agg.pt), tdsDeducted: agg.tds, monthsPaid: agg.months,
  };
  return { row, employer };
}

/** Update an employee's tax regime (drives payroll TDS + Form 16). */
export async function updateEmployeeRegime(employeeId: string, regime: TaxRegime): Promise<{ error: string | null }> {
  const { error } = await db.from('employees').update({ tax_regime: regime, updated_at: new Date().toISOString() } as never).eq('id', employeeId);
  return { error: error?.message ?? null };
}

// ─── Form 16 (Part B-style) document ──────────────────────────────────────────

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function buildForm16Html(row: Form16Row, employer: Employer, fy: string): string {
  const assessmentYear = (() => {
    const start = parseInt(fy.slice(0, 4), 10);
    return Number.isNaN(start) ? '' : `${start + 1}-${String((start + 2) % 100).padStart(2, '0')}`;
  })();
  const r = (label: string, value: string, opts: { bold?: boolean; indent?: boolean } = {}) =>
    `<tr><td class="lbl" style="${opts.indent ? 'padding-left:28px;' : ''}${opts.bold ? 'font-weight:700;' : ''}">${label}</td><td class="val" style="${opts.bold ? 'font-weight:700;' : ''}">${value}</td></tr>`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Form 16 — ${row.name} — FY ${fy}</title>
<style>
  *{box-sizing:border-box;} body{font-family:'Segoe UI',Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a;}
  .bar{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;background:#1e293b;color:#fff;padding:10px 20px;}
  .bar button{background:#3b82f6;color:#fff;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;}
  .sheet{max-width:820px;margin:18px auto;background:#fff;border:1px solid #e2e8f0;padding:34px;}
  h1{font-size:17px;text-align:center;margin:0 0 2px;} .sub{text-align:center;font-size:12px;color:#475569;margin:0 0 18px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:12px;margin-bottom:16px;}
  .box{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;}
  .box h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;}
  .box p{margin:2px 0;font-size:12px;} .box .big{font-weight:700;font-size:13px;}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;}
  td{padding:7px 10px;border-bottom:1px solid #eef2f7;} td.val{text-align:right;font-variant-numeric:tabular-nums;}
  .total{background:#eff6ff;} .total td{font-weight:700;border-top:2px solid #bfdbfe;}
  .note{font-size:10px;color:#94a3b8;text-align:center;margin-top:18px;border-top:1px dashed #e2e8f0;padding-top:10px;}
  @media print{.bar{display:none;} body{background:#fff;} .sheet{border:none;margin:0;}}
</style></head>
<body>
  <div class="bar"><span style="font-size:13px;font-weight:600;">📄 Form 16 (Part B) — ${row.name} — FY ${fy}</span>
    <button onclick="window.print()">🖨️ Print / Save PDF</button></div>
  <div class="sheet">
    <h1>FORM 16 — PART B</h1>
    <p class="sub">Certificate of tax deducted at source on salary · Financial Year ${fy} · Assessment Year ${assessmentYear}</p>
    <div class="grid">
      <div class="box"><h3>Employer (Deductor)</h3><p class="big">${employer.name}</p><p>${employer.address || '—'}</p><p>TAN: ${employer.tan || '—'} &nbsp; PAN: ${employer.pan || '—'}</p></div>
      <div class="box"><h3>Employee (Deductee)</h3><p class="big">${row.name}</p><p>${row.designation || ''} ${row.employeeCode ? '· ' + row.employeeCode : ''}</p><p>PAN: ${row.pan || '—'} &nbsp; Regime: ${row.regime}</p></div>
    </div>
    <table>
      ${r('1. Gross Salary', inr(row.grossSalary), { bold: true })}
      ${r('2. Less: Standard Deduction u/s 16(ia)', inr(row.standardDeduction), { indent: true })}
      ${r('3. Less: Professional Tax u/s 16(iii)', inr(row.professionalTax), { indent: true })}
      ${r('4. Income chargeable under the head “Salaries”', inr(row.taxableIncome), { bold: true })}
      ${r('5. Employee PF contribution (for reference)', inr(row.pfDeducted), { indent: true })}
      ${r('6. Months paid in the FY', String(row.monthsPaid), { indent: true })}
      <tr class="total"><td>7. Total Tax Deducted at Source (TDS)</td><td class="val">${inr(row.tdsDeducted)}</td></tr>
    </table>
    <p class="note">This is a system-generated Part B-style statement compiled from payroll records. Part A (TRACES challan / quarterly acknowledgements) must be obtained from the TRACES portal. ${employer.name}</p>
  </div>
</body></html>`;
}

/** Open the Form 16 in a new window for print / save-as-PDF. */
export function openForm16(row: Form16Row, employer: Employer, fy: string): boolean {
  const html = buildForm16Html(row, employer, fy);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const win = window.open(url, '_blank', 'width=900,height=760,scrollbars=yes');
  if (!win) { URL.revokeObjectURL(url); return false; }
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return true;
}
