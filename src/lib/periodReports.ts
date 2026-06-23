// Period Reports — a single attendance or wage/statutory metric tabulated across a
// range of payroll periods (columns), per employee (rows), optionally grouped by
// Work Location / Department / Designation / Category with subtotals.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);

export type MetricSource = 'payroll' | 'attendance';
export interface Metric {
  key: string; label: string; source: MetricSource; isAmount: boolean;
  field?: string;          // payroll: payroll_entries column; attendance: sum field (overtime_hours)
  match?: RegExp;          // attendance: status matcher (counts days)
}

export const PERIOD_METRICS: { group: string; items: Metric[] }[] = [
  {
    group: 'Attendance', items: [
      { key: 'lop', label: 'Loss of Pay (Days)', source: 'attendance', isAmount: false, match: /lop|loss of pay/i },
      { key: 'present', label: 'Present Days', source: 'attendance', isAmount: false, match: /present|wfh|late/i },
      { key: 'absent', label: 'Absent Days', source: 'attendance', isAmount: false, match: /absent/i },
      { key: 'leave', label: 'Leave Days', source: 'attendance', isAmount: false, match: /leave/i },
      { key: 'halfday', label: 'Half Days', source: 'attendance', isAmount: false, match: /half/i },
      { key: 'ot', label: 'Overtime (Hours)', source: 'attendance', isAmount: false, field: 'overtime_hours' },
    ],
  },
  {
    group: 'Wages & Statutory', items: [
      { key: 'basic_salary', label: 'Basic', source: 'payroll', isAmount: true, field: 'basic_salary' },
      { key: 'gross_salary', label: 'Gross', source: 'payroll', isAmount: true, field: 'gross_salary' },
      { key: 'pf_employee', label: 'PF (Employee)', source: 'payroll', isAmount: true, field: 'pf_employee' },
      { key: 'pf_employer', label: 'PF (Employer)', source: 'payroll', isAmount: true, field: 'pf_employer' },
      { key: 'esi_employee', label: 'ESI (Employee)', source: 'payroll', isAmount: true, field: 'esi_employee' },
      { key: 'professional_tax', label: 'Professional Tax', source: 'payroll', isAmount: true, field: 'professional_tax' },
      { key: 'tds', label: 'TDS', source: 'payroll', isAmount: true, field: 'tds' },
      { key: 'loan_emi', label: 'Loan EMI', source: 'payroll', isAmount: true, field: 'loan_emi' },
      { key: 'other_deductions', label: 'Other Deductions', source: 'payroll', isAmount: true, field: 'other_deductions' },
      { key: 'total_deductions', label: 'Total Deductions', source: 'payroll', isAmount: true, field: 'total_deductions' },
      { key: 'net_salary', label: 'Net Pay', source: 'payroll', isAmount: true, field: 'net_salary' },
    ],
  },
];
export const ALL_METRICS: Metric[] = PERIOD_METRICS.flatMap(g => g.items);

export type GroupBy = 'none' | 'location' | 'department' | 'designation' | 'category';
export const GROUP_BY_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: 'none', label: 'No grouping' },
  { key: 'location', label: 'Work Location' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'category', label: 'Category' },
];

export interface PeriodCol { id: string; name: string }
export interface PeriodReportRow { employeeId: string; code: string; name: string; group: string; values: Record<string, number>; total: number }
export interface PeriodReportGroup { key: string; label: string; rows: PeriodReportRow[]; subtotals: Record<string, number>; subtotal: number }
export interface PeriodReportResult {
  hasData: boolean; metricLabel: string; isAmount: boolean;
  periods: PeriodCol[]; groups: PeriodReportGroup[];
  grandTotals: Record<string, number>; grandTotal: number;
}

const EMP_SELECT = 'employee_id, first_name, middle_name, last_name, department:departments(name), designation:designations(name), work_location:work_locations(name), employee_category:employee_categories(name)';
const groupValue = (emp: Record<string, any>, by: GroupBy): string => {
  if (by === 'location') return emp.work_location?.name || '— No Location —';
  if (by === 'department') return emp.department?.name || '— No Department —';
  if (by === 'designation') return emp.designation?.name || '— No Designation —';
  if (by === 'category') return emp.employee_category?.name || '— No Category —';
  return 'All Employees';
};
const empName = (e: Record<string, any>) => [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || (e.employee_id ?? 'Employee');

export async function loadPeriodReport(metricKey: string, fromPeriodId: string, toPeriodId: string, groupBy: GroupBy): Promise<PeriodReportResult> {
  const empty: PeriodReportResult = { hasData: false, metricLabel: '', isAmount: false, periods: [], groups: [], grandTotals: {}, grandTotal: 0 };
  const metric = ALL_METRICS.find(m => m.key === metricKey);
  if (!metric || !fromPeriodId || !toPeriodId) return empty;

  // Resolve the inclusive period range (ordered by from_date).
  const { data: perRows } = await db.from('payroll_periods').select('id, name, from_date, to_date').order('from_date', { ascending: true });
  const all = (perRows ?? []) as Array<Record<string, any>>;
  const fromIdx = all.findIndex(p => p.id === fromPeriodId);
  const toIdx = all.findIndex(p => p.id === toPeriodId);
  if (fromIdx < 0 || toIdx < 0) return empty;
  const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
  const periodsInRange = all.slice(lo, hi + 1);
  const periods: PeriodCol[] = periodsInRange.map(p => ({ id: p.id, name: p.name ?? '' }));
  const periodIds = periodsInRange.map(p => p.id);

  // employeeId → { meta, values: {periodId: number} }
  const emps = new Map<string, { code: string; name: string; group: string; values: Record<string, number> }>();
  const ensure = (id: string, e: Record<string, any>) => {
    let row = emps.get(id);
    if (!row) { row = { code: e.employee_id ?? '', name: empName(e), group: groupValue(e, groupBy), values: {} }; emps.set(id, row); }
    return row;
  };

  if (metric.source === 'payroll') {
    // Latest run per period → its entries.
    const { data: runRows } = await db.from('payroll_runs').select('id, payroll_period_id, run_date').in('payroll_period_id', periodIds).order('run_date', { ascending: false });
    const latestRunByPeriod = new Map<string, string>();
    ((runRows ?? []) as Array<Record<string, any>>).forEach(r => { if (!latestRunByPeriod.has(r.payroll_period_id)) latestRunByPeriod.set(r.payroll_period_id, r.id); });
    const runIds = [...latestRunByPeriod.values()];
    if (runIds.length) {
      const { data: ents } = await db.from('payroll_entries')
        .select(`payroll_run_id, payroll_period_id, ${metric.field}, employees(${EMP_SELECT})`).in('payroll_run_id', runIds);
      ((ents ?? []) as Array<Record<string, any>>).forEach(e => {
        const emp = e.employees ?? {};
        const key = (emp.employee_id ?? '') + '|' + empName(emp); // entries don't expose the uuid via this join; key by code+name
        const row = ensure(key, emp);
        row.values[e.payroll_period_id] = (row.values[e.payroll_period_id] ?? 0) + num(e[metric.field as string]);
      });
    }
  } else {
    // Attendance — load records in the full date range, bucket by period via date.
    const fromDate = periodsInRange[0].from_date; const toDate = periodsInRange[periodsInRange.length - 1].to_date;
    const { data: att } = await db.from('attendance_records')
      .select(`attendance_date, status, overtime_hours, employees(${EMP_SELECT})`).gte('attendance_date', fromDate).lte('attendance_date', toDate);
    const periodOf = (d: string): string | null => { for (const p of periodsInRange) if (d >= p.from_date && d <= p.to_date) return p.id; return null; };
    ((att ?? []) as Array<Record<string, any>>).forEach(a => {
      const emp = a.employees ?? {}; const pid = periodOf(a.attendance_date); if (!pid) return;
      const key = (emp.employee_id ?? '') + '|' + empName(emp);
      const row = ensure(key, emp);
      const add = metric.field ? num(a.overtime_hours) : (metric.match && metric.match.test(a.status ?? '') ? 1 : 0);
      if (add) row.values[pid] = (row.values[pid] ?? 0) + add;
    });
  }

  // Build employee rows with totals.
  const rows: PeriodReportRow[] = [...emps.entries()].map(([key, r]) => ({
    employeeId: key, code: r.code, name: r.name, group: r.group, values: r.values,
    total: periodIds.reduce((s, pid) => s + (r.values[pid] ?? 0), 0),
  })).filter(r => r.total !== 0 || Object.keys(r.values).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Group + subtotals.
  const byGroup = new Map<string, PeriodReportRow[]>();
  rows.forEach(r => { const a = byGroup.get(r.group) ?? []; a.push(r); byGroup.set(r.group, a); });
  const groups: PeriodReportGroup[] = [...byGroup.entries()].map(([label, grpRows]) => {
    const subtotals: Record<string, number> = {};
    periodIds.forEach(pid => { subtotals[pid] = grpRows.reduce((s, r) => s + (r.values[pid] ?? 0), 0); });
    return { key: label, label, rows: grpRows, subtotals, subtotal: grpRows.reduce((s, r) => s + r.total, 0) };
  }).sort((a, b) => a.label.localeCompare(b.label));

  const grandTotals: Record<string, number> = {};
  periodIds.forEach(pid => { grandTotals[pid] = rows.reduce((s, r) => s + (r.values[pid] ?? 0), 0); });
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return { hasData: rows.length > 0, metricLabel: metric.label, isAmount: metric.isAmount, periods, groups, grandTotals, grandTotal };
}
