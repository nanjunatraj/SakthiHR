import { useMemo, useState, Fragment } from 'react';
import { ChevronLeft, Eye, Search, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useLoanRegister, useEstablishment, type LoanRow } from '../../lib/reports';
import { useCurrency } from '../../context/CurrencyContext';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

type GroupBy = 'none' | 'loanType' | 'status' | 'department' | 'designation' | 'location' | 'grade' | 'employeeType' | 'establishment';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'loanType', label: 'Loan Type Wise' },
  { value: 'status', label: 'Status Wise' },
  { value: 'department', label: 'Department Wise' },
  { value: 'designation', label: 'Designation Wise' },
  { value: 'location', label: 'Work Location Wise' },
  { value: 'grade', label: 'Grade Wise' },
  { value: 'employeeType', label: 'Employee Type Wise' },
  { value: 'establishment', label: 'Establishment Wise' },
  { value: 'none', label: 'No Grouping' },
];

const STATUS_STYLE: Record<string, string> = {
  Active: 'text-green-700', Approved: 'text-blue-600', Pending: 'text-amber-600',
  Closed: 'text-muted-foreground', Rejected: 'text-red-600',
};

export default function LoanRegister() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { formatAmount } = useCurrency();
  const { rows, loading } = useLoanRegister();
  const [groupBy, setGroupBy] = useState<GroupBy>('loanType');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (statusFilter === 'all' || r.status === statusFilter) &&
      (!q || r.name.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q) || r.loanType.toLowerCase().includes(q)));
  }, [rows, search, statusFilter]);

  const groups = useMemo(() => {
    const keyOf = (r: LoanRow) => (groupBy === 'none' ? 'All Loans & Advances' : (r[groupBy] || '—'));
    const m = new Map<string, LoanRow[]>();
    filtered.forEach(r => { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const subtotal = (items: LoanRow[]) => items.reduce((t, r) => ({
    principal: t.principal + r.principal, emi: t.emi + r.emiAmount, outstanding: t.outstanding + r.outstanding,
  }), { principal: 0, emi: 0, outstanding: 0 });
  const grand = useMemo(() => subtotal(filtered), [filtered]);

  const reportDoc: StatementDoc = useMemo(() => {
    const columns = [
      { key: 'employee', label: 'Employee', text: true },
      { key: 'code', label: 'Emp ID', text: true },
      { key: 'type', label: 'Loan Type', text: true },
      { key: 'principal', label: 'Principal', align: 'right' as const },
      { key: 'emi', label: 'EMI', align: 'right' as const },
      { key: 'tenure', label: 'Tenure', align: 'right' as const },
      { key: 'paid', label: 'Paid', align: 'right' as const },
      { key: 'outstanding', label: 'Outstanding', align: 'right' as const },
      { key: 'status', label: 'Status', text: true },
    ];
    const rowsOut: Array<Record<string, string | number>> = [];
    groups.forEach(g => {
      if (groupBy !== 'none') {
        const st = subtotal(g.items);
        rowsOut.push({ employee: `— ${g.label} —`, code: '', type: '', principal: st.principal, emi: st.emi, tenure: '', paid: '', outstanding: st.outstanding, status: `${g.items.length}` });
      }
      g.items.forEach(r => rowsOut.push({
        employee: r.name, code: r.employeeCode, type: r.loanType, principal: r.principal, emi: r.emiAmount,
        tenure: `${r.paidEmis}/${r.tenureMonths}`, paid: r.paidEmis, outstanding: r.outstanding, status: r.status,
      }));
    });
    return {
      title: 'Loan & Advance Register',
      establishment: est.name,
      subtitle: `${groupBy !== 'none' ? GROUP_OPTIONS.find(o => o.value === groupBy)?.label : 'All loans & advances'}${statusFilter !== 'all' ? ` · ${statusFilter}` : ''}`,
      columns,
      rows: rowsOut,
      totals: { employee: 'GRAND TOTAL', principal: grand.principal, emi: grand.emi, outstanding: grand.outstanding },
      note: 'Computer-generated loan & advance register.',
    };
  }, [groups, groupBy, est.name, grand, statusFilter]);

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
              <div className="p-2 bg-indigo-100 rounded-lg"><Wallet size={22} className="text-indigo-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Loan & Advance Register</h1>
                <p className="text-xs text-muted-foreground">Master register of all loans & advances per employee — principal, EMI, paid and outstanding.</p>
              </div>
            </div>
            <button onClick={() => setShowView(true)} disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50">
              <Eye size={15} /> View / Print
            </button>
          </div>
        </div>

        <div className="p-8 space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Group By</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card min-w-[170px]">
                {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card min-w-[130px]">
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Closed">Closed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee, ID or loan type…" className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-left">Loan Type</th>
                    <th className="px-3 py-2.5 text-right">Principal</th>
                    <th className="px-3 py-2.5 text-right">EMI</th>
                    <th className="px-3 py-2.5 text-right">Paid / Tenure</th>
                    <th className="px-3 py-2.5 text-right">Outstanding</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No loans or advances on record.</td></tr>
                  ) : groups.map(g => {
                    const st = subtotal(g.items);
                    return (
                      <Fragment key={g.label}>
                        {groupBy !== 'none' && (
                          <tr className="bg-accent/40">
                            <td className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide" colSpan={2}>{g.label}<span className="ml-2 text-muted-foreground font-normal normal-case">· {g.items.length}</span></td>
                            <td className="px-3 py-2 text-right font-bold">{formatAmount(st.principal)}</td>
                            <td className="px-3 py-2 text-right font-bold">{formatAmount(st.emi)}</td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-right font-bold">{formatAmount(st.outstanding)}</td>
                            <td className="px-3 py-2"></td>
                          </tr>
                        )}
                        {g.items.map(r => (
                          <tr key={r.id} className="hover:bg-accent/20">
                            <td className="px-3 py-2.5"><div className="font-semibold">{r.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</div></td>
                            <td className="px-3 py-2.5">{r.loanType}</td>
                            <td className="px-3 py-2.5 text-right">{formatAmount(r.principal)}</td>
                            <td className="px-3 py-2.5 text-right">{formatAmount(r.emiAmount)}</td>
                            <td className="px-3 py-2.5 text-right">{r.paidEmis}/{r.tenureMonths}</td>
                            <td className="px-3 py-2.5 text-right font-medium">{formatAmount(r.outstanding)}</td>
                            <td className={`px-3 py-2.5 font-medium ${STATUS_STYLE[r.status] ?? 'text-muted-foreground'}`}>{r.status}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-accent/30 font-bold border-t-2 border-border">
                      <td className="px-3 py-2.5" colSpan={2}>GRAND TOTAL · {filtered.length} loan{filtered.length !== 1 ? 's' : ''}</td>
                      <td className="px-3 py-2.5 text-right">{formatAmount(grand.principal)}</td>
                      <td className="px-3 py-2.5 text-right">{formatAmount(grand.emi)}</td>
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5 text-right">{formatAmount(grand.outstanding)}</td>
                      <td className="px-3 py-2.5"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}
