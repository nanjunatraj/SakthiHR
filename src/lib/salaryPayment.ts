// Salary Payment data layer — reads the latest payroll run for a period with each
// employee's net payable + primary bank account, confirms payment, and (after payment)
// computes employee-wise arrears by diffing a fresh re-run against the paid entries.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { netOf, type RunCandidate } from './payrollRun';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PaymentRow {
  employeeId: string; code: string; name: string; department: string;
  bankName: string; accountName: string; accountNumber: string; ifsc: string; branch: string; accountType: string;
  net: number;
}

export interface PaymentView {
  runId: string | null;
  runStatus: string | null;
  paymentStatus: 'Pending' | 'Paid';
  paidAt: string | null;
  paymentReference: string | null;
  paymentMode: string | null;
  rows: PaymentRow[];
  totalNet: number;
}

export async function loadPaymentView(periodId: string): Promise<PaymentView> {
  const empty: PaymentView = { runId: null, runStatus: null, paymentStatus: 'Pending', paidAt: null, paymentReference: null, paymentMode: null, rows: [], totalNet: 0 };
  if (!periodId) return empty;
  const { data: runRows } = await db.from('payroll_runs')
    .select('id, status, payment_status, paid_at, payment_reference, payment_mode, run_date')
    .eq('payroll_period_id', periodId).order('run_date', { ascending: false }).limit(1);
  const run = (runRows ?? [])[0] as Record<string, any> | undefined;
  if (!run) return empty;

  const { data: ents } = await db.from('payroll_entries')
    .select('employee_id, net_salary, employees(employee_id, first_name, middle_name, last_name, department:departments(name))')
    .eq('payroll_run_id', run.id);
  const entries = (ents ?? []) as Array<Record<string, any>>;
  const empIds = entries.map(e => e.employee_id);

  // Primary bank account per employee (fall back to any account).
  const bankByEmp = new Map<string, Record<string, any>>();
  if (empIds.length) {
    const { data: banks } = await db.from('employee_bank_accounts')
      .select('employee_id, bank_name, account_name, account_number, ifsc_code, branch_name, account_type, is_primary')
      .in('employee_id', empIds);
    ((banks ?? []) as Array<Record<string, any>>).forEach(b => {
      const cur = bankByEmp.get(b.employee_id);
      if (!cur || b.is_primary) bankByEmp.set(b.employee_id, b);
    });
  }

  const rows: PaymentRow[] = entries.map(e => {
    const emp = e.employees ?? {};
    const b = bankByEmp.get(e.employee_id) ?? {};
    return {
      employeeId: e.employee_id,
      code: emp.employee_id ?? '',
      name: [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') || (emp.employee_id ?? 'Employee'),
      department: emp.department?.name ?? '—',
      bankName: b.bank_name ?? '', accountName: b.account_name ?? '', accountNumber: b.account_number ?? '',
      ifsc: b.ifsc_code ?? '', branch: b.branch_name ?? '', accountType: b.account_type ?? '',
      net: num(e.net_salary),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    runId: run.id, runStatus: run.status ?? null,
    paymentStatus: (run.payment_status === 'Paid' ? 'Paid' : 'Pending'),
    paidAt: run.paid_at ?? null, paymentReference: run.payment_reference ?? null, paymentMode: run.payment_mode ?? null,
    rows, totalNet: round2(rows.reduce((s, r) => s + r.net, 0)),
  };
}

export async function confirmSalaryPayment(runId: string, reference: string, mode: string): Promise<{ error: string | null }> {
  const { error } = await db.from('payroll_runs')
    .update({ payment_status: 'Paid', paid_at: new Date().toISOString(), payment_reference: reference || null, payment_mode: mode || null, updated_at: new Date().toISOString() } as never)
    .eq('id', runId);
  return { error: error?.message ?? null };
}

export interface ArrearsRow {
  employeeId: string; code: string; name: string; department: string;
  previousNet: number; revisedNet: number; arrears: number;
}

/** After payment confirmation, diff a fresh re-run (candidates) against the paid entries
 *  and persist employee-wise arrears. Does NOT touch the paid run or advance loan EMIs. */
export async function computeArrears(periodId: string, runId: string | null, candidates: RunCandidate[]): Promise<{ error: string | null; rows: ArrearsRow[] }> {
  if (!periodId || !runId) return { error: 'No paid payroll run for this period.', rows: [] };
  const { data: ents } = await db.from('payroll_entries')
    .select('employee_id, net_salary, employees(employee_id, first_name, middle_name, last_name, department:departments(name))')
    .eq('payroll_run_id', runId);
  const paidByEmp = new Map<string, { net: number; emp: Record<string, any> }>();
  ((ents ?? []) as Array<Record<string, any>>).forEach(e => paidByEmp.set(e.employee_id, { net: num(e.net_salary), emp: e.employees ?? {} }));

  const upserts: Array<Record<string, unknown>> = [];
  const rows: ArrearsRow[] = [];
  for (const c of candidates) {
    const paid = paidByEmp.get(c.employeeId);
    const previousNet = round2(paid?.net ?? 0);
    const revisedNet = round2(netOf(c));
    const arrears = round2(revisedNet - previousNet);
    const emp = paid?.emp ?? {};
    rows.push({
      employeeId: c.employeeId, code: c.employeeCode || (emp.employee_id ?? ''),
      name: c.employeeName || [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' '),
      department: emp.department?.name ?? '—',
      previousNet, revisedNet, arrears,
    });
    upserts.push({
      payroll_period_id: periodId, payroll_run_id: runId, employee_id: c.employeeId,
      previous_net: previousNet, revised_net: revisedNet, arrears_amount: arrears,
      breakdown: { gross: round2(c.breakdown.grossMonthly + c.breakdown.totalReimbursements + c.overtimeAmount), tds: c.tds, pf: c.pfEmployee, esi: c.esiEmployee, pt: c.pt, loanEmi: c.loanEmi },
      computed_at: new Date().toISOString(),
    });
  }
  if (upserts.length) {
    const { error } = await db.from('payroll_arrears').upsert(upserts as never, { onConflict: 'payroll_period_id,employee_id' });
    if (error) return { error: error.message, rows };
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { error: null, rows };
}

export async function loadArrears(periodId: string): Promise<ArrearsRow[]> {
  if (!periodId) return [];
  const { data } = await db.from('payroll_arrears')
    .select('employee_id, previous_net, revised_net, arrears_amount, employees(employee_id, first_name, middle_name, last_name, department:departments(name))')
    .eq('payroll_period_id', periodId);
  return ((data ?? []) as Array<Record<string, any>>).map(r => {
    const emp = r.employees ?? {};
    return {
      employeeId: r.employee_id, code: emp.employee_id ?? '',
      name: [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') || (emp.employee_id ?? 'Employee'),
      department: emp.department?.name ?? '—',
      previousNet: num(r.previous_net), revisedNet: num(r.revised_net), arrears: num(r.arrears_amount),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
