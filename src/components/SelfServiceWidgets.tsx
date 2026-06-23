import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, Check, Send,
  BarChart2, CheckCircle2, Circle, Clock, Users, X, CalendarOff,
  HandCoins, ShieldCheck, UserCheck, AlertCircle, FileText, Download, Eye,
  Printer, FileSignature, Mail,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { supabase } from '../supabase/client';
import { getEmployeeForm16Years, getEmployeeForm16, openForm16, updateEmployeeRegime, type EmployeeFyTotal } from '../lib/form16';
import type { TaxRegime } from '../lib/tax';
import { buildLetterHtml, openLetterPrint, loadLetterhead, categoryLabel } from '../lib/letters';
import { sendEmployeeEmail } from '../lib/email';
import {
  REIMBURSEMENT_CATEGORIES, loadEmployeeClaims, createClaim, loadCurrentPeriodId,
  type ReimbursementClaim, type ReimbursementStatus,
} from '../lib/reimbursements';
import AadhaarOTPSigning, { type SignatureData } from './AadhaarOTPSigning';
import { recordSignature } from '../lib/digitalSignature';
import SecureDocUploadZone from './SecureDocUploadZone';
import {
  submitResignation, loadExits, loadApprovals, actApproval, loadPendingApprovalsForApprover,
  type ExitRecord, type ExitApproval, type PendingApproval,
} from '../lib/employeeExit';

// New tables (polls, poll_votes, loan_emi_skip_requests) aren't in the generated
// Database type, so use a loosely-typed client for dynamic access — same pattern
// as src/hooks/useTable.ts.
const db = supabase as unknown as SupabaseClient;

// ─── Shared ───────────────────────────────────────────────────────────────────

interface PayrollPeriod {
  id: string;
  name: string;
  from_date: string;
  to_date: string;
  is_default: boolean | null;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

function usePayrollPeriods() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  useEffect(() => {
    void db
      .from('payroll_periods')
      .select('id, name, from_date, to_date, is_default')
      .order('from_date', { ascending: false })
      .then(({ data }) => setPeriods((data ?? []) as PayrollPeriod[]));
  }, []);
  return periods;
}

const ATT_STYLES: Record<string, { dot: string; cell: string; label: string }> = {
  Present: { dot: 'bg-green-500', cell: 'bg-green-50 border-green-200 text-green-800', label: 'Present' },
  Absent: { dot: 'bg-red-500', cell: 'bg-red-50 border-red-200 text-red-800', label: 'Absent' },
  Late: { dot: 'bg-amber-500', cell: 'bg-amber-50 border-amber-200 text-amber-800', label: 'Late' },
  'Half Day': { dot: 'bg-orange-500', cell: 'bg-orange-50 border-orange-200 text-orange-800', label: 'Half Day' },
  'On Leave': { dot: 'bg-blue-500', cell: 'bg-blue-50 border-blue-200 text-blue-800', label: 'On Leave' },
  Holiday: { dot: 'bg-violet-500', cell: 'bg-violet-50 border-violet-200 text-violet-800', label: 'Holiday' },
  Weekend: { dot: 'bg-teal-500', cell: 'bg-teal-50 border-teal-200 text-teal-800', label: 'Weekly Off' },
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Attendance + Leave Calendar ────────────────────────────────────────────────

interface AttendanceLeaveCalendarProps {
  employeeId?: string;
  /** Double-clicking a date calls this (e.g. open the Leave Application with the date pre-filled). */
  onApplyForDate?: (date: string) => void;
}

export const AttendanceLeaveCalendar = ({ employeeId, onApplyForDate }: AttendanceLeaveCalendarProps) => {
  const periods = usePayrollPeriods();
  const [periodId, setPeriodId] = useState<string>('');
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  // Holidays / weekly-offs for the period, keyed by date → { weekly, name }.
  const [holidays, setHolidays] = useState<Record<string, { weekly: boolean; name: string }>>({});
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Default to the CURRENT payroll period (the one containing today's date),
  // falling back to the marked-default period, then the most recent.
  useEffect(() => {
    if (!periodId && periods.length) {
      const today = ymd(new Date());
      const current = periods.find(p => p.from_date <= today && today <= p.to_date);
      setPeriodId((current ?? periods.find(p => p.is_default) ?? periods[0]).id);
    }
  }, [periods, periodId]);

  useEffect(() => {
    void db
      .from('leave_types')
      .select('id, name, code')
      .order('name')
      .then(({ data }) => {
        const rows = (data ?? []) as LeaveType[];
        setLeaveTypes(rows);
        if (rows.length) setLeaveTypeId(prev => prev || rows[0].id);
      });
  }, []);

  const period = useMemo(() => periods.find(p => p.id === periodId), [periods, periodId]);

  const loadAttendance = useCallback(async () => {
    if (!employeeId || !period) return;
    setLoading(true);
    const { data } = await db
      .from('attendance_records')
      .select('attendance_date, status')
      .eq('employee_id', employeeId)
      .gte('attendance_date', period.from_date)
      .lte('attendance_date', period.to_date);
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { attendance_date: string; status: string }) => {
      map[r.attendance_date] = r.status;
    });
    setAttendance(map);
    setSelected(new Set());
    setLoading(false);
  }, [employeeId, period]);

  useEffect(() => { void loadAttendance(); }, [loadAttendance]);

  // Load holidays + weekly-offs for the period so they colour the calendar even without an attendance record.
  useEffect(() => {
    if (!period) { setHolidays({}); return; }
    void db
      .from('holidays')
      .select('holiday_date, name, type')
      .gte('holiday_date', period.from_date)
      .lte('holiday_date', period.to_date)
      .then(({ data }) => {
        const map: Record<string, { weekly: boolean; name: string }> = {};
        (data ?? []).forEach((h: { holiday_date: string; name: string; type: string }) => {
          const weekly = (h.type ?? '').toLowerCase().includes('weekly');
          // A named holiday (e.g. National) takes precedence over a weekly-off on the same date.
          if (!map[h.holiday_date] || (!weekly && map[h.holiday_date].weekly)) {
            map[h.holiday_date] = { weekly, name: h.name || (weekly ? 'Weekly Off' : 'Holiday') };
          }
        });
        setHolidays(map);
      });
  }, [period]);

  // Build the calendar grid (leading blanks + each day of the period's month).
  const days = useMemo(() => {
    if (!period) return [];
    const start = new Date(period.from_date + 'T00:00:00');
    const end = new Date(period.to_date + 'T00:00:00');
    const cells: { date: string | null }[] = [];
    for (let i = 0; i < start.getDay(); i++) cells.push({ date: null });
    const cur = new Date(start);
    while (cur <= end) {
      cells.push({ date: ymd(cur) });
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }, [period]);

  const toggleDay = (date: string) => {
    const status = attendance[date];
    if (status === 'On Leave') { toast.info('Leave is already marked for this day.'); return; }
    if (!status && holidays[date]) { toast.info(`${holidays[date].name} — no leave needed.`); return; }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const applyLeave = async () => {
    if (!employeeId) { toast.error('Employee record not loaded yet. Please retry in a moment.'); return; }
    if (!selected.size) { toast.warn('Select one or more days on the calendar first.'); return; }
    if (!leaveTypeId) { toast.error('Select a leave type.'); return; }
    setSubmitting(true);
    const today = ymd(new Date());
    const rows = Array.from(selected).map(d => ({
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      from_date: d,
      to_date: d,
      days: 1,
      is_half_day: false,
      reason: reason.trim() || 'Applied from attendance calendar',
      status: 'Pending',
      applied_on: today,
    }));
    const { error } = await db.from('leave_requests').insert(rows);
    setSubmitting(false);
    if (error) { toast.error(`Could not submit leave: ${error.message}`); return; }
    toast.success(`Leave application submitted for ${rows.length} day${rows.length !== 1 ? 's' : ''}.`);
    setReason('');
    setSelected(new Set());
    void loadAttendance();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 rounded-lg"><CalendarDays size={16} className="text-indigo-600" /></div>
          <div>
            <h3 className="font-bold text-sm text-gray-900">Attendance Calendar</h3>
            <p className="text-[11px] text-gray-500">Pay-period view · tap to select · double-click a date to apply leave</p>
          </div>
        </div>
        <select
          value={periodId}
          onChange={e => setPeriodId(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="p-5">
        {!employeeId && (
          <div className="mb-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Loader2 size={13} className="animate-spin" /> Linking your employee record…
          </div>
        )}

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((cell, i) => {
            if (!cell.date) return <div key={`b${i}`} />;
            const hol = holidays[cell.date];
            // Attendance record (Present/Absent/Leave…) wins; otherwise fall back to holiday/weekly-off.
            const status = attendance[cell.date] ?? (hol ? (hol.weekly ? 'Weekend' : 'Holiday') : undefined);
            const style = status ? ATT_STYLES[status] : undefined;
            const isSelected = selected.has(cell.date);
            const dayNum = Number(cell.date.slice(8, 10));
            const tooltip = attendance[cell.date] ?? hol?.name ?? 'No record';
            // Show the attendance status; for holidays/weekly-offs (no record) show the actual holiday name.
            const cellLabel = attendance[cell.date] ? style?.label : (hol?.name ?? style?.label);
            return (
              <button
                key={cell.date}
                onClick={() => toggleDay(cell.date!)}
                onDoubleClick={() => onApplyForDate?.(cell.date!)}
                className={`relative aspect-square rounded-lg border text-xs font-semibold flex flex-col items-center justify-center transition-all
                  ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-300' : style ? style.cell : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'}`}
                title={tooltip}
              >
                <span>{dayNum}</span>
                {isSelected ? (
                  <Check size={11} className="mt-0.5" />
                ) : style ? (
                  <span className="mt-0.5 flex items-center gap-0.5 leading-tight max-w-full px-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                    <span className="text-[8px] font-bold tracking-tight text-center line-clamp-2">{cellLabel}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {loading && <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading attendance…</p>}

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-4 pt-4 border-t border-gray-100">
          {Object.values(ATT_STYLES).map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-[10px] text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Leave application */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-gray-100 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-700">{selected.size} day{selected.size !== 1 ? 's' : ''} selected</p>
                <button onClick={() => setSelected(new Set())} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X size={11} /> Clear
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={leaveTypeId}
                  onChange={e => setLeaveTypeId(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                </select>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <button
                onClick={applyLeave}
                disabled={submitting}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Send size={14} /> Apply for Leave</>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Poll Vote Widget ───────────────────────────────────────────────────────────

interface PollOption { id: string; text: string; sort_order: number; }
interface Poll {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  end_date: string | null;
  poll_options: PollOption[];
}

interface PollVoteWidgetProps {
  employeeId?: string;
}

export const PollVoteWidget = ({ employeeId }: PollVoteWidgetProps) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Record<string, string[]>>({}); // poll_id -> option_ids
  const [counts, setCounts] = useState<Record<string, number>>({}); // option_id -> count
  const [picking, setPicking] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: pollData } = await db
      .from('polls')
      .select('id, title, description, type, status, end_date, poll_options(id, text, sort_order)')
      .eq('status', 'Active')
      .order('created_at', { ascending: false });
    const pollList = ((pollData ?? []) as Poll[]).map(p => ({
      ...p,
      poll_options: [...(p.poll_options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }));
    setPolls(pollList);

    const { data: voteData } = await db.from('poll_votes').select('poll_id, option_id, employee_id');
    const allVotes = (voteData ?? []) as { poll_id: string; option_id: string | null; employee_id: string | null }[];
    const cnt: Record<string, number> = {};
    const mine: Record<string, string[]> = {};
    allVotes.forEach(v => {
      if (v.option_id) cnt[v.option_id] = (cnt[v.option_id] ?? 0) + 1;
      if (employeeId && v.employee_id === employeeId && v.option_id) {
        mine[v.poll_id] = [...(mine[v.poll_id] ?? []), v.option_id];
      }
    });
    setCounts(cnt);
    setVotes(mine);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  const togglePick = (poll: Poll, optionId: string) => {
    setPicking(prev => {
      const cur = new Set(prev[poll.id] ?? []);
      if (poll.type === 'multiple') {
        if (cur.has(optionId)) cur.delete(optionId); else cur.add(optionId);
      } else {
        cur.clear(); cur.add(optionId);
      }
      return { ...prev, [poll.id]: cur };
    });
  };

  const submitVote = async (poll: Poll) => {
    if (!employeeId) { toast.error('Employee record not loaded yet. Please retry in a moment.'); return; }
    const picked = Array.from(picking[poll.id] ?? []);
    if (!picked.length) { toast.warn('Select an option to submit.'); return; }
    setBusy(poll.id);
    const rows = picked.map(option_id => ({ poll_id: poll.id, option_id, employee_id: employeeId }));
    const { error } = await db.from('poll_votes').insert(rows);
    setBusy(null);
    if (error) { toast.error(`Could not submit vote: ${error.message}`); return; }
    toast.success('Thanks — your response was recorded.');
    void load();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-2 text-xs text-gray-400">
        <Loader2 size={14} className="animate-spin" /> Loading polls…
      </div>
    );
  }
  if (!polls.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <div className="p-2 bg-violet-100 rounded-lg"><BarChart2 size={16} className="text-violet-600" /></div>
        <div>
          <h3 className="font-bold text-sm text-gray-900">Active Polls</h3>
          <p className="text-[11px] text-gray-500">Your voice matters — cast your response</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {polls.map(poll => {
          const myVotes = votes[poll.id];
          const hasVoted = !!myVotes?.length;
          const totalVotes = poll.poll_options.reduce((s, o) => s + (counts[o.id] ?? 0), 0);
          const pick = picking[poll.id] ?? new Set<string>();
          return (
            <div key={poll.id} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h4 className="font-bold text-sm text-gray-900">{poll.title}</h4>
                {hasVoted && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={11} /> Voted
                  </span>
                )}
              </div>
              {poll.description && <p className="text-xs text-gray-500 mb-3">{poll.description}</p>}

              <div className="space-y-2">
                {poll.poll_options.map(opt => {
                  const c = counts[opt.id] ?? 0;
                  const pct = totalVotes ? Math.round((c / totalVotes) * 100) : 0;
                  const isMine = myVotes?.includes(opt.id);
                  const isPicked = pick.has(opt.id);
                  if (hasVoted) {
                    return (
                      <div key={opt.id} className="relative">
                        <div className="relative z-10 flex items-center justify-between px-3 py-2 text-xs">
                          <span className={`flex items-center gap-1.5 font-medium ${isMine ? 'text-violet-700' : 'text-gray-700'}`}>
                            {isMine ? <CheckCircle2 size={13} className="text-violet-600" /> : <Circle size={13} className="text-gray-300" />}
                            {opt.text}
                          </span>
                          <span className="font-bold text-gray-500">{pct}%</span>
                        </div>
                        <div className="absolute inset-0 rounded-lg bg-gray-50 overflow-hidden">
                          <div className={`h-full ${isMine ? 'bg-violet-100' : 'bg-gray-100'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={opt.id}
                      onClick={() => togglePick(poll, opt.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all
                        ${isPicked ? 'bg-violet-50 border-violet-300 text-violet-800 font-semibold' : 'bg-white border-gray-200 text-gray-700 hover:border-violet-300'}`}
                    >
                      {isPicked ? <CheckCircle2 size={14} className="text-violet-600 shrink-0" /> : <Circle size={14} className="text-gray-300 shrink-0" />}
                      {opt.text}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-gray-400 flex items-center gap-1"><Users size={11} /> {totalVotes} response{totalVotes !== 1 ? 's' : ''}</span>
                {!hasVoted && (
                  <button
                    onClick={() => submitVote(poll)}
                    disabled={busy === poll.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-[11px] font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60"
                  >
                    {busy === poll.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Submit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── EMI Skip Panel ─────────────────────────────────────────────────────────────

interface DbLoan {
  id: string;
  principal_amount: number;
  emi_amount: number;
  outstanding_balance: number;
  status: string;
  loan_types: { name: string } | null;
}
interface SkipRequest {
  id: string;
  loan_id: string;
  payroll_period_id: string | null;
  emi_month_number: number | null;
  reason: string;
  status: string;
  manager_status: string;
  hr_status: string;
  requested_on: string;
}

const STAGE_BADGE: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-green-50 text-green-700 border-green-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
};

interface EmiSkipPanelProps {
  employeeId?: string;
}

export const EmiSkipPanel = ({ employeeId }: EmiSkipPanelProps) => {
  const periods = usePayrollPeriods();
  const [loans, setLoans] = useState<DbLoan[]>([]);
  const [requests, setRequests] = useState<SkipRequest[]>([]);
  const [loanId, setLoanId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) return;
    const { data: loanData } = await db
      .from('loans')
      .select('id, principal_amount, emi_amount, outstanding_balance, status, loan_types(name)')
      .eq('employee_id', employeeId)
      .eq('status', 'Active');
    const loanList = (loanData ?? []) as unknown as DbLoan[];
    setLoans(loanList);
    if (loanList.length) setLoanId(prev => prev || loanList[0].id);

    const { data: reqData } = await db
      .from('loan_emi_skip_requests')
      .select('id, loan_id, payroll_period_id, emi_month_number, reason, status, manager_status, hr_status, requested_on')
      .eq('employee_id', employeeId)
      .order('requested_on', { ascending: false });
    setRequests((reqData ?? []) as SkipRequest[]);
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!periodId && periods.length) setPeriodId((periods.find(p => p.is_default) ?? periods[0]).id);
  }, [periods, periodId]);

  const submit = async () => {
    if (!employeeId) { toast.error('Employee record not loaded yet.'); return; }
    if (!loanId) { toast.error('Select a loan.'); return; }
    if (!periodId) { toast.error('Select the pay period to skip.'); return; }
    if (!reason.trim()) { toast.warn('Please provide a reason for the skip request.'); return; }
    setSubmitting(true);
    // Look up the employee's reporting manager so the manager-approval stage is routed.
    const { data: emp } = await db.from('employees').select('reporting_manager_id').eq('id', employeeId).maybeSingle();
    const { error } = await db.from('loan_emi_skip_requests').insert({
      loan_id: loanId,
      employee_id: employeeId,
      payroll_period_id: periodId,
      reason: reason.trim(),
      status: 'Pending',
      manager_status: 'Pending',
      hr_status: 'Pending',
      manager_id: (emp as { reporting_manager_id: string | null } | null)?.reporting_manager_id ?? null,
    });
    setSubmitting(false);
    if (error) { toast.error(`Could not submit request: ${error.message}`); return; }
    toast.success('EMI-skip request submitted for manager & HR approval.');
    setReason('');
    setOpen(false);
    void load();
  };

  const periodName = (id: string | null) => periods.find(p => p.id === id)?.name ?? '—';

  if (!loans.length && !requests.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-100 rounded-lg"><CalendarOff size={16} className="text-rose-600" /></div>
          <div>
            <h3 className="font-bold text-sm text-gray-900">EMI Skip Requests</h3>
            <p className="text-[11px] text-gray-500">Request to skip a loan EMI for a pay period · approved by manager &amp; HR</p>
          </div>
        </div>
        {loans.length > 0 && (
          <button
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
          >
            <HandCoins size={14} /> {open ? 'Close' : 'Request EMI Skip'}
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                <label className="block">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Loan</span>
                  <select value={loanId} onChange={e => setLoanId(e.target.value)} className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-300">
                    {loans.map(l => <option key={l.id} value={l.id}>{l.loan_types?.name ?? 'Loan'} · EMI ₹{Number(l.emi_amount).toLocaleString('en-IN')}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Pay Period to Skip</span>
                  <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-300">
                    {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Reason</span>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why do you need to skip this EMI?" className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-300 resize-none" />
                </label>
              </div>
              <button
                onClick={submit}
                disabled={submitting}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-60"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Send size={14} /> Submit Request</>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {requests.length === 0 ? (
          <p className="text-xs text-gray-400 flex items-center gap-1.5"><AlertCircle size={13} /> No EMI-skip requests yet.</p>
        ) : (
          <div className="space-y-2.5">
            {requests.map(r => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{periodName(r.payroll_period_id)}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{r.reason}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STAGE_BADGE[r.status === 'ManagerApproved' ? 'Pending' : r.status] ?? STAGE_BADGE.Pending}`}>
                    {r.status === 'ManagerApproved' ? 'Awaiting HR' : r.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${STAGE_BADGE[r.manager_status]}`}>
                    <UserCheck size={11} /> Manager: {r.manager_status}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${STAGE_BADGE[r.hr_status]}`}>
                    <ShieldCheck size={11} /> HR: {r.hr_status}
                  </span>
                  <span className="ml-auto text-gray-400 flex items-center gap-1"><Clock size={10} /> {r.requested_on}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Form 16 Panel (self-service view & download) ───────────────────────────────

interface Form16PanelProps {
  employeeId?: string;
  /** The employee's current tax regime (from session), for the declaration control. */
  regime?: TaxRegime;
}

export const Form16Panel = ({ employeeId, regime }: Form16PanelProps) => {
  const [years, setYears] = useState<EmployeeFyTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [localRegime, setLocalRegime] = useState<TaxRegime>(regime ?? 'New');

  useEffect(() => { setLocalRegime(regime ?? 'New'); }, [regime]);

  const load = useCallback(async () => {
    if (!employeeId) { setYears([]); setLoading(false); return; }
    setLoading(true);
    const [yrs, { data: emp }] = await Promise.all([
      getEmployeeForm16Years(employeeId),
      db.from('employees').select('tax_regime').eq('id', employeeId).maybeSingle(),
    ]);
    setYears(yrs);
    const dbRegime = (emp as { tax_regime: string | null } | null)?.tax_regime;
    if (dbRegime === 'Old' || dbRegime === 'New') setLocalRegime(dbRegime);
    setLoading(false);
  }, [employeeId]);
  useEffect(() => { void load(); }, [load]);

  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const download = async (fy: string) => {
    if (!employeeId) return;
    setBusy(fy);
    const data = await getEmployeeForm16(employeeId, fy);
    setBusy(null);
    if (!data) { toast.error('No Form 16 data for this year yet.'); return; }
    if (!openForm16(data.row, data.employer, fy)) toast.error('Popup blocked. Please allow popups to download Form 16.');
    else toast.success(`Form 16 for FY ${fy} opened. Use Print → Save as PDF.`);
  };

  const changeRegime = async (r: TaxRegime) => {
    if (!employeeId) { toast.error('Employee record not loaded yet.'); return; }
    setLocalRegime(r);
    const { error } = await updateEmployeeRegime(employeeId, r);
    if (error) { toast.error(error); return; }
    toast.success(`Tax regime set to ${r} Regime. Future payroll will use it.`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5 flex-wrap">
        <div className="p-2 bg-rose-100 rounded-lg"><FileText size={18} className="text-rose-600" /></div>
        <div>
          <h3 className="font-bold text-sm text-gray-900">Form 16 — Annual TDS Certificate</h3>
          <p className="text-xs text-gray-500">View & download your year-wise income-tax certificate.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-500">Tax Regime:</span>
          <select value={localRegime} onChange={e => changeRegime(e.target.value as TaxRegime)} className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-300 appearance-none">
            <option value="New">New Regime</option>
            <option value="Old">Old Regime</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-6 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin" /> Loading…</div>
      ) : years.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">No Form 16 available yet — it appears once payroll has been processed for a financial year.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {years.map(y => (
            <div key={y.fy} className="px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-bold text-sm text-gray-900">FY {y.fy}</p>
                <p className="text-xs text-gray-500">Gross {inr(y.gross)} · TDS <span className="font-semibold text-rose-600">{inr(y.tds)}</span> · {y.months} month{y.months !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={busy === y.fy} onClick={() => download(y.fy)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors disabled:opacity-60">
                  {busy === y.fy ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} View
                </button>
                <button disabled={busy === y.fy} onClick={() => download(y.fy)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-60">
                  <Download size={13} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── My Letters (ESS) — view / print / download + Aadhaar eSign acknowledge ─────

interface MyLetter {
  id: string;
  title: string;
  bodyHtml: string;
  category: string;
  useLetterhead: boolean;
  refNo: string;
  status: string;
  sentAt: string | null;
  acknowledgedAt: string | null;
}

interface MyLettersPanelProps {
  employeeId?: string;
  employeeName?: string;
  employeeCode?: string;
}

export const MyLettersPanel = ({ employeeId, employeeName, employeeCode }: MyLettersPanelProps) => {
  const [letters, setLetters] = useState<MyLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState<MyLetter | null>(null);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    const { data } = await db.from('generated_letters')
      .select('id, title, body_html, category, use_letterhead, ref_no, status, sent_at, acknowledged_at')
      .eq('employee_id', employeeId).in('status', ['Sent', 'Acknowledged'])
      .order('created_at', { ascending: false });
    setLetters(((data ?? []) as Record<string, any>[]).map(r => ({
      id: r.id, title: r.title ?? 'Letter', bodyHtml: r.body_html ?? '', category: r.category ?? '',
      useLetterhead: r.use_letterhead !== false, refNo: r.ref_no ?? '', status: r.status ?? 'Sent',
      sentAt: r.sent_at ?? null, acknowledgedAt: r.acknowledged_at ?? null,
    })));
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  const view = async (l: MyLetter) => {
    const lh = l.useLetterhead ? await loadLetterhead(employeeId) : null;
    const html = buildLetterHtml({ title: l.title, bodyHtml: l.bodyHtml, letterhead: lh, useLetterhead: l.useLetterhead });
    if (!openLetterPrint(html)) toast.error('Popup blocked — allow popups to view/print.');
  };

  const [emailingId, setEmailingId] = useState<string | null>(null);
  const emailToMe = async (l: MyLetter) => {
    setEmailingId(l.id);
    const lh = l.useLetterhead ? await loadLetterhead(employeeId) : null;
    const html = buildLetterHtml({ title: l.title, bodyHtml: l.bodyHtml, letterhead: lh, useLetterhead: l.useLetterhead, withToolbar: false });
    const { data: emp } = await db.from('employees').select('email').eq('id', employeeId).maybeSingle();
    const res = await sendEmployeeEmail({
      employeeId, toEmail: (emp as { email?: string } | null)?.email ?? null, category: 'letter',
      documentTitle: l.title, subject: l.title,
      message: `<p>Dear ${employeeName},</p><p>Please find your <strong>${l.title}</strong> attached.</p>`,
      documentHtml: html,
    });
    setEmailingId(null);
    if (res.error) toast.error(`Email failed: ${res.error}`);
    else if (res.status === 'No Email') toast.error('No email address on your profile — contact HR.');
    else if (res.status === 'Simulated') toast.success('Logged (email isn’t configured by HR yet).');
    else toast.success('Letter emailed to you — check your inbox.');
  };

  const onSigned = async (sig: SignatureData) => {
    if (!signing) return;
    await recordSignature(sig, { documentName: signing.title, documentCategory: categoryLabel(signing.category), source: 'letter' });
    const { error } = await db.from('generated_letters')
      .update({ status: 'Acknowledged', acknowledged_at: new Date().toISOString(), signature: sig as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq('id', signing.id);
    setSigning(null);
    if (error) { toast.error(`Could not record acknowledgement: ${error.message}`); return; }
    toast.success('Letter acknowledged & eSigned.');
    void load();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <div className="p-2 bg-rose-100 rounded-lg"><FileSignature size={16} className="text-rose-600" /></div>
        <div>
          <h3 className="font-bold text-sm text-gray-900">My Letters</h3>
          <p className="text-[11px] text-gray-500">View, print/download & acknowledge HR letters</p>
        </div>
        {letters.some(l => l.status !== 'Acknowledged') && (
          <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
            {letters.filter(l => l.status !== 'Acknowledged').length} to acknowledge
          </span>
        )}
      </div>

      <div className="p-5">
        {!employeeId && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Loader2 size={13} className="animate-spin" /> Linking your employee record…
          </div>
        )}
        {employeeId && loading && <p className="text-[11px] text-gray-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading letters…</p>}
        {employeeId && !loading && letters.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <FileText size={26} className="mx-auto mb-2" />
            <p className="text-sm">No letters yet.</p>
          </div>
        )}

        <div className="space-y-2">
          {letters.map(l => (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-rose-200 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0"><FileText size={16} className="text-rose-600" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{l.title}</p>
                <p className="text-[10px] text-gray-500">{categoryLabel(l.category)} · {l.refNo}</p>
              </div>
              {l.status === 'Acknowledged' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full shrink-0"><CheckCircle2 size={11} /> Acknowledged · eSigned</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full shrink-0"><Clock size={11} /> Action needed</span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => view(l)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors" title="View / Print / Download PDF"><Eye size={15} /></button>
                <button onClick={() => void emailToMe(l)} disabled={emailingId === l.id} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50" title="Email this letter to me"><Mail size={15} /></button>
                {l.status !== 'Acknowledged' && (
                  <button onClick={() => setSigning(l)} className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-xs font-semibold" title="Acknowledge with Aadhaar eSign">
                    <FileSignature size={13} /> Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {signing && (
          <AadhaarOTPSigning
            document={{ id: signing.id, name: signing.title, category: categoryLabel(signing.category) }}
            employeeName={employeeName ?? ''}
            employeeId={employeeCode ?? ''}
            onClose={() => setSigning(null)}
            onSigned={onSigned}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── My Reimbursements (self-service raise + status) ──────────────────────────────

const REIMB_STATUS_STYLE: Record<ReimbursementStatus, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Verified: 'bg-blue-100 text-blue-700 border-blue-200',
  Closed: 'bg-green-100 text-green-700 border-green-200',
  Paid: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-600 border-red-200',
};

export const MyReimbursementsPanel = ({ employeeId }: { employeeId?: string }) => {
  const [claims, setClaims] = useState<ReimbursementClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>('Travel');
  const [amount, setAmount] = useState('');
  const [hasBill, setHasBill] = useState(false);
  const [billRef, setBillRef] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const refresh = useCallback(async () => {
    if (!employeeId) { setClaims([]); setLoading(false); return; }
    setLoading(true);
    setClaims(await loadEmployeeClaims(employeeId));
    setLoading(false);
  }, [employeeId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async () => {
    if (!employeeId) { toast.error('Your employee record is still loading — retry shortly.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount.'); return; }
    setBusy(true);
    const periodId = await loadCurrentPeriodId();
    const { error } = await createClaim({ employeeId, periodId, category, amount: amt, hasBill, billReference: billRef, description, raisedBy: 'employee' });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success('Reimbursement claim submitted for verification.');
    setOpen(false); setAmount(''); setHasBill(false); setBillRef(''); setDescription(''); setCategory('Travel');
    void refresh();
  };

  const inputCls = 'w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none';

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-100 rounded-xl"><HandCoins size={18} className="text-teal-600" /></div>
          <div><h3 className="font-bold text-sm">My Reimbursements</h3><p className="text-[11px] text-muted-foreground">Raise expense claims (with or without bills) &amp; track status</p></div>
        </div>
        <button onClick={() => setOpen(o => !o)} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700">{open ? 'Close' : 'New Claim'}</button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border bg-accent/20">
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Category</label><select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>{REIMBURSEMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Amount</label><input type="number" min={0} className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
              </div>
              <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Description</label><textarea className={`${inputCls} resize-none`} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this expense for?" /></div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={hasBill} onChange={e => setHasBill(e.target.checked)} className="rounded border-border" /> Bill available</label>
                {hasBill && <input className={`${inputCls} flex-1 min-w-[160px]`} value={billRef} onChange={e => setBillRef(e.target.value)} placeholder="Bill / invoice reference" />}
                <button onClick={submit} disabled={busy} className="ml-auto px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50">{busy ? 'Submitting…' : 'Submit Claim'}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {loading && <div className="px-5 py-8 text-center text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin inline mr-2" />Loading…</div>}
        {!loading && claims.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">No reimbursement claims yet. Raise one with “New Claim”.</div>}
        {!loading && claims.map(c => (
          <div key={c.id} className="px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.category}{c.description ? ` — ${c.description}` : ''}</p>
              <p className="text-[11px] text-muted-foreground">{c.hasBill ? `With bill${c.billReference ? ` · ${c.billReference}` : ''}` : 'Without bill'} · {c.raisedBy === 'hr' ? 'Raised by HR' : 'Self-raised'}{c.rejectionReason ? ` · ${c.rejectionReason}` : ''}</p>
            </div>
            <span className="text-sm font-semibold">{inr(c.amount)}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${REIMB_STATUS_STYLE[c.status]}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── My Resignation / Exit + pending approvals ────────────────────────────────

const EXIT_STATUS_STYLE: Record<string, string> = {
  Initiated: 'bg-slate-100 text-slate-600 border-slate-200',
  'In Clearance': 'bg-amber-100 text-amber-700 border-amber-200',
  Settled: 'bg-blue-100 text-blue-700 border-blue-200',
  Relieved: 'bg-green-100 text-green-700 border-green-200',
  Cancelled: 'bg-red-100 text-red-600 border-red-200',
};

export const MyResignationPanel = ({ employeeId, employeeName, employeeCode }: { employeeId?: string; employeeName: string; employeeCode: string }) => {
  const [myExit, setMyExit] = useState<ExitRecord | null>(null);
  const [approvals, setApprovals] = useState<ExitApproval[]>([]);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [lwd, setLwd] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    setLoading(true);
    const [all, pend] = await Promise.all([loadExits(), loadPendingApprovalsForApprover(employeeId)]);
    const mine = all.find(e => e.employeeId === employeeId && e.status !== 'Cancelled') ?? null;
    setMyExit(mine);
    setApprovals(mine ? await loadApprovals(mine.id) : []);
    setPending(pend);
    setLoading(false);
  }, [employeeId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async () => {
    if (!employeeId) { toast.error('Your record is still loading.'); return; }
    if (!lwd) { toast.error('Pick a proposed last working day.'); return; }
    setBusy(true);
    const { error } = await submitResignation({ employeeId, lastWorkingDay: lwd, reason });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success('Resignation submitted — upload your signed letter below.');
    setOpen(false); setReason('');
    void refresh();
  };

  const decide = async (a: PendingApproval, decision: 'Approved' | 'Rejected') => {
    setBusy(true);
    const { error } = await actApproval(a.approvalId, decision, employeeName, '');
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(`${a.employeeName}'s resignation ${decision.toLowerCase()}.`);
    void refresh();
  };

  const inputCls = 'w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none';

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-100 rounded-xl"><UserCheck size={18} className="text-rose-600" /></div>
          <div><h3 className="font-bold text-sm">Resignation / Exit</h3><p className="text-[11px] text-muted-foreground">Submit your resignation &amp; track approvals; act on your team's requests</p></div>
        </div>
        {!myExit && !loading && <button onClick={() => setOpen(o => !o)} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700">{open ? 'Close' : 'Submit Resignation'}</button>}
      </div>

      <AnimatePresence>
        {open && !myExit && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border bg-accent/20">
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Proposed Last Working Day</label><input type="date" className={inputCls} value={lwd} onChange={e => setLwd(e.target.value)} /></div>
              </div>
              <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Reason</label><textarea className={`${inputCls} resize-none`} rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for resignation" /></div>
              <button onClick={submit} disabled={busy} className="px-5 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50">{busy ? 'Submitting…' : 'Submit Resignation'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 space-y-4">
        {loading && <div className="text-center text-sm text-muted-foreground py-4"><Loader2 size={15} className="animate-spin inline mr-2" />Loading…</div>}

        {!loading && myExit && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">My Resignation</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${EXIT_STATUS_STYLE[myExit.status]}`}>{myExit.status}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">LWD {myExit.lastWorkingDay || '—'}</span>
            </div>
            {/* Upload scanned letter */}
            <SecureDocUploadZone entityType="employee_exit" entityRef={myExit.id} label="Resignation Letter" signerName={employeeName} signerId={employeeCode} compact />
            {/* Approval progress */}
            <div className="space-y-1 pt-1">
              {approvals.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-border">
                  <span className="flex-1">{a.role}{a.approverName ? ` — ${a.approverName}` : ''}</span>
                  <span className={`font-semibold ${a.status === 'Approved' ? 'text-green-700' : a.status === 'Rejected' ? 'text-red-600' : 'text-amber-700'}`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && pending.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="text-sm font-semibold">Pending My Approval</p>
            {pending.map(a => (
              <div key={a.approvalId} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/50">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{a.employeeName} <span className="text-[10px] font-mono text-muted-foreground">{a.employeeCode}</span></p><p className="text-[11px] text-muted-foreground">{a.exitType} · {a.role} · LWD {a.lastWorkingDay || '—'}</p></div>
                <button onClick={() => decide(a, 'Approved')} disabled={busy} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50">Approve</button>
                <button onClick={() => decide(a, 'Rejected')} disabled={busy} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">Reject</button>
              </div>
            ))}
          </div>
        )}

        {!loading && !myExit && pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No active resignation. Use “Submit Resignation” to begin.</p>}
      </div>
    </div>
  );
};
