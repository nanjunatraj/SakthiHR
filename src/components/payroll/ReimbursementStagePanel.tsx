import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  Plus, Search, X, Check, Ban, Lock, Trash2, RefreshCw, Receipt, FileCheck2, IndianRupee,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import { useCurrency } from '../../context/CurrencyContext';
import BulkImport, { type CsvColumn } from '../configuration/BulkImport';
import {
  REIMBURSEMENT_CATEGORIES, loadClaims, createClaim, verifyClaim, rejectClaim, closeClaim,
  deleteClaim, closeAllForPeriod, employeeIdFromCode, summarise,
  type ReimbursementClaim, type ReimbursementStatus,
} from '../../lib/reimbursements';
import type { PeriodInfo } from '../../lib/prePayroll';

const db = supabase as unknown as SupabaseClient;

interface EmpPick { id: string; code: string; name: string }

const STATUS_STYLE: Record<ReimbursementStatus, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Verified: 'bg-blue-100 text-blue-700 border-blue-200',
  Closed: 'bg-green-100 text-green-700 border-green-200',
  Paid: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-600 border-red-200',
};

interface Props {
  period: PeriodInfo;
  closed: boolean;                       // stage closed → read-only
  onPendingChange: (pending: number) => void;
}

export default function ReimbursementStagePanel({ period, closed, onPendingChange }: Props) {
  const { formatAmount } = useCurrency();
  const [claims, setClaims] = useState<ReimbursementClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState<EmpPick[]>([]);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [reject, setReject] = useState<{ id: string; reason: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!period.id) return;
    setLoading(true);
    const rows = await loadClaims(period.id);
    setClaims(rows);
    setLoading(false);
    onPendingChange(rows.filter(c => c.status === 'Pending').length);
  }, [period.id, onPendingChange]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    void db.from('employees').select('id, employee_id, first_name, middle_name, last_name').order('first_name')
      .then(({ data }) => setEmployees(((data ?? []) as Record<string, any>[]).map(e => ({
        id: e.id, code: e.employee_id ?? '', name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
      }))));
  }, []);

  const summary = useMemo(() => summarise(claims), [claims]);

  const run = async (fn: () => Promise<{ error: string | null }>, ok: string) => {
    setBusy(true); const { error } = await fn(); setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(ok); void refresh();
  };

  // ── Bulk import wiring ──
  const importColumns: CsvColumn[] = [
    { header: 'Employee ID', required: true, example: 'SMS0001', hint: 'Must match an existing Employee ID' },
    { header: 'Category', example: 'Travel', hint: REIMBURSEMENT_CATEGORIES.join(' / ') },
    { header: 'Description', example: 'Client visit cab fare' },
    { header: 'Amount', required: true, example: '1500' },
    { header: 'Has Bill', example: 'Yes', hint: 'Yes / No' },
    { header: 'Bill Reference', example: 'INV-2031' },
  ];
  const toImportRecord = (cells: Record<string, string>): Record<string, unknown> | { error: string } => {
    const amount = parseFloat(cells['Amount']);
    if (isNaN(amount) || amount <= 0) return { error: 'Amount must be a positive number.' };
    return {
      code: cells['Employee ID'], category: cells['Category'] || 'General', description: cells['Description'] || '',
      amount, has_bill: /^(yes|y|true|1)$/i.test(cells['Has Bill'] || ''), bill_reference: cells['Bill Reference'] || '',
    };
  };
  const insertImport = async (rec: Record<string, unknown>): Promise<string | null> => {
    const empId = await employeeIdFromCode(String(rec.code));
    if (!empId) return `Employee ID "${rec.code}" not found.`;
    const { error } = await createClaim({
      employeeId: empId, periodId: period.id, category: String(rec.category), description: String(rec.description),
      amount: Number(rec.amount), hasBill: Boolean(rec.has_bill), billReference: String(rec.bill_reference), raisedBy: 'hr',
    });
    return error;
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Claims', value: summary.total, icon: Receipt, color: 'text-slate-600', bg: 'bg-slate-100' },
          { label: 'Pending', value: summary.pending, icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: 'Verified', value: summary.verified, icon: FileCheck2, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Closed', value: summary.closed, icon: Check, color: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Closed Amount', value: formatAmount(summary.amountClosed), icon: IndianRupee, color: 'text-green-700', bg: 'bg-green-100' },
        ].map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${c.bg}`}><c.icon size={16} className={c.color} /></div>
            <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{c.label}</p><p className="font-bold text-sm">{c.value}</p></div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground mr-auto">
          Verify &amp; close each claim — bills optional. Claims raised by employees or by HR against an employee.
          {summary.pending > 0 && <strong className="text-amber-700"> {summary.pending} pending.</strong>}
        </p>
        {!closed && (
          <>
            <button onClick={() => setRaiseOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700"><Plus size={15} /> Raise Claim</button>
            <BulkImport title="Reimbursement Claim" columns={importColumns} toRecord={toImportRecord} insertRecord={insertImport} onDone={refresh} />
            {(summary.pending > 0 || summary.verified > 0) && (
              <button onClick={() => run(() => closeAllForPeriod(period.id).then(r => ({ error: r.error })), 'All claims verified & closed.')} disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"><Lock size={15} /> Close All</button>
            )}
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Employee</th>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 font-semibold">Description</th>
                <th className="px-3 py-2.5 font-semibold text-center">Bill</th>
                <th className="px-3 py-2.5 font-semibold">Raised By</th>
                <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
                <th className="px-3 py-2.5 font-semibold text-center">Status</th>
                <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground"><RefreshCw size={15} className="animate-spin inline mr-2" />Loading…</td></tr>}
              {!loading && claims.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No reimbursement claims for this period yet.</td></tr>}
              {!loading && claims.map(c => (
                <tr key={c.id} className="hover:bg-accent/30">
                  <td className="px-3 py-2.5"><p className="font-medium">{c.name}</p><p className="text-[10px] font-mono text-muted-foreground">{c.employeeCode}</p></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.category}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[220px] truncate" title={c.description}>{c.description || '—'}</td>
                  <td className="px-3 py-2.5 text-center">{c.hasBill ? <span className="text-[10px] font-semibold text-green-700" title={c.billReference}>Yes{c.billReference ? ` · ${c.billReference}` : ''}</span> : <span className="text-[10px] text-muted-foreground">No bill</span>}</td>
                  <td className="px-3 py-2.5"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.raisedBy === 'hr' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{c.raisedBy === 'hr' ? 'HR' : 'Employee'}</span></td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatAmount(c.amount)}</td>
                  <td className="px-3 py-2.5 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[c.status]}`}>{c.status}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {!closed && c.status === 'Pending' && <button onClick={() => run(() => verifyClaim(c.id), 'Claim verified.')} disabled={busy} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600" title="Verify"><FileCheck2 size={14} /></button>}
                      {!closed && (c.status === 'Pending' || c.status === 'Verified') && <button onClick={() => run(() => closeClaim(c.id), 'Claim closed (approved for payout).')} disabled={busy} className="p-1.5 rounded-lg hover:bg-green-100 text-green-600" title="Close (approve for payout)"><Check size={14} /></button>}
                      {!closed && (c.status === 'Pending' || c.status === 'Verified') && <button onClick={() => setReject({ id: c.id, reason: '' })} disabled={busy} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600" title="Reject"><Ban size={14} /></button>}
                      {!closed && <button onClick={() => run(() => deleteClaim(c.id), 'Claim deleted.')} disabled={busy} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete"><Trash2 size={14} /></button>}
                      {closed && <span className="text-[10px] text-muted-foreground">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {raiseOpen && <RaiseClaimModal employees={employees} period={period} onClose={() => setRaiseOpen(false)} onSaved={() => { setRaiseOpen(false); void refresh(); }} />}
        {reject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2"><Ban size={18} className="text-red-600" /><h3 className="font-bold">Reject Claim</h3></div>
              <div className="p-6 space-y-3">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Reason</label>
                <textarea className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm resize-none" rows={3} value={reject.reason} onChange={e => setReject(r => r && ({ ...r, reason: e.target.value }))} placeholder="Why is this claim rejected?" />
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-accent/10">
                <button onClick={() => setReject(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground">Cancel</button>
                <button onClick={() => { const r = reject; setReject(null); void run(() => rejectClaim(r.id, r.reason), 'Claim rejected.'); }} className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">Reject</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Raise-claim modal (HR raising a claim against an employee) ───────────────────

function RaiseClaimModal({ employees, period, onClose, onSaved }: { employees: EmpPick[]; period: PeriodInfo; onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState('');
  const [empId, setEmpId] = useState('');
  const [category, setCategory] = useState<string>('Travel');
  const [amount, setAmount] = useState('');
  const [hasBill, setHasBill] = useState(false);
  const [billRef, setBillRef] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase())).slice(0, 40);
  const inputCls = 'w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none';

  const save = async () => {
    if (!empId) { toast.error('Select an employee.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount.'); return; }
    setBusy(true);
    const { error } = await createClaim({ employeeId: empId, periodId: period.id, category, amount: amt, hasBill, billReference: billRef, description, raisedBy: 'hr' });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success('Reimbursement claim raised.');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50">
          <div className="flex items-center gap-2"><div className="p-2 bg-teal-100 rounded-xl"><Receipt size={18} className="text-teal-600" /></div><div><h2 className="text-base font-bold text-teal-900">Raise Reimbursement Claim</h2><p className="text-xs text-teal-600">Against an employee · {period.name}</p></div></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Employee</label>
            <div className="relative mb-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className={`${inputCls} pl-9`} placeholder="Search name or ID…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filtered.map(e => (
                <button key={e.id} onClick={() => setEmpId(e.id)} className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left text-sm ${empId === e.id ? 'bg-teal-50 border-teal-300' : 'bg-card border-border hover:border-teal-200'}`}>
                  <span className="font-medium">{e.name}</span><span className="ml-auto text-[10px] font-mono text-muted-foreground">{e.code}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">No employees match.</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Category</label><select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>{REIMBURSEMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Amount</label><input type="number" min={0} className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
          </div>
          <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Description</label><textarea className={`${inputCls} resize-none`} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this expense for?" /></div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={hasBill} onChange={e => setHasBill(e.target.checked)} className="rounded border-border" /> Bill attached / available</label>
            {hasBill && <input className={`${inputCls} flex-1 min-w-[180px]`} value={billRef} onChange={e => setBillRef(e.target.value)} placeholder="Bill / invoice reference" />}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-accent/10">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={busy} className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50">Raise Claim</button>
        </div>
      </motion.div>
    </div>
  );
}
