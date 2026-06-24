// Shared reporting data layer — every figure is aggregated live from the DB
// (payroll_entries, payroll_periods, employees, attendance_records, leave_requests,
// loans, …). No mock/hardcoded report data. Empty tables yield empty reports.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { loadReportLetterhead, letterheadPrintConfig } from './letters';
import type { LetterheadWrap } from './exportStatement';

const db = supabase as unknown as SupabaseClient;

/** Org-default letterhead print wrapper for report PDFs (null until loaded / when none configured). */
export function useReportLetterheadWrap(): LetterheadWrap | null {
  const [wrap, setWrap] = useState<LetterheadWrap | null>(null);
  useEffect(() => {
    let active = true;
    loadReportLetterhead().then(lh => { if (active) setWrap(letterheadPrintConfig(lh)); });
    return () => { active = false; };
  }, []);
  return wrap;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export interface MonthlyPayrollRow { month: string; period: string; gross: number; deductions: number; net: number; employees: number; }
export interface DeptPayrollRow { dept: string; gross: number; employees: number; }
export interface DeductionRow { name: string; amount: number; }

export interface PayrollSummary {
  loading: boolean;
  monthly: MonthlyPayrollRow[];
  byDept: DeptPayrollRow[];
  deductions: DeductionRow[];
}

/** Payroll-summary report data: monthly trend, department split, deduction breakdown. */
export function usePayrollSummary(): PayrollSummary {
  const [data, setData] = useState<PayrollSummary>({ loading: true, monthly: [], byDept: [], deductions: [] });

  useEffect(() => {
    let active = true;
    void (async () => {
      const [periodsRes, entriesRes, empRes] = await Promise.all([
        db.from('payroll_periods').select('id, name, from_date').order('from_date', { ascending: true }),
        db.from('payroll_entries').select('payroll_period_id, employee_id, gross_salary, total_deductions, net_salary, pf_employee, esi_employee, professional_tax, tds, loan_emi'),
        db.from('employees').select('id, department:departments(name)'),
      ]);
      const periods = (periodsRes.data ?? []) as Record<string, any>[];
      const entries = (entriesRes.data ?? []) as Record<string, any>[];
      const employees = (empRes.data ?? []) as Record<string, any>[];
      const deptByEmp = new Map<string, string>(employees.map(e => [e.id, e.department?.name ?? '—']));

      const monthly: MonthlyPayrollRow[] = periods.map(p => {
        const rows = entries.filter(e => e.payroll_period_id === p.id);
        const label = (p.name ?? '').split(' ')[0] || (p.from_date ? MONTHS[new Date(p.from_date).getMonth()] : '');
        return {
          month: label,
          period: p.from_date ? String(p.from_date).slice(0, 7) : '',
          gross: rows.reduce((s, r) => s + num(r.gross_salary), 0),
          deductions: rows.reduce((s, r) => s + num(r.total_deductions), 0),
          net: rows.reduce((s, r) => s + num(r.net_salary), 0),
          employees: new Set(rows.map(r => r.employee_id)).size,
        };
      }).filter(m => m.employees > 0 || m.gross > 0);

      // Latest period with entries drives the department split + deduction breakdown.
      const latestPeriod = [...periods].reverse().find(p => entries.some(e => e.payroll_period_id === p.id));
      const latestEntries = latestPeriod ? entries.filter(e => e.payroll_period_id === latestPeriod.id) : [];

      const deptMap = new Map<string, { gross: number; employees: Set<string> }>();
      latestEntries.forEach(e => {
        const dept = deptByEmp.get(e.employee_id) ?? '—';
        const cur = deptMap.get(dept) ?? { gross: 0, employees: new Set<string>() };
        cur.gross += num(e.gross_salary);
        cur.employees.add(e.employee_id);
        deptMap.set(dept, cur);
      });
      const byDept: DeptPayrollRow[] = [...deptMap.entries()].map(([dept, v]) => ({ dept, gross: v.gross, employees: v.employees.size }));

      const sum = (k: string) => latestEntries.reduce((s, e) => s + num(e[k]), 0);
      const deductions: DeductionRow[] = [
        { name: 'PF (Employee)', amount: sum('pf_employee') },
        { name: 'ESI (Employee)', amount: sum('esi_employee') },
        { name: 'Professional Tax', amount: sum('professional_tax') },
        { name: 'TDS', amount: sum('tds') },
        { name: 'Loan EMI', amount: sum('loan_emi') },
      ].filter(d => d.amount > 0);

      if (active) setData({ loading: false, monthly, byDept, deductions });
    })();
    return () => { active = false; };
  }, []);

  return data;
}

// ─── Pay-run report ────────────────────────────────────────────────────────────

export interface PayRunRow {
  id: string; period: string; code: string; runDate: string; status: string;
  employees: number; gross: number; deductions: number; net: number;
}
export interface PayslipRow {
  id: string; name: string; dept: string; location: string;
  basic: number; hra: number; special: number; gross: number;
  pf: number; esi: number; pt: number; tds: number; net: number;
}
export interface PayRunsData { loading: boolean; runs: PayRunRow[]; payslipsByRun: Record<string, PayslipRow[]>; }

export function usePayRuns(): PayRunsData {
  const [data, setData] = useState<PayRunsData>({ loading: true, runs: [], payslipsByRun: {} });
  useEffect(() => {
    let active = true;
    void (async () => {
      const [runsRes, entriesRes] = await Promise.all([
        db.from('payroll_runs').select('id, run_date, status, total_employees, total_gross, total_deductions, total_net, period:payroll_periods(name, code)').order('run_date', { ascending: false }),
        db.from('payroll_entries').select('payroll_run_id, employee_id, basic_salary, hra, special_allowance, gross_salary, pf_employee, esi_employee, professional_tax, tds, net_salary, employee:employees(first_name, middle_name, last_name, department:departments(name), work_location:work_locations(name))'),
      ]);
      const runs: PayRunRow[] = ((runsRes.data ?? []) as Record<string, any>[]).map(r => ({
        id: r.id,
        period: r.period?.name ?? '—',
        code: r.period?.code ?? '',
        runDate: r.run_date ?? '',
        status: r.status ?? 'Draft',
        employees: num(r.total_employees),
        gross: num(r.total_gross),
        deductions: num(r.total_deductions),
        net: num(r.total_net),
      }));
      const payslipsByRun: Record<string, PayslipRow[]> = {};
      ((entriesRes.data ?? []) as Record<string, any>[]).forEach(e => {
        const emp = e.employee;
        const row: PayslipRow = {
          id: e.employee_id,
          name: emp ? [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') : '—',
          dept: emp?.department?.name ?? '—',
          location: emp?.work_location?.name ?? '—',
          basic: num(e.basic_salary), hra: num(e.hra), special: num(e.special_allowance), gross: num(e.gross_salary),
          pf: num(e.pf_employee), esi: num(e.esi_employee), pt: num(e.professional_tax), tds: num(e.tds), net: num(e.net_salary),
        };
        (payslipsByRun[e.payroll_run_id] ??= []).push(row);
      });
      if (active) setData({ loading: false, runs, payslipsByRun });
    })();
    return () => { active = false; };
  }, []);
  return data;
}

// ─── Year-to-date report ─────────────────────────────────────────────────────

export interface YtdMonthlyRow { month: string; period: string; ytdGross: number; ytdPF: number; ytdESI: number; ytdTDS: number; }
export interface YtdEmployeeRow {
  id: string; name: string; dept: string; location: string; grade: string;
  ytdGross: number; ytdBasic: number; ytdHRA: number; ytdPF: number; ytdESI: number; ytdPT: number; ytdTDS: number; ytdNet: number;
}
export interface YtdData { loading: boolean; monthly: YtdMonthlyRow[]; employees: YtdEmployeeRow[]; }

export function useYTD(): YtdData {
  const [data, setData] = useState<YtdData>({ loading: true, monthly: [], employees: [] });
  useEffect(() => {
    let active = true;
    void (async () => {
      const [periodsRes, entriesRes, empRes] = await Promise.all([
        db.from('payroll_periods').select('id, name, from_date').order('from_date', { ascending: true }),
        db.from('payroll_entries').select('payroll_period_id, employee_id, basic_salary, hra, special_allowance, gross_salary, pf_employee, esi_employee, professional_tax, tds, net_salary'),
        db.from('employees').select('id, employee_id, first_name, middle_name, last_name, department:departments(name), work_location:work_locations(name), grade:employee_grades(name)'),
      ]);
      const periods = (periodsRes.data ?? []) as Record<string, any>[];
      const entries = (entriesRes.data ?? []) as Record<string, any>[];
      const employees = (empRes.data ?? []) as Record<string, any>[];

      let cumGross = 0, cumPF = 0, cumESI = 0, cumTDS = 0;
      const monthly: YtdMonthlyRow[] = [];
      periods.forEach(p => {
        const rows = entries.filter(e => e.payroll_period_id === p.id);
        if (rows.length === 0) return;
        cumGross += rows.reduce((s, r) => s + num(r.gross_salary), 0);
        cumPF += rows.reduce((s, r) => s + num(r.pf_employee), 0);
        cumESI += rows.reduce((s, r) => s + num(r.esi_employee), 0);
        cumTDS += rows.reduce((s, r) => s + num(r.tds), 0);
        monthly.push({
          month: (p.name ?? '').split(' ')[0] || (p.from_date ? MONTHS[new Date(p.from_date).getMonth()] : ''),
          period: p.from_date ? String(p.from_date).slice(0, 7) : '',
          ytdGross: cumGross, ytdPF: cumPF, ytdESI: cumESI, ytdTDS: cumTDS,
        });
      });

      const empById = new Map(employees.map(e => [e.id, e]));
      const agg = new Map<string, YtdEmployeeRow>();
      entries.forEach(e => {
        const emp = empById.get(e.employee_id);
        if (!emp) return;
        const cur = agg.get(e.employee_id) ?? {
          id: emp.employee_id ?? e.employee_id,
          name: [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' '),
          dept: emp.department?.name ?? '—', location: emp.work_location?.name ?? '—', grade: emp.grade?.name ?? '—',
          ytdGross: 0, ytdBasic: 0, ytdHRA: 0, ytdPF: 0, ytdESI: 0, ytdPT: 0, ytdTDS: 0, ytdNet: 0,
        };
        cur.ytdGross += num(e.gross_salary); cur.ytdBasic += num(e.basic_salary); cur.ytdHRA += num(e.hra);
        cur.ytdPF += num(e.pf_employee); cur.ytdESI += num(e.esi_employee); cur.ytdPT += num(e.professional_tax);
        cur.ytdTDS += num(e.tds); cur.ytdNet += num(e.net_salary);
        agg.set(e.employee_id, cur);
      });

      if (active) setData({ loading: false, monthly, employees: [...agg.values()] });
    })();
    return () => { active = false; };
  }, []);
  return data;
}

// ─── Statutory report (PF / ESI / TDS / PT) ─────────────────────────────────────

export interface PfRow { id: string; name: string; dept: string; location: string; uan: string; pfWages: number; empPF: number; empPFER: number; eps: number; edli: number; adminCharges: number; }
export interface EsiRow { id: string; name: string; dept: string; location: string; esiNo: string; grossWages: number; empESI: number; empESIER: number; }
export interface TdsRow { id: string; name: string; dept: string; location: string; pan: string; ytdGross: number; ytdTDS: number; tdsQ1: number; tdsQ2: number; tdsQ3: number; tdsQ4: number; }
export interface PtRow { state: string; employees: number; ptSlab: string; totalPT: number; remittanceDue: string; status: string; }
export interface StatutoryData { loading: boolean; pf: PfRow[]; esi: EsiRow[]; tds: TdsRow[]; pt: PtRow[]; }

export function useStatutory(): StatutoryData {
  const [data, setData] = useState<StatutoryData>({ loading: true, pf: [], esi: [], tds: [], pt: [] });
  useEffect(() => {
    let active = true;
    void (async () => {
      const [entriesRes, empRes, statRes] = await Promise.all([
        db.from('payroll_entries').select('employee_id, gross_salary, pf_employee, pf_employer, esi_employee, esi_employer, professional_tax, tds, basic_salary'),
        db.from('employees').select('id, employee_id, first_name, middle_name, last_name, department:departments(name), work_location:work_locations(name, state)'),
        db.from('employee_statutory').select('employee_id, uan_no, esi_no, pan_no'),
      ]);
      const entries = (entriesRes.data ?? []) as Record<string, any>[];
      const employees = (empRes.data ?? []) as Record<string, any>[];
      const stat = (statRes.data ?? []) as Record<string, any>[];
      const empById = new Map(employees.map(e => [e.id, e]));
      const statByEmp = new Map(stat.map(s => [s.employee_id, s]));
      const nm = (e: any) => [e?.first_name, e?.middle_name, e?.last_name].filter(Boolean).join(' ') || '—';

      // Aggregate entries per employee (across all loaded periods).
      const agg = new Map<string, { gross: number; pf: number; pfEr: number; esi: number; esiEr: number; pt: number; tds: number; base: number }>();
      entries.forEach(e => {
        const c = agg.get(e.employee_id) ?? { gross: 0, pf: 0, pfEr: 0, esi: 0, esiEr: 0, pt: 0, tds: 0, base: 0 };
        c.gross += num(e.gross_salary); c.pf += num(e.pf_employee); c.pfEr += num(e.pf_employer);
        c.esi += num(e.esi_employee); c.esiEr += num(e.esi_employer); c.pt += num(e.professional_tax);
        c.tds += num(e.tds); c.base += num(e.basic_salary);
        agg.set(e.employee_id, c);
      });

      const pf: PfRow[] = []; const esi: EsiRow[] = []; const tds: TdsRow[] = [];
      agg.forEach((v, empId) => {
        const e = empById.get(empId); const s = statByEmp.get(empId);
        const common = { id: e?.employee_id ?? empId, name: nm(e), dept: e?.department?.name ?? '—', location: e?.work_location?.name ?? '—' };
        if (v.pf > 0 || v.pfEr > 0) pf.push({ ...common, uan: s?.uan_no ?? '—', pfWages: v.base, empPF: v.pf, empPFER: v.pfEr, eps: 0, edli: 0, adminCharges: 0 });
        if (v.esi > 0 || v.esiEr > 0) esi.push({ ...common, esiNo: s?.esi_no ?? '—', grossWages: v.gross, empESI: v.esi, empESIER: v.esiEr });
        if (v.tds > 0) tds.push({ ...common, pan: s?.pan_no ?? '—', ytdGross: v.gross, ytdTDS: v.tds, tdsQ1: 0, tdsQ2: 0, tdsQ3: 0, tdsQ4: 0 });
      });

      // Professional tax grouped by the employee's work-location state.
      const ptMap = new Map<string, { employees: Set<string>; total: number }>();
      agg.forEach((v, empId) => {
        const e = empById.get(empId);
        const state = e?.work_location?.state ?? '—';
        const c = ptMap.get(state) ?? { employees: new Set<string>(), total: 0 };
        c.employees.add(empId); c.total += v.pt; ptMap.set(state, c);
      });
      const pt: PtRow[] = [...ptMap.entries()].map(([state, v]) => ({
        state, employees: v.employees.size, ptSlab: v.total > 0 ? 'As per state slab' : 'Nil',
        totalPT: v.total, remittanceDue: '—', status: v.total > 0 ? 'Pending' : 'N/A',
      }));

      if (active) setData({ loading: false, pf, esi, tds, pt });
    })();
    return () => { active = false; };
  }, []);
  return data;
}

// Shared payroll-period option list for the register period selectors.
export interface PeriodOption { id: string; name: string; code: string; fromDate: string; toDate: string; status: string; }
export const EMPTY_PERIOD_OPTION: PeriodOption = { id: '', name: '—', code: '', fromDate: '', toDate: '', status: '' };
export function usePayrollPeriodOptions(): PeriodOption[] {
  const [rows, setRows] = useState<PeriodOption[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await db.from('payroll_periods').select('id, name, code, from_date, to_date, status').order('from_date', { ascending: false });
      if (active) setRows(((data ?? []) as Record<string, any>[]).map(p => ({ id: p.id, name: p.name ?? '', code: p.code ?? '', fromDate: p.from_date ?? '', toDate: p.to_date ?? '', status: p.status ?? 'Open' })));
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

// ─── Statutory/wage/attendance/leave REGISTERS ──────────────────────────────────
// Each register aggregates live from its source table; empty tables → empty registers.

const EMP_META_SELECT =
  'id, employee_id, first_name, middle_name, last_name, date_of_joining, section, ' +
  'designation:designations(name), department:departments(name), work_location:work_locations(name), ' +
  'grade:employee_grades(name), employee_type:employee_types(name)';

interface EmpMeta { employeeCode: string; name: string; department: string; designation: string; location: string; grade: string; employeeType: string; doj: string; establishment: string; }

async function loadEmpMeta(): Promise<{ map: Map<string, EmpMeta>; establishment: string }> {
  const [empRes, estRes] = await Promise.all([
    db.from('employees').select(EMP_META_SELECT),
    db.from('establishment').select('name').limit(1).maybeSingle(),
  ]);
  const establishment = (estRes.data as any)?.name ?? '—';
  const map = new Map<string, EmpMeta>();
  ((empRes.data ?? []) as Record<string, any>[]).forEach(e => {
    map.set(e.id, {
      employeeCode: e.employee_id ?? '', name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
      department: e.department?.name ?? '—', designation: e.designation?.name ?? '—', location: e.work_location?.name ?? '—',
      grade: e.grade?.name ?? '—', employeeType: e.employee_type?.name ?? '—', doj: e.date_of_joining ?? '', establishment,
    });
  });
  return { map, establishment };
}

export interface EstablishmentInfo { name: string; address: string; netRoundoff: string; }

/** Establishment identity (name + composed address + net round-off) from the DB. */
export function useEstablishment(): EstablishmentInfo {
  const [info, setInfo] = useState<EstablishmentInfo>({ name: '', address: '', netRoundoff: 'nearest_100' });
  useEffect(() => {
    let active = true;
    void db.from('establishment').select('name, address_line1, address_line2, city, state, net_roundoff').limit(1).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const r = (data ?? {}) as Record<string, any>;
        const address = [r.address_line1, r.address_line2, r.city, r.state].filter(Boolean).join(', ');
        setInfo({ name: r.name ?? '', address, netRoundoff: r.net_roundoff ?? 'nearest_100' });
      });
    return () => { active = false; };
  }, []);
  return info;
}

/** The most recent payroll run id for a period (null when the period hasn't been run). */
async function latestRunId(periodId: string): Promise<string | null> {
  const { data } = await db.from('payroll_runs').select('id').eq('payroll_period_id', periodId).order('run_date', { ascending: false }).limit(1);
  return ((data ?? [])[0] as { id: string } | undefined)?.id ?? null;
}

/** Payslip rows for a period — built from the latest run's payroll_entries + employee statutory/bank. */
/** Imperative loader for a period's payslip employees (latest run). Used by the hook
 *  below and for multi-period (range) payslip generation. Returns [] if the period has
 *  no processed run. */
export async function loadPayslipEmployees(periodId: string | null): Promise<any[]> {
  if (!periodId) return [];
  const runId = await latestRunId(periodId);
  if (!runId) return [];
  const [{ map }, entriesRes, statRes, bankRes, extraRes] = await Promise.all([
    loadEmpMeta(),
    db.from('payroll_entries').select('employee_id, basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance, lta, other_earnings, gross_salary, pf_employee, esi_employee, professional_tax, tds, loan_emi, other_deductions, deduction_breakdown, total_deductions, net_salary, working_days, present_days, leave_days, absent_days, overtime_hours').eq('payroll_run_id', runId),
    db.from('employee_statutory').select('employee_id, pan_no, uan_no'),
    db.from('employee_bank_accounts').select('employee_id, account_number, ifsc_code, is_primary'),
    db.from('employees').select('id, email, employee_group:employee_groups(name), employee_category:employee_categories(name)'),
  ]);
  const statBy = new Map<string, any>(); ((statRes.data ?? []) as any[]).forEach(s => statBy.set(s.employee_id, s));
  const bankBy = new Map<string, any>(); ((bankRes.data ?? []) as any[]).forEach(b => { if (!bankBy.has(b.employee_id) || b.is_primary) bankBy.set(b.employee_id, b); });
  const extraBy = new Map<string, any>(); ((extraRes.data ?? []) as any[]).forEach(e => extraBy.set(e.id, e));
  return ((entriesRes.data ?? []) as Record<string, any>[]).map(e => {
    const m = map.get(e.employee_id); const st = statBy.get(e.employee_id); const bk = bankBy.get(e.employee_id); const ex = extraBy.get(e.employee_id);
    const name = m?.name ?? '—';
    return {
      id: e.employee_id, employeeCode: m?.employeeCode ?? '', name,
      designation: m?.designation ?? '—', department: m?.department ?? '—', workLocation: m?.location ?? '—',
      employeeType: m?.employeeType ?? '—', employeeGroup: ex?.employee_group?.name ?? '—', employeeCategory: ex?.employee_category?.name ?? '—', employeeGrade: m?.grade ?? '—',
      avatar: name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      email: ex?.email ?? '', pan: st?.pan_no ?? '—', uan: st?.uan_no ?? '—',
      bankAccount: bk?.account_number ? `XXXX ${String(bk.account_number).slice(-4)}` : '—', ifsc: bk?.ifsc_code ?? '—', doj: m?.doj ?? '',
      basic: num(e.basic_salary), hra: num(e.hra), conveyance: num(e.conveyance_allowance), medicalAllowance: num(e.medical_allowance),
      specialAllowance: num(e.special_allowance), lta: num(e.lta), otherEarnings: num(e.other_earnings), gross: num(e.gross_salary),
      pfEmployee: num(e.pf_employee), esiEmployee: num(e.esi_employee), professionalTax: num(e.professional_tax), tds: num(e.tds),
      loanEmi: num(e.loan_emi), otherDeductions: num(e.other_deductions), totalDeductions: num(e.total_deductions), net: num(e.net_salary),
      workingDays: num(e.working_days), presentDays: num(e.present_days), leaveDays: num(e.leave_days), lopDays: num(e.absent_days),
      overtimeHours: num(e.overtime_hours), overtimeAmount: 0,
      deductionBreakdown: (e.deduction_breakdown && typeof e.deduction_breakdown === 'object') ? e.deduction_breakdown as Record<string, number> : {},
    };
  });
}

export function usePayslipEmployees(periodId: string | null): { employees: any[]; loading: boolean } {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const out = await loadPayslipEmployees(periodId);
      if (active) { setRows(out); setLoading(false); }
    })();
    return () => { active = false; };
  }, [periodId]);
  return { employees: rows, loading };
}

/** Wage register for a period — the latest run's payroll_entries. */
export function useWageRegister(periodId?: string | null): any[] {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!periodId) { if (active) setRows([]); return; }
      const runId = await latestRunId(periodId);
      if (!runId) { if (active) setRows([]); return; }
      const [{ map }, entriesRes] = await Promise.all([
        loadEmpMeta(),
        db.from('payroll_entries').select('employee_id, basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance, gross_salary, pf_employee, esi_employee, professional_tax, tds, loan_emi, other_deductions, total_deductions, net_salary, absent_days, overtime_hours').eq('payroll_run_id', runId),
      ]);
      const out = ((entriesRes.data ?? []) as Record<string, any>[]).map(e => {
        const m = map.get(e.employee_id);
        return {
          id: e.employee_id, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—', department: m?.department ?? '—',
          designation: m?.designation ?? '—', location: m?.location ?? '—', grade: m?.grade ?? '—', employeeType: m?.employeeType ?? '—',
          establishment: m?.establishment ?? '—', basic: num(e.basic_salary), hra: num(e.hra), conveyance: num(e.conveyance_allowance),
          medicalAllowance: num(e.medical_allowance), specialAllowance: num(e.special_allowance), overtimeAmount: 0,
          gross: num(e.gross_salary), pfEmployee: num(e.pf_employee), esiEmployee: num(e.esi_employee), professionalTax: num(e.professional_tax),
          tds: num(e.tds), loanEmi: num(e.loan_emi), otherDeductions: num(e.other_deductions), totalDeductions: num(e.total_deductions),
          net: num(e.net_salary), lopDays: num(e.absent_days), lopAmount: 0,
        };
      });
      if (active) setRows(out);
    })();
    return () => { active = false; };
  }, [periodId]);
  return rows;
}

/** Map a stored attendance status string to a single-letter register code. */
export function attCode(s: string): string {
  const t = (s || '').toLowerCase();
  if (/half.?day.?holiday/.test(t)) return 'H';           // half-day weekly off → full-pay holiday
  if (/present|wfh|work from home/.test(t)) return 'P';
  if (/half/.test(t)) return 'HD';
  if (/late/.test(t)) return 'LT';
  if (/lop|loss of pay/.test(t)) return 'LOP';
  if (/leave/.test(t)) return 'L';
  if (/absent/.test(t)) return 'A';
  if (/holiday/.test(t)) return 'H';
  if (/weekend|weekly|week.?off/.test(t)) return 'WO';
  return '';
}

const isPresent = (s: string) => /present|wfh/i.test(s);

export interface AttendanceRegisterDay { status: string; checkIn?: string; checkOut?: string; hoursWorked?: number; overtimeHours?: number; remarks?: string }
export interface AttendanceRegisterEmp {
  id: string; employeeCode: string; name: string; department: string; location: string; designation: string;
  grade: string; employeeType: string; establishment: string;
  daily: Record<string, AttendanceRegisterDay>; overtimeHours: number; totalHoursWorked: number;
}
export interface AttendanceRegisterData { employees: AttendanceRegisterEmp[]; holidaysByDate: Record<string, 'H' | 'WO'>; loading: boolean; }

/** Attendance register for a period — REAL per-day attendance scoped to the period's date range,
 *  plus the holiday/weekly-off calendar so non-record days can be classified. */
export function useAttendanceRegister(fromDate?: string, toDate?: string): AttendanceRegisterData {
  const [data, setData] = useState<AttendanceRegisterData>({ employees: [], holidaysByDate: {}, loading: true });
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!fromDate || !toDate) { if (active) setData({ employees: [], holidaysByDate: {}, loading: false }); return; }
      const [{ map }, attRes, holRes] = await Promise.all([
        loadEmpMeta(),
        db.from('attendance_records').select('employee_id, attendance_date, status, check_in, check_out, hours_worked, overtime_hours')
          .gte('attendance_date', fromDate).lte('attendance_date', toDate),
        db.from('holidays').select('holiday_date, type').gte('holiday_date', fromDate).lte('holiday_date', toDate),
      ]);
      const holidaysByDate: Record<string, 'H' | 'WO'> = {};
      ((holRes.data ?? []) as Record<string, any>[]).forEach(h => {
        const code = /weekly|week.?off/i.test(h.type ?? '') ? 'WO' : 'H';
        if (!holidaysByDate[h.holiday_date] || code === 'H') holidaysByDate[h.holiday_date] = code; // a named holiday wins
      });

      const byEmp = new Map<string, AttendanceRegisterEmp>();
      const ensure = (empId: string): AttendanceRegisterEmp => {
        let r = byEmp.get(empId);
        if (!r) {
          const m = map.get(empId);
          r = {
            id: empId, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—', department: m?.department ?? '—',
            location: m?.location ?? '—', designation: m?.designation ?? '—', grade: m?.grade ?? '—',
            employeeType: m?.employeeType ?? '—', establishment: m?.establishment ?? '—',
            daily: {}, overtimeHours: 0, totalHoursWorked: 0,
          };
          byEmp.set(empId, r);
        }
        return r;
      };
      ((attRes.data ?? []) as Record<string, any>[]).forEach(a => {
        const r = ensure(a.employee_id);
        const code = attCode(a.status ?? '') || 'P';
        r.daily[a.attendance_date] = {
          status: code, checkIn: a.check_in ?? undefined, checkOut: a.check_out ?? undefined,
          hoursWorked: num(a.hours_worked), overtimeHours: num(a.overtime_hours), remarks: a.status ?? undefined,
        };
        r.overtimeHours += num(a.overtime_hours);
        r.totalHoursWorked += num(a.hours_worked);
      });
      if (active) setData({ employees: [...byEmp.values()], holidaysByDate, loading: false });
    })();
    return () => { active = false; };
  }, [fromDate, toDate]);
  return data;
}

/** Overtime register — employees with overtime hours in attendance. */
export function useOvertimeRegister(fromDate?: string, toDate?: string, periodId?: string): any[] {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!fromDate || !toDate) { if (active) setRows([]); return; }
      // OT salary-component config (multiplier + standard hours/month) → drives the OT pay rate.
      const { data: otCompRows } = await db.from('salary_components')
        .select('overtime_multiplier, overtime_hours_per_month').eq('is_overtime', true).eq('is_active', true).limit(1);
      const otComp = (otCompRows ?? [])[0] as { overtime_multiplier: number | null; overtime_hours_per_month: number | null } | undefined;
      const otMult = otComp ? num(otComp.overtime_multiplier) || 2 : 2;
      const otDivisor = otComp ? num(otComp.overtime_hours_per_month) || 208 : 208;
      // Per-employee Basic from the period's latest run (for the OT pay calc), if a run exists.
      const basicByEmp = new Map<string, number>();
      if (periodId) {
        const runId = await latestRunId(periodId);
        if (runId) {
          const { data: ents } = await db.from('payroll_entries').select('employee_id, basic_salary').eq('payroll_run_id', runId);
          ((ents ?? []) as Record<string, any>[]).forEach(e => basicByEmp.set(e.employee_id, num(e.basic_salary)));
        }
      }
      const [{ map }, attRes] = await Promise.all([
        loadEmpMeta(),
        db.from('attendance_records').select('employee_id, overtime_hours, hours_worked, shift:shifts(name)')
          .gte('attendance_date', fromDate).lte('attendance_date', toDate),
      ]);
      const agg = new Map<string, { otHours: number; otDays: number; normalHours: number; shift: string }>();
      ((attRes.data ?? []) as Record<string, any>[]).forEach(a => {
        const c = agg.get(a.employee_id) ?? { otHours: 0, otDays: 0, normalHours: 0, shift: a.shift?.name ?? '—' };
        const ot = num(a.overtime_hours);
        c.otHours += ot; if (ot > 0) c.otDays++; c.normalHours += num(a.hours_worked);
        agg.set(a.employee_id, c);
      });
      const out = [...agg.entries()].filter(([, v]) => v.otHours > 0).map(([empId, v]) => {
        const m = map.get(empId);
        const basic = basicByEmp.get(empId) ?? 0;
        const hourlyRate = basic > 0 ? basic / otDivisor : 0;
        const otAmount = Math.round(hourlyRate * otMult * v.otHours);
        return {
          id: empId, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—', department: m?.department ?? '—',
          designation: m?.designation ?? '—', location: m?.location ?? '—', grade: m?.grade ?? '—', employeeType: m?.employeeType ?? '—',
          establishment: m?.establishment ?? '—', shift: v.shift, basicPerDay: Math.round(hourlyRate * 8), otDays: v.otDays, otHours: v.otHours,
          otRate: otMult, otAmount, normalHours: v.normalHours, totalHours: v.normalHours + v.otHours, remarks: '',
        };
      });
      if (active) setRows(out);
    })();
    return () => { active = false; };
  }, [fromDate, toDate, periodId]);
  return rows;
}

// ─── Time-management (late entry / early out / overtime) ────────────────────────
export interface TimeMgmtRow {
  empId: string; employeeCode: string; name: string;
  department: string; designation: string; location: string; grade: string; employeeType: string; establishment: string;
  date: string; shift: string; shiftStart: string; shiftEnd: string;
  checkIn: string; checkOut: string;
  lateMinutes: number; earlyMinutes: number; overtimeHours: number; hoursWorked: number;
}

const timeToMinutes = (t?: string | null): number | null => {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

/** Per-day time-management occurrences across a date range. Late/early are computed from
 *  the shift's start/end time and grace window; overtime comes straight from the record. */
export function useTimeManagement(fromDate?: string, toDate?: string): { rows: TimeMgmtRow[]; loading: boolean } {
  const [state, setState] = useState<{ rows: TimeMgmtRow[]; loading: boolean }>({ rows: [], loading: true });
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!fromDate || !toDate) { if (active) setState({ rows: [], loading: false }); return; }
      const [{ map }, attRes] = await Promise.all([
        loadEmpMeta(),
        db.from('attendance_records')
          .select('employee_id, attendance_date, check_in, check_out, hours_worked, overtime_hours, shift:shifts(name, start_time, end_time, grace_period_minutes)')
          .gte('attendance_date', fromDate).lte('attendance_date', toDate)
          .order('attendance_date'),
      ]);
      const rows: TimeMgmtRow[] = ((attRes.data ?? []) as Record<string, any>[]).map(a => {
        const m = map.get(a.employee_id);
        const sh = a.shift ?? null;
        const grace = num(sh?.grace_period_minutes);
        const ci = timeToMinutes(a.check_in), co = timeToMinutes(a.check_out);
        const ss = timeToMinutes(sh?.start_time), se = timeToMinutes(sh?.end_time);
        const lateMinutes = ci != null && ss != null ? Math.max(0, ci - ss - grace) : 0;
        const earlyMinutes = co != null && se != null ? Math.max(0, se - co - grace) : 0;
        return {
          empId: a.employee_id, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—',
          department: m?.department ?? '—', designation: m?.designation ?? '—', location: m?.location ?? '—',
          grade: m?.grade ?? '—', employeeType: m?.employeeType ?? '—', establishment: m?.establishment ?? '—',
          date: a.attendance_date, shift: sh?.name ?? '—',
          shiftStart: sh?.start_time ?? '', shiftEnd: sh?.end_time ?? '',
          checkIn: a.check_in ?? '', checkOut: a.check_out ?? '',
          lateMinutes, earlyMinutes, overtimeHours: num(a.overtime_hours), hoursWorked: num(a.hours_worked),
        };
      });
      if (active) setState({ rows, loading: false });
    })();
    return () => { active = false; };
  }, [fromDate, toDate]);
  return state;
}

/** Leave register — per-employee balances pivoted by leave-type code (CL/SL/EL/CO/UL). */
export function useLeaveRegister(): any[] {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [{ map }, balRes] = await Promise.all([
        loadEmpMeta(),
        db.from('leave_balances').select('employee_id, used, closing_balance, opening_balance, accrued, leave_type:leave_types(code)'),
      ]);
      const byEmp = new Map<string, Record<string, { used: number; bal: number; total: number }>>();
      ((balRes.data ?? []) as Record<string, any>[]).forEach(b => {
        const code = (b.leave_type?.code ?? '').toUpperCase();
        const e = byEmp.get(b.employee_id) ?? {};
        e[code] = { used: num(b.used), bal: num(b.closing_balance), total: num(b.opening_balance) + num(b.accrued) };
        byEmp.set(b.employee_id, e);
      });
      const out = [...byEmp.entries()].map(([empId, codes]) => {
        const m = map.get(empId);
        const g = (c: string) => codes[c] ?? { used: 0, bal: 0, total: 0 };
        const cl = g('CL'), sl = g('SL'), el = g('EL'), co = g('CO'), ul = g('UL');
        const totalUsed = Object.values(codes).reduce((s, v) => s + v.used, 0);
        const totalBalance = Object.values(codes).reduce((s, v) => s + v.bal, 0);
        return {
          id: empId, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—', department: m?.department ?? '—',
          designation: m?.designation ?? '—', location: m?.location ?? '—', grade: m?.grade ?? '—', employeeType: m?.employeeType ?? '—',
          establishment: m?.establishment ?? '—', doj: m?.doj ?? '',
          clTotal: cl.total, clUsed: cl.used, clBalance: cl.bal, slTotal: sl.total, slUsed: sl.used, slBalance: sl.bal,
          elTotal: el.total, elUsed: el.used, elBalance: el.bal, coTotal: co.total, coUsed: co.used, coBalance: co.bal,
          ulUsed: ul.used, totalUsed, totalBalance,
        };
      });
      if (active) setRows(out);
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

// ─── Leave Statement (applications taken in a date range) ────────────────────────
export interface LeaveStatementRow {
  id: string; employeeId: string; employeeCode: string; name: string; department: string;
  designation: string; location: string; grade: string; employeeType: string; establishment: string;
  leaveType: string; leaveCode: string; fromDate: string; toDate: string; days: number;
  status: string; reason: string; appliedOn: string; halfDay: boolean;
}
export function useLeaveStatement(fromDate?: string | null, toDate?: string | null): { rows: LeaveStatementRow[]; loading: boolean } {
  const [rows, setRows] = useState<LeaveStatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      if (!fromDate || !toDate) { if (active) { setRows([]); setLoading(false); } return; }
      const [{ map }, lr] = await Promise.all([
        loadEmpMeta(),
        db.from('leave_requests')
          .select('id, employee_id, from_date, to_date, days, status, reason, applied_on, is_half_day, leave_type:leave_types(name, code)')
          .lte('from_date', toDate).gte('to_date', fromDate)   // applications overlapping the range
          .order('from_date', { ascending: true }),
      ]);
      const out = ((lr.data ?? []) as Record<string, any>[]).map(r => {
        const m = map.get(r.employee_id);
        return {
          id: r.id, employeeId: r.employee_id, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—',
          department: m?.department ?? '—', designation: m?.designation ?? '—', location: m?.location ?? '—',
          grade: m?.grade ?? '—', employeeType: m?.employeeType ?? '—', establishment: m?.establishment ?? '—',
          leaveType: r.leave_type?.name ?? 'Leave', leaveCode: (r.leave_type?.code ?? '').toUpperCase(),
          fromDate: r.from_date ?? '', toDate: r.to_date ?? '', days: num(r.days), status: r.status ?? '—',
          reason: r.reason ?? '', appliedOn: r.applied_on ?? '', halfDay: !!r.is_half_day,
        };
      });
      if (active) { setRows(out); setLoading(false); }
    })();
    return () => { active = false; };
  }, [fromDate, toDate]);
  return { rows, loading };
}

// ─── Employee Leave Status (current balances + pending applications) ──────────────
export interface LeaveStatusRow {
  id: string; employeeCode: string; name: string; department: string; designation: string;
  location: string; grade: string; employeeType: string; establishment: string;
  entitled: number; used: number; balance: number; pending: number; cl: number; sl: number; el: number;
}
export function useEmployeeLeaveStatus(): { rows: LeaveStatusRow[]; loading: boolean } {
  const [rows, setRows] = useState<LeaveStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const [{ map }, balRes, reqRes] = await Promise.all([
        loadEmpMeta(),
        db.from('leave_balances').select('employee_id, used, closing_balance, opening_balance, accrued, leave_type:leave_types(code)'),
        db.from('leave_requests').select('employee_id, status'),
      ]);
      const pendingBy = new Map<string, number>();
      ((reqRes.data ?? []) as Record<string, any>[]).forEach(r => {
        if (/pending|applied/i.test(r.status ?? '')) pendingBy.set(r.employee_id, (pendingBy.get(r.employee_id) ?? 0) + 1);
      });
      const byEmp = new Map<string, { entitled: number; used: number; balance: number; cl: number; sl: number; el: number }>();
      ((balRes.data ?? []) as Record<string, any>[]).forEach(b => {
        const code = (b.leave_type?.code ?? '').toUpperCase();
        const e = byEmp.get(b.employee_id) ?? { entitled: 0, used: 0, balance: 0, cl: 0, sl: 0, el: 0 };
        e.entitled += num(b.opening_balance) + num(b.accrued);
        e.used += num(b.used);
        e.balance += num(b.closing_balance);
        if (code === 'CL') e.cl = num(b.closing_balance);
        else if (code === 'SL') e.sl = num(b.closing_balance);
        else if (code === 'EL') e.el = num(b.closing_balance);
        byEmp.set(b.employee_id, e);
      });
      const out = [...byEmp.entries()].map(([empId, v]) => {
        const m = map.get(empId);
        return {
          id: empId, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—', department: m?.department ?? '—',
          designation: m?.designation ?? '—', location: m?.location ?? '—', grade: m?.grade ?? '—',
          employeeType: m?.employeeType ?? '—', establishment: m?.establishment ?? '—',
          entitled: v.entitled, used: v.used, balance: v.balance, pending: pendingBy.get(empId) ?? 0,
          cl: v.cl, sl: v.sl, el: v.el,
        };
      });
      if (active) { setRows(out); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  return { rows, loading };
}

// ─── Loan & Advance register / statement ────────────────────────────────────────
export interface LoanRow {
  id: string; employeeId: string; employeeCode: string; name: string; department: string;
  designation: string; location: string; grade: string; employeeType: string; establishment: string;
  loanType: string; principal: number; interestRate: number; tenureMonths: number; emiAmount: number;
  disbursedDate: string; appliedDate: string; status: string; paidEmis: number; outstanding: number;
  purpose: string; managerStatus: string; hrStatus: string;
}

const LOAN_REPORT_SELECT =
  'id, employee_id, principal_amount, interest_rate, tenure_months, emi_amount, disbursed_date, applied_date, status, purpose, paid_emis, outstanding_balance, manager_status, hr_status, loan_type:loan_types(name)';

function toLoanRow(r: Record<string, any>, map: Map<string, EmpMeta>): LoanRow {
  const m = map.get(r.employee_id);
  return {
    id: r.id, employeeId: r.employee_id, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—',
    department: m?.department ?? '—', designation: m?.designation ?? '—', location: m?.location ?? '—',
    grade: m?.grade ?? '—', employeeType: m?.employeeType ?? '—', establishment: m?.establishment ?? '—',
    loanType: r.loan_type?.name ?? '—', principal: num(r.principal_amount), interestRate: num(r.interest_rate),
    tenureMonths: num(r.tenure_months), emiAmount: num(r.emi_amount), disbursedDate: r.disbursed_date ?? '',
    appliedDate: r.applied_date ?? '', status: r.status ?? '—', paidEmis: num(r.paid_emis),
    outstanding: num(r.outstanding_balance), purpose: r.purpose ?? '', managerStatus: r.manager_status ?? 'NA',
    hrStatus: r.hr_status ?? 'Pending',
  };
}

export function useLoanRegister(): { rows: LoanRow[]; loading: boolean } {
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const [{ map }, res] = await Promise.all([
        loadEmpMeta(),
        db.from('loans').select(LOAN_REPORT_SELECT).order('applied_date', { ascending: false }),
      ]);
      const out = ((res.data ?? []) as Record<string, any>[]).map(r => toLoanRow(r, map));
      if (active) { setRows(out); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  return { rows, loading };
}

export interface LoanStatementRow extends LoanRow {
  disbursedInPeriod: number; emiDueCount: number; emiDueAmount: number; emiPaidCount: number; emiPaidAmount: number;
}

/** Loan statement for a period — each loan with its disbursement (if in the period)
 *  and EMI activity (scheduled vs recovered) within the from/to range. */
export function useLoanStatement(fromDate?: string | null, toDate?: string | null): { rows: LoanStatementRow[]; loading: boolean } {
  const [rows, setRows] = useState<LoanStatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      if (!fromDate || !toDate) { if (active) { setRows([]); setLoading(false); } return; }
      const [{ map }, loanRes, emiRes] = await Promise.all([
        loadEmpMeta(),
        db.from('loans').select(LOAN_REPORT_SELECT).order('applied_date', { ascending: false }),
        db.from('loan_emi_schedule').select('loan_id, emi_amount, paid_amount, is_paid, due_date')
          .gte('due_date', fromDate).lte('due_date', toDate),
      ]);
      const agg = new Map<string, { dueCount: number; dueAmount: number; paidCount: number; paidAmount: number }>();
      ((emiRes.data ?? []) as Record<string, any>[]).forEach(e => {
        const a = agg.get(e.loan_id) ?? { dueCount: 0, dueAmount: 0, paidCount: 0, paidAmount: 0 };
        a.dueCount += 1; a.dueAmount += num(e.emi_amount);
        if (e.is_paid) { a.paidCount += 1; a.paidAmount += (num(e.paid_amount) || num(e.emi_amount)); }
        agg.set(e.loan_id, a);
      });
      const out = ((loanRes.data ?? []) as Record<string, any>[]).map(r => {
        const base = toLoanRow(r, map);
        const a = agg.get(base.id) ?? { dueCount: 0, dueAmount: 0, paidCount: 0, paidAmount: 0 };
        const disbursedInPeriod = (base.disbursedDate && base.disbursedDate >= fromDate && base.disbursedDate <= toDate) ? base.principal : 0;
        return { ...base, disbursedInPeriod, emiDueCount: a.dueCount, emiDueAmount: a.dueAmount, emiPaidCount: a.paidCount, emiPaidAmount: a.paidAmount };
      })
        // Only loans with activity in the period (disbursed or EMI scheduled).
        .filter(r => r.disbursedInPeriod > 0 || r.emiDueCount > 0);
      if (active) { setRows(out); setLoading(false); }
    })();
    return () => { active = false; };
  }, [fromDate, toDate]);
  return { rows, loading };
}

/** Fines & deductions register for a period — from deduction_entries (DB-backed). */
export function useFinesDeductionsRegister(periodId?: string | null): any[] {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { map } = await loadEmpMeta();
      let q = db.from('deduction_entries')
        .select('id, employee_id, category, description, amount, reference_no, status, remarks, approved_by, created_at, employee_rejection_reason, payroll_period_id, payroll_period:payroll_period_id(name)')
        .order('created_at', { ascending: false });
      if (periodId) q = q.eq('payroll_period_id', periodId);
      const { data } = await q;
      const out = ((data ?? []) as Record<string, any>[]).map(e => {
        const m = map.get(e.employee_id);
        return {
          id: e.id, employeeCode: m?.employeeCode ?? '', name: m?.name ?? '—', department: m?.department ?? '—',
          designation: m?.designation ?? '—', location: m?.location ?? '—', grade: m?.grade ?? '—',
          employeeType: m?.employeeType ?? '—', establishment: m?.establishment ?? '—',
          category: e.category ?? '', description: e.description ?? '', amount: num(e.amount), referenceNo: e.reference_no ?? '',
          payrollPeriod: e.payroll_period?.name ?? '', status: e.status ?? 'Draft',
          issuedBy: e.approved_by ?? 'HR', issuedOn: e.created_at ? String(e.created_at).slice(0, 10) : '',
          employeeResponse: e.employee_rejection_reason ?? '', remarks: e.remarks ?? '',
        };
      });
      if (active) setRows(out);
    })();
    return () => { active = false; };
  }, [periodId]);
  return rows;
}
