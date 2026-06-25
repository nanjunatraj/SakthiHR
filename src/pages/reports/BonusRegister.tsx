import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Receipt, ChevronLeft, Search, Users, IndianRupee, Percent, AlertCircle, Loader2, Eye } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import { useCurrency } from '../../context/CurrencyContext';
import { useBonusData } from '../../lib/statutoryBenefits';
import { useEstablishment } from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

export default function BonusRegister() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { loading, config, rows } = useBonusData();
  const est = useEstablishment();
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);

  const filtered = useMemo(
    () => rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.employeeCode.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );
  const eligible = rows.filter(r => r.eligible);
  const exgratiaRows = rows.filter(r => r.isExgratia);
  const totalAnnual = rows.reduce((s, r) => s + r.annualBonus, 0);

  const reportDoc: StatementDoc = useMemo(() => ({
    title: 'Statutory Bonus Register',
    establishment: est.name,
    subtitle: `Bonus ${config.percentage}% · ceiling ${formatAmount(config.wageCeiling)} · eligibility ${formatAmount(config.eligibilityLimit)}/mo`,
    columns: [
      { key: 'name', label: 'Employee' }, { key: 'code', label: 'Code' },
      { key: 'basic', label: 'Basic + DA', align: 'right' }, { key: 'base', label: 'Bonus Base', align: 'right' },
      { key: 'monthly', label: 'Monthly', align: 'right' }, { key: 'annual', label: 'Annual', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    rows: filtered.map(r => ({
      name: r.name, code: r.employeeCode, basic: formatAmount(r.basicMonthly), base: formatAmount(r.bonusBase),
      monthly: (r.eligible || r.isExgratia) ? formatAmount(r.monthlyBonus) : '—',
      annual: (r.eligible || r.isExgratia) ? formatAmount(r.annualBonus) : '—',
      status: r.eligible ? 'Eligible' : r.isExgratia ? 'Ex-gratia' : 'Above limit',
    })),
    totals: { name: 'Total Annual Payout', annual: formatAmount(totalAnnual) },
    note: 'Computer-generated Statutory Bonus Register.',
  }), [filtered, est.name, config, totalAnnual, formatAmount]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
            <div className="p-2 bg-rose-100 rounded-lg"><Receipt size={22} className="text-rose-600" /></div>
            <div>
              <h1 className="text-xl font-bold">Statutory Bonus Register</h1>
              <p className="text-xs text-muted-foreground">Payment of Bonus Act — computed from Payroll Settings (percentage, wage ceiling, eligibility).</p>
            </div>
            <button onClick={() => setShowView(true)} className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm">
              <Eye size={15} /> View / Print
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {!config.enabled && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Statutory Bonus is currently <strong>disabled</strong>. Enable it and set the percentage / ceiling in <strong>Payroll Setup → Payroll Settings → Statutory Bonus</strong>. Figures below are indicative.</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Bonus %', value: `${config.percentage}%`, sub: 'Of eligible wage', color: 'bg-rose-100', iconColor: 'text-rose-600', icon: Percent },
              { label: 'Wage Ceiling', value: formatAmount(config.wageCeiling), sub: 'Calc base cap / mo', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: IndianRupee },
              { label: 'Eligible Employees', value: eligible.length, sub: config.exgratiaEnabled ? `+ ${exgratiaRows.length} ex-gratia` : `of ${rows.length}`, color: 'bg-green-100', iconColor: 'text-green-600', icon: Users },
              { label: 'Total Annual Payout', value: formatAmount(totalAnnual), sub: 'Bonus + ex-gratia', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: IndianRupee },
            ].map((c, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${c.color} rounded-xl`}><c.icon size={20} className={c.iconColor} /></div>
                <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{c.label}</p><p className="font-bold text-lg mt-0.5">{c.value}</p><p className="text-[10px] text-muted-foreground">{c.sub}</p></div>
              </motion.div>
            ))}
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search employee..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="ml-auto text-xs text-muted-foreground">Eligibility wage limit: {formatAmount(config.eligibilityLimit)}/mo · {filtered.length} of {rows.length}</div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold text-right">Basic + DA</th>
                    <th className="px-4 py-3 font-semibold text-right">Bonus Base</th>
                    <th className="px-4 py-3 font-semibold text-right">Monthly Bonus</th>
                    <th className="px-4 py-3 font-semibold text-right">Annual Bonus</th>
                    <th className="px-4 py-3 font-semibold text-center">Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</td></tr>}
                  {!loading && filtered.map(r => (
                    <tr key={r.employeeId} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3"><p className="text-sm font-medium">{r.name}</p><p className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</p></td>
                      <td className="px-4 py-3 text-right text-sm">{formatAmount(r.basicMonthly)}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatAmount(r.bonusBase)}</td>
                      <td className="px-4 py-3 text-right text-sm">{(r.eligible || r.isExgratia) ? formatAmount(r.monthlyBonus) : '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-rose-600">{(r.eligible || r.isExgratia) ? formatAmount(r.annualBonus) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${r.eligible ? 'bg-green-100 text-green-700 border-green-200' : r.isExgratia ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{r.eligible ? 'Eligible' : r.isExgratia ? 'Ex-gratia' : 'Above limit'}</span>
                      </td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">{rows.length === 0 ? 'No employees with a salary assignment yet.' : 'No employees match your search.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}
