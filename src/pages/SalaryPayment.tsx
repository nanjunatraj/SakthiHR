import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Banknote, Building2, CheckCircle2, RefreshCw, Download, FileSpreadsheet, FileText,
  Lock, AlertCircle, X, Calculator, ArrowRight, ShieldCheck,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';
import { usePayrollPeriodOptions, EMPTY_PERIOD_OPTION, useEstablishment, useReportLetterheadWrap } from '../lib/reports';
import { useRunCandidates, persistPayrollRun, approvePayrollRun } from '../lib/payrollRun';
import {
  loadPaymentView, confirmSalaryPayment, computeArrears, loadArrears,
  type PaymentView, type ArrearsRow,
} from '../lib/salaryPayment';
import { downloadCSV, downloadExcel, printStatementPDF, type StatementDoc } from '../lib/exportStatement';

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s); if (isNaN(d.getTime())) return s;
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}/${m[d.getMonth()]}/${d.getFullYear()}`;
};
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalaryPayment() {
  const navigate = useNavigate();
  const periods = usePayrollPeriodOptions();
  const establishment = useEstablishment();
  const lhWrap = useReportLetterheadWrap();
  const [periodId, setPeriodId] = useState('');
  useEffect(() => {
    if (!periodId && periods.length) {
      const today = new Date().toISOString().slice(0, 10);
      setPeriodId((periods.find(p => p.fromDate <= today && today <= p.toDate) ?? periods[0]).id);
    }
  }, [periods, periodId]);
  const period = periods.find(p => p.id === periodId) ?? EMPTY_PERIOD_OPTION;

  const [view, setView] = useState<PaymentView | null>(null);
  const [arrears, setArrears] = useState<ArrearsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [payMode, setPayMode] = useState('Bank Transfer (NEFT)');

  // Fresh candidates for re-run / arrears (recomputed from current employee data).
  const { candidates } = useRunCandidates(periodId);

  const reload = useCallback(async () => {
    if (!periodId) { setView(null); setArrears([]); return; }
    setLoading(true);
    const [v, ar] = await Promise.all([loadPaymentView(periodId), loadArrears(periodId)]);
    setView(v); setArrears(ar); setLoading(false);
  }, [periodId]);
  useEffect(() => { void reload(); }, [reload]);

  const periodLabel = `${period.name} · ${fmtDate(period.fromDate)} – ${fmtDate(period.toDate)}`;
  const isPaid = view?.paymentStatus === 'Paid';
  const hasRun = !!view?.runId;
  // Payment stage gate: the Pay Run must be closed & approved before payment can be
  // confirmed. A re-run produces a fresh Draft, which must be re-approved before paying.
  const runApproved = (view?.runStatus ?? '').toLowerCase() === 'approved';

  // ── Bank Payment Statement ──
  const bankDoc = (): StatementDoc => ({
    title: 'Bank Payment Statement',
    establishment: establishment.name,
    subtitle: periodLabel,
    columns: [
      { key: 'sno', label: 'S.No', align: 'right' },
      { key: 'code', label: 'Emp Code' },
      { key: 'name', label: 'Employee Name' },
      { key: 'bankName', label: 'Bank' },
      { key: 'accountName', label: 'Account Name' },
      { key: 'accountNumber', label: 'Account No.', text: true },
      { key: 'ifsc', label: 'IFSC', text: true },
      { key: 'accountType', label: 'Type' },
      { key: 'net', label: 'Nett Payable', align: 'right' },
    ],
    rows: (view?.rows ?? []).map((r, i) => ({
      sno: i + 1, code: r.code, name: r.name, bankName: r.bankName || '—',
      accountName: r.accountName || '—', accountNumber: r.accountNumber || '—',
      ifsc: r.ifsc || '—', accountType: r.accountType || '—', net: r.net.toFixed(2),
    })),
    totals: { name: `Total (${view?.rows.length ?? 0} employees)`, net: (view?.totalNet ?? 0).toFixed(2) },
    note: `Computer-generated bank payment statement${view?.paymentReference ? ` · Ref: ${view.paymentReference}` : ''}.`,
  });

  const arrearsDoc = (): StatementDoc => ({
    title: 'Arrears Statement',
    establishment: establishment.name,
    subtitle: periodLabel,
    columns: [
      { key: 'sno', label: 'S.No', align: 'right' },
      { key: 'code', label: 'Emp Code' },
      { key: 'name', label: 'Employee Name' },
      { key: 'department', label: 'Department' },
      { key: 'previousNet', label: 'Paid Net', align: 'right' },
      { key: 'revisedNet', label: 'Revised Net', align: 'right' },
      { key: 'arrears', label: 'Arrears', align: 'right' },
    ],
    rows: arrears.map((r, i) => ({
      sno: i + 1, code: r.code, name: r.name, department: r.department,
      previousNet: r.previousNet.toFixed(2), revisedNet: r.revisedNet.toFixed(2), arrears: r.arrears.toFixed(2),
    })),
    totals: {
      name: 'Total Arrears',
      previousNet: arrears.reduce((s, r) => s + r.previousNet, 0).toFixed(2),
      revisedNet: arrears.reduce((s, r) => s + r.revisedNet, 0).toFixed(2),
      arrears: arrears.reduce((s, r) => s + r.arrears, 0).toFixed(2),
    },
    note: 'Arrears = Revised Net (re-run after payment) − Paid Net.',
  });

  const reRunBeforeCommit = async () => {
    if (!candidates.length) { toast.error('No employees with a current salary structure to process.'); return; }
    setBusy(true);
    const { error } = await persistPayrollRun(periodId, candidates);
    setBusy(false);
    if (error) { toast.error(`Re-run failed: ${error}`); return; }
    toast.success('Payroll re-run — review the figures, then approve the Pay Run to enable payment.');
    await reload();
  };

  // Approve the (latest) Pay Run for this period so payment can be confirmed. Available
  // here so the re-run → approve → pay loop is self-contained before payment.
  const doApprove = async () => {
    if (!view?.runId) return;
    setBusy(true);
    const { error } = await approvePayrollRun(periodId);
    setBusy(false);
    if (error) { toast.error(`Could not approve Pay Run: ${error}`); return; }
    toast.success('Pay Run approved — you can now confirm the salary payment.');
    await reload();
  };

  const doConfirm = async () => {
    if (!view?.runId) return;
    if (!runApproved) { toast.error('Approve the Pay Run before confirming payment.'); return; }
    setBusy(true);
    const { error } = await confirmSalaryPayment(view.runId, payRef.trim(), payMode);
    setBusy(false);
    if (error) { toast.error(`Could not confirm payment: ${error}`); return; }
    toast.success('Salary payment confirmed.');
    setPayModal(false); setPayRef('');
    await reload();
  };

  const reRunForArrears = async () => {
    if (!view?.runId) return;
    if (!candidates.length) { toast.error('No employees to recompute.'); return; }
    setBusy(true);
    const { error, rows } = await computeArrears(periodId, view.runId, candidates);
    setBusy(false);
    if (error) { toast.error(`Arrears computation failed: ${error}`); return; }
    const changed = rows.filter(r => Math.abs(r.arrears) > 0.001).length;
    toast.success(`Arrears computed — ${changed} employee(s) with a difference.`);
    await reload();
  };

  const ExportButtons = ({ doc }: { doc: () => StatementDoc }) => (
    <div className="flex items-center gap-2">
      <button onClick={() => printStatementPDF(doc(), lhWrap)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileText size={13} /> PDF</button>
      <button onClick={() => downloadExcel(doc())} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><FileSpreadsheet size={13} /> Excel</button>
      <button onClick={() => downloadCSV(doc())} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><Download size={13} /> CSV</button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg"><Banknote size={22} className="text-emerald-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Salary Payment</h1>
                <p className="text-xs text-muted-foreground">Review nett payable, download the bank statement, confirm payment, and compute arrears.</p>
              </div>
            </div>
            <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-card text-sm outline-none">
              {periods.length === 0 && <option>No periods</option>}
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Status / summary */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{periodLabel}</p>
                {!hasRun ? (
                  <p className="mt-1 text-sm font-medium text-amber-600 flex items-center gap-1.5"><AlertCircle size={15} /> No payroll run for this period yet — run payroll first.</p>
                ) : (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${isPaid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                      {isPaid ? <><Lock size={12} /> Payment Confirmed</> : <>Payment Pending</>}
                    </span>
                    {!isPaid && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${runApproved ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {runApproved ? <><ShieldCheck size={12} /> Pay Run Approved</> : <>Pay Run Draft — needs approval</>}
                      </span>
                    )}
                    {isPaid && <span className="text-xs text-muted-foreground">Paid on {fmtDate(view!.paidAt)}{view!.paymentReference ? ` · Ref ${view!.paymentReference}` : ''}{view!.paymentMode ? ` · ${view!.paymentMode}` : ''}</span>}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Nett Payable</p>
                <p className="text-2xl font-bold text-emerald-600">{inr(view?.totalNet ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground">{view?.rows.length ?? 0} employees</p>
              </div>
            </div>

            {hasRun && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {!isPaid && (
                    <>
                      {/* Re-run is allowed any time before payment is confirmed. It creates a
                          fresh Draft run that must be re-approved before payment. */}
                      <button onClick={reRunBeforeCommit} disabled={busy} className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-lg text-sm font-medium hover:bg-indigo-100 disabled:opacity-60">
                        {busy ? <RefreshCw size={15} className="animate-spin" /> : <RefreshCw size={15} />} Re-run Payroll (before payment)
                      </button>
                      {!runApproved ? (
                        <button onClick={doApprove} disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm disabled:opacity-60">
                          {busy ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Approve Pay Run
                        </button>
                      ) : (
                        <button onClick={() => setPayModal(true)} disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm disabled:opacity-60">
                          <CheckCircle2 size={15} /> Confirm Salary Payment
                        </button>
                      )}
                    </>
                  )}
                  {isPaid && (
                    <button onClick={reRunForArrears} disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 shadow-sm disabled:opacity-60">
                      {busy ? <RefreshCw size={15} className="animate-spin" /> : <Calculator size={15} />} Re-run for Arrears
                    </button>
                  )}
                </div>
                {!isPaid && !runApproved && (
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-600" />
                    Payment is locked until the Pay Run is approved. Approve it here, or open <button onClick={() => navigate('/payroll')} className="underline font-medium text-indigo-700 hover:text-indigo-800">Payroll → Pay Run</button> to review the full calculation first.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bank Payment Statement */}
          {hasRun && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h2 className="font-bold text-sm flex items-center gap-2"><Building2 size={16} className="text-emerald-600" /> Bank Payment Statement</h2>
                <ExportButtons doc={bankDoc} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-accent/50 text-muted-foreground text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Employee</th>
                      <th className="px-4 py-2.5 font-semibold">Bank</th>
                      <th className="px-4 py-2.5 font-semibold">Account No.</th>
                      <th className="px-4 py-2.5 font-semibold">IFSC</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Nett Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground"><RefreshCw size={15} className="inline animate-spin mr-2" />Loading…</td></tr>}
                    {!loading && (view?.rows ?? []).map(r => (
                      <tr key={r.employeeId} className="hover:bg-accent/30">
                        <td className="px-4 py-2.5"><p className="font-medium">{r.name}</p><p className="text-[10px] text-muted-foreground">{r.code} · {r.department}</p></td>
                        <td className="px-4 py-2.5 text-xs">{r.bankName || <span className="text-amber-600">No bank on file</span>}{r.branch ? <span className="text-muted-foreground"> · {r.branch}</span> : ''}</td>
                        <td className="px-4 py-2.5 text-xs font-mono">{r.accountNumber || '—'}</td>
                        <td className="px-4 py-2.5 text-xs font-mono">{r.ifsc || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{inr(r.net)}</td>
                      </tr>
                    ))}
                    {!loading && (view?.rows.length ?? 0) > 0 && (
                      <tr className="bg-accent/30 font-bold"><td className="px-4 py-2.5" colSpan={4}>Total — {view!.rows.length} employees</td><td className="px-4 py-2.5 text-right text-emerald-700">{inr(view!.totalNet)}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Arrears */}
          {arrears.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h2 className="font-bold text-sm flex items-center gap-2"><Calculator size={16} className="text-violet-600" /> Arrears Statement</h2>
                <ExportButtons doc={arrearsDoc} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-accent/50 text-muted-foreground text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Employee</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Paid Net</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Revised Net</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Arrears</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {arrears.map(r => (
                      <tr key={r.employeeId} className="hover:bg-accent/30">
                        <td className="px-4 py-2.5"><p className="font-medium">{r.name}</p><p className="text-[10px] text-muted-foreground">{r.code} · {r.department}</p></td>
                        <td className="px-4 py-2.5 text-right">{inr(r.previousNet)}</td>
                        <td className="px-4 py-2.5 text-right">{inr(r.revisedNet)}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${r.arrears > 0 ? 'text-green-600' : r.arrears < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{inr(r.arrears)}</td>
                      </tr>
                    ))}
                    <tr className="bg-accent/30 font-bold">
                      <td className="px-4 py-2.5">Total Arrears</td>
                      <td className="px-4 py-2.5 text-right">{inr(arrears.reduce((s,r)=>s+r.previousNet,0))}</td>
                      <td className="px-4 py-2.5 text-right">{inr(arrears.reduce((s,r)=>s+r.revisedNet,0))}</td>
                      <td className="px-4 py-2.5 text-right text-violet-700">{inr(arrears.reduce((s,r)=>s+r.arrears,0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirm Payment modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
              <h2 className="text-lg font-bold">Confirm Salary Payment</h2>
              <button onClick={() => setPayModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                <Banknote size={18} className="text-emerald-600" />
                <div><p className="font-semibold text-emerald-800">{inr(view?.totalNet ?? 0)}</p><p className="text-xs text-emerald-700">{view?.rows.length ?? 0} employees · {period.name}</p></div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Payment Mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full p-3 bg-accent/50 border border-border rounded-xl text-sm outline-none">
                  <option>Bank Transfer (NEFT)</option><option>Bank Transfer (RTGS)</option><option>Bank Transfer (IMPS)</option><option>Cheque</option><option>Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Payment Reference / UTR</label>
                <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="e.g. UTR / cheque no." className="w-full p-3 bg-accent/50 border border-border rounded-xl text-sm outline-none" />
              </div>
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5"><AlertCircle size={13} className="shrink-0 mt-0.5" /> After confirmation, re-running payroll produces an arrears statement instead of overwriting the paid figures.</p>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setPayModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={doConfirm} disabled={busy} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 shadow-md disabled:opacity-60">
                {busy ? <RefreshCw size={15} className="animate-spin" /> : <ArrowRight size={15} />} Confirm Payment
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
