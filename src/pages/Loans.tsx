import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  HandCoins, Plus, Search, X, CheckCircle2, XCircle, Clock,
  TrendingDown, AlertCircle, Eye, DollarSign, Percent, Hash,
  ShieldCheck, UserCheck, Loader2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import EmiSkipApprovals from '../components/EmiSkipApprovals';
import { useCurrency } from '../context/CurrencyContext';
import { supabase } from '../supabase/client';
import {
  useLoans, useActiveLoanTypes, applyLoan, decideLoan, calcEMI, fetchSchedule,
  type UiLoan, type UiLoanType, type LoanStatus, type EmiRow, type LoanApprovalWorkflow,
} from '../lib/loans';

const db = supabase as unknown as SupabaseClient;

const STATUS_STYLES: Record<LoanStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  Approved: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: CheckCircle2 },
  Active: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: TrendingDown },
  Closed: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: CheckCircle2 },
  Rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
};

const STAGE_BADGE: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Approved: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
  NA: 'bg-gray-100 text-gray-500 border-gray-200',
};

const WORKFLOW_LABEL: Record<LoanApprovalWorkflow, string> = {
  SingleHR: 'Single HR / Admin',
  TwoStage: 'Manager → HR',
  AutoWithinLimits: 'Auto (within limits)',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2, '0')}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = inputCls + " appearance-none";

interface FieldProps { label: string; required?: boolean; children: React.ReactNode; hint?: string; }
const Field = ({ label, required, children, hint }: FieldProps) => (
  <div>
    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">{label} {required && <span className="text-destructive">*</span>}</label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

interface EmployeeOption { id: string; code: string; name: string; department: string }
function useEmployees(): EmployeeOption[] {
  const [rows, setRows] = useState<EmployeeOption[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await db.from('employees')
        .select('id, employee_id, first_name, last_name, status, department:departments(name)')
        .order('first_name');
      const list: EmployeeOption[] = (data ?? [])
        .filter((r: any) => r.status !== 'Inactive')
        .map((r: any) => ({ id: r.id, code: r.employee_id ?? '', name: [r.first_name, r.last_name].filter(Boolean).join(' ') || (r.employee_id ?? 'Employee'), department: r.department?.name ?? '' }));
      if (active) setRows(list);
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

export default function Loans() {
  const { formatAmount, currencySymbol } = useCurrency();
  const { loans, loading } = useLoans();
  const { loanTypes } = useActiveLoanTypes();
  const employees = useEmployees();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [detailLoan, setDetailLoan] = useState<UiLoan | null>(null);
  const [schedule, setSchedule] = useState<EmiRow[]>([]);
  const [applyModal, setApplyModal] = useState(false);
  const [approvalModal, setApprovalModal] = useState<UiLoan | null>(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const [applyForm, setApplyForm] = useState({ employeeId: '', loanTypeId: '', principalAmount: '', tenureMonths: '', purpose: '' });

  const selectedType = loanTypes.find(t => t.id === applyForm.loanTypeId);

  // Default the loan-type selection once types load.
  useEffect(() => {
    if (!applyForm.loanTypeId && loanTypes.length) {
      const t = loanTypes[0];
      setApplyForm(f => ({ ...f, loanTypeId: t.id, tenureMonths: String(Math.min(12, t.maxTenureMonths)) }));
    }
  }, [loanTypes, applyForm.loanTypeId]);

  const filtered = useMemo(() =>
    loans
      .filter(l => l.employeeName.toLowerCase().includes(search.toLowerCase()) || l.employeeCode.toLowerCase().includes(search.toLowerCase()))
      .filter(l => statusFilter === 'All' || l.status === statusFilter)
      .filter(l => typeFilter === 'All' || l.loanTypeName === typeFilter),
    [loans, search, statusFilter, typeFilter]
  );

  const totalDisbursed = loans.filter(l => l.status === 'Active' || l.status === 'Closed').reduce((s, l) => s + l.principalAmount, 0);
  const totalOutstanding = loans.filter(l => l.status === 'Active').reduce((s, l) => s + l.outstandingBalance, 0);
  const pendingCount = loans.filter(l => l.status === 'Pending').length;
  const activeCount = loans.filter(l => l.status === 'Active').length;

  const rate = selectedType ? (selectedType.isInterestFree ? 0 : selectedType.interestRate) : 0;
  const previewEMI = applyForm.principalAmount && applyForm.tenureMonths
    ? Math.round(calcEMI(parseFloat(applyForm.principalAmount) || 0, rate, parseInt(applyForm.tenureMonths) || 1))
    : 0;

  const handleApply = async () => {
    if (!applyForm.employeeId) { toast.error('Select an employee.'); return; }
    if (!selectedType) { toast.error('Select a loan type.'); return; }
    const principal = parseFloat(applyForm.principalAmount);
    const tenure = parseInt(applyForm.tenureMonths);
    if (!principal || principal <= 0) { toast.error('Enter a valid loan amount.'); return; }
    if (principal > selectedType.maxAmount) { toast.error(`Amount exceeds the ${selectedType.name} limit of ${formatAmount(selectedType.maxAmount)}.`); return; }
    if (!tenure || tenure <= 0) { toast.error('Enter a valid tenure.'); return; }
    if (tenure > selectedType.maxTenureMonths) { toast.error(`Tenure exceeds the limit of ${selectedType.maxTenureMonths} months.`); return; }
    if (!applyForm.purpose.trim()) { toast.error('Provide the purpose of the loan.'); return; }
    setBusy(true);
    const { error } = await applyLoan({ employeeId: applyForm.employeeId, loanType: selectedType, principal, interestRate: rate, tenureMonths: tenure, purpose: applyForm.purpose });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(selectedType.approvalWorkflow === 'AutoWithinLimits' ? 'Loan auto-approved & disbursed.' : 'Loan application submitted for approval.');
    setApplyModal(false);
    setApplyForm({ employeeId: '', loanTypeId: applyForm.loanTypeId, principalAmount: '', tenureMonths: applyForm.tenureMonths, purpose: '' });
  };

  const decide = async (loan: UiLoan, stage: 'manager' | 'hr' | 'single', decision: 'Approved' | 'Rejected') => {
    if (decision === 'Rejected' && !remarks.trim()) { toast.error('Please add remarks for a rejection.'); return; }
    setBusy(true);
    const { error } = await decideLoan(loan, stage, decision, remarks);
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(decision === 'Approved' ? 'Approval recorded.' : 'Application rejected.');
    setApprovalModal(null);
    setRemarks('');
  };

  const openDetail = async (loan: UiLoan) => {
    setDetailLoan(loan);
    setSchedule(await fetchSchedule(loan.id));
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><HandCoins size={22} className="text-amber-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Loan & Advance Management</h1>
                <p className="text-xs text-muted-foreground">Manage employee loans, advances, approvals, and EMI schedules.</p>
              </div>
            </div>
            <button onClick={() => setApplyModal(true)} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
              <Plus size={16} /> New Loan / Advance
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Disbursed', value: formatAmount(totalDisbursed), sub: 'Active + closed', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: DollarSign },
              { label: 'Outstanding', value: formatAmount(totalOutstanding), sub: 'Active loans', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: TrendingDown },
              { label: 'Active Loans', value: activeCount, sub: 'Currently running', color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Pending Approval', value: pendingCount, sub: 'Awaiting review', color: 'bg-rose-100', iconColor: 'text-rose-600', icon: Clock },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={20} className={card.iconColor} /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-lg mt-0.5">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search by employee name or ID..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as LoanStatus | 'All')}>
              <option value="All">All Status</option>
              {(['Pending', 'Approved', 'Active', 'Closed', 'Rejected'] as LoanStatus[]).map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="All">All Types</option>
              {[...new Set(loans.map(l => l.loanTypeName))].map(t => <option key={t}>{t}</option>)}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} loans</div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Loan Type</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">EMI</th>
                    <th className="px-4 py-3 font-semibold">Outstanding</th>
                    <th className="px-4 py-3 font-semibold">Applied</th>
                    <th className="px-4 py-3 font-semibold">Progress</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm"><Loader2 size={16} className="animate-spin inline mr-2" />Loading loans…</td></tr>
                  )}
                  {!loading && filtered.map((loan, i) => {
                    const statusStyle = STATUS_STYLES[loan.status];
                    const StatusIcon = statusStyle.icon;
                    const progress = loan.tenureMonths > 0 ? (loan.paidEMIs / loan.tenureMonths) * 100 : 0;
                    return (
                      <motion.tr key={loan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors group">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{loan.employeeName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{loan.employeeCode}</p>
                        </td>
                        <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-100 text-violet-700 border-violet-200">{loan.loanTypeName}</span></td>
                        <td className="px-4 py-3 font-bold text-sm">{formatAmount(loan.principalAmount)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatAmount(loan.emiAmount)}/mo</td>
                        <td className="px-4 py-3 font-semibold text-sm text-amber-600">{formatAmount(loan.outstandingBalance)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(loan.appliedDate)}</td>
                        <td className="px-4 py-3">
                          <div className="w-24">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>{loan.paidEMIs}/{loan.tenureMonths}</span><span>{Math.round(progress)}%</span></div>
                            <div className="w-full h-1.5 bg-accent rounded-full"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}><StatusIcon size={10} />{loan.status}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openDetail(loan)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Eye size={13} /></button>
                            {loan.status === 'Pending' && (
                              <button onClick={() => { setApprovalModal(loan); setRemarks(''); }} className="p-1.5 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors" title="Review"><ShieldCheck size={13} /></button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">No loans found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <EmiSkipApprovals />
        </div>
      </main>

      {/* Apply Modal */}
      <AnimatePresence>
        {applyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">New Loan / Advance</h2>
                <button onClick={() => setApplyModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {loanTypes.length === 0 ? (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200"><AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" /><p className="text-xs text-amber-700">No active loan types. Add one in <strong>Payroll Setup → Loan &amp; Advance Types</strong> first.</p></div>
                ) : (
                  <>
                    <Field label="Employee" required>
                      <select className={selectCls} value={applyForm.employeeId} onChange={e => setApplyForm(f => ({ ...f, employeeId: e.target.value }))}>
                        <option value="">Select employee…</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.code ? `(${e.code})` : ''}{e.department ? ` · ${e.department}` : ''}</option>)}
                      </select>
                    </Field>
                    <Field label="Loan Type" required>
                      <select className={selectCls} value={applyForm.loanTypeId} onChange={e => setApplyForm(f => ({ ...f, loanTypeId: e.target.value }))}>
                        {loanTypes.map(t => <option key={t.id} value={t.id}>{t.name}{t.isInterestFree ? ' (Interest-free)' : ` · ${t.interestRate}%`}</option>)}
                      </select>
                    </Field>
                    {selectedType && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded-full bg-accent border border-border text-muted-foreground">Max {formatAmount(selectedType.maxAmount)}</span>
                        <span className="px-2 py-0.5 rounded-full bg-accent border border-border text-muted-foreground">Up to {selectedType.maxTenureMonths} mo</span>
                        <span className="px-2 py-0.5 rounded-full bg-accent border border-border text-muted-foreground">Rate {rate}% p.a.</span>
                        <span className="px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 inline-flex items-center gap-1"><ShieldCheck size={10} /> {WORKFLOW_LABEL[selectedType.approvalWorkflow]}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <Field label={`Amount (${currencySymbol})`} required>
                        <div className="relative"><DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="number" className={`${inputCls} pl-8`} placeholder="50000" min={1000} value={applyForm.principalAmount} onChange={e => setApplyForm(f => ({ ...f, principalAmount: e.target.value }))} /></div>
                      </Field>
                      <Field label="Tenure (Months)" required>
                        <div className="relative"><Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="number" className={`${inputCls} pl-8`} placeholder="12" min={1} max={selectedType?.maxTenureMonths ?? 60} value={applyForm.tenureMonths} onChange={e => setApplyForm(f => ({ ...f, tenureMonths: e.target.value }))} /></div>
                      </Field>
                      <Field label="Interest Rate" hint="Set by the loan type">
                        <div className="relative"><Percent size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="text" disabled className={`${inputCls} pl-8 opacity-70`} value={`${rate}% p.a.`} /></div>
                      </Field>
                      <div className="flex flex-col justify-end">
                        {previewEMI > 0 && (
                          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Monthly EMI</p><p className="text-lg font-bold text-primary">{formatAmount(previewEMI)}</p></div>
                        )}
                      </div>
                    </div>
                    <Field label="Purpose / Reason" required>
                      <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Describe the purpose of this loan..." value={applyForm.purpose} onChange={e => setApplyForm(f => ({ ...f, purpose: e.target.value }))} />
                    </Field>
                  </>
                )}
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setApplyModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={handleApply} disabled={busy || loanTypes.length === 0} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md disabled:opacity-50">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <HandCoins size={15} />} Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Approval Modal */}
      <AnimatePresence>
        {approvalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">Review Application</h2>
                <button onClick={() => setApprovalModal(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Employee', value: approvalModal.employeeName },
                    { label: 'Loan Type', value: approvalModal.loanTypeName },
                    { label: 'Amount', value: formatAmount(approvalModal.principalAmount) },
                    { label: 'EMI', value: `${formatAmount(approvalModal.emiAmount)}/mo` },
                    { label: 'Tenure', value: `${approvalModal.tenureMonths} months` },
                    { label: 'Interest', value: `${approvalModal.interestRate}% p.a.` },
                  ].map(row => (
                    <div key={row.label} className="p-3 bg-accent/30 rounded-lg"><p className="text-xs text-muted-foreground mb-0.5">{row.label}</p><p className="font-semibold text-sm">{row.value}</p></div>
                  ))}
                </div>
                <div className="p-3 bg-accent/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Purpose</p><p className="text-sm">{approvalModal.purpose || '—'}</p></div>

                {approvalModal.approvalWorkflow === 'TwoStage' && (
                  <div className="space-y-2 p-3 rounded-xl border border-border bg-accent/10">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STAGE_BADGE[approvalModal.managerStatus] ?? STAGE_BADGE.Pending}`}><UserCheck size={11} /> Manager: {approvalModal.managerStatus}</span>
                      {approvalModal.managerStatus === 'Pending' && (
                        <div className="flex gap-2">
                          <button disabled={busy} onClick={() => decide(approvalModal, 'manager', 'Approved')} className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-[11px] font-semibold hover:bg-green-100 disabled:opacity-50">Approve</button>
                          <button disabled={busy} onClick={() => decide(approvalModal, 'manager', 'Rejected')} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-[11px] font-semibold hover:bg-red-100 disabled:opacity-50">Reject</button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STAGE_BADGE[approvalModal.hrStatus] ?? STAGE_BADGE.Pending}`}><ShieldCheck size={11} /> HR: {approvalModal.hrStatus}</span>
                      {approvalModal.hrStatus === 'Pending' && approvalModal.managerStatus === 'Approved' && (
                        <div className="flex gap-2">
                          <button disabled={busy} onClick={() => decide(approvalModal, 'hr', 'Approved')} className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-[11px] font-semibold hover:bg-green-100 disabled:opacity-50">Approve &amp; Disburse</button>
                          <button disabled={busy} onClick={() => decide(approvalModal, 'hr', 'Rejected')} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-[11px] font-semibold hover:bg-red-100 disabled:opacity-50">Reject</button>
                        </div>
                      )}
                      {approvalModal.hrStatus === 'Pending' && approvalModal.managerStatus !== 'Approved' && <span className="text-[10px] text-muted-foreground">awaiting manager</span>}
                    </div>
                  </div>
                )}

                <Field label="Remarks"><textarea className={`${inputCls} resize-none`} rows={2} placeholder="Add remarks (required to reject)..." value={remarks} onChange={e => setRemarks(e.target.value)} /></Field>
              </div>
              {approvalModal.approvalWorkflow !== 'TwoStage' && (
                <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                  <button disabled={busy} onClick={() => decide(approvalModal, 'single', 'Rejected')} className="flex items-center gap-2 px-5 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"><XCircle size={15} /> Reject</button>
                  <button disabled={busy} onClick={() => decide(approvalModal, 'single', 'Approved')} className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Approve &amp; Disburse</button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">Loan Details — {detailLoan.employeeName}</h2>
                <button onClick={() => setDetailLoan(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Principal', value: formatAmount(detailLoan.principalAmount) },
                    { label: 'EMI', value: `${formatAmount(detailLoan.emiAmount)}/mo` },
                    { label: 'Outstanding', value: formatAmount(detailLoan.outstandingBalance) },
                    { label: 'Interest Rate', value: `${detailLoan.interestRate}% p.a.` },
                    { label: 'Tenure', value: `${detailLoan.tenureMonths} months` },
                    { label: 'Paid EMIs', value: `${detailLoan.paidEMIs}/${detailLoan.tenureMonths}` },
                    { label: 'Applied On', value: formatDate(detailLoan.appliedDate) },
                    { label: 'Disbursed On', value: formatDate(detailLoan.disbursedDate) },
                    { label: 'Status', value: detailLoan.status },
                  ].map(row => (
                    <div key={row.label} className="p-3 bg-accent/30 rounded-lg text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{row.label}</p><p className="font-bold text-sm">{row.value}</p></div>
                  ))}
                </div>
                {schedule.length > 0 ? (
                  <div>
                    <h3 className="font-bold text-sm mb-3">EMI Schedule</h3>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                          <tr><th className="px-3 py-2 font-semibold">#</th><th className="px-3 py-2 font-semibold">Due Date</th><th className="px-3 py-2 font-semibold">EMI</th><th className="px-3 py-2 font-semibold">Principal</th><th className="px-3 py-2 font-semibold">Interest</th><th className="px-3 py-2 font-semibold">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {schedule.map(emi => (
                            <tr key={emi.id} className={emi.isPaid ? 'bg-green-50/50' : ''}>
                              <td className="px-3 py-2 font-mono">{emi.monthNumber}</td>
                              <td className="px-3 py-2">{formatDate(emi.dueDate)}</td>
                              <td className="px-3 py-2 font-semibold">{formatAmount(emi.emiAmount)}</td>
                              <td className="px-3 py-2">{formatAmount(emi.principalComponent)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{formatAmount(emi.interestComponent)}</td>
                              <td className="px-3 py-2">{emi.isPaid ? <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={11} /> Paid</span> : <span className="text-amber-600 font-bold flex items-center gap-1"><Clock size={11} /> Due</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No EMI schedule yet — generated once the loan is approved &amp; disbursed.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
