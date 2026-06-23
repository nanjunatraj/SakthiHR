import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Wallet, ChevronLeft, Search, Users, IndianRupee, Clock, AlertCircle, Loader2, FileCheck, X, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';
import { useCurrency } from '../../context/CurrencyContext';
import { useGratuityData, recordGratuitySettlement, gratuityAmount, type GratuityRow } from '../../lib/statutoryBenefits';
import { useEstablishment } from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

export default function GratuityRegister() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { loading, config, rows, reload } = useGratuityData();
  const est = useEstablishment();
  const [search, setSearch] = useState('');
  const [showView, setShowView] = useState(false);
  const [settle, setSettle] = useState<GratuityRow | null>(null);
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.employeeCode.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );
  const totalProvision = rows.reduce((s, r) => s + r.accrued, 0);
  const eligibleCount = rows.filter(r => r.eligibleForPayout).length;

  const reportDoc: StatementDoc = useMemo(() => ({
    title: 'Gratuity Register',
    establishment: est.name,
    subtitle: `${config.formula} · min ${config.minYears} years`,
    columns: [
      { key: 'name', label: 'Employee' }, { key: 'code', label: 'Code' },
      { key: 'basic', label: 'Monthly Basic', align: 'right' }, { key: 'years', label: 'Years', align: 'right' },
      { key: 'accrued', label: 'Accrued Provision', align: 'right' }, { key: 'status', label: 'Payout Eligible' },
    ],
    rows: filtered.map(r => ({
      name: r.name, code: r.employeeCode, basic: formatAmount(r.basicMonthly), years: r.yearsOfService.toFixed(1),
      accrued: formatAmount(r.accrued), status: r.eligibleForPayout ? 'Yes' : 'No',
    })),
    totals: { name: 'Total Provision', accrued: formatAmount(totalProvision) },
    note: 'Computer-generated Gratuity Register (accrual provision).',
  }), [filtered, est.name, config, totalProvision, formatAmount]);

  // Settlement amount uses years up to the chosen last working day.
  const settleYears = useMemo(() => {
    if (!settle?.doj) return settle?.yearsOfService ?? 0;
    const from = new Date(settle.doj + 'T00:00:00').getTime();
    const to = new Date(settleDate + 'T00:00:00').getTime();
    return Math.max(0, (to - from) / (365.25 * 24 * 3600 * 1000));
  }, [settle, settleDate]);
  const settleAmount = settle ? gratuityAmount(settle.basicMonthly, settleYears) : 0;
  const settleEligible = settleYears >= config.minYears;

  const doSettle = async () => {
    if (!settle) return;
    if (!settleEligible) { toast.error(`Not eligible — requires at least ${config.minYears} years of service.`); return; }
    setBusy(true);
    const { error } = await recordGratuitySettlement({
      employeeId: settle.employeeId, settlementDate: settleDate, yearsOfService: Math.round(settleYears * 100) / 100,
      lastBasic: settle.basicMonthly, gratuityAmount: settleAmount, formula: config.formula,
    });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(`Gratuity settlement of ${formatAmount(settleAmount)} recorded for ${settle.name}.`);
    setSettle(null);
    void reload();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
            <div className="p-2 bg-amber-100 rounded-lg"><Wallet size={22} className="text-amber-600" /></div>
            <div>
              <h1 className="text-xl font-bold font-serif">Gratuity</h1>
              <p className="text-xs text-muted-foreground">Accrual / liability provision and exit settlement — per Payroll Settings ({config.formula}).</p>
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
              <p className="text-xs text-amber-700">Gratuity is currently <strong>disabled</strong>. Enable it in <strong>Payroll Setup → Payroll Settings → Gratuity</strong>. Figures below are indicative.</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Employees', value: rows.length, sub: 'With salary basis', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Eligible (≥ ' + config.minYears + 'y)', value: eligibleCount, sub: 'For payout', color: 'bg-green-100', iconColor: 'text-green-600', icon: FileCheck },
              { label: 'Total Provision', value: formatAmount(totalProvision), sub: 'Accrued liability', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: IndianRupee },
              { label: 'Min. Years', value: config.minYears, sub: 'Eligibility', color: 'bg-rose-100', iconColor: 'text-rose-600', icon: Clock },
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
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rows.length}</div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold text-right">Basic (Monthly)</th>
                    <th className="px-4 py-3 font-semibold text-right">Years of Service</th>
                    <th className="px-4 py-3 font-semibold text-right">Accrued Gratuity</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-center">Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</td></tr>}
                  {!loading && filtered.map(r => (
                    <tr key={r.employeeId} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3"><p className="text-sm font-medium">{r.name}</p><p className="text-[10px] font-mono text-muted-foreground">{r.employeeCode}</p></td>
                      <td className="px-4 py-3 text-right text-sm">{formatAmount(r.basicMonthly)}</td>
                      <td className="px-4 py-3 text-right text-sm">{r.yearsOfService.toFixed(1)} yrs</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-amber-600">{formatAmount(r.accrued)}</td>
                      <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${r.eligibleForPayout ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{r.eligibleForPayout ? 'Eligible' : `< ${config.minYears}y`}</span></td>
                      <td className="px-4 py-3 text-center"><button onClick={() => { setSettle(r); setSettleDate(new Date().toISOString().split('T')[0]); }} className="text-xs font-semibold text-primary hover:underline">Settle →</button></td>
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

      <AnimatePresence>
        {settle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-base font-bold">Gratuity Settlement — {settle.name}</h2>
                <button onClick={() => setSettle(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Last Working Day</label>
                  <input type="date" className="w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={settleDate} onChange={e => setSettleDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-accent/30 rounded-lg text-center"><p className="text-[10px] text-muted-foreground uppercase">Years</p><p className="font-bold text-sm">{settleYears.toFixed(2)}</p></div>
                  <div className="p-3 bg-accent/30 rounded-lg text-center"><p className="text-[10px] text-muted-foreground uppercase">Last Basic</p><p className="font-bold text-sm">{formatAmount(settle.basicMonthly)}</p></div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center"><p className="text-[10px] text-amber-600 uppercase">Gratuity</p><p className="font-bold text-sm text-amber-700">{formatAmount(settleAmount)}</p></div>
                </div>
                <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${settleEligible ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {settleEligible ? `Eligible. ${config.formula}.` : `Not eligible — requires at least ${config.minYears} years of continuous service.`}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setSettle(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={doSettle} disabled={busy || !settleEligible} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <FileCheck size={15} />} Record Settlement</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {showView && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}
