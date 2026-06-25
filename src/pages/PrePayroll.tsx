import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ClipboardCheck, ChevronLeft, ChevronRight, CheckCircle2, Lock, Unlock, RefreshCw,
  Printer, AlertCircle, Play, X, CalendarRange, Check, Ban, Sparkles,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import ReimbursementStagePanel from '../components/payroll/ReimbursementStagePanel';
import { useCurrency } from '../context/CurrencyContext';
import { usePayrollPeriodOptions, EMPTY_PERIOD_OPTION, useEstablishment, type PeriodOption } from '../lib/reports';
import { buildLetterHtml, openLetterPrint } from '../lib/letters';
import {
  PRE_STAGES, DEDUCTION_GROUPS, dedGroupLabel, loadPeriod, loadStageStatus, setStage,
  loadLeaves, setLeaveStatus, rejectAllPendingLeaves, loadOvertime, loadDeductions, approveDeduction,
  fullApproveDeductions, loadLoans, overrideSkip, loadFundContributions, loadAttendanceClose, markUnmarkedAsLOP, loadArrears,
  type StageKey, type PeriodInfo, type LeaveRow, type OtRow, type DeductionRow, type LoanRow, type FundRow, type AttRow, type ArrearsRow,
} from '../lib/prePayroll';
import { generatePeriodAttendance } from '../lib/periodAttendance';

const fmtDate = (d: string) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00'); if (isNaN(dt.getTime())) return d;
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(dt.getDate()).padStart(2,'0')}/${mo[dt.getMonth()]}/${dt.getFullYear()}`;
};

const isPending = (s: string) => /pending|draft/i.test(s);
const isApproved = (s: string) => /approved/i.test(s);

export default function PrePayroll() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const est = useEstablishment();
  const PERIODS = usePayrollPeriodOptions();
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  useEffect(() => { if (!selectedPeriodId && PERIODS.length) { const today = new Date().toISOString().slice(0,10); setSelectedPeriodId((PERIODS.find(p => p.fromDate <= today && today <= p.toDate) ?? PERIODS[0]).id); } }, [PERIODS, selectedPeriodId]);
  const periodOpt = PERIODS.find(p => p.id === selectedPeriodId) ?? PERIODS[0] ?? EMPTY_PERIOD_OPTION;
  const period: PeriodInfo = { id: periodOpt.id, name: periodOpt.name, fromDate: periodOpt.fromDate, toDate: periodOpt.toDate, status: periodOpt.status };

  const [status, setStatusMap] = useState<Record<StageKey, 'Open' | 'Closed'>>({ leaves:'Open', overtime:'Open', deductions:'Open', loans:'Open', fund_contribution:'Open', reimbursement:'Open', arrears:'Open', attendance:'Open' });
  const [activeStage, setActiveStage] = useState<StageKey>('leaves');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ msg: string; onYes: () => void } | null>(null);

  // Stage data
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [ot, setOt] = useState<OtRow[]>([]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [funds, setFunds] = useState<FundRow[]>([]);
  const [arrears, setArrears] = useState<ArrearsRow[]>([]);
  const [att, setAtt] = useState<AttRow[]>([]);
  const [reimbPending, setReimbPending] = useState(0);
  const [loadingStage, setLoadingStage] = useState(false);

  const refreshStatus = useCallback(() => { if (period.id) void loadStageStatus(period.id).then(setStatusMap); }, [period.id]);
  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const loadActive = useCallback(async () => {
    if (!period.id) return;
    setLoadingStage(true);
    try {
      if (activeStage === 'leaves') setLeaves(await loadLeaves(period));
      else if (activeStage === 'overtime') setOt(await loadOvertime(period));
      else if (activeStage === 'deductions') setDeductions(await loadDeductions(period));
      else if (activeStage === 'loans') setLoans(await loadLoans(period));
      else if (activeStage === 'fund_contribution') setFunds(await loadFundContributions(period));
      else if (activeStage === 'arrears') setArrears(await loadArrears(period));
      else if (activeStage === 'attendance') setAtt((await loadAttendanceClose(period)).rows);
    } finally { setLoadingStage(false); }
  }, [activeStage, period.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadActive(); }, [loadActive]);

  const allClosed = PRE_STAGES.every(s => status[s.key] === 'Closed');
  const priorClosed = (stage: StageKey) => { const seq = PRE_STAGES.find(s => s.key === stage)!.seq; return PRE_STAGES.filter(s => s.seq < seq).every(s => status[s.key] === 'Closed'); };

  // Blocking-item counts that prevent closing.
  const pendingLeaves = leaves.filter(l => isPending(l.status)).length;
  const pendingDeductions = deductions.filter(d => isPending(d.status)).length;
  const pendingSkips = loans.filter(l => l.skipStatus && isPending(l.skipStatus)).length;
  const pendingFunds = funds.filter(f => f.kind !== 'VPF' && isPending(f.status)).length;
  const unmarkedTotal = att.reduce((s, r) => s + r.unmarked, 0);

  const blockingFor = (stage: StageKey): string | null => {
    if (stage === 'leaves' && pendingLeaves > 0) return `${pendingLeaves} pending leave request(s) — approve/reject or reject all.`;
    if (stage === 'deductions' && pendingDeductions > 0) return `${pendingDeductions} deduction(s) awaiting approval — approve or full-approve.`;
    if (stage === 'loans' && pendingSkips > 0) return `${pendingSkips} EMI-skip request(s) pending — approve/reject (override).`;
    if (stage === 'fund_contribution' && pendingFunds > 0) return `${pendingFunds} fund deduction(s) awaiting employee approval.`;
    if (stage === 'reimbursement' && reimbPending > 0) return `${reimbPending} reimbursement claim(s) pending — verify, close or reject each.`;
    if (stage === 'attendance' && unmarkedTotal > 0) return `${unmarkedTotal} non-marked working day(s) — mark them as Loss of Pay first.`;
    return null;
  };

  const doClose = async (stage: StageKey) => {
    if (!priorClosed(stage)) { toast.error('Close the previous stage(s) first.'); return; }
    const block = blockingFor(stage);
    if (block) { toast.error(block); return; }
    setBusy(true); const { error } = await setStage(period.id, stage, 'Closed'); setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(`${PRE_STAGES.find(s => s.key === stage)!.label} stage closed.`);
    refreshStatus();
  };
  const doReopen = async (stage: StageKey) => {
    setBusy(true); const { error } = await setStage(period.id, stage, 'Open'); setBusy(false);
    if (error) { toast.error(error); return; }
    toast.info(`${PRE_STAGES.find(s => s.key === stage)!.label} re-opened for editing.`);
    refreshStatus();
  };

  // ── Bulk actions ──
  const act = async (fn: () => Promise<{ error: string | null; count?: number }>, okMsg: (n: number) => string) => {
    setBusy(true); const res = await fn(); setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(okMsg(res.count ?? 0));
    void loadActive(); refreshStatus();
  };

  // Fill in attendance for employees/days that have no saved record yet (e.g. employees
  // added after the period was first generated). overwriteExisting:false means existing
  // Draft/Approved rows are preserved — only the genuinely-missing days are created, with
  // their proper computed status (Present / Weekend / Holiday / On Leave), not blanket LOP.
  const generateMissingAttendance = () => act(
    async () => {
      const r = await generatePeriodAttendance(period.fromDate, period.toDate, { overwriteExisting: false });
      return { error: r.error, count: r.employees };
    },
    () => 'Attendance generated for any missing employees & days.',
  );

  // ── Print a stage report ──
  const printStage = (title: string, headers: string[], rows: (string | number)[][]) => {
    const th = headers.map(h => `<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1e3a5f;font-size:11px;">${h}</th>`).join('');
    const trs = rows.map(r => `<tr>${r.map(c => `<td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${c}</td>`).join('')}</tr>`).join('');
    const body = `
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:12px;">
        <div><div style="font-size:16px;font-weight:bold;color:#1e3a5f;">${est.name || 'Establishment'}</div>${est.address ? `<div style="font-size:10px;color:#6b7280;">${est.address}</div>` : ''}
        <div style="font-size:12px;font-weight:bold;margin-top:4px;">Pre-Payroll Report — ${title}</div></div>
        <div style="text-align:right;font-size:11px;color:#6b7280;"><div>${period.name}</div><div>${fmtDate(period.fromDate)} – ${fmtDate(period.toDate)}</div></div>
      </div>
      ${rows.length ? `<table style="width:100%;border-collapse:collapse;"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>` : '<p style="font-size:12px;color:#6b7280;">No records.</p>'}
      <div style="font-size:9px;color:#9ca3af;text-align:center;margin-top:16px;">Computer-generated Pre-Payroll report · ${est.name || ''} · ${period.name}</div>`;
    const html = buildLetterHtml({ title: `Pre-Payroll — ${title}`, bodyHtml: body, useLetterhead: false });
    if (!openLetterPrint(html)) toast.error('Popup blocked — allow popups to print.');
  };

  const stageBadge = (s: 'Open' | 'Closed') => s === 'Closed'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> Closed</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Unlock size={10} /> Open</span>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><ClipboardCheck size={22} className="text-primary" /></div>
              <div>
                <h1 className="text-xl font-bold">Pre-Payroll Process</h1>
                <p className="text-xs text-muted-foreground">Verify &amp; close each stage before Run Payroll is enabled for the period.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
              <CalendarRange size={14} className="text-muted-foreground shrink-0" />
              <select className="bg-transparent outline-none text-sm font-medium max-w-[180px]" value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)}>
                {PERIODS.length === 0 && <option value="">No payroll periods</option>}
                {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Stage rail */}
          <div className="space-y-3 h-fit">
            <div className={`rounded-xl border p-4 ${allClosed ? 'bg-green-50 border-green-200' : 'bg-accent/30 border-border'}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Progress</p>
              <p className="text-2xl font-bold mt-1">{PRE_STAGES.filter(s => status[s.key] === 'Closed').length} / {PRE_STAGES.length}</p>
              <p className="text-[11px] text-muted-foreground">stages closed</p>
              {allClosed && (
                <button onClick={() => navigate('/payroll')} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors">
                  <Play size={13} /> Go to Run Payroll
                </button>
              )}
            </div>
            {PRE_STAGES.map(s => {
              const st = status[s.key]; const locked = !priorClosed(s.key) && st !== 'Closed';
              return (
                <button key={s.key} onClick={() => setActiveStage(s.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${activeStage === s.key ? 'bg-primary/5 border-primary/40' : 'bg-card border-border hover:border-primary/30'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${st === 'Closed' ? 'bg-green-500 text-white' : locked ? 'bg-gray-200 text-gray-400' : 'bg-primary/10 text-primary'}`}>
                    {st === 'Closed' ? <CheckCircle2 size={14} /> : locked ? <Lock size={12} /> : s.seq}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.label}</p>
                  </div>
                  {stageBadge(st)}
                </button>
              );
            })}
          </div>

          {/* Stage detail */}
          <div className="space-y-4">
            {(() => {
              const stage = PRE_STAGES.find(s => s.key === activeStage)!;
              const st = status[activeStage];
              const block = blockingFor(activeStage);
              const canClose = priorClosed(activeStage) && !block;
              return (
                <div className="bg-card rounded-xl border border-border shadow-sm">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold">{stage.seq}. {stage.label}</h2>
                      {stageBadge(st)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void loadActive()} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Refresh"><RefreshCw size={15} className={loadingStage ? 'animate-spin' : ''} /></button>
                      {st === 'Closed'
                        ? <button onClick={() => doReopen(activeStage)} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent disabled:opacity-50"><Unlock size={13} /> Re-open</button>
                        : <button onClick={() => doClose(activeStage)} disabled={busy || !canClose} className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed" title={!priorClosed(activeStage) ? 'Close previous stages first' : (block ?? '')}><Lock size={13} /> Close Stage</button>}
                    </div>
                  </div>

                  {!priorClosed(activeStage) && st !== 'Closed' && (
                    <div className="mx-5 mt-4 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600"><Lock size={13} /> Close the previous stage(s) before closing this one.</div>
                  )}
                  {block && st !== 'Closed' && (
                    <div className="mx-5 mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700"><AlertCircle size={13} /> {block}</div>
                  )}

                  <div className="p-5">
                    {loadingStage ? <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><RefreshCw size={15} className="animate-spin" /> Loading…</div>
                      : activeStage === 'leaves' ? renderLeaves()
                      : activeStage === 'overtime' ? renderOvertime()
                      : activeStage === 'deductions' ? renderDeductions()
                      : activeStage === 'loans' ? renderLoans()
                      : activeStage === 'fund_contribution' ? renderFunds()
                      : activeStage === 'reimbursement' ? <ReimbursementStagePanel period={period} closed={status.reimbursement === 'Closed'} onPendingChange={setReimbPending} />
                      : activeStage === 'arrears' ? renderArrears()
                      : renderAttendance()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2"><AlertCircle size={18} className="text-amber-600" /><h3 className="font-bold">Please confirm</h3></div>
              <div className="p-6 text-sm text-muted-foreground">{confirm.msg}</div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-accent/10">
                <button onClick={() => setConfirm(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={() => { const fn = confirm.onYes; setConfirm(null); fn(); }} className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90">Confirm</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  // ── Stage renderers ──
  function renderLeaves() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">{leaves.length} leave request(s) overlapping this period · <strong className="text-amber-700">{pendingLeaves} pending</strong></p>
          <div className="flex items-center gap-2">
            {pendingLeaves > 0 && st_open('leaves') && <button onClick={() => setConfirm({ msg: `Reject all ${pendingLeaves} pending leave request(s) for this period?`, onYes: () => act(() => rejectAllPendingLeaves(period), n => `${n} leave(s) rejected.`) })} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100"><Ban size={13} /> Reject All Pending</button>}
            {printBtn(() => printStage('Leaves', ['Employee','Code','Leave Type','From','To','Days','Status'], leaves.map(l => [l.name, l.code, l.leaveType, fmtDate(l.fromDate), fmtDate(l.toDate), l.days, l.status])))}
          </div>
        </div>
        {leaves.length === 0 ? emptyState('No leave requests in this period.') : (
          <div className="border border-border rounded-xl overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="bg-accent/40 text-muted-foreground"><tr><Th>Employee</Th><Th>Leave Type</Th><Th>From</Th><Th>To</Th><Th right>Days</Th><Th>Status</Th><Th right>Action</Th></tr></thead>
            <tbody className="divide-y divide-border">{leaves.map(l => (
              <tr key={l.id} className="hover:bg-accent/20">
                <Td><p className="font-semibold">{l.name}</p><p className="text-[10px] font-mono text-muted-foreground">{l.code}</p></Td>
                <Td>{l.leaveType}</Td><Td>{fmtDate(l.fromDate)}</Td><Td>{fmtDate(l.toDate)}</Td><Td right>{l.days}</Td>
                <Td><StatusPill s={l.status} /></Td>
                <Td right>{isPending(l.status) && st_open('leaves') ? (
                  <span className="inline-flex gap-1">
                    <button onClick={() => act(() => setLeaveStatus(l.id, 'Approved'), () => 'Leave approved.')} className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100" title="Approve"><Check size={13} /></button>
                    <button onClick={() => act(() => setLeaveStatus(l.id, 'Rejected'), () => 'Leave rejected.')} className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100" title="Reject"><X size={13} /></button>
                  </span>) : <span className="text-[10px] text-muted-foreground">—</span>}</Td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    );
  }

  function renderArrears() {
    const total = arrears.reduce((s, r) => s + r.arrears, 0);
    const pending = arrears.filter(r => r.status === 'Pending').length;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">{arrears.length} salary-revision arrears line(s) · {pending} pending · Total <strong>{formatAmount(total)}</strong> — paid in this period's run.</p>
          {printBtn(() => printStage('Arrears', ['Employee','Code','Back Period','Paid Gross','Revised Gross','Arrears','Status'], arrears.map(r => [r.name, r.code, r.backPeriod, formatAmount(r.paidGross), formatAmount(r.revisedGross), formatAmount(r.arrears), r.status])))}
        </div>
        {arrears.length === 0 ? emptyState('No salary-revision arrears targeted at this period. Arrears appear here when an approved revision is applied with this period as the payout.') : (
          <div className="border border-border rounded-xl overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="bg-accent/40 text-muted-foreground"><tr><Th>Employee</Th><Th>Back Period</Th><Th right>Paid Gross</Th><Th right>Revised Gross</Th><Th right>Arrears</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y divide-border">{arrears.map(r => (
              <tr key={r.id} className="hover:bg-accent/20"><Td><p className="font-semibold">{r.name}</p><p className="text-[10px] font-mono text-muted-foreground">{r.code}</p></Td><Td>{r.backPeriod}</Td><Td right>{formatAmount(r.paidGross)}</Td><Td right>{formatAmount(r.revisedGross)}</Td><Td right className="font-semibold text-emerald-700">{formatAmount(r.arrears)}</Td><Td><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span></Td></tr>))}</tbody>
          </table></div>
        )}
      </div>
    );
  }

  function renderOvertime() {
    const total = ot.reduce((s, r) => s + r.otAmount, 0);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">{ot.length} employee(s) with overtime · Total OT pay <strong>{formatAmount(total)}</strong></p>
          {printBtn(() => printStage('Overtime', ['Employee','Code','Dept','OT Hours','OT Amount'], ot.map(r => [r.name, r.code, r.department, r.otHours, formatAmount(r.otAmount)])))}
        </div>
        {ot.length === 0 ? emptyState('No overtime recorded in this period.') : (
          <div className="border border-border rounded-xl overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="bg-accent/40 text-muted-foreground"><tr><Th>Employee</Th><Th>Dept</Th><Th right>OT Hours</Th><Th right>OT Amount</Th></tr></thead>
            <tbody className="divide-y divide-border">{ot.map(r => (
              <tr key={r.employeeId} className="hover:bg-accent/20"><Td><p className="font-semibold">{r.name}</p><p className="text-[10px] font-mono text-muted-foreground">{r.code}</p></Td><Td>{r.department}</Td><Td right>{r.otHours}h</Td><Td right className="font-semibold">{formatAmount(r.otAmount)}</Td></tr>))}</tbody>
          </table></div>
        )}
      </div>
    );
  }

  function renderDeductions() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">{deductions.length} deduction(s) · <strong className="text-amber-700">{pendingDeductions} awaiting approval</strong></p>
          <div className="flex items-center gap-2">
            {pendingDeductions > 0 && st_open('deductions') && <button onClick={() => setConfirm({ msg: `Full-approve all ${pendingDeductions} pending deduction(s) across all groups (including fines)?`, onYes: () => act(() => fullApproveDeductions(period), n => `${n} deduction(s) approved.`) })} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100"><Check size={13} /> Full Approve All</button>}
            {printBtn(() => printStage('Deductions', ['Group','Employee','Code','Description','Amount','Status'], deductions.map(d => [dedGroupLabel(d.category), d.name, d.code, d.description, formatAmount(d.amount), d.status])))}
          </div>
        </div>
        {DEDUCTION_GROUPS.map(g => {
          const rows = deductions.filter(d => d.category === g.key);
          const pend = rows.filter(d => isPending(d.status)).length;
          return (
            <div key={g.key} className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-accent/40">
                <p className="text-xs font-bold">{g.label} <span className="text-muted-foreground font-normal">· {rows.length} entr{rows.length !== 1 ? 'ies' : 'y'}{pend > 0 ? ` · ${pend} pending` : ''}</span></p>
                {pend > 0 && st_open('deductions') && <button onClick={() => act(() => fullApproveDeductions(period, g.key), n => `${n} ${g.label} deduction(s) approved.`)} className="text-[11px] font-semibold text-green-700 hover:underline">Approve all {g.label}</button>}
              </div>
              {rows.length === 0 ? <p className="px-4 py-3 text-[11px] text-muted-foreground">No entries.</p> : (
                <table className="w-full text-left text-xs"><tbody className="divide-y divide-border">{rows.map(d => (
                  <tr key={d.id} className="hover:bg-accent/20">
                    <Td><p className="font-semibold">{d.name}</p><p className="text-[10px] font-mono text-muted-foreground">{d.code}</p></Td>
                    <Td>{d.description}</Td><Td right className="font-semibold">{formatAmount(d.amount)}</Td>
                    <Td><StatusPill s={d.status} /></Td>
                    <Td right>{isPending(d.status) && st_open('deductions') ? <button onClick={() => act(() => approveDeduction(d.id), () => 'Deduction approved.')} className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100" title="Approve"><Check size={13} /></button> : <span className="text-[10px] text-muted-foreground">—</span>}</Td>
                  </tr>))}</tbody></table>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderLoans() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">{loans.length} active loan(s) with EMI · <strong className="text-amber-700">{pendingSkips} EMI-skip request(s) pending</strong></p>
          {printBtn(() => printStage('Loans & Advances', ['Employee','Code','EMI','Outstanding','Paid/Tenure','EMI-Skip'], loans.map(l => [l.name, l.code, formatAmount(l.emi), formatAmount(l.outstanding), `${l.paidEmis}/${l.tenure}`, l.skipStatus ?? '—'])))}
        </div>
        {loans.length === 0 ? emptyState('No active loans/advances.') : (
          <div className="border border-border rounded-xl overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="bg-accent/40 text-muted-foreground"><tr><Th>Employee</Th><Th right>EMI</Th><Th right>Outstanding</Th><Th right>Paid/Tenure</Th><Th>EMI-Skip Approval</Th><Th right>Override</Th></tr></thead>
            <tbody className="divide-y divide-border">{loans.map(l => (
              <tr key={l.id} className="hover:bg-accent/20">
                <Td><p className="font-semibold">{l.name}</p><p className="text-[10px] font-mono text-muted-foreground">{l.code}</p></Td>
                <Td right className="font-semibold">{formatAmount(l.emi)}</Td><Td right>{formatAmount(l.outstanding)}</Td><Td right>{l.paidEmis}/{l.tenure}</Td>
                <Td>{l.skipStatus ? <StatusPill s={l.skipStatus} /> : <span className="text-[10px] text-muted-foreground">No skip request</span>}</Td>
                <Td right>{l.skipId && l.skipStatus && isPending(l.skipStatus) && st_open('loans') ? (
                  <span className="inline-flex gap-1">
                    <button onClick={() => act(() => overrideSkip(l.skipId!, 'Approved'), () => 'EMI-skip approved.')} className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100" title="Approve skip"><Check size={13} /></button>
                    <button onClick={() => act(() => overrideSkip(l.skipId!, 'Rejected'), () => 'EMI-skip rejected.')} className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100" title="Reject skip"><X size={13} /></button>
                  </span>) : <span className="text-[10px] text-muted-foreground">—</span>}</Td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    );
  }

  function renderFunds() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">{funds.length} fund/contribution item(s) · <strong className="text-amber-700">{pendingFunds} awaiting employee approval</strong></p>
          {printBtn(() => printStage('Fund Contribution', ['Type','Employee','Code','Detail','Amount','Status'], funds.map(f => [f.kind, f.name, f.code, f.detail, f.amount ? formatAmount(f.amount) : '—', f.status])))}
        </div>
        {funds.length === 0 ? emptyState('No voluntary/fund contributions configured.') : (
          <div className="border border-border rounded-xl overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="bg-accent/40 text-muted-foreground"><tr><Th>Type</Th><Th>Employee</Th><Th>Detail</Th><Th right>Amount</Th><Th>Status</Th><Th right>Action</Th></tr></thead>
            <tbody className="divide-y divide-border">{funds.map(f => (
              <tr key={f.id} className="hover:bg-accent/20">
                <Td><span className="text-[10px] font-bold bg-accent px-1.5 py-0.5 rounded">{f.kind}</span></Td>
                <Td><p className="font-semibold">{f.name}</p><p className="text-[10px] font-mono text-muted-foreground">{f.code}</p></Td>
                <Td>{f.detail}</Td><Td right>{f.amount ? formatAmount(f.amount) : '—'}</Td>
                <Td><StatusPill s={f.status} /></Td>
                <Td right>{f.kind !== 'VPF' && isPending(f.status) && st_open('fund_contribution') ? <button onClick={() => act(() => approveDeduction(f.id), () => 'Fund deduction approved.')} className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100" title="Approve"><Check size={13} /></button> : <span className="text-[10px] text-muted-foreground">—</span>}</Td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    );
  }

  function renderAttendance() {
    // Distinguish "no attendance generated/saved for THIS period yet" (every employee
    // has 0 marked days) from "a few days are unmarked" — the former is almost always a
    // period mismatch or a Generate that wasn't Confirmed & Saved, not a real shortfall.
    const noneMarked = att.length > 0 && att.every(r => r.marked === 0) && att.some(r => r.workingDays > 0);
    return (
      <div className="space-y-3">
        {noneMarked && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>No saved attendance found for <strong>{period.name}</strong>. Open <strong>Attendance → Payroll Period Wise</strong>, select <strong>{period.name}</strong>, click <strong>Generate Attendance → Confirm &amp; Save</strong> (a preview alone doesn't save), then <strong>Refresh</strong> this stage. Make sure the period here matches the one you marked.</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">{att.length} employee(s) · <strong className={unmarkedTotal > 0 ? 'text-amber-700' : 'text-green-700'}>{unmarkedTotal} non-marked working day(s)</strong></p>
          <div className="flex items-center gap-2">
            {unmarkedTotal > 0 && st_open('attendance') && <button onClick={generateMissingAttendance} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold hover:bg-indigo-100 disabled:opacity-50"><Sparkles size={13} /> Generate missing attendance</button>}
            {unmarkedTotal > 0 && st_open('attendance') && <button onClick={() => setConfirm({ msg: `Mark all ${unmarkedTotal} non-marked working day(s) as Loss of Pay (LOP)? This creates attendance records for those dates.`, onYes: () => act(() => markUnmarkedAsLOP(period), n => `${n} day(s) marked as Loss of Pay.`) })} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100"><AlertCircle size={13} /> Mark non-marked as LOP</button>}
            {printBtn(() => printStage('Attendance Close', ['Employee','Code','Dept','Working Days','Marked','Non-Marked'], att.map(r => [r.name, r.code, r.department, r.workingDays, r.marked, r.unmarked])))}
          </div>
        </div>
        {unmarkedTotal > 0 && st_open('attendance') && (
          <p className="text-[11px] text-muted-foreground -mt-1">
            <strong className="text-indigo-700">Generate missing attendance</strong> fills new joiners / un-generated days with their computed status (Present, Weekly-off, Holiday, On Leave) without touching saved rows. Use <strong className="text-amber-700">Mark as LOP</strong> only for genuine unauthorised absences.
          </p>
        )}
        {att.length === 0 ? emptyState('No employees to check.') : (
          <div className="border border-border rounded-xl overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="bg-accent/40 text-muted-foreground"><tr><Th>Employee</Th><Th>Dept</Th><Th right>Working Days</Th><Th right>Marked</Th><Th right>Non-Marked</Th></tr></thead>
            <tbody className="divide-y divide-border">{att.map(r => (
              <tr key={r.employeeId} className="hover:bg-accent/20">
                <Td><p className="font-semibold">{r.name}</p><p className="text-[10px] font-mono text-muted-foreground">{r.code}</p></Td>
                <Td>{r.department}</Td><Td right>{r.workingDays}</Td><Td right className="text-green-700">{r.marked}</Td>
                <Td right className={r.unmarked > 0 ? 'text-amber-700 font-semibold' : 'text-muted-foreground'}>{r.unmarked}</Td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    );
  }

  function st_open(stage: StageKey) { return status[stage] !== 'Closed'; }
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => <th className={`px-3 py-2 font-semibold text-[10px] uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
const Td = ({ children, right, className = '' }: { children: React.ReactNode; right?: boolean; className?: string }) => <td className={`px-3 py-2 ${right ? 'text-right' : ''} ${className}`}>{children}</td>;
const emptyState = (msg: string) => <div className="py-10 text-center text-sm text-muted-foreground">{msg}</div>;
const printBtn = (onClick: () => void) => <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><Printer size={13} /> Print / Download</button>;

function StatusPill({ s }: { s: string }) {
  const cls = isApproved(s) ? 'bg-green-100 text-green-700 border-green-200'
    : /reject/i.test(s) ? 'bg-red-100 text-red-700 border-red-200'
    : isPending(s) ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-gray-100 text-gray-600 border-gray-200';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>{s}</span>;
}
