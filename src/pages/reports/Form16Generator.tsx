import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileText, ChevronLeft, Search, Download, Eye, Send, Users,
  Receipt, Building2, Loader2, ShieldCheck, IndianRupee,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';
import { useCurrency } from '../../context/CurrencyContext';
import { useForm16Data, updateEmployeeRegime, openForm16, type Form16Row } from '../../lib/form16';
import type { TaxRegime } from '../../lib/tax';

export default function Form16Generator() {
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const [fy, setFy] = useState<string | null>(null);
  const { loading, fys, rows, employer, reload } = useForm16Data(fy);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Default the FY selection to the most recent one with payroll data.
  React.useEffect(() => { if (fy === null && fys.length > 0) setFy(fys[0]); }, [fys, fy]);

  const filtered = useMemo(
    () => rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.employeeCode.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );

  const totalGross = rows.reduce((s, r) => s + r.grossSalary, 0);
  const totalTds = rows.reduce((s, r) => s + r.tdsDeducted, 0);

  const changeRegime = async (r: Form16Row, regime: TaxRegime) => {
    setBusyId(r.employeeId);
    const { error } = await updateEmployeeRegime(r.employeeId, regime);
    setBusyId(null);
    if (error) { toast.error(error); return; }
    toast.success(`${r.name} set to ${regime} regime.`);
    void reload();
  };

  const view = (r: Form16Row) => {
    if (!fy) return;
    if (!openForm16(r, employer, fy)) toast.error('Popup blocked. Please allow popups to view/download Form 16.');
    else toast.success(`Form 16 opened for ${r.name}. Use Print → Save as PDF to download.`);
  };

  const send = (r: Form16Row) => toast.success(`Form 16 for FY ${fy} sent to ${r.name}. It is now available in their Self-Service Portal.`);
  const sendAll = () => {
    if (filtered.length === 0) return;
    toast.success(`Form 16 for FY ${fy} dispatched to ${filtered.length} employee${filtered.length > 1 ? 's' : ''}. Available in their Self-Service Portals.`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-rose-100 rounded-lg"><FileText size={22} className="text-rose-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Form 16 Generator</h1>
                <p className="text-xs text-muted-foreground">Annual TDS certificate (Part B) per employee, compiled from payroll for the financial year.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={fy ?? ''} onChange={e => setFy(e.target.value)}>
                {fys.length === 0 && <option value="">No payroll data</option>}
                {fys.map(f => <option key={f} value={f}>FY {f}</option>)}
              </select>
              <button onClick={sendAll} disabled={filtered.length === 0} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium disabled:opacity-50"><Send size={16} /> Send to All</button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border shadow-sm">
            <div className="p-2.5 bg-rose-100 rounded-xl"><Building2 size={20} className="text-rose-600" /></div>
            <div className="flex-1">
              <p className="font-bold text-sm">{employer.name}</p>
              <p className="text-xs text-muted-foreground">{employer.address || 'Employer address not configured'} · TAN {employer.tan || '—'} · PAN {employer.pan || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Employees', value: rows.length, sub: `FY ${fy ?? '—'}`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Total Gross Paid', value: formatAmount(totalGross), sub: 'Across the FY', color: 'bg-green-100', iconColor: 'text-green-600', icon: IndianRupee },
              { label: 'Total TDS Deducted', value: formatAmount(totalTds), sub: 'Income tax', color: 'bg-rose-100', iconColor: 'text-rose-600', icon: Receipt },
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
                    <th className="px-4 py-3 font-semibold">PAN</th>
                    <th className="px-4 py-3 font-semibold">Regime</th>
                    <th className="px-4 py-3 font-semibold text-right">Gross</th>
                    <th className="px-4 py-3 font-semibold text-right">Taxable</th>
                    <th className="px-4 py-3 font-semibold text-right">TDS</th>
                    <th className="px-4 py-3 font-semibold text-center">Form 16</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</td></tr>}
                  {!loading && filtered.map(r => (
                    <tr key={r.employeeId} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3"><p className="text-sm font-medium">{r.name}</p><p className="text-[10px] font-mono text-muted-foreground">{r.employeeCode} · {r.monthsPaid} mo paid</p></td>
                      <td className="px-4 py-3 text-sm font-mono">{r.pan || <span className="text-amber-600 text-xs">No PAN</span>}</td>
                      <td className="px-4 py-3">
                        <select disabled={busyId === r.employeeId} value={r.regime} onChange={e => changeRegime(r, e.target.value as TaxRegime)} className="px-2 py-1 border border-border rounded-lg bg-card text-xs outline-none appearance-none disabled:opacity-50">
                          <option value="New">New</option><option value="Old">Old</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">{formatAmount(r.grossSalary)}</td>
                      <td className="px-4 py-3 text-right text-sm">{formatAmount(r.taxableIncome)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-rose-600">{formatAmount(r.tdsDeducted)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => view(r)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="View / Download"><Eye size={14} /></button>
                          <button onClick={() => view(r)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Download (Print → Save PDF)"><Download size={14} /></button>
                          <button onClick={() => send(r)} className="p-1.5 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors" title="Send to employee"><Send size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">{rows.length === 0 ? 'No payroll has been processed for this financial year yet. Run payroll to generate Form 16 data.' : 'No employees match your search.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">Form 16 figures are compiled from posted <strong>payroll entries</strong> for the year (gross, professional tax, and TDS) and the employee's tax regime. This is a Part B-style statement; TRACES Part A is obtained separately. Employees can view & download their Form 16 from the <strong>Self-Service Portal → Payslips</strong> tab.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
