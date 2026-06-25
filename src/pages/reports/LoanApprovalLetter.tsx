import { formatDate, todayFormatted } from '../../utils/date';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search, Printer, FileSignature, X, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from '../../components/Sidebar';
import { useEstablishment } from '../../lib/reports';
import { useLoans, type UiLoan } from '../../lib/loans';
import { useCurrency } from '../../context/CurrencyContext';
import { buildLetterHtml, loadLetterhead, openLetterPrint } from '../../lib/letters';
import { toast } from 'react-toastify';

type LetterKind = 'application' | 'approval';

const fmtDate = (s: string) => formatDate(s, '__________');
const today = () => todayFormatted();
const refNo = (loan: UiLoan) => `LOAN/${new Date().getFullYear()}/${loan.employeeCode || loan.id.slice(0, 4).toUpperCase()}`;

const REF = (loan: UiLoan) =>
  `<table style="width:100%;border-collapse:collapse;margin:0 0 18px;font-size:13px;">` +
  `<tr><td>Ref: <strong>${refNo(loan)}</strong></td><td style="text-align:right;">Date: <strong>${today()}</strong></td></tr></table>`;

const SIGN = (company: string, role: string, sub: string) =>
  `<div style="margin-top:42px;"><p style="margin:0 0 2px;">For <strong>${company}</strong>,</p>` +
  `<div style="height:40px;"></div><p style="margin:0;font-weight:700;">${role}</p>` +
  `<p style="margin:0;font-size:12px;color:#475569;">${sub}</p></div>`;

function applicationBody(loan: UiLoan, company: string, money: (n: number) => string): string {
  return `${REF(loan)}
    <p>To,<br/>The HR / Accounts Department,<br/><strong>${company}</strong></p>
    <p>Respected Sir/Madam,</p>
    <p><strong>Subject: Application for ${loan.loanTypeName}</strong></p>
    <p>I, <strong>${loan.employeeName}</strong> (Employee ID <strong>${loan.employeeCode}</strong>), request the sanction of a
    <strong>${loan.loanTypeName}</strong> of <strong>${money(loan.principalAmount)}</strong>${loan.interestRate > 0 ? ` at an interest rate of <strong>${loan.interestRate}%</strong> p.a.` : ' (interest-free)'},
    repayable over <strong>${loan.tenureMonths} months</strong> at a monthly instalment of <strong>${money(loan.emiAmount)}</strong>.</p>
    <p>Purpose of the loan/advance: <strong>${loan.purpose || '__________'}</strong>.</p>
    <p>I authorise the company to recover the instalments through monthly deductions from my salary until the loan is fully
    repaid. Kindly consider and approve my application.</p>
    <p>Application dated: <strong>${fmtDate(loan.appliedDate)}</strong>.</p>
    <p>Thanking you,<br/>Yours faithfully,<br/><strong>${loan.employeeName}</strong><br/>${loan.employeeCode}</p>`;
}

function approvalBody(loan: UiLoan, company: string, money: (n: number) => string): string {
  const start = loan.disbursedDate ? fmtDate(loan.disbursedDate) : 'the next payroll cycle';
  return `${REF(loan)}
    <p>To,<br/><strong>${loan.employeeName}</strong><br/>Employee ID: ${loan.employeeCode}</p>
    <p><strong>Subject: Sanction of ${loan.loanTypeName}</strong></p>
    <p>Dear ${loan.employeeName},</p>
    <p>With reference to your application dated <strong>${fmtDate(loan.appliedDate)}</strong>, we are pleased to inform you that the
    management has <strong>${loan.status === 'Rejected' ? 'reviewed' : 'sanctioned'}</strong> your request for a
    <strong>${loan.loanTypeName}</strong> on the following terms:</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:13px;">
      <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Loan / Advance Type</td><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:700;">${loan.loanTypeName}</td></tr>
      <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Sanctioned Amount</td><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:700;">${money(loan.principalAmount)}</td></tr>
      <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Interest Rate</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">${loan.interestRate > 0 ? `${loan.interestRate}% p.a.` : 'Interest-free'}</td></tr>
      <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Tenure</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">${loan.tenureMonths} months</td></tr>
      <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Monthly Instalment (EMI)</td><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:700;">${money(loan.emiAmount)}</td></tr>
      <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Recovery Commences</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">${start}</td></tr>
    </table>
    <p>The instalments will be recovered through monthly deductions from your salary. This sanction is subject to the
    company's loan &amp; advance policy and the terms of your employment.</p>
    ${SIGN(company, 'Authorised Signatory', 'Human Resources Department')}`;
}

// Popup-proof in-app viewer with its own Print button.
const Viewer = ({ html, title, onClose }: { html: string; title: string; onClose: () => void }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card w-full max-w-3xl h-[92vh] rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-2"><Eye size={18} className="text-indigo-600" /><h2 className="text-sm font-bold text-indigo-900 truncate">{title}</h2></div>
          <div className="flex items-center gap-2">
            <button onClick={() => { const w = frameRef.current?.contentWindow; if (w) { w.focus(); w.print(); } }} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <Printer size={15} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
          </div>
        </div>
        <iframe title="loan-letter" ref={frameRef} srcDoc={html} className="flex-1 w-full bg-white" />
      </motion.div>
    </div>
  );
};

export default function LoanApprovalLetter() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { formatAmount } = useCurrency();
  const { loans, loading } = useLoans();
  const [loanId, setLoanId] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<LetterKind>('approval');
  const [letterhead, setLetterhead] = useState<Record<string, any> | null>(null);
  const [viewerHtml, setViewerHtml] = useState<string | null>(null);

  const loanList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans.filter(l => !q || l.employeeName.toLowerCase().includes(q) || l.employeeCode.toLowerCase().includes(q) || l.loanTypeName.toLowerCase().includes(q));
  }, [loans, search]);

  useEffect(() => { if (!loanId && loanList.length) setLoanId(loanList[0].id); }, [loanList, loanId]);
  const loan = loans.find(l => l.id === loanId);

  useEffect(() => {
    if (!loan) { setLetterhead(null); return; }
    let active = true;
    void loadLetterhead(loan.employeeId).then(lh => { if (active) setLetterhead(lh); });
    return () => { active = false; };
  }, [loan?.employeeId]);

  const company = est.name || 'the Establishment';
  const title = loan ? `${kind === 'application' ? 'Loan Application' : 'Loan Sanction / Approval'} — ${loan.employeeName}` : '';
  const body = loan ? (kind === 'application' ? applicationBody(loan, company, formatAmount) : approvalBody(loan, company, formatAmount)) : '';
  const previewHtml = useMemo(() =>
    loan ? buildLetterHtml({ title, bodyHtml: body, letterhead, useLetterhead: true, withToolbar: false }) : '',
    [loan, title, body, letterhead]);

  const openViewer = () => { if (loan) setViewerHtml(buildLetterHtml({ title, bodyHtml: body, letterhead, useLetterhead: true, withToolbar: false })); };
  const openTab = () => {
    if (!loan) return;
    const html = buildLetterHtml({ title, bodyHtml: body, letterhead, useLetterhead: true });
    if (!openLetterPrint(html)) toast.error('Popup blocked — use “View / Print” to open it in-app.');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports/g/loan')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="p-2 bg-indigo-100 rounded-lg"><FileSignature size={22} className="text-indigo-600" /></div>
            <div>
              <h1 className="text-xl font-bold">Loan Application & Approval Letter</h1>
              <p className="text-xs text-muted-foreground">Generate the loan application or sanction/approval letter for any loan & advance.</p>
            </div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Loan picker */}
          <div className="bg-card border border-border rounded-xl overflow-hidden h-fit">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee or loan type…" className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card" />
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2 space-y-1">
              {loading ? (
                <p className="text-xs text-muted-foreground p-4 text-center">Loading…</p>
              ) : loanList.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">No loans on record.</p>
              ) : loanList.map(l => (
                <button key={l.id} onClick={() => setLoanId(l.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${loanId === l.id ? 'bg-indigo-50 border-indigo-300' : 'bg-card border-border hover:border-indigo-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{l.employeeName}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">{l.status}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{l.loanTypeName} · {formatAmount(l.principalAmount)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Letter preview */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-accent/50 p-1 rounded-xl">
                <button onClick={() => setKind('application')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${kind === 'application' ? 'bg-white text-indigo-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Application Letter</button>
                <button onClick={() => setKind('approval')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${kind === 'approval' ? 'bg-white text-indigo-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Sanction / Approval Letter</button>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={openViewer} disabled={!loan} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent text-sm font-medium disabled:opacity-50"><Eye size={15} /> View / Print</button>
                <button onClick={openTab} disabled={!loan} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50" title="Open in a new browser tab"><Printer size={15} /> Open in Tab</button>
              </div>
            </div>
            <div className="bg-accent/20 border border-border rounded-xl overflow-hidden" style={{ height: '70vh' }}>
              {loan
                ? <iframe title="loan-letter-preview" srcDoc={previewHtml} className="w-full h-full bg-white" />
                : <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Select a loan to preview the letter.</div>}
            </div>
          </div>
        </div>
      </main>
      {viewerHtml && <Viewer html={viewerHtml} title={title} onClose={() => setViewerHtml(null)} />}
    </div>
  );
}
