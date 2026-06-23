// Payslip template — builds an individual payslip (wage structure with Actual,
// Earned and YTD columns) for the "Payslip" letter category. Earned values come
// from the period's persisted payroll_entries; Actual is the full-month entitlement
// from the employee's current salary assignment; YTD is the financial-year cumulative
// of earned values up to and including the selected period. No mock data.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { computeSalaryBreakdown, type SalaryBreakdown } from '../data/salaryStructures';
import { loadDbStructures, getEmployeeAssignment } from './salaryAssignments';

const pdb = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);

// ─── Period options (only periods that have at least one processed run) ──────────

export interface PayslipPeriodOpt { id: string; name: string; fromDate: string; toDate: string; financialYear: string }

export async function loadPayslipPeriods(): Promise<PayslipPeriodOpt[]> {
  const [{ data: periods }, { data: runs }] = await Promise.all([
    pdb.from('payroll_periods').select('id, name, from_date, to_date, financial_year').order('from_date', { ascending: false }),
    pdb.from('payroll_runs').select('payroll_period_id'),
  ]);
  const withRun = new Set(((runs ?? []) as Record<string, any>[]).map(r => r.payroll_period_id));
  return ((periods ?? []) as Record<string, any>[])
    .filter(p => withRun.has(p.id))
    .map(p => ({ id: p.id, name: p.name ?? '', fromDate: p.from_date ?? '', toDate: p.to_date ?? '', financialYear: p.financial_year ?? '' }));
}

// ─── Payslip document model ─────────────────────────────────────────────────────

export interface PayslipRow { label: string; actual: number; earned: number; ytd: number }

export interface PayslipDoc {
  employee: {
    name: string; code: string; designation: string; department: string; workLocation: string;
    employeeType: string; grade: string; pan: string; uan: string; bankAccount: string; ifsc: string; doj: string;
  };
  period: PayslipPeriodOpt;
  attendance: { workingDays: number; presentDays: number; leaveDays: number; lopDays: number; overtimeHours: number };
  earnings: PayslipRow[];
  deductions: PayslipRow[];
  grossActual: number; grossEarned: number; grossYtd: number;
  dedActual: number; dedEarned: number; dedYtd: number;
  netActual: number; netEarned: number; netYtd: number;
  employerPf: number; employerEsi: number;
}

// ─── Configurable format (stored as JSON in the letter_templates.body column) ──────

export type PayslipColumn = 'actual' | 'earned' | 'ytd';

export interface PayslipConfig {
  /** Employee header fields to show (keys from PAYSLIP_HEADER_FIELDS). */
  headerFields: string[];
  /** Show the working/present/leave/LOP/overtime attendance summary cards. */
  attendanceSummary: boolean;
  /** Which value columns appear in the earnings/deductions tables (≥1). */
  columns: Record<PayslipColumn, boolean>;
}

/** Selectable employee header fields and how to read them off a PayslipDoc. */
export const PAYSLIP_HEADER_FIELDS: { key: string; label: string; get: (d: PayslipDoc) => string }[] = [
  { key: 'name', label: 'Employee Name', get: d => d.employee.name },
  { key: 'code', label: 'Employee Code', get: d => d.employee.code },
  { key: 'designation', label: 'Designation', get: d => d.employee.designation },
  { key: 'department', label: 'Department', get: d => d.employee.department },
  { key: 'workLocation', label: 'Work Location', get: d => d.employee.workLocation },
  { key: 'employeeType', label: 'Employee Type', get: d => d.employee.employeeType },
  { key: 'grade', label: 'Grade', get: d => d.employee.grade },
  { key: 'doj', label: 'Date of Joining', get: d => fmtDate(d.employee.doj) },
  { key: 'pan', label: 'PAN', get: d => d.employee.pan },
  { key: 'uan', label: 'UAN', get: d => d.employee.uan },
  { key: 'bank', label: 'Bank A/C', get: d => `${d.employee.bankAccount}${d.employee.ifsc !== '—' ? ' · ' + d.employee.ifsc : ''}` },
];

export const PAYSLIP_COLUMN_LABELS: Record<PayslipColumn, string> = { actual: 'Actual', earned: 'Earned', ytd: 'YTD' };

export const DEFAULT_PAYSLIP_CONFIG: PayslipConfig = {
  headerFields: PAYSLIP_HEADER_FIELDS.map(f => f.key),
  attendanceSummary: true,
  columns: { actual: true, earned: true, ytd: true },
};

/** Parse a stored config (JSON in body); fall back to the default for legacy/blank rows. */
export function parsePayslipConfig(body?: string | null): PayslipConfig {
  if (!body) return DEFAULT_PAYSLIP_CONFIG;
  try {
    const raw = JSON.parse(body) as Partial<PayslipConfig>;
    const cols = { ...DEFAULT_PAYSLIP_CONFIG.columns, ...(raw.columns ?? {}) };
    if (!cols.actual && !cols.earned && !cols.ytd) cols.earned = true; // never empty
    return {
      headerFields: Array.isArray(raw.headerFields) ? raw.headerFields : DEFAULT_PAYSLIP_CONFIG.headerFields,
      attendanceSummary: raw.attendanceSummary !== false,
      columns: cols,
    };
  } catch {
    return DEFAULT_PAYSLIP_CONFIG;
  }
}

/** Sample document so the format editor can preview the configured layout. */
export const SAMPLE_PAYSLIP_DOC: PayslipDoc = {
  employee: {
    name: 'John Doe', code: 'EMP0001', designation: 'Software Engineer', department: 'Engineering',
    workLocation: 'Head Office', employeeType: 'Permanent', grade: 'Grade A', pan: 'ABCDE1234F',
    uan: '100123456789', bankAccount: 'XXXX 4321', ifsc: 'HDFC0001234', doj: '2024-04-01',
  },
  period: { id: 'sample', name: 'April 2026', fromDate: '2026-04-01', toDate: '2026-04-30', financialYear: '2026-27' },
  attendance: { workingDays: 26, presentDays: 24, leaveDays: 1, lopDays: 1, overtimeHours: 4 },
  earnings: [
    { label: 'Basic Salary', actual: 30000, earned: 28846, ytd: 28846 },
    { label: 'House Rent Allowance (HRA)', actual: 15000, earned: 14423, ytd: 14423 },
    { label: 'Conveyance Allowance', actual: 2000, earned: 1923, ytd: 1923 },
    { label: 'Other Earnings / Allowances', actual: 8000, earned: 7692, ytd: 7692 },
  ],
  deductions: [
    { label: 'Provident Fund (Employee)', actual: 1800, earned: 1800, ytd: 1800 },
    { label: 'Professional Tax', actual: 200, earned: 200, ytd: 200 },
    { label: 'Income Tax (TDS)', actual: 2500, earned: 2500, ytd: 2500 },
  ],
  grossActual: 55000, grossEarned: 52884, grossYtd: 52884,
  dedActual: 4500, dedEarned: 4500, dedYtd: 4500,
  netActual: 50500, netEarned: 48384, netYtd: 48384,
  employerPf: 1800, employerEsi: 0,
};

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return '—';
  const day = String(dt.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
}

const amtOf = (b: SalaryBreakdown, code: string, type: 'earnings' | 'deductions' | 'reimbursements') =>
  b[type].find(l => l.componentCode === code)?.amount ?? 0;

/** Build the per-employee, full-month "Actual" earnings from the current assignment. */
async function actualEarnings(employeeId: string): Promise<Record<string, number>> {
  const [assignment, structures] = await Promise.all([getEmployeeAssignment(employeeId), loadDbStructures()]);
  if (!assignment) return {};
  const structure = structures.find(s => s.id === assignment.structureId);
  if (!structure) return {};
  const b = computeSalaryBreakdown(structure, assignment.ctcMonthly, assignment.componentValues);
  return {
    basic: b.basicMonthly,
    hra: amtOf(b, 'HRA', 'earnings'),
    special: amtOf(b, 'SPEC', 'earnings'),
    conveyance: amtOf(b, 'CONV', 'earnings'),
    medical: amtOf(b, 'MED', 'earnings'),
    lta: amtOf(b, 'LTA', 'reimbursements'),
    gross: b.grossMonthly + b.totalReimbursements,
  };
}

const ENTRY_COLS = [
  'basic_salary', 'hra', 'conveyance_allowance', 'medical_allowance', 'special_allowance', 'lta', 'other_earnings', 'arrears',
  'gross_salary', 'pf_employee', 'esi_employee', 'professional_tax', 'tds', 'loan_emi', 'other_deductions',
  'total_deductions', 'net_salary', 'pf_employer', 'esi_employer', 'working_days', 'present_days', 'leave_days',
  'absent_days', 'overtime_hours',
].join(', ');

/** Latest run id for a period (most recent run). */
async function latestRunId(periodId: string): Promise<string | null> {
  const { data } = await pdb.from('payroll_runs').select('id').eq('payroll_period_id', periodId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as any)?.id ?? null;
}

/**
 * Load a full payslip document for one employee + period. Returns null when the
 * period has no processed run or the employee has no entry in it.
 */
export async function loadPayslipData(employeeId: string, period: PayslipPeriodOpt): Promise<PayslipDoc | null> {
  const runId = await latestRunId(period.id);
  if (!runId) return null;

  const [entryRes, empRes, statRes, bankRes, actual, fyPeriodsRes] = await Promise.all([
    pdb.from('payroll_entries').select(ENTRY_COLS).eq('payroll_run_id', runId).eq('employee_id', employeeId).maybeSingle(),
    pdb.from('employees').select('employee_id, first_name, middle_name, last_name, date_of_joining, designation:designations(name), department:departments(name), work_location:work_locations(name), grade:employee_grades(name), employee_type:employee_types(name)').eq('id', employeeId).maybeSingle(),
    pdb.from('employee_statutory').select('pan_no, uan_no').eq('employee_id', employeeId).maybeSingle(),
    pdb.from('employee_bank_accounts').select('account_number, ifsc_code, is_primary').eq('employee_id', employeeId),
    actualEarnings(employeeId),
    pdb.from('payroll_periods').select('id, from_date').eq('financial_year', period.financialYear),
  ]);

  const e = entryRes.data as Record<string, any> | null;
  if (!e) return null;

  // ── YTD: sum earned across the FY's processed runs up to & including this period ──
  const fyPeriods = ((fyPeriodsRes.data ?? []) as Record<string, any>[])
    .filter(p => (p.from_date ?? '') <= (period.fromDate || '9999-99-99'));
  const ytd: Record<string, number> = {};
  await Promise.all(fyPeriods.map(async p => {
    const rid = await latestRunId(p.id);
    if (!rid) return;
    const { data } = await pdb.from('payroll_entries').select(ENTRY_COLS).eq('payroll_run_id', rid).eq('employee_id', employeeId).maybeSingle();
    if (!data) return;
    for (const col of ['basic_salary', 'hra', 'conveyance_allowance', 'medical_allowance', 'special_allowance', 'lta', 'other_earnings', 'arrears', 'gross_salary', 'pf_employee', 'esi_employee', 'professional_tax', 'tds', 'loan_emi', 'other_deductions', 'total_deductions', 'net_salary'])
      ytd[col] = (ytd[col] ?? 0) + num((data as Record<string, any>)[col]);
  }));

  const emp = (empRes.data ?? {}) as Record<string, any>;
  const stat = (statRes.data ?? {}) as Record<string, any>;
  const banks = (bankRes.data ?? []) as Record<string, any>[];
  const bank = banks.find(b => b.is_primary) ?? banks[0];
  const name = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') || (emp.employee_id ?? 'Employee');

  // Earnings rows (Actual full-month, Earned this period, YTD). "Other Earnings" is
  // computed as the residual to Gross so the named rows always reconcile to the total.
  const grossActual = num(actual.gross);
  const grossEarned = num(e.gross_salary);
  const grossYtd = num(ytd.gross_salary);
  const earnRow = (label: string, actualKey: string, col: string): PayslipRow =>
    ({ label, actual: num(actual[actualKey]), earned: num(e[col]), ytd: num(ytd[col]) });
  const namedEarnings = [
    earnRow('Basic Salary', 'basic', 'basic_salary'),
    earnRow('House Rent Allowance (HRA)', 'hra', 'hra'),
    earnRow('Conveyance Allowance', 'conveyance', 'conveyance_allowance'),
    earnRow('Medical Allowance', 'medical', 'medical_allowance'),
    earnRow('Special Allowance', 'special', 'special_allowance'),
    earnRow('Leave Travel Allowance (LTA)', 'lta', 'lta'),
  ];
  // Salary-revision arrears paid this period — shown as a distinct line (no full-month "Actual").
  if (num(e.arrears) || num(ytd.arrears)) namedEarnings.push({ label: 'Arrears (Salary Revision)', actual: 0, earned: num(e.arrears), ytd: num(ytd.arrears) });
  const sum = (k: keyof PayslipRow) => namedEarnings.reduce((s, r) => s + (r[k] as number), 0);
  const otherRow: PayslipRow = {
    label: 'Other Earnings / Allowances',
    actual: Math.max(0, grossActual - sum('actual')),
    earned: Math.max(0, grossEarned - sum('earned')),
    ytd: Math.max(0, grossYtd - sum('ytd')),
  };
  const earnings = [...namedEarnings, otherRow].filter(r => r.actual || r.earned || r.ytd);

  // Deductions rows (Actual = Earned, since deductions apply to paid wages)
  const dedRow = (label: string, col: string): PayslipRow =>
    ({ label, actual: num(e[col]), earned: num(e[col]), ytd: num(ytd[col]) });
  const deductions = [
    dedRow('Provident Fund (Employee)', 'pf_employee'),
    dedRow('ESI (Employee)', 'esi_employee'),
    dedRow('Professional Tax', 'professional_tax'),
    dedRow('Income Tax (TDS)', 'tds'),
    dedRow('Loan / Advance EMI', 'loan_emi'),
    dedRow('Other Deductions', 'other_deductions'),
  ].filter(r => r.actual || r.earned || r.ytd);

  const dedEarned = num(e.total_deductions);
  const dedYtd = num(ytd.total_deductions);
  const dedActual = deductions.reduce((s, r) => s + r.actual, 0);

  return {
    employee: {
      name, code: emp.employee_id ?? '', designation: emp.designation?.name ?? '—', department: emp.department?.name ?? '—',
      workLocation: emp.work_location?.name ?? '—', employeeType: emp.employee_type?.name ?? '—', grade: emp.grade?.name ?? '—',
      pan: stat.pan_no ?? '—', uan: stat.uan_no ?? '—',
      bankAccount: bank?.account_number ? `XXXX ${String(bank.account_number).slice(-4)}` : '—', ifsc: bank?.ifsc_code ?? '—',
      doj: emp.date_of_joining ?? '',
    },
    period,
    attendance: {
      workingDays: num(e.working_days), presentDays: num(e.present_days), leaveDays: num(e.leave_days),
      lopDays: num(e.absent_days), overtimeHours: num(e.overtime_hours),
    },
    earnings, deductions,
    grossActual, grossEarned, grossYtd,
    dedActual, dedEarned, dedYtd,
    netActual: grossActual - dedActual, netEarned: num(e.net_salary), netYtd: num(ytd.net_salary),
    employerPf: num(e.pf_employer), employerEsi: num(e.esi_employer),
  };
}

// ─── Number to words (Indian) ─────────────────────────────────────────────────────

function numberToWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number): string => x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ' ' + ones[x % 10] : ''}`;
  const three = (x: number): string => x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' + two(x % 100) : ''}` : two(x);
  let words = '';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) words += `${three(crore)} Crore `;
  if (lakh) words += `${three(lakh)} Lakh `;
  if (thousand) words += `${three(thousand)} Thousand `;
  if (n) words += three(n);
  return `${words.trim()} Rupees Only`;
}

// ─── Payslip body HTML (drops into the letterhead via buildLetterHtml) ─────────────

export function buildPayslipBody(doc: PayslipDoc, currencySymbol = '₹', config: PayslipConfig = DEFAULT_PAYSLIP_CONFIG): string {
  const f = (n: number) => n ? `${currencySymbol}${Math.round(n).toLocaleString('en-IN')}` : '—';
  const empCell = (label: string, value: string) =>
    `<div style="display:flex;gap:6px;margin-bottom:3px;"><span style="color:#6b7280;font-size:10px;font-weight:600;text-transform:uppercase;min-width:108px;">${label}</span><span style="color:#111827;font-weight:600;font-size:11px;">${value}</span></div>`;
  const attCard = (value: string | number, label: string, color = '#1e3a5f') =>
    `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:7px;text-align:center;"><div style="font-size:15px;font-weight:bold;color:${color};">${value}</div><div style="font-size:8.5px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-top:2px;">${label}</div></div>`;

  // ── Header: only the selected employee fields, split across two columns ──
  const selectedFields = PAYSLIP_HEADER_FIELDS.filter(fld => config.headerFields.includes(fld.key));
  const half = Math.ceil(selectedFields.length / 2);
  const col1 = selectedFields.slice(0, half).map(fld => empCell(fld.label, fld.get(doc))).join('');
  const col2 = selectedFields.slice(half).map(fld => empCell(fld.label, fld.get(doc))).join('');
  const headerBlock = selectedFields.length
    ? `<div class="ps-emp"><div>${col1}</div><div>${col2}</div></div>` : '';

  // ── Attendance summary (optional) ──
  const attBlock = config.attendanceSummary
    ? `<div class="ps-att">
        ${attCard(doc.attendance.workingDays, 'Working Days')}
        ${attCard(doc.attendance.presentDays, 'Present Days', '#16a34a')}
        ${attCard(doc.attendance.leaveDays, 'Leave Days', '#2563eb')}
        ${attCard(doc.attendance.lopDays, 'LOP Days', '#dc2626')}
        ${attCard(`${doc.attendance.overtimeHours}h`, 'Overtime', '#7c3aed')}
      </div>` : '';

  // ── Value columns (Actual / Earned / YTD) per config ──
  const activeCols: PayslipColumn[] = (['actual', 'earned', 'ytd'] as PayslipColumn[]).filter(c => config.columns[c]);
  const colHead = activeCols.map(c => `<th class="amt">${PAYSLIP_COLUMN_LABELS[c]}</th>`).join('');
  const valCells = (r: PayslipRow) => activeCols.map(c => `<td class="amt${c === 'ytd' ? ' ytd' : ''}">${f(r[c])}</td>`).join('');
  const totCells = (vals: Record<PayslipColumn, number>) => activeCols.map(c => `<td class="amt${c === 'ytd' ? ' ytd' : ''}">${f(vals[c])}</td>`).join('');

  const earnRows = doc.earnings.map(r => `<tr><td>${r.label}</td>${valCells(r)}</tr>`).join('');
  const dedRows = doc.deductions.map(r => `<tr><td>${r.label}</td>${valCells(r)}</tr>`).join('');
  const grossVals = { actual: doc.grossActual, earned: doc.grossEarned, ytd: doc.grossYtd };
  const dedVals = { actual: doc.dedActual, earned: doc.dedEarned, ytd: doc.dedYtd };
  const colNames = activeCols.map(c => PAYSLIP_COLUMN_LABELS[c]).join(', ').replace(/, ([^,]*)$/, ' & $1');

  return `
  <style>
    .ps-title { text-align:center; font-size:15px; font-weight:bold; color:#1e3a5f; letter-spacing:.04em; margin:0 0 2px; }
    .ps-sub { text-align:center; font-size:10px; color:#6b7280; margin:0 0 14px; }
    .ps-period { display:inline-block; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; padding:2px 10px; border-radius:20px; font-size:10px; font-weight:bold; }
    .ps-emp { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:0 0 14px; padding:11px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; }
    .ps-att { display:grid; grid-template-columns:repeat(5,1fr); gap:7px; margin:0 0 14px; }
    .ps-secttl { font-size:11px; font-weight:bold; color:#1e3a5f; background:#eff6ff; padding:5px 9px; border:1px solid #bfdbfe; border-bottom:none; border-radius:4px 4px 0 0; }
    .ps-tbl { width:100%; border-collapse:collapse; margin-bottom:14px; }
    .ps-tbl th { background:#f1f5f9; font-size:8.5px; font-weight:700; text-transform:uppercase; color:#6b7280; padding:5px 8px; text-align:left; border:1px solid #e2e8f0; }
    .ps-tbl th.amt, .ps-tbl td.amt { text-align:right; }
    .ps-tbl td { padding:4px 8px; border:1px solid #e2e8f0; font-size:10px; }
    .ps-tbl td.amt { font-weight:600; }
    .ps-tbl td.ytd { color:#1d4ed8; }
    .ps-tbl tr.tot td { background:#f8fafc; font-weight:bold; font-size:10.5px; }
    .ps-net { background:linear-gradient(135deg,#1e3a5f,#2563eb); color:#fff; padding:13px 16px; border-radius:8px; margin:2px 0 14px; display:flex; justify-content:space-between; align-items:center; }
    .ps-foot { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:6px; padding-top:10px; border-top:1px solid #e2e8f0; }
    .ps-foot .lbl { font-size:8.5px; color:#6b7280; font-weight:600; text-transform:uppercase; }
    .ps-foot .val { font-size:11px; font-weight:700; color:#111827; margin-top:2px; }
    .ps-sign { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:22px; }
    .ps-sign div { border-top:1px dashed #9ca3af; padding-top:4px; font-size:9px; color:#9ca3af; text-align:center; }
    .ps-note { font-size:9px; color:#9ca3af; text-align:center; margin-top:10px; }
  </style>
  <div style="text-align:center;margin-bottom:6px;"><span class="ps-period">Pay Period: ${doc.period.name} (${fmtDate(doc.period.fromDate)} – ${fmtDate(doc.period.toDate)})</span></div>
  <div class="ps-title">SALARY SLIP</div>
  <div class="ps-sub">Wage structure — ${colNames} (FY ${doc.period.financialYear || '—'})</div>

  ${headerBlock}

  ${attBlock}

  <div class="ps-secttl">Earnings</div>
  <table class="ps-tbl">
    <thead><tr><th>Component</th>${colHead}</tr></thead>
    <tbody>
      ${earnRows}
      <tr class="tot"><td>Gross Earnings</td>${totCells(grossVals)}</tr>
    </tbody>
  </table>

  <div class="ps-secttl" style="background:#fff1f2;border-color:#fecdd3;color:#be123c;">Deductions</div>
  <table class="ps-tbl">
    <thead><tr><th>Component</th>${colHead}</tr></thead>
    <tbody>
      ${dedRows}
      <tr class="tot"><td>Total Deductions</td>${totCells(dedVals)}</tr>
    </tbody>
  </table>

  <div class="ps-net">
    <div>
      <div style="font-size:12px;font-weight:600;opacity:.9;">Net Pay (Take Home)</div>
      <div style="font-size:9.5px;opacity:.85;margin-top:2px;">${numberToWords(doc.netEarned)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:21px;font-weight:bold;">${f(doc.netEarned)}</div>
      <div style="font-size:9.5px;opacity:.85;margin-top:2px;">Gross ${f(doc.grossEarned)} − Deductions ${f(doc.dedEarned)}</div>
    </div>
  </div>

  <div class="ps-foot">
    <div><div class="lbl">Employer PF</div><div class="val">${f(doc.employerPf)}</div></div>
    <div><div class="lbl">Employer ESI</div><div class="val">${f(doc.employerEsi)}</div></div>
    <div><div class="lbl">YTD Gross</div><div class="val">${f(doc.grossYtd)}</div></div>
    <div><div class="lbl">YTD Net</div><div class="val">${f(doc.netYtd)}</div></div>
  </div>

  <div class="ps-sign">
    <div>Employee Signature</div>
    <div>HR Manager</div>
    <div>Authorised Signatory</div>
  </div>
  <div class="ps-note">This is a computer-generated payslip. Actual = full-month entitlement · Earned = paid for this period · YTD = financial-year to date.</div>
  `;
}
