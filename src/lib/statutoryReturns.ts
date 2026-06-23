// Statutory Returns — period-wise contribution data grouped by the work-location's
// statutory registration code (PF code / ESI code / PT no / TAN). Powers the Returns
// section of Statutory Reports, including EPFO ECR text-file generation.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);
const r0 = (n: number) => Math.round(n);

export type StatKind = 'pf' | 'esi' | 'pt' | 'tds';
const PF_WAGE_CEILING = 15000;   // EPS/EDLI statutory wage ceiling

export interface ReturnRow {
  employeeId: string; code: string; name: string;
  uan: string; pfAccount: string; esiNo: string; pan: string;
  grossWages: number; epfWages: number; epsWages: number; edliWages: number;
  eePF: number; epsContrib: number; erPF: number;
  esiEE: number; esiER: number;
  pt: number; tds: number;
  workingDays: number; presentDays: number; ncpDays: number;
}

export interface ReturnGroup {
  statCode: string;        // the grouping code value (or '—' when unset)
  statCodeLabel: string;   // "PF Code No." / "ESI Code No." / "PT Reg. No." / "TAN"
  location: string;        // work-location name(s)
  rows: ReturnRow[];
}

const CODE_LABEL: Record<StatKind, string> = {
  pf: 'PF Code No.', esi: 'ESI Code No.', pt: 'PT Reg. No.', tds: 'TAN',
};

export async function loadStatutoryReturn(kind: StatKind, periodId: string): Promise<{ hasRun: boolean; groups: ReturnGroup[] }> {
  if (!periodId) return { hasRun: false, groups: [] };
  const { data: runRows } = await db.from('payroll_runs')
    .select('id, run_date').eq('payroll_period_id', periodId).order('run_date', { ascending: false }).limit(1);
  const run = (runRows ?? [])[0] as { id: string } | undefined;
  if (!run) return { hasRun: false, groups: [] };

  const { data: ents } = await db.from('payroll_entries')
    .select('employee_id, basic_salary, gross_salary, pf_employee, pf_employer, esi_employee, esi_employer, professional_tax, tds, working_days, present_days, absent_days, employees(employee_id, first_name, middle_name, last_name, work_location:work_locations(name, epf_code_no, esi_code_no, pt_no, tan_no))')
    .eq('payroll_run_id', run.id);
  const entryRows = (ents ?? []) as Array<Record<string, any>>;
  const empIds = entryRows.map(e => e.employee_id);

  const statByEmp = new Map<string, Record<string, any>>();
  if (empIds.length) {
    const { data: stat } = await db.from('employee_statutory')
      .select('employee_id, uan_no, pf_account_no, esi_no, pan_no').in('employee_id', empIds);
    ((stat ?? []) as Array<Record<string, any>>).forEach(s => statByEmp.set(s.employee_id, s));
  }

  const codeOf = (wl: Record<string, any> | null): string => {
    const v = kind === 'pf' ? wl?.epf_code_no : kind === 'esi' ? wl?.esi_code_no : kind === 'pt' ? wl?.pt_no : wl?.tan_no;
    return (v && String(v).trim()) || '—';
  };

  const groups = new Map<string, ReturnGroup>();
  for (const e of entryRows) {
    const emp = e.employees ?? {}; const wl = emp.work_location ?? null; const s = statByEmp.get(e.employee_id) ?? {};
    const basic = num(e.basic_salary);
    const epsWages = Math.min(basic, PF_WAGE_CEILING);
    const eePF = num(e.pf_employee);
    const erTotal = num(e.pf_employer);
    const epsContrib = r0(0.0833 * epsWages);
    const row: ReturnRow = {
      employeeId: e.employee_id, code: emp.employee_id ?? '',
      name: [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') || (emp.employee_id ?? 'Employee'),
      uan: s.uan_no ?? '', pfAccount: s.pf_account_no ?? '', esiNo: s.esi_no ?? '', pan: s.pan_no ?? '',
      grossWages: num(e.gross_salary), epfWages: basic, epsWages, edliWages: epsWages,
      eePF, epsContrib, erPF: Math.max(0, erTotal - epsContrib),
      esiEE: num(e.esi_employee), esiER: num(e.esi_employer),
      pt: num(e.professional_tax), tds: num(e.tds),
      workingDays: num(e.working_days), presentDays: num(e.present_days),
      ncpDays: Math.max(0, num(e.absent_days)),
    };
    // Only include members relevant to the contribution type.
    if (kind === 'pf' && eePF <= 0 && erTotal <= 0) continue;
    if (kind === 'esi' && row.esiEE <= 0 && row.esiER <= 0) continue;
    if (kind === 'pt' && row.pt <= 0) continue;
    if (kind === 'tds' && row.tds <= 0) continue;

    const code = codeOf(wl);
    const g: ReturnGroup = groups.get(code) ?? { statCode: code, statCodeLabel: CODE_LABEL[kind], location: wl?.name ?? '—', rows: [] };
    if (g.location !== (wl?.name ?? '—') && !g.location.includes(wl?.name ?? '')) g.location = `${g.location}, ${wl?.name ?? '—'}`;
    g.rows.push(row);
    groups.set(code, g);
  }
  const out = [...groups.values()].map(g => ({ ...g, rows: g.rows.sort((a, b) => a.name.localeCompare(b.name)) }));
  out.sort((a, b) => a.statCode.localeCompare(b.statCode));
  return { hasRun: true, groups: out };
}

/** EPFO ECR text — one `#~#`-delimited line per member, for a single PF code group. */
export function generateEcrText(group: ReturnGroup): string {
  // UAN#~#NAME#~#GROSS#~#EPF_WAGES#~#EPS_WAGES#~#EDLI_WAGES#~#EE_EPF#~#EPS_CONTRIB#~#ER_EPF#~#NCP_DAYS#~#REFUND
  return group.rows.map(r => [
    r.uan || '', r.name, r0(r.grossWages), r0(r.epfWages), r0(r.epsWages), r0(r.edliWages),
    r0(r.eePF), r0(r.epsContrib), r0(r.erPF), r.ncpDays, 0,
  ].join('#~#')).join('\n');
}

export function downloadEcr(group: ReturnGroup, periodLabel: string) {
  const text = generateEcrText(group);
  const fname = `ECR_${(group.statCode || 'PFCODE').replace(/[^a-z0-9]+/gi, '')}_${periodLabel.replace(/[^a-z0-9]+/gi, '')}.txt`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Group totals helper for the UI / export. */
export function groupTotals(kind: StatKind, g: ReturnGroup): Record<string, number> {
  const sum = (f: (r: ReturnRow) => number) => g.rows.reduce((s, r) => s + f(r), 0);
  if (kind === 'pf') return { employees: g.rows.length, eePF: sum(r => r.eePF), epsContrib: sum(r => r.epsContrib), erPF: sum(r => r.erPF), total: sum(r => r.eePF + r.epsContrib + r.erPF) };
  if (kind === 'esi') return { employees: g.rows.length, esiEE: sum(r => r.esiEE), esiER: sum(r => r.esiER), total: sum(r => r.esiEE + r.esiER) };
  if (kind === 'pt') return { employees: g.rows.length, pt: sum(r => r.pt), total: sum(r => r.pt) };
  return { employees: g.rows.length, tds: sum(r => r.tds), total: sum(r => r.tds) };
}
