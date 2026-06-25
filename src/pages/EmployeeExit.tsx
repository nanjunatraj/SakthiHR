import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  DoorOpen, Plus, Search, X, Check, Ban, Loader2, RefreshCw, ClipboardCheck,
  Calculator, FileSignature, UserMinus, ChevronRight, Eye, Package, Clock,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import Sidebar from '../components/Sidebar';
import { useCurrency } from '../context/CurrencyContext';
import { useEstablishment } from '../lib/reports';
import ReportViewModal from '../components/ReportViewModal';
import type { StatementDoc } from '../lib/exportStatement';
import { loadEmployeeAssets, returnAsset, type Asset } from '../lib/assets';
import SecureDocUploadZone from '../components/SecureDocUploadZone';
import { listDocuments } from '../lib/documents';
import {
  EXIT_TYPES, loadExits, createExit, cancelExit, loadClearances, setClearance,
  computeFnF, loadSettlement, saveSettlement, relieveEmployee, netOfSettlement,
  loadApprovals, actApproval, issueAcceptance, waiveNotice, updateExit,
  setStepFlag, setReportDeadline, stepsFor, isStepDone, currentStep,
  type ExitRecord, type ExitType, type ExitClearance, type ExitSettlement, type ClearanceStatus,
  type ExitApproval, type StepCtx,
} from '../lib/employeeExit';

const db = supabase as unknown as SupabaseClient;
const inputCls = 'w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none';

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00'); if (isNaN(dt.getTime())) return d;
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(dt.getDate()).padStart(2,'0')}/${mo[dt.getMonth()]}/${dt.getFullYear()}`;
};
const addDays = (iso: string, days: number) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const STATUS_STYLE: Record<string, string> = {
  Initiated: 'bg-slate-100 text-slate-600 border-slate-200',
  'In Clearance': 'bg-amber-100 text-amber-700 border-amber-200',
  Settled: 'bg-blue-100 text-blue-700 border-blue-200',
  Relieved: 'bg-green-100 text-green-700 border-green-200',
  Cancelled: 'bg-red-100 text-red-600 border-red-200',
};

export default function EmployeeExit() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const [exits, setExits] = useState<ExitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [initiate, setInitiate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setExits(await loadExits());
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => exits.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeCode.toLowerCase().includes(search.toLowerCase())), [exits, search]);
  const inProcess = exits.filter(e => e.status === 'In Clearance' || e.status === 'Initiated').length;
  const settled = exits.filter(e => e.status === 'Settled').length;
  const relieved = exits.filter(e => e.status === 'Relieved').length;

  const detail = exits.find(e => e.id === detailId) ?? null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg"><DoorOpen size={22} className="text-rose-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Employee Separation</h1>
                <p className="text-xs text-muted-foreground">Separation lifecycle — initiate, clearances, Full &amp; Final settlement and relieving.</p>
              </div>
            </div>
            <button onClick={() => setInitiate(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-semibold shadow-sm">
              <Plus size={15} /> Initiate Separation
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Exits', value: exits.length, color: 'bg-slate-100', text: 'text-slate-600', icon: DoorOpen },
              { label: 'In Process', value: inProcess, color: 'bg-amber-100', text: 'text-amber-700', icon: ClipboardCheck },
              { label: 'Settled', value: settled, color: 'bg-blue-100', text: 'text-blue-700', icon: Calculator },
              { label: 'Relieved', value: relieved, color: 'bg-green-100', text: 'text-green-700', icon: UserMinus },
            ].map((c, i) => (
              <div key={i} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${c.color} rounded-xl`}><c.icon size={20} className={c.text} /></div>
                <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{c.label}</p><p className="font-bold text-lg mt-0.5">{c.value}</p></div>
              </div>
            ))}
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input className={`${inputCls} pl-9`} placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => void refresh()} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th><th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Resignation</th><th className="px-4 py-3 font-semibold">Last Working Day</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th><th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</td></tr>}
                  {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No separations yet. Click “Initiate Separation” to start.</td></tr>}
                  {!loading && filtered.map(e => (
                    <tr key={e.id} className="hover:bg-accent/30">
                      <td className="px-4 py-3"><p className="font-medium">{e.name}</p><p className="text-[10px] font-mono text-muted-foreground">{e.employeeCode} · {e.department}</p></td>
                      <td className="px-4 py-3 text-muted-foreground">{e.exitType}</td>
                      <td className="px-4 py-3">{fmtDate(e.resignationDate)}</td>
                      <td className="px-4 py-3">{fmtDate(e.lastWorkingDay)}</td>
                      <td className="px-4 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[e.status]}`}>{e.status}</span></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setDetailId(e.id)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent">Open <ChevronRight size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {initiate && <InitiateExitModal onClose={() => setInitiate(false)} onSaved={() => { setInitiate(false); void refresh(); }} />}
        {detail && <ExitDetailModal exit={detail} onClose={() => setDetailId(null)} onChanged={refresh} onGoTemplates={() => navigate('/configuration')} formatAmount={formatAmount} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Initiate ─────────────────────────────────────────────────────────────────

interface EmpPick { id: string; code: string; name: string; designation: string; department: string; doj: string; notice: number }

function InitiateExitModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<EmpPick[]>([]);
  const [search, setSearch] = useState('');
  const [emp, setEmp] = useState<EmpPick | null>(null);
  const [exitType, setExitType] = useState<ExitType>('Resignation');
  const [resignationDate, setResignationDate] = useState(new Date().toISOString().slice(0, 10));
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [noticeServed, setNoticeServed] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void db.from('employees').select('id, employee_id, first_name, middle_name, last_name, date_of_joining, notice_period_days, designation:designations(name), department:departments(name)')
      .neq('status', 'Inactive').order('first_name')
      .then(({ data }) => setEmployees(((data ?? []) as Record<string, any>[]).map(e => ({
        id: e.id, code: e.employee_id ?? '', name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
        designation: e.designation?.name ?? '—', department: e.department?.name ?? '—', doj: e.date_of_joining ?? '', notice: Number(e.notice_period_days) || 30,
      }))));
  }, []);

  // Default the last working day to resignation + notice period.
  useEffect(() => { if (emp && resignationDate) setLastWorkingDay(addDays(resignationDate, emp.notice)); }, [emp, resignationDate]);

  const filtered = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase())).slice(0, 40);

  const save = async () => {
    if (!emp) { toast.error('Select an employee.'); return; }
    setBusy(true);
    const noticeDays = emp.notice;
    const { error } = await createExit({ employeeId: emp.id, exitType, resignationDate, lastWorkingDay, noticeDays, noticeServed, reason });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success('Exit initiated — clearances seeded.');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-rose-50 to-orange-50">
          <div className="flex items-center gap-2"><div className="p-2 bg-rose-100 rounded-xl"><DoorOpen size={18} className="text-rose-600" /></div><h2 className="text-base font-bold text-rose-900">Initiate Employee Separation</h2></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Employee</label>
            {emp ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-rose-200 bg-rose-50">
                <div><p className="text-sm font-medium">{emp.name} <span className="text-[10px] font-mono text-muted-foreground">{emp.code}</span></p><p className="text-[11px] text-muted-foreground">{emp.designation} · {emp.department} · DOJ {fmtDate(emp.doj)} · {emp.notice}d notice</p></div>
                <button onClick={() => setEmp(null)} className="text-xs text-rose-600 font-medium">Change</button>
              </div>
            ) : (
              <>
                <div className="relative mb-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className={`${inputCls} pl-9`} placeholder="Search name or ID…" value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filtered.map(e => (
                    <button key={e.id} onClick={() => setEmp(e)} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:border-rose-200 text-left text-sm">
                      <span className="font-medium">{e.name}</span><span className="ml-auto text-[10px] font-mono text-muted-foreground">{e.code}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">No active employees match.</p>}
                </div>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Exit Type</label><select className={inputCls} value={exitType} onChange={e => setExitType(e.target.value as ExitType)}>{EXIT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Resignation / Notice Date</label><input type="date" className={inputCls} value={resignationDate} onChange={e => setResignationDate(e.target.value)} /></div>
            <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Last Working Day</label><input type="date" className={inputCls} value={lastWorkingDay} onChange={e => setLastWorkingDay(e.target.value)} /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm cursor-pointer pb-2"><input type="checkbox" checked={noticeServed} onChange={e => setNoticeServed(e.target.checked)} className="rounded border-border" /> Notice period served</label></div>
          </div>
          <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Reason</label><textarea className={`${inputCls} resize-none`} rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for separation" /></div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-accent/10">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={busy} className="px-6 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50">Initiate Separation</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Detail (type-driven stepper) ─────────────────────────────────────────────

function ExitDetailModal({ exit, onClose, onChanged, onGoTemplates, formatAmount }: {
  exit: ExitRecord; onClose: () => void; onChanged: () => Promise<void> | void; onGoTemplates: () => void; formatAmount: (n: number) => string;
}) {
  const est = useEstablishment();
  const [approvals, setApprovals] = useState<ExitApproval[]>([]);
  const [clearances, setClearances] = useState<ExitClearance[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [settlement, setSettlement] = useState<ExitSettlement | null>(null);
  const [hasResignationLetter, setHasResignationLetter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showFnFView, setShowFnFView] = useState(false);
  const [activeStep, setActiveStep] = useState<string>('');
  const readOnly = exit.status === 'Relieved' || exit.status === 'Cancelled';
  const steps = stepsFor(exit.exitType);

  const reload = useCallback(async () => {
    const [ap, cl, as, st, docs] = await Promise.all([
      loadApprovals(exit.id), loadClearances(exit.id), loadEmployeeAssets(exit.employeeId), loadSettlement(exit.id),
      listDocuments('employee_exit', exit.id, 'Resignation Letter'),
    ]);
    setApprovals(ap); setClearances(cl); setAssets(as);
    setSettlement(st ?? (await computeFnF(exit)));
    setHasResignationLetter(docs.length > 0);
  }, [exit]);
  useEffect(() => { void reload(); }, [reload]);

  const ctx: StepCtx = { approvals, clearances, settlement, hasResignationLetter };
  const cur = currentStep(exit, ctx);
  useEffect(() => { setActiveStep(s => s || cur); }, [cur]);
  const shownStep = activeStep || cur;
  const clearancesDone = clearances.length > 0 && clearances.every(c => c.status === 'Cleared' || c.status === 'NA');
  const fnfFinalised = settlement?.status === 'Finalised';

  const act = async (fn: () => Promise<{ error: string | null }>, ok: string, after?: () => Promise<void> | void) => {
    setBusy(true); const { error } = await fn(); setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(ok); await reload(); if (after) await after(); await onChanged();
  };
  const setField = (k: keyof ExitSettlement, v: number) => setSettlement(s => s ? { ...s, [k]: v } : s);

  const fnfDoc: StatementDoc | null = settlement ? {
    title: 'Full & Final Settlement', establishment: est.name,
    subtitle: `${exit.name} (${exit.employeeCode}) · LWD ${fmtDate(exit.lastWorkingDay)}`,
    columns: [{ key: 'head', label: 'Component' }, { key: 'amount', label: 'Amount', align: 'right' }],
    rows: [
      { head: 'Pending Salary', amount: formatAmount(settlement.pendingSalary) },
      { head: `Leave Encashment (${settlement.leaveEncashDays} days)`, amount: formatAmount(settlement.leaveEncashAmount) },
      { head: 'Gratuity', amount: formatAmount(settlement.gratuityAmount) },
      { head: 'Bonus / Ex-gratia', amount: formatAmount(settlement.bonusAmount) },
      { head: 'Other Additions', amount: formatAmount(settlement.otherAdditions) },
      { head: 'Less: Loan / Advance Recovery', amount: `- ${formatAmount(settlement.loanRecovery)}` },
      { head: 'Less: Notice Pay Recovery', amount: `- ${formatAmount(settlement.noticeRecovery)}` },
      { head: 'Less: Other Deductions', amount: `- ${formatAmount(settlement.otherDeductions)}` },
    ],
    totals: { head: 'Net Settlement Payable', amount: formatAmount(netOfSettlement(settlement)) },
    note: 'Computer-generated Full & Final settlement statement.',
  } : null;

  // Approval level for an approval step key.
  const approvalForKey = (k: string) => approvals.find(a => a.level === (k === 'mgr_approval' ? 1 : k === 'next_approval' ? 2 : 3));
  const lowestPendingLevel = approvals.filter(a => a.status === 'Pending').sort((a, b) => a.level - b.level)[0]?.level ?? 99;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-rose-50 to-orange-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 rounded-xl"><DoorOpen size={18} className="text-rose-600" /></div>
            <div><h2 className="text-base font-bold text-rose-900">{exit.name} <span className="text-[11px] font-mono text-rose-500">{exit.employeeCode}</span></h2>
              <p className="text-xs text-rose-600">{exit.exitType} · {exit.submittedBy === 'employee' ? 'self-submitted' : 'HR-initiated'} · <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[exit.status]}`}>{exit.status}</span></p></div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[230px_1fr]">
          {/* Stepper rail */}
          <div className="border-r border-border p-3 overflow-y-auto bg-accent/10">
            {steps.map((s, i) => {
              const done = isStepDone(s.key, exit, ctx);
              const isCur = s.key === cur;
              const isShown = s.key === shownStep;
              return (
                <button key={s.key} onClick={() => setActiveStep(s.key)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs mb-0.5 transition-colors ${isShown ? 'bg-rose-50 border border-rose-200' : 'hover:bg-accent'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${done ? 'bg-green-600 text-white' : isCur ? 'bg-rose-600 text-white' : 'bg-muted text-muted-foreground border border-border'}`}>{done ? <Check size={12} /> : i + 1}</span>
                  <span className={`flex-1 ${done ? 'text-muted-foreground' : isCur ? 'font-semibold' : ''}`}>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active step panel */}
          <div className="p-5 overflow-y-auto">
            {shownStep === 'submitted' && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Resignation Letter</p>
                <p className="text-xs text-muted-foreground">Upload the employee's scanned resignation letter to start the approval chain.</p>
                <SecureDocUploadZone entityType="employee_exit" entityRef={exit.id} label="Resignation Letter" signerName={exit.name} signerId={exit.employeeCode} compact />
              </div>
            )}

            {(shownStep === 'mgr_approval' || shownStep === 'next_approval' || shownStep === 'hr_approval') && (() => {
              const a = approvalForKey(shownStep);
              if (!a) return <p className="text-sm text-muted-foreground">No approval record.</p>;
              const actionable = !readOnly && a.status === 'Pending' && a.level === lowestPendingLevel;
              return (
                <ApprovalPanel approval={a} actionable={actionable} busy={busy}
                  onAct={(d, name, rem) => act(() => actApproval(a.id, d, name, rem), d === 'Approved' ? 'Approved.' : 'Rejected.')} />
              );
            })()}

            {shownStep === 'acceptance' && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Issue the Resignation Acceptance Letter (format in Template Master → Resignation Acceptance Letter) confirming the notice period.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent"><FileSignature size={15} /> Generate Acceptance Letter</button>
                  {exit.acceptanceIssued
                    ? <span className="text-xs text-green-700 font-semibold inline-flex items-center gap-1"><Check size={14} /> Acceptance issued</span>
                    : !readOnly && <button onClick={() => act(() => issueAcceptance(exit.id), 'Acceptance marked as issued.')} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Mark Issued</button>}
                </div>
              </div>
            )}

            {shownStep === 'show_cause' && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Serve a <strong>Show-Cause Notice</strong> (Template Master) for unauthorised absence, giving the employee a deadline to report to work or provide a valid personal / medical reason.</p>
                <div className="max-w-xs"><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Report-back Deadline</label>
                  <input type="date" className={inputCls} disabled={readOnly} defaultValue={exit.reportDeadline} onBlur={e => { if (e.target.value && e.target.value !== exit.reportDeadline) act(() => setReportDeadline(exit.id, e.target.value), 'Deadline set.'); }} /></div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent"><FileSignature size={15} /> Generate Show-Cause Notice</button>
                  {exit.stepFlags.show_cause_issued
                    ? <span className="text-xs text-green-700 font-semibold inline-flex items-center gap-1"><Check size={14} /> Issued</span>
                    : !readOnly && <button onClick={() => act(() => setStepFlag(exit, 'show_cause_issued', true), 'Show-cause notice issued.')} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Mark Issued</button>}
                </div>
              </div>
            )}

            {shownStep === 'abandonment' && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">On non-receipt of a valid reason and non-reporting by <strong>{fmtDate(exit.reportDeadline)}</strong>, serve a <strong>Termination Letter for voluntary abandonment of service</strong> (Template Master). Notice-pay and asset recovery are captured in the Full &amp; Final.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent"><FileSignature size={15} /> Generate Termination Letter</button>
                  {exit.stepFlags.termination_issued
                    ? <span className="text-xs text-green-700 font-semibold inline-flex items-center gap-1"><Check size={14} /> Issued</span>
                    : !readOnly && <button onClick={() => act(() => setStepFlag(exit, 'termination_issued', true), 'Termination (abandonment) letter issued.')} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Mark Issued</button>}
                </div>
              </div>
            )}

            {shownStep === 'retirement_notice' && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Send a <strong>Notice of Retirement</strong> (Template Master) to the employee ahead of the retirement (last working) date.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent"><FileSignature size={15} /> Generate Notice of Retirement</button>
                  {exit.stepFlags.retirement_notice_issued
                    ? <span className="text-xs text-green-700 font-semibold inline-flex items-center gap-1"><Check size={14} /> Sent</span>
                    : !readOnly && <button onClick={() => act(() => setStepFlag(exit, 'retirement_notice_issued', true), 'Notice of retirement sent.')} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Mark Sent</button>}
                </div>
              </div>
            )}

            {shownStep === 'condolence' && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Send a <strong>Condolence Letter</strong> (Template Master) to the beneficiary / nominee on record, and proceed with the Full &amp; Final settlement payable to the nominee.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent"><FileSignature size={15} /> Generate Condolence Letter</button>
                  {exit.stepFlags.condolence_sent
                    ? <span className="text-xs text-green-700 font-semibold inline-flex items-center gap-1"><Check size={14} /> Sent</span>
                    : !readOnly && <button onClick={() => act(() => setStepFlag(exit, 'condolence_sent', true), 'Condolence letter sent.')} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Mark Sent</button>}
                </div>
              </div>
            )}

            {shownStep === 'notice' && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="px-3 py-2 rounded-lg bg-accent/30 border border-border"><p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Notice Period</p><p className="font-medium">{exit.noticeDays} days {exit.noticeWaived && <span className="text-amber-600">· waived</span>}</p></div>
                  <div><label className="block text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Last Working Day (override)</label><input type="date" className={inputCls} disabled={readOnly} defaultValue={exit.lastWorkingDay} onBlur={e => { if (e.target.value && e.target.value !== exit.lastWorkingDay) act(() => updateExit(exit.id, { lastWorkingDay: e.target.value }), 'Last working day updated.'); }} /></div>
                </div>
                {!readOnly && (
                  <button onClick={() => act(() => waiveNotice(exit.id, !exit.noticeWaived), exit.noticeWaived ? 'Notice un-waived.' : 'Notice period waived.')} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 border border-amber-200 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100"><Clock size={15} /> {exit.noticeWaived ? 'Un-waive notice' : 'Waive / Override notice'}</button>
                )}
                <p className="text-[11px] text-muted-foreground">Notice is served until the last working day; it can be waived or the date overridden by HR.</p>
              </div>
            )}

            {shownStep === 'clearance' && (
              <div className="space-y-2">
                {clearances.map(c => (
                  <div key={c.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium flex-1">{c.department}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.status === 'Cleared' ? 'bg-green-100 text-green-700 border-green-200' : c.status === 'NA' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>{c.status}</span>
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => act(() => setClearance(c.id, 'Cleared'), 'Cleared.')} disabled={busy} className="p-1.5 rounded-lg hover:bg-green-100 text-green-600" title="Mark cleared"><Check size={14} /></button>
                          <button onClick={() => act(() => setClearance(c.id, 'NA'), 'Marked N/A.')} disabled={busy} className="px-2 py-1 rounded-lg hover:bg-gray-100 text-gray-500 text-[10px] font-bold" title="Not applicable">NA</button>
                          {c.status !== 'Pending' && <button onClick={() => act(() => setClearance(c.id, 'Pending'), 'Reset.')} disabled={busy} className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600" title="Reset"><RefreshCw size={13} /></button>}
                        </div>
                      )}
                    </div>
                    {c.department === 'Assets' && assets.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-border pt-2">
                        {assets.map(a => (
                          <div key={a.id} className="flex items-center gap-2 text-xs">
                            <Package size={13} className="text-muted-foreground" /><span className="flex-1">{a.name} <span className="font-mono text-muted-foreground">{a.productId}</span></span>
                            {!readOnly && <button onClick={() => act(() => returnAsset(a.id, 'Returned at exit'), 'Asset handed over.')} disabled={busy} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold hover:bg-rose-100">Handover</button>}
                          </div>
                        ))}
                      </div>
                    )}
                    {c.department === 'Assets' && assets.length === 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">No assets under this employee’s charge.</p>}
                  </div>
                ))}
              </div>
            )}

            {shownStep === 'fnf' && settlement && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['Pending Salary', 'pendingSalary'], ['Leave Encashment', 'leaveEncashAmount'], ['Gratuity', 'gratuityAmount'],
                    ['Bonus / Ex-gratia', 'bonusAmount'], ['Other Additions', 'otherAdditions'],
                    ['Loan / Advance Recovery', 'loanRecovery'], ['Notice Pay Recovery', 'noticeRecovery'], ['Other Deductions', 'otherDeductions'],
                  ] as [string, keyof ExitSettlement][]).map(([label, key]) => (
                    <div key={key}><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">{label}</label>
                      <input type="number" className={inputCls} value={settlement[key] as number} disabled={readOnly || fnfFinalised} onChange={e => setField(key, parseFloat(e.target.value) || 0)} /></div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-rose-50 border border-rose-200"><span className="font-bold text-rose-900">Net Settlement Payable</span><span className="font-bold text-lg text-rose-700">{formatAmount(netOfSettlement(settlement))}</span></div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setShowFnFView(true)} className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent"><Eye size={15} /> View / Print</button>
                  {!readOnly && !fnfFinalised && (
                    <>
                      <button onClick={() => act(() => saveSettlement(settlement, false), 'F&F saved as draft.')} disabled={busy} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent">Save Draft</button>
                      <button onClick={() => act(() => saveSettlement(settlement, true), 'F&F finalised.')} disabled={busy} className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"><Calculator size={15} /> Finalise F&amp;F</button>
                    </>
                  )}
                  {fnfFinalised && <span className="text-xs text-blue-700 font-semibold inline-flex items-center gap-1"><Check size={14} /> Finalised</span>}
                </div>
              </div>
            )}

            {shownStep === 'exit_docs' && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Issue exit letters (formats in Template Master) and upload the signed Exit Interview.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileSignature size={14} /> Experience Letter</button>
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileSignature size={14} /> Service Certificate</button>
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileSignature size={14} /> F&amp;F Letter</button>
                  <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileSignature size={14} /> Relieving Letter</button>
                </div>
                <div><p className="text-xs font-semibold mb-1 mt-2">Exit Interview (upload)</p>
                  <SecureDocUploadZone entityType="employee_exit" entityRef={exit.id} label="Exit Interview" signerName={exit.name} signerId={exit.employeeCode} compact /></div>
              </div>
            )}

            {shownStep === 'relieved' && (
              <div className="space-y-3 text-sm">
                <div className="space-y-2">
                  {[['All clearances completed', clearancesDone], ['Full & Final finalised', fnfFinalised]].map(([label, ok]) => (
                    <div key={label as string} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border">
                      {ok ? <Check size={15} className="text-green-600" /> : <X size={15} className="text-amber-500" />}<span className={ok ? '' : 'text-muted-foreground'}>{label}</span>
                    </div>
                  ))}
                </div>
                {exit.status === 'Relieved'
                  ? <span className="text-xs text-green-700 font-semibold inline-flex items-center gap-1"><Check size={14} /> Relieved on {fmtDate(exit.lastWorkingDay)} — login blocked, hierarchy updated.</span>
                  : <button onClick={() => act(() => relieveEmployee(exit), 'Employee relieved — login blocked, reports reassigned.', onClose)} disabled={busy || !clearancesDone || !fnfFinalised} title={!clearancesDone ? 'Complete clearances' : !fnfFinalised ? 'Finalise F&F' : ''} className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"><UserMinus size={15} /> Relieve Employee</button>}
                <p className="text-[11px] text-muted-foreground">Relieving marks the employee Inactive, sets the relieving date, blocks the system login, and moves their direct reports to the next-level manager.</p>
                {!readOnly && <button onClick={() => act(() => cancelExit(exit.id), 'Exit cancelled.', onClose)} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100"><Ban size={13} /> Cancel Exit</button>}
              </div>
            )}
          </div>
        </div>
      </motion.div>
      <AnimatePresence>{showFnFView && fnfDoc && <ReportViewModal doc={fnfDoc} onClose={() => setShowFnFView(false)} />}</AnimatePresence>
    </div>
  );
}

function ApprovalPanel({ approval, actionable, busy, onAct }: {
  approval: ExitApproval; actionable: boolean; busy: boolean; onAct: (d: 'Approved' | 'Rejected', name: string, remarks: string) => void;
}) {
  const [name, setName] = useState(approval.approverName);
  const [remarks, setRemarks] = useState('');
  return (
    <div className="space-y-3 text-sm">
      <div className="px-3 py-2 rounded-lg bg-accent/30 border border-border">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{approval.role}</p>
        <p className="font-medium">{approval.approverName || '—'} · <span className={`text-[11px] ${approval.status === 'Approved' ? 'text-green-700' : approval.status === 'Rejected' ? 'text-red-600' : 'text-amber-700'}`}>{approval.status}</span></p>
        {approval.remarks && <p className="text-[11px] text-muted-foreground mt-0.5">“{approval.remarks}”</p>}
      </div>
      {actionable ? (
        <>
          <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Approver Name</label><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Name of the approving manager" /></div>
          <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase tracking-wide">Remarks</label><textarea className={`${inputCls} resize-none`} rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
          <div className="flex gap-2">
            <button onClick={() => onAct('Approved', name, remarks)} disabled={busy} className="flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"><Check size={15} /> Approve</button>
            <button onClick={() => onAct('Rejected', name, remarks)} disabled={busy} className="flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"><Ban size={15} /> Reject</button>
          </div>
        </>
      ) : approval.status === 'Pending' ? (
        <p className="text-xs text-muted-foreground">Awaiting the previous approval level.</p>
      ) : null}
    </div>
  );
}

