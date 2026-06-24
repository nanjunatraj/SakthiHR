import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Eye, Search, CalendarClock, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useEstablishment } from '../../lib/reports';
import { useLoans, fetchSchedule, type UiLoan, type EmiRow } from '../../lib/loans';
import { useCurrency } from '../../context/CurrencyContext';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

const fmtDate = (s: string) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

export default function EmiStatement() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { formatAmount } = useCurrency();
  const { loans, loading } = useLoans();
  const [loanId, setLoanId] = useState('');
  const [search, setSearch] = useState('');
  const [schedule, setSchedule] = useState<EmiRow[]>([]);
  const [schLoading, setSchLoading] = useState(false);
  const [showView, setShowView] = useState(false);

  const loanList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans.filter(l => !q || l.employeeName.toLowerCase().includes(q) || l.employeeCode.toLowerCase().includes(q) || l.loanTypeName.toLowerCase().includes(q));
  }, [loans, search]);

  useEffect(() => {
    if (loanId || loanList.length === 0) return;
    setLoanId(loanList[0].id);
  }, [loanList, loanId]);
  const loan: UiLoan | undefined = loans.find(l => l.id === loanId);

  useEffect(() => {
    if (!loanId) { setSchedule([]); return; }
    let active = true;
    setSchLoading(true);
    void fetchSchedule(loanId).then(rows => { if (active) { setSchedule(rows); setSchLoading(false); } });
    return () => { active = false; };
  }, [loanId]);

  const totals = useMemo(() => schedule.reduce((t, r) => ({
    emi: t.emi + r.emiAmount, principal: t.principal + r.principalComponent, interest: t.interest + r.interestComponent,
    paid: t.paid + (r.isPaid ? r.paidAmount || r.emiAmount : 0),
  }), { emi: 0, principal: 0, interest: 0, paid: 0 }), [schedule]);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'month', label: '#', align: 'right' as const },
      { key: 'due', label: 'Due Date', text: true },
      { key: 'emi', label: 'EMI', align: 'right' as const },
      { key: 'principal', label: 'Principal', align: 'right' as const },
      { key: 'interest', label: 'Interest', align: 'right' as const },
      { key: 'status', label: 'Status', text: true },
      { key: 'paidDate', label: 'Paid On', text: true },
    ];
    const rows = schedule.map(r => ({
      month: r.monthNumber, due: fmtDate(r.dueDate), emi: r.emiAmount, principal: r.principalComponent,
      interest: r.interestComponent, status: r.isPaid ? 'Paid' : 'Due', paidDate: r.paidDate ? fmtDate(r.paidDate) : '—',
    }));
    return {
      title: 'EMI Statement',
      establishment: est.name,
      subtitle: loan ? `${loan.employeeName} (${loan.employeeCode}) · ${loan.loanTypeName} · Principal ${formatAmount(loan.principalAmount)} @ ${loan.interestRate}% · ${loan.tenureMonths} months` : '',
      columns,
      rows,
      totals: { month: '', due: 'TOTAL', emi: totals.emi, principal: totals.principal, interest: totals.interest, status: '', paidDate: '' },
      note: 'Computer-generated EMI amortisation statement.',
    };
  }, [schedule, est.name, loan, totals, formatAmount]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/loan')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-indigo-100 rounded-lg"><CalendarClock size={22} className="text-indigo-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">EMI Statement</h1>
                <p className="text-xs text-muted-foreground">Amortisation schedule for a loan — month-wise EMI, principal, interest and repayment status.</p>
              </div>
            </div>
            <button onClick={() => setShowView(true)} disabled={schedule.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50">
              <Eye size={15} /> View / Print
            </button>
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
                  <p className="text-[11px] text-muted-foreground">{l.loanTypeName} · {formatAmount(l.principalAmount)} · {l.tenureMonths}m</p>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            {loan && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border border-border rounded-xl p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Principal</p><p className="font-bold">{formatAmount(loan.principalAmount)}</p></div>
                <div className="bg-card border border-border rounded-xl p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">EMI</p><p className="font-bold">{formatAmount(loan.emiAmount)}</p></div>
                <div className="bg-card border border-border rounded-xl p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid / Tenure</p><p className="font-bold">{loan.paidEMIs}/{loan.tenureMonths}</p></div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3"><p className="text-[10px] uppercase tracking-wide text-indigo-600">Outstanding</p><p className="font-bold text-indigo-700">{formatAmount(loan.outstandingBalance)}</p></div>
              </div>
            )}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-accent/30 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-right">#</th>
                      <th className="px-3 py-2.5 text-left">Due Date</th>
                      <th className="px-3 py-2.5 text-right">EMI</th>
                      <th className="px-3 py-2.5 text-right">Principal</th>
                      <th className="px-3 py-2.5 text-right">Interest</th>
                      <th className="px-3 py-2.5 text-left">Status</th>
                      <th className="px-3 py-2.5 text-left">Paid On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schLoading ? (
                      <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                    ) : schedule.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No EMI schedule for this loan.</td></tr>
                    ) : schedule.map(r => (
                      <tr key={r.id} className={`hover:bg-accent/20 ${r.isPaid ? 'bg-green-50/40' : ''}`}>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{r.monthNumber}</td>
                        <td className="px-3 py-2.5">{fmtDate(r.dueDate)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{formatAmount(r.emiAmount)}</td>
                        <td className="px-3 py-2.5 text-right">{formatAmount(r.principalComponent)}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{formatAmount(r.interestComponent)}</td>
                        <td className="px-3 py-2.5">{r.isPaid ? <span className="inline-flex items-center gap-1 text-green-700 font-medium"><CheckCircle2 size={12} /> Paid</span> : <span className="text-amber-600">Due</span>}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.paidDate ? fmtDate(r.paidDate) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {schedule.length > 0 && (
                    <tfoot>
                      <tr className="bg-accent/30 font-bold border-t-2 border-border">
                        <td className="px-3 py-2.5" colSpan={2}>TOTAL</td>
                        <td className="px-3 py-2.5 text-right">{formatAmount(totals.emi)}</td>
                        <td className="px-3 py-2.5 text-right">{formatAmount(totals.principal)}</td>
                        <td className="px-3 py-2.5 text-right">{formatAmount(totals.interest)}</td>
                        <td className="px-3 py-2.5" colSpan={2}>Recovered: {formatAmount(totals.paid)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}
