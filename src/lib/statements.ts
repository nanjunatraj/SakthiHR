// Pay-period statements — all derived from the latest payroll run's payroll_entries
// (the figures actually computed/paid) for a period, enriched with bank + statutory IDs
// and the period's deduction_entries. Each statement is returned as a StatementDoc so the
// same object renders on screen and exports to PDF / Excel / CSV.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { StatementColumn, StatementDoc } from './exportStatement';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);
const f2 = (n: number) => n.toFixed(2);

export type StatementKey =
  | 'attendance' | 'wage' | 'leave' | 'overtime' | 'fines'
  | 'pf' | 'esi' | 'pt' | 'tds' | 'nett' | 'bank';

export const STATEMENTS: { key: StatementKey; label: string }[] = [
  { key: 'attendance', label: 'Attendance Statement' },
  { key: 'wage', label: 'Wage Statement' },
  { key: 'leave', label: 'Leave Statement' },
  { key: 'overtime', label: 'Overtime Statement' },
  { key: 'fines', label: 'Fine & Deduction Statement' },
  { key: 'pf', label: 'PF Statement' },
  { key: 'esi', label: 'ESI Statement' },
  { key: 'pt', label: 'Professional Tax Statement' },
  { key: 'tds', label: 'TDS Statement' },
  { key: 'nett', label: 'Nett Payment Statement' },
  { key: 'bank', label: 'Bank Transfer Statement' },
];

interface BaseEntry {
  employeeId: string; code: string; name: string; department: string; designation: string;
  basic: number; hra: number; conveyance: number; medical: number; special: number; lta: number; otherEarnings: number;
  gross: number; pfEmployee: number; pfEmployer: number; esiEmployee: number; esiEmployer: number;
  pt: number; tds: number; loanEmi: number; advanceRecovery: number; otherDeductions: number; totalDeductions: number; net: number;
  workingDays: number; presentDays: number; absentDays: number; leaveDays: number; overtimeHours: number;
  bankName: string; accountName: string; accountNumber: string; ifsc: string; branch: string; accountType: string;
  uan: string; esiNo: string; pan: string;
}
interface DedRow { employeeId: string; category: string; description: string; amount: number; }
interface LeaveRow { employeeId: string; leaveType: string; days: number; fromDate: string; toDate: string; }

interface AttAgg { present: number; absent: number; lop: number; leave: number; half: number; weekoff: number; holiday: number; otHours: number; total: number; }

export interface StatementCtx {
  hasRun: boolean;
  entries: BaseEntry[];
  deductions: DedRow[];
  leaves: LeaveRow[];
  attendance: Map<string, AttAgg>;   // live attendance_records aggregated per employee for the period
  otMult: number;                    // overtime pay multiplier (from the OT salary component)
  otDivisor: number;                 // standard OT hours/month → hourly rate = basic / divisor
}

export async function loadStatementContext(periodId: string, fromDate: string, toDate: string): Promise<StatementCtx> {
  const empty: StatementCtx = { hasRun: false, entries: [], deductions: [], leaves: [], attendance: new Map(), otMult: 2, otDivisor: 208 };
  if (!periodId) return empty;
  const { data: runRows } = await db.from('payroll_runs')
    .select('id, run_date').eq('payroll_period_id', periodId).order('run_date', { ascending: false }).limit(1);
  const run = (runRows ?? [])[0] as { id: string } | undefined;
  if (!run) return empty;

  const { data: ents } = await db.from('payroll_entries')
    .select('employee_id, basic_salary, hra, special_allowance, conveyance_allowance, medical_allowance, lta, other_earnings, gross_salary, pf_employee, pf_employer, esi_employee, esi_employer, professional_tax, tds, loan_emi, advance_recovery, other_deductions, total_deductions, net_salary, working_days, present_days, absent_days, leave_days, overtime_hours, employees(employee_id, first_name, middle_name, last_name, department:departments(name), designation:designations(name))')
    .eq('payroll_run_id', run.id);
  const entryRows = (ents ?? []) as Array<Record<string, any>>;
  const empIds = entryRows.map(e => e.employee_id);

  const bankByEmp = new Map<string, Record<string, any>>();
  const statByEmp = new Map<string, Record<string, any>>();
  if (empIds.length) {
    const [{ data: banks }, { data: stat }] = await Promise.all([
      db.from('employee_bank_accounts').select('employee_id, bank_name, account_name, account_number, ifsc_code, branch_name, account_type, is_primary').in('employee_id', empIds),
      db.from('employee_statutory').select('employee_id, uan_no, esi_no, pan_no').in('employee_id', empIds),
    ]);
    ((banks ?? []) as Array<Record<string, any>>).forEach(b => { const c = bankByEmp.get(b.employee_id); if (!c || b.is_primary) bankByEmp.set(b.employee_id, b); });
    ((stat ?? []) as Array<Record<string, any>>).forEach(s => statByEmp.set(s.employee_id, s));
  }

  const entries: BaseEntry[] = entryRows.map(e => {
    const emp = e.employees ?? {}; const b = bankByEmp.get(e.employee_id) ?? {}; const s = statByEmp.get(e.employee_id) ?? {};
    return {
      employeeId: e.employee_id, code: emp.employee_id ?? '',
      name: [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') || (emp.employee_id ?? 'Employee'),
      department: emp.department?.name ?? '—', designation: emp.designation?.name ?? '—',
      basic: num(e.basic_salary), hra: num(e.hra), conveyance: num(e.conveyance_allowance), medical: num(e.medical_allowance),
      special: num(e.special_allowance), lta: num(e.lta), otherEarnings: num(e.other_earnings),
      gross: num(e.gross_salary), pfEmployee: num(e.pf_employee), pfEmployer: num(e.pf_employer),
      esiEmployee: num(e.esi_employee), esiEmployer: num(e.esi_employer), pt: num(e.professional_tax), tds: num(e.tds),
      loanEmi: num(e.loan_emi), advanceRecovery: num(e.advance_recovery), otherDeductions: num(e.other_deductions),
      totalDeductions: num(e.total_deductions), net: num(e.net_salary),
      workingDays: num(e.working_days), presentDays: num(e.present_days), absentDays: num(e.absent_days),
      leaveDays: num(e.leave_days), overtimeHours: num(e.overtime_hours),
      bankName: b.bank_name ?? '', accountName: b.account_name ?? '', accountNumber: b.account_number ?? '',
      ifsc: b.ifsc_code ?? '', branch: b.branch_name ?? '', accountType: b.account_type ?? '',
      uan: s.uan_no ?? '', esiNo: s.esi_no ?? '', pan: s.pan_no ?? '',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Period deductions + approved leaves + LIVE attendance + OT component config.
  const [{ data: deds }, { data: lvs }, { data: att }, { data: otCompRows }] = await Promise.all([
    db.from('deduction_entries').select('employee_id, category, description, amount').eq('payroll_period_id', periodId),
    db.from('leave_requests').select('employee_id, days, from_date, to_date, status, leave_type:leave_types(name)').lte('from_date', toDate).gte('to_date', fromDate),
    db.from('attendance_records').select('employee_id, status, overtime_hours').gte('attendance_date', fromDate).lte('attendance_date', toDate),
    db.from('salary_components').select('overtime_multiplier, overtime_hours_per_month').eq('is_overtime', true).eq('is_active', true).limit(1),
  ]);
  const deductions: DedRow[] = ((deds ?? []) as Array<Record<string, any>>).map(d => ({ employeeId: d.employee_id, category: d.category ?? '', description: d.description ?? '', amount: num(d.amount) }));
  const leaves: LeaveRow[] = ((lvs ?? []) as Array<Record<string, any>>).filter(l => /approved/i.test(l.status ?? '')).map(l => ({ employeeId: l.employee_id, leaveType: l.leave_type?.name ?? '—', days: num(l.days), fromDate: l.from_date ?? '', toDate: l.to_date ?? '' }));

  const attendance = new Map<string, AttAgg>();
  ((att ?? []) as Array<Record<string, any>>).forEach(a => {
    const c = attendance.get(a.employee_id) ?? { present: 0, absent: 0, lop: 0, leave: 0, half: 0, weekoff: 0, holiday: 0, otHours: 0, total: 0 };
    const s = (a.status ?? '').toLowerCase();
    if (/half/.test(s)) c.half++;
    else if (/present|wfh/.test(s)) c.present++;
    else if (/late/.test(s)) c.present++;
    else if (/lop|loss of pay/.test(s)) c.lop++;
    else if (/leave/.test(s)) c.leave++;
    else if (/absent/.test(s)) c.absent++;
    else if (/holiday/.test(s)) c.holiday++;
    else if (/weekend|weekly|week.?off/.test(s)) c.weekoff++;
    c.otHours += num(a.overtime_hours); c.total++;
    attendance.set(a.employee_id, c);
  });

  const otComp = (otCompRows ?? [])[0] as { overtime_multiplier: number | null; overtime_hours_per_month: number | null } | undefined;
  const otMult = otComp ? num(otComp.overtime_multiplier) || 2 : 2;
  const otDivisor = otComp ? num(otComp.overtime_hours_per_month) || 208 : 208;

  return { hasRun: true, entries, deductions, leaves, attendance, otMult, otDivisor };
}

const empCols: StatementColumn[] = [
  { key: 'sno', label: 'S.No', align: 'right' },
  { key: 'code', label: 'Emp Code' },
  { key: 'name', label: 'Employee Name' },
  { key: 'department', label: 'Department' },
];
const dedLabel: Record<string, string> = { 'damages-loss': 'Damage & Loss', fines: 'Fines', canteen: 'Canteen', society: 'Society', donations: 'Donations / Campaign', 'other-deductions': 'Other Deductions', 'loan-advances': 'Loan & Advances' };

export function buildStatement(key: StatementKey, ctx: StatementCtx, opts: { establishment: string; subtitle: string }): StatementDoc {
  const meta = STATEMENTS.find(s => s.key === key)!;
  const base = { title: meta.label, establishment: opts.establishment, subtitle: opts.subtitle, note: 'Computer-generated statement.' };
  const E = ctx.entries;
  const idx = (i: number) => i + 1;

  // Helper to total numeric columns into a totals row.
  const totalsFor = (cols: StatementColumn[], rows: Array<Record<string, string | number>>, labelKey = 'name', label = 'Total'): Record<string, string | number> => {
    const t: Record<string, string | number> = { [labelKey]: label };
    cols.filter(c => c.isAmount).forEach(c => { t[c.key] = f2(rows.reduce((s, r) => s + (parseFloat(String(r[c.key])) || 0), 0)); });
    return t;
  };

  switch (key) {
    case 'attendance': {
      const cols: StatementColumn[] = [...empCols,
        { key: 'present', label: 'Present', align: 'right' }, { key: 'half', label: 'Half Day', align: 'right' },
        { key: 'leave', label: 'Leave', align: 'right' }, { key: 'absent', label: 'Absent', align: 'right' },
        { key: 'lop', label: 'LOP', align: 'right' }, { key: 'weekoff', label: 'Week-off', align: 'right' },
        { key: 'holiday', label: 'Holiday', align: 'right' }, { key: 'workingDays', label: 'Working Days', align: 'right' },
        { key: 'otHours', label: 'OT Hrs', align: 'right' }];
      const rows = E.map((e, i) => {
        const a = ctx.attendance.get(e.employeeId) ?? { present: 0, absent: 0, lop: 0, leave: 0, half: 0, weekoff: 0, holiday: 0, otHours: 0, total: 0 };
        return {
          sno: idx(i), code: e.code, name: e.name, department: e.department,
          present: a.present, half: a.half, leave: a.leave, absent: a.absent, lop: a.lop,
          weekoff: a.weekoff, holiday: a.holiday, workingDays: a.total - a.weekoff - a.holiday, otHours: a.otHours,
        };
      });
      return { ...base, columns: cols, rows: ctx.attendance.size === 0 ? [] : rows, note: ctx.attendance.size === 0 ? 'No attendance records for this period — generate attendance first.' : base.note };
    }
    case 'wage': {
      const cols: StatementColumn[] = [...empCols,
        { key: 'basic', label: 'Basic', align: 'right', isAmount: true }, { key: 'hra', label: 'HRA', align: 'right', isAmount: true },
        { key: 'conveyance', label: 'Conveyance', align: 'right', isAmount: true }, { key: 'medical', label: 'Medical', align: 'right', isAmount: true },
        { key: 'special', label: 'Special', align: 'right', isAmount: true }, { key: 'otherEarnings', label: 'Other/OT', align: 'right', isAmount: true },
        { key: 'gross', label: 'Gross', align: 'right', isAmount: true }, { key: 'totalDeductions', label: 'Deductions', align: 'right', isAmount: true },
        { key: 'net', label: 'Nett Pay', align: 'right', isAmount: true }];
      const rows = E.map((e, i) => ({ sno: idx(i), code: e.code, name: e.name, department: e.department, basic: f2(e.basic), hra: f2(e.hra), conveyance: f2(e.conveyance), medical: f2(e.medical), special: f2(e.special), otherEarnings: f2(e.otherEarnings), gross: f2(e.gross), totalDeductions: f2(e.totalDeductions), net: f2(e.net) }));
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows) };
    }
    case 'leave': {
      const cols: StatementColumn[] = [...empCols, { key: 'leaveType', label: 'Leave Type' }, { key: 'period', label: 'Period' }, { key: 'days', label: 'Days', align: 'right' }];
      const codeByEmp = new Map(E.map(e => [e.employeeId, e]));
      const rows = ctx.leaves.map((l, i) => { const e = codeByEmp.get(l.employeeId); return { sno: idx(i), code: e?.code ?? '', name: e?.name ?? l.employeeId, department: e?.department ?? '—', leaveType: l.leaveType, period: `${l.fromDate} → ${l.toDate}`, days: l.days }; });
      return { ...base, columns: cols, rows, note: rows.length ? base.note : 'No approved leave overlapping this period.' };
    }
    case 'overtime': {
      // OT hours come from live attendance; OT amount = (basic / divisor) × multiplier × hours.
      const cols: StatementColumn[] = [...empCols,
        { key: 'otHours', label: 'OT Hours', align: 'right' }, { key: 'rate', label: `Rate (×${ctx.otMult})`, align: 'right', isAmount: true },
        { key: 'overtimeAmount', label: 'OT Amount', align: 'right', isAmount: true }];
      const rows = E.map(e => {
        const a = ctx.attendance.get(e.employeeId);
        const otHours = a?.otHours ?? 0;
        const hourly = e.basic > 0 ? e.basic / ctx.otDivisor : 0;
        const rate = hourly * ctx.otMult;
        return { code: e.code, name: e.name, department: e.department, otHours, rate, amount: Math.round(rate * otHours) };
      }).filter(r => r.otHours > 0)
        .map((r, i) => ({ sno: idx(i), code: r.code, name: r.name, department: r.department, otHours: r.otHours, rate: f2(r.rate), overtimeAmount: f2(r.amount) }));
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows), note: rows.length ? base.note : 'No overtime recorded in attendance for this period.' };
    }
    case 'fines': {
      const cols: StatementColumn[] = [...empCols, { key: 'category', label: 'Category' }, { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount', align: 'right', isAmount: true }];
      const empByCode = new Map(E.map(e => [e.employeeId, e]));
      const rows = ctx.deductions.map((d, i) => { const e = empByCode.get(d.employeeId); return { sno: idx(i), code: e?.code ?? '', name: e?.name ?? d.employeeId, department: e?.department ?? '—', category: dedLabel[d.category] ?? d.category, description: d.description || '—', amount: f2(d.amount) }; });
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows), note: rows.length ? base.note : 'No deduction entries for this period.' };
    }
    case 'pf': {
      const cols: StatementColumn[] = [...empCols, { key: 'uan', label: 'UAN', text: true }, { key: 'pfWages', label: 'PF Wages', align: 'right', isAmount: true }, { key: 'empPF', label: 'Employee PF', align: 'right', isAmount: true }, { key: 'erPF', label: 'Employer PF', align: 'right', isAmount: true }, { key: 'total', label: 'Total', align: 'right', isAmount: true }];
      const rows = E.filter(e => e.pfEmployee > 0 || e.pfEmployer > 0).map((e, i) => ({ sno: idx(i), code: e.code, name: e.name, department: e.department, uan: e.uan || '—', pfWages: f2(e.basic), empPF: f2(e.pfEmployee), erPF: f2(e.pfEmployer), total: f2(e.pfEmployee + e.pfEmployer) }));
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows) };
    }
    case 'esi': {
      const cols: StatementColumn[] = [...empCols, { key: 'esiNo', label: 'ESI No.', text: true }, { key: 'grossWages', label: 'Gross Wages', align: 'right', isAmount: true }, { key: 'empESI', label: 'Employee ESI', align: 'right', isAmount: true }, { key: 'erESI', label: 'Employer ESI', align: 'right', isAmount: true }, { key: 'total', label: 'Total', align: 'right', isAmount: true }];
      const rows = E.filter(e => e.esiEmployee > 0 || e.esiEmployer > 0).map((e, i) => ({ sno: idx(i), code: e.code, name: e.name, department: e.department, esiNo: e.esiNo || '—', grossWages: f2(e.gross), empESI: f2(e.esiEmployee), erESI: f2(e.esiEmployer), total: f2(e.esiEmployee + e.esiEmployer) }));
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows) };
    }
    case 'pt': {
      const cols: StatementColumn[] = [...empCols, { key: 'gross', label: 'Gross', align: 'right', isAmount: true }, { key: 'pt', label: 'Professional Tax', align: 'right', isAmount: true }];
      const rows = E.filter(e => e.pt > 0).map((e, i) => ({ sno: idx(i), code: e.code, name: e.name, department: e.department, gross: f2(e.gross), pt: f2(e.pt) }));
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows) };
    }
    case 'tds': {
      const cols: StatementColumn[] = [...empCols, { key: 'pan', label: 'PAN', text: true }, { key: 'gross', label: 'Gross', align: 'right', isAmount: true }, { key: 'tds', label: 'TDS', align: 'right', isAmount: true }];
      const rows = E.filter(e => e.tds > 0).map((e, i) => ({ sno: idx(i), code: e.code, name: e.name, department: e.department, pan: e.pan || '—', gross: f2(e.gross), tds: f2(e.tds) }));
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows) };
    }
    case 'nett': {
      const cols: StatementColumn[] = [...empCols, { key: 'gross', label: 'Gross', align: 'right', isAmount: true }, { key: 'totalDeductions', label: 'Deductions', align: 'right', isAmount: true }, { key: 'net', label: 'Nett Payable', align: 'right', isAmount: true }];
      const rows = E.map((e, i) => ({ sno: idx(i), code: e.code, name: e.name, department: e.department, gross: f2(e.gross), totalDeductions: f2(e.totalDeductions), net: f2(e.net) }));
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows) };
    }
    case 'bank': {
      const cols: StatementColumn[] = [...empCols, { key: 'bankName', label: 'Bank' }, { key: 'accountNumber', label: 'Account No.', text: true }, { key: 'ifsc', label: 'IFSC', text: true }, { key: 'accountType', label: 'Type' }, { key: 'net', label: 'Nett Payable', align: 'right', isAmount: true }];
      const rows = E.map((e, i) => ({ sno: idx(i), code: e.code, name: e.name, department: e.department, bankName: e.bankName || '—', accountNumber: e.accountNumber || '—', ifsc: e.ifsc || '—', accountType: e.accountType || '—', net: f2(e.net) }));
      return { ...base, columns: cols, rows, totals: totalsFor(cols, rows) };
    }
  }
}
