// Period-wise attendance — real per-date persistence to the `attendance_records` table.
// Generate writes one row per employee per day (Present/Holiday/Weekend/On Leave/Half Day),
// reading the real Holiday List Master (holidays), approved leave_requests and the employee roster.
// Submit/Approve move rows through the approval_status workflow (Draft → Submitted → Approved).
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;

export type ApprovalStatus = 'Draft' | 'Submitted' | 'Approved';
export type DayStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Holiday' | 'Weekend' | 'LOP';

export interface PeriodAttRow {
  employeeId: string;            // employees.id (uuid) — DB key
  code: string;                  // employee_id text (display)
  name: string;
  department: string;
  workLocationName: string;
  avatar: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  holidayDays: number;
  weekendDays: number;
  lopDays: number;
  overtimeHours: number;
  workingDays: number;
  totalDays: number;
  approval: ApprovalStatus;
}

const num = (v: unknown) => (typeof v === 'number' ? v : v ? Number(v) || 0 : 0);

function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  while (d <= end) { out.push(fmt(d)); d.setDate(d.getDate() + 1); }
  return out;
}

const isWeeklyOff = (type: string) => /weekend|weekly|week.?off/i.test(type || '');
const initials = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

interface EmpMeta { id: string; code: string; name: string; department: string; workLocationName: string }
async function loadEmployees(): Promise<EmpMeta[]> {
  const { data } = await db.from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, department:departments(name), work_location:work_locations(name)')
    .order('first_name');
  return ((data ?? []) as Record<string, any>[]).map(e => ({
    id: e.id,
    code: e.employee_id ?? '',
    name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
    department: e.department?.name ?? '—',
    workLocationName: e.work_location?.name ?? '—',
  }));
}

/** Classify each calendar date for the period using the real holiday calendar. */
async function classifyCalendar(fromDate: string, toDate: string) {
  const { data: hol } = await db.from('holidays')
    .select('holiday_date, type, is_half_day')
    .gte('holiday_date', fromDate).lte('holiday_date', toDate);
  const holiday = new Map<string, { weeklyOff: boolean; half: boolean }>();
  ((hol ?? []) as Record<string, any>[]).forEach(h => {
    holiday.set(h.holiday_date, { weeklyOff: isWeeklyOff(h.type), half: !!h.is_half_day });
  });
  return holiday;
}

/** Approved leave dates per employee (uuid) overlapping the period. */
async function loadApprovedLeaveDates(fromDate: string, toDate: string): Promise<Map<string, Set<string>>> {
  const { data } = await db.from('leave_requests')
    .select('employee_id, from_date, to_date, status')
    .lte('from_date', toDate).gte('to_date', fromDate);
  const out = new Map<string, Set<string>>();
  ((data ?? []) as Record<string, any>[])
    .filter(r => /approved/i.test(r.status ?? ''))
    .forEach(r => {
      const set = out.get(r.employee_id) ?? new Set<string>();
      for (const d of datesInRange(r.from_date, r.to_date)) {
        if (d >= fromDate && d <= toDate) set.add(d);
      }
      out.set(r.employee_id, set);
    });
  return out;
}

// Weekly-offs come solely from the Holiday List Master ("Weekly Off" type entries);
// there is no day-of-week picker. `overwriteExisting` replaces previously saved rows.
export interface GenerateConfig { overwriteExisting: boolean }

/** Holidays falling inside the period (for the Generate config summary). */
export interface PeriodHoliday { date: string; name: string; type: string; isHalfDay: boolean }
export async function loadPeriodHolidays(fromDate: string, toDate: string): Promise<PeriodHoliday[]> {
  if (!fromDate || !toDate) return [];
  const { data } = await db.from('holidays')
    .select('holiday_date, name, type, is_half_day')
    .gte('holiday_date', fromDate).lte('holiday_date', toDate)
    .order('holiday_date');
  return ((data ?? []) as Record<string, any>[]).map(h => ({
    date: h.holiday_date, name: h.name ?? '', type: h.type ?? '', isHalfDay: !!h.is_half_day,
  }));
}

/** Build the per-date DB rows for a period (shared by preview + generate).
 *  Weekly-offs / holidays are driven entirely by the Holiday List Master. */
function buildDayRows(
  employees: EmpMeta[],
  dates: string[],
  calendar: Map<string, { weeklyOff: boolean; half: boolean }>,
  leavesByEmp: Map<string, Set<string>>,
): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  for (const emp of employees) {
    const leaveDates = leavesByEmp.get(emp.id) ?? new Set<string>();
    for (const date of dates) {
      const hol = calendar.get(date);
      let status: DayStatus;
      if (hol?.half) status = 'Half Day';                     // half-day weekly off → HD
      else if (hol?.weeklyOff) status = 'Weekend';            // weekly off in holiday list
      else if (hol) status = 'Holiday';                       // national / festival holiday
      else if (leaveDates.has(date)) status = 'On Leave';
      else status = 'Present';
      rows.push({ employee_id: emp.id, attendance_date: date, status, approval_status: 'Draft' });
    }
  }
  return rows;
}

/** Aggregate in-memory day rows (no DB columns like overtime/approval) into summaries. */
function summarizeRows(rows: Record<string, any>[], employees: EmpMeta[]): PeriodAttRow[] {
  const empById = new Map(employees.map(e => [e.id, e]));
  const grouped = new Map<string, Record<string, any>[]>();
  rows.forEach(r => { const a = grouped.get(r.employee_id) ?? []; a.push(r); grouped.set(r.employee_id, a); });
  const out: PeriodAttRow[] = [];
  for (const [empId, recs] of grouped.entries()) {
    const m = empById.get(empId); if (!m) continue;
    let present = 0, absent = 0, late = 0, half = 0, leave = 0, holiday = 0, weekend = 0, lop = 0;
    for (const r of recs) {
      const s = (r.status ?? '').toLowerCase();
      if (/half/.test(s)) half++;
      else if (/present|wfh/.test(s)) present++;
      else if (/late/.test(s)) late++;
      else if (/lop|loss of pay/.test(s)) lop++;
      else if (/leave/.test(s)) leave++;
      else if (/absent/.test(s)) absent++;
      else if (/holiday/.test(s)) holiday++;
      else if (/weekend|weekly|week.?off/.test(s)) weekend++;
    }
    out.push({
      employeeId: empId, code: m.code, name: m.name, department: m.department,
      workLocationName: m.workLocationName, avatar: initials(m.name),
      presentDays: present, absentDays: absent, lateDays: late, halfDays: half,
      leaveDays: leave, holidayDays: holiday, weekendDays: weekend, lopDays: lop,
      overtimeHours: 0, totalDays: recs.length, workingDays: recs.length - weekend - holiday, approval: 'Draft',
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Compute (without persisting) what Generate would produce — for the preview step. */
export async function previewPeriodAttendance(
  fromDate: string,
  toDate: string,
  config: GenerateConfig,
): Promise<PeriodAttRow[]> {
  if (!fromDate || !toDate) return [];
  const [employees, calendar, leavesByEmp] = await Promise.all([
    loadEmployees(), classifyCalendar(fromDate, toDate), loadApprovedLeaveDates(fromDate, toDate),
  ]);
  const rows = buildDayRows(employees, datesInRange(fromDate, toDate), calendar, leavesByEmp);
  return summarizeRows(rows, employees);
}

/** Generate per-date attendance rows for every employee across the period and persist them. */
export async function generatePeriodAttendance(
  fromDate: string,
  toDate: string,
  config: GenerateConfig,
): Promise<{ error: string | null; count: number; employees: number }> {
  if (!fromDate || !toDate) return { error: 'Invalid period', count: 0, employees: 0 };
  const [employees, calendar, leavesByEmp] = await Promise.all([
    loadEmployees(), classifyCalendar(fromDate, toDate), loadApprovedLeaveDates(fromDate, toDate),
  ]);
  const rows = buildDayRows(employees, datesInRange(fromDate, toDate), calendar, leavesByEmp);
  if (!rows.length) return { error: null, count: 0, employees: employees.length };
  const { error } = await db.from('attendance_records')
    .upsert(rows, { onConflict: 'employee_id,attendance_date', ignoreDuplicates: !config.overwriteExisting });
  return { error: error?.message ?? null, count: rows.length, employees: employees.length };
}

/** Aggregate persisted attendance rows into per-employee summaries for the period. */
export async function loadPeriodSummaries(fromDate: string, toDate: string): Promise<PeriodAttRow[]> {
  if (!fromDate || !toDate) return [];
  const [employees, { data: att }] = await Promise.all([
    loadEmployees(),
    db.from('attendance_records')
      .select('employee_id, attendance_date, status, approval_status, overtime_hours')
      .gte('attendance_date', fromDate).lte('attendance_date', toDate),
  ]);
  const empById = new Map(employees.map(e => [e.id, e]));
  const grouped = new Map<string, Record<string, any>[]>();
  ((att ?? []) as Record<string, any>[]).forEach(a => {
    const arr = grouped.get(a.employee_id) ?? [];
    arr.push(a); grouped.set(a.employee_id, arr);
  });
  const rows: PeriodAttRow[] = [];
  for (const [empId, recs] of grouped.entries()) {
    const m = empById.get(empId);
    if (!m) continue; // record for an employee no longer present
    let present = 0, absent = 0, late = 0, half = 0, leave = 0, holiday = 0, weekend = 0, lop = 0, ot = 0;
    const approvals: string[] = [];
    for (const r of recs) {
      const s = (r.status ?? '').toLowerCase();
      if (/half/.test(s)) half++;
      else if (/present|wfh/.test(s)) present++;
      else if (/late/.test(s)) late++;
      else if (/lop|loss of pay/.test(s)) lop++;
      else if (/leave/.test(s)) leave++;
      else if (/absent/.test(s)) absent++;
      else if (/holiday/.test(s)) holiday++;
      else if (/weekend|weekly|week.?off/.test(s)) weekend++;
      ot += num(r.overtime_hours);
      approvals.push(r.approval_status ?? 'Draft');
    }
    const approval: ApprovalStatus = approvals.some(a => a === 'Draft')
      ? 'Draft' : approvals.some(a => a === 'Submitted') ? 'Submitted' : 'Approved';
    const totalDays = recs.length;
    rows.push({
      employeeId: empId, code: m.code, name: m.name, department: m.department,
      workLocationName: m.workLocationName, avatar: initials(m.name),
      presentDays: present, absentDays: absent, lateDays: late, halfDays: half,
      leaveDays: leave, holidayDays: holiday, weekendDays: weekend, lopDays: lop,
      overtimeHours: ot, totalDays, workingDays: totalDays - weekend - holiday, approval,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

/** Move attendance rows from one approval status to the next for a period. */
export async function setPeriodApproval(
  fromDate: string,
  toDate: string,
  from: ApprovalStatus,
  to: ApprovalStatus,
  employeeIds?: string[],
): Promise<{ error: string | null }> {
  let q = db.from('attendance_records')
    .update({ approval_status: to, updated_at: new Date().toISOString() })
    .gte('attendance_date', fromDate).lte('attendance_date', toDate)
    .eq('approval_status', from);
  if (employeeIds && employeeIds.length) q = q.in('employee_id', employeeIds);
  const { error } = await q;
  return { error: error?.message ?? null };
}

export interface EditCounts {
  presentDays: number; absentDays: number; lateDays: number; halfDays: number;
  leaveDays: number; lopDays: number; overtimeHours: number;
}

/** Persist a manual edit by deterministically redistributing statuses across the
 *  employee's working days (weekend/holiday rows are preserved). */
export async function saveEmployeeSummary(
  employeeId: string,
  fromDate: string,
  toDate: string,
  counts: EditCounts,
): Promise<{ error: string | null }> {
  const { data: recs } = await db.from('attendance_records')
    .select('id, attendance_date, status')
    .eq('employee_id', employeeId)
    .gte('attendance_date', fromDate).lte('attendance_date', toDate)
    .order('attendance_date');
  const all = (recs ?? []) as Record<string, any>[];
  // Working days = everything except weekend / holiday rows (those stay as-is).
  const fixed = (s: string) => /holiday|weekend|weekly|week.?off/i.test(s || '');
  const working = all.filter(r => !fixed(r.status ?? ''));
  // Place the "exception" statuses first, then let Present fill the remaining working days.
  // (This way marking e.g. 2 Absent reduces Present automatically, rather than being dropped.)
  const seq: DayStatus[] = [];
  const push = (n: number, s: DayStatus) => { for (let i = 0; i < Math.max(0, Math.floor(n)); i++) seq.push(s); };
  push(counts.lateDays, 'Late');
  push(counts.halfDays, 'Half Day');
  push(counts.leaveDays, 'On Leave');
  push(counts.lopDays, 'LOP');
  push(counts.absentDays, 'Absent');
  // Remaining working days become Present (exceptions beyond capacity are trimmed below).
  while (seq.length < working.length) seq.push('Present');
  seq.length = working.length;
  const totalOt = Math.max(0, counts.overtimeHours || 0);
  const updates = working.map((r, i) => ({
    id: r.id,
    status: seq[i] ?? 'Present',
    overtime_hours: i === 0 ? totalOt : 0,   // park the period OT total on the first working day
    updated_at: new Date().toISOString(),
  }));
  // Apply row-by-row (small N per employee/period).
  for (const u of updates) {
    const { error } = await db.from('attendance_records')
      .update({ status: u.status, overtime_hours: u.overtime_hours, updated_at: u.updated_at })
      .eq('id', u.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}
