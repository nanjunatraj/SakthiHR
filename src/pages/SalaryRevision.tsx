import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { TrendingUp, Plus, X, Check, Eye, BadgeIndianRupee, Users, AlertTriangle, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import { loadPayrollPeriods, type AttPeriod } from '../lib/attendancePeriods';
import { REVISION_BASES, type RevisionBasis } from '../lib/salarySolver';
import {
  REVISION_METHODS, REVISION_SCOPES, type RevisionMethod, type RevisionScope,
  loadRevisions, loadRevision, loadRevisionItems, buildRevisionPreview, createRevision,
  approveRevision, rejectRevision, cancelRevision, applyRevision, loadRevisionArrears,
  type Revision, type RevisionItem, type RevisionPreview, type RevisionInput, type ArrearsRow,
} from '../lib/salaryRevisions';
import ReportViewModal from '../components/ReportViewModal';
import type { StatementDoc } from '../lib/exportStatement';
import Sidebar from '../components/Sidebar';

const rdb = supabase as unknown as SupabaseClient;
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const inputCls = 'w-full p-2.5 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm';

const STATUS_STYLE: Record<string, string> = {
  Proposed: 'bg-amber-100 text-amber-700 border-amber-200',
  Approved: 'bg-blue-100 text-blue-700 border-blue-200',
  Applied: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};
const basisLabel = (b: RevisionBasis) => REVISION_BASES.find(x => x.key === b)?.label ?? b;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SalaryRevision() {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [initiate, setInitiate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const refresh = async () => { setLoading(true); setRevisions(await loadRevisions()); setLoading(false); };
  useEffect(() => { void refresh(); }, []);

  const summary = useMemo(() => ({
    total: revisions.length,
    proposed: revisions.filter(r => r.status === 'Proposed').length,
    approved: revisions.filter(r => r.status === 'Approved').length,
    applied: revisions.filter(r => r.status === 'Applied').length,
  }), [revisions]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg"><TrendingUp size={22} className="text-emerald-600" /></div>
          <div>
            <h1 className="text-xl font-bold font-serif">Salary Revision</h1>
            <p className="text-xs text-muted-foreground">Propose a revision (% or amount) on CTC / Gross / Net / Take-Home, effective from a payroll period — single or bulk, with approval.</p>
          </div>
        </div>
        <button onClick={() => setInitiate(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold shadow-sm">
          <Plus size={15} /> New Revision
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[['Total', summary.total, 'text-foreground'], ['Proposed', summary.proposed, 'text-amber-600'], ['Approved', summary.approved, 'text-blue-600'], ['Applied', summary.applied, 'text-green-600']].map(([l, v, c]) => (
          <div key={l as string} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-bold">{l}</p>
            <p className={`text-2xl font-bold mt-0.5 ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 text-left font-bold">Title</th>
              <th className="px-4 py-2.5 text-left font-bold">Period</th>
              <th className="px-4 py-2.5 text-left font-bold">Revision</th>
              <th className="px-4 py-2.5 text-center font-bold">Employees</th>
              <th className="px-4 py-2.5 text-center font-bold">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && revisions.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No revisions yet. Click “New Revision” to propose one.</td></tr>}
            {revisions.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-accent/20">
                <td className="px-4 py-2.5 font-medium">{r.title}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.periodName || fmtDate(r.effectiveFrom)}</td>
                <td className="px-4 py-2.5">{basisLabel(r.basis)} · {r.method === 'Percentage' ? `${r.value}%` : fmt(r.value)}</td>
                <td className="px-4 py-2.5 text-center">{r.itemCount}</td>
                <td className="px-4 py-2.5 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[r.status]}`}>{r.status}</span></td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setDetailId(r.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-emerald-600"><Eye size={13} /> Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {initiate && <NewRevisionModal onClose={() => setInitiate(false)} onCreated={() => { setInitiate(false); void refresh(); }} />}
      {detailId && <RevisionDetailModal id={detailId} onClose={() => { setDetailId(null); void refresh(); }} />}
      </div>
      </main>
    </div>
  );
}

// ─── New Revision ────────────────────────────────────────────────────────────────

interface Opt { id: string; name: string }

function NewRevisionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [periods, setPeriods] = useState<AttPeriod[]>([]);
  const [title, setTitle] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [basis, setBasis] = useState<RevisionBasis>('CTC');
  const [method, setMethod] = useState<RevisionMethod>('Percentage');
  const [value, setValue] = useState('10');
  const [scope, setScope] = useState<RevisionScope>('all');
  const [scopeOptId, setScopeOptId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [employees, setEmployees] = useState<Opt[]>([]);
  const [preview, setPreview] = useState<RevisionPreview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => setPeriods(await loadPayrollPeriods()))(); }, []);

  // Load the option list for the chosen scope dimension.
  useEffect(() => {
    void (async () => {
      const table = scope === 'location' ? 'work_locations' : scope === 'department' ? 'departments' : scope === 'designation' ? 'designations' : scope === 'category' ? 'employee_categories' : null;
      if (!table) { setOpts([]); return; }
      const { data } = await rdb.from(table).select('id, name').order('name');
      setOpts(((data ?? []) as Array<Record<string, any>>).map(r => ({ id: r.id, name: r.name ?? '' })));
      setScopeOptId('');
    })();
  }, [scope]);

  useEffect(() => {
    if (scope !== 'selected') return;
    void (async () => {
      const { data } = await rdb.from('employees').select('id, employee_id, first_name, middle_name, last_name').eq('status', 'Active').order('employee_id');
      setEmployees(((data ?? []) as Array<Record<string, any>>).map(e => ({ id: e.id, name: `${e.employee_id} · ${[e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ')}` })));
    })();
  }, [scope]);

  const buildInput = (): RevisionInput => ({
    title, basis, method, value: Number(value) || 0, payrollPeriodId: periodId, scope,
    scopeRef: scope === 'all' ? null : scope === 'selected' ? { ids: selectedIds } : { id: scopeOptId, label: opts.find(o => o.id === scopeOptId)?.name },
    proposedBy: 'HR',
  });

  const canPreview = periodId && (scope === 'all' || (scope === 'selected' ? selectedIds.length > 0 : scopeOptId));

  const doPreview = async () => {
    if (!canPreview) { toast.error('Pick a payroll period and scope.'); return; }
    setBusy(true);
    try { setPreview(await buildRevisionPreview(buildInput())); }
    finally { setBusy(false); }
  };

  const doCreate = async () => {
    setBusy(true);
    try {
      const { error, itemCount } = await createRevision(buildInput());
      if (error) { toast.error(error); return; }
      toast.success(`Revision proposed for ${itemCount} employee(s).`);
      onCreated();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2"><div className="p-2 bg-emerald-100 rounded-xl"><BadgeIndianRupee size={18} className="text-emerald-600" /></div><h2 className="text-base font-bold text-emerald-900">New Salary Revision</h2></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase">Title</label>
              <input className={inputCls} placeholder="e.g. Annual Increment FY26-27" value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase">Effective from Payroll Period</label>
              <select className={inputCls} value={periodId} onChange={e => { setPeriodId(e.target.value); setPreview(null); }}>
                <option value="">Select period…</option>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase">Basis</label>
              <select className={inputCls} value={basis} onChange={e => { setBasis(e.target.value as RevisionBasis); setPreview(null); }}>
                {REVISION_BASES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">{REVISION_BASES.find(b => b.key === basis)?.hint}</p></div>
            <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase">Method</label>
              <select className={inputCls} value={method} onChange={e => { setMethod(e.target.value as RevisionMethod); setPreview(null); }}>
                {REVISION_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select></div>
            <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase">{method === 'Percentage' ? 'Percentage (%)' : 'Amount (₹)'}</label>
              <input type="number" className={inputCls} value={value} onChange={e => { setValue(e.target.value); setPreview(null); }} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase">Apply to</label>
              <select className={inputCls} value={scope} onChange={e => { setScope(e.target.value as RevisionScope); setPreview(null); }}>
                {REVISION_SCOPES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select></div>
            {scope !== 'all' && scope !== 'selected' && (
              <div><label className="block text-[11px] font-bold mb-1 text-muted-foreground uppercase">Choose</label>
                <select className={inputCls} value={scopeOptId} onChange={e => { setScopeOptId(e.target.value); setPreview(null); }}>
                  <option value="">Select…</option>
                  {opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select></div>
            )}
          </div>

          {scope === 'selected' && (
            <div className="border border-border rounded-lg p-2 max-h-40 overflow-y-auto">
              {employees.map(e => (
                <label key={e.id} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-accent/30 rounded cursor-pointer">
                  <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={ev => { setSelectedIds(p => ev.target.checked ? [...p, e.id] : p.filter(x => x !== e.id)); setPreview(null); }} />
                  {e.name}
                </label>
              ))}
              {employees.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">No active employees.</p>}
            </div>
          )}

          {preview && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-accent/30 text-xs font-bold flex items-center gap-2"><Users size={13} /> Preview · {preview.items.length} employee(s) · effective {fmtDate(preview.effectiveFrom)}</div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-accent/20 text-muted-foreground"><tr>
                    <th className="px-2 py-1.5 text-left">Employee</th>
                    <th className="px-2 py-1.5 text-right">Old {basisLabel(basis)}</th>
                    <th className="px-2 py-1.5 text-right">New {basisLabel(basis)}</th>
                    <th className="px-2 py-1.5 text-right">New CTC/mo</th>
                    <th className="px-2 py-1.5 text-right">New Take-Home</th>
                  </tr></thead>
                  <tbody>
                    {preview.items.map(it => (
                      <tr key={it.employeeId} className="border-t border-border">
                        <td className="px-2 py-1.5">{it.employeeCode} · {it.employeeName}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(it.oldBasis)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-emerald-700">{fmt(it.newBasis)}{it.clamped && <AlertTriangle size={11} className="inline ml-1 text-amber-500" />}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(it.newCtcMonthly)}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(it.newTakehome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.skipped.length > 0 && <div className="px-3 py-2 text-[11px] text-amber-600 border-t border-border">Skipped: {preview.skipped.join('; ')}</div>}
              {preview.items.some(i => i.clamped) && <div className="px-3 py-1.5 text-[11px] text-amber-600 border-t border-border flex items-center gap-1"><AlertTriangle size={11} /> Some targets couldn't be reached exactly (fixed-amount components don't scale).</div>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-5 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
          <button onClick={doPreview} disabled={busy || !canPreview} className="px-5 py-2 border border-emerald-300 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50">Preview</button>
          <button onClick={doCreate} disabled={busy || !preview || preview.items.length === 0} className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50">Propose Revision</button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────────

function RevisionDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [rev, setRev] = useState<Revision | null>(null);
  const [items, setItems] = useState<RevisionItem[]>([]);
  const [arrears, setArrears] = useState<ArrearsRow[]>([]);
  const [periods, setPeriods] = useState<AttPeriod[]>([]);
  const [payoutPeriodId, setPayoutPeriodId] = useState('');
  const [busy, setBusy] = useState(false);
  const [approver, setApprover] = useState('');
  const [printDoc, setPrintDoc] = useState<StatementDoc | null>(null);

  const reload = async () => { setRev(await loadRevision(id)); setItems(await loadRevisionItems(id)); setArrears(await loadRevisionArrears(id)); };
  useEffect(() => { void reload(); }, [id]);
  useEffect(() => { void (async () => setPeriods(await loadPayrollPeriods()))(); }, []);

  const act = async (fn: () => Promise<{ error: string | null }>, ok: string) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) toast.error(error); else { toast.success(ok); await reload(); } }
    finally { setBusy(false); }
  };

  const buildDoc = (): StatementDoc => ({
    title: rev?.title || 'Salary Revision',
    subtitle: rev ? `${basisLabel(rev.basis)} · ${rev.method === 'Percentage' ? `${rev.value}%` : fmt(rev.value)} · effective ${fmtDate(rev.effectiveFrom)} · ${rev.status}` : '',
    columns: [
      { key: 'code', label: 'Emp ID' }, { key: 'name', label: 'Employee' },
      { key: 'oldctc', label: 'Old CTC/mo', align: 'right', isAmount: true }, { key: 'newctc', label: 'New CTC/mo', align: 'right', isAmount: true },
      { key: 'oldth', label: 'Old Take-Home', align: 'right', isAmount: true }, { key: 'newth', label: 'New Take-Home', align: 'right', isAmount: true },
    ],
    rows: items.map(it => ({ code: it.employeeCode, name: it.employeeName, oldctc: Math.round(it.oldCtcMonthly), newctc: Math.round(it.newCtcMonthly), oldth: Math.round(it.oldTakehome), newth: Math.round(it.newTakehome) })),
    note: 'Computer-generated salary revision statement',
  });

  const buildArrearsDoc = (): StatementDoc => ({
    title: 'Salary Revision Arrears Statement',
    subtitle: rev ? `${rev.title} · effective ${fmtDate(rev.effectiveFrom)} · ${arrears.length} period-line(s)` : '',
    columns: [
      { key: 'code', label: 'Emp ID' }, { key: 'name', label: 'Employee' }, { key: 'period', label: 'Period' },
      { key: 'paid', label: 'Paid Gross', align: 'right', isAmount: true },
      { key: 'revised', label: 'Revised Gross', align: 'right', isAmount: true },
      { key: 'arr', label: 'Arrears', align: 'right', isAmount: true },
      { key: 'status', label: 'Status', align: 'center' },
    ],
    rows: arrears.map(a => ({ code: a.employeeCode, name: a.employeeName, period: a.periodName, paid: Math.round(a.paidGross), revised: Math.round(a.revisedGross), arr: Math.round(a.arrearsAmount), status: a.status })),
    totals: { name: 'Total Arrears', arr: Math.round(arrears.reduce((s, a) => s + a.arrearsAmount, 0)) },
    note: 'Period-wise arrears from the revision month to the payout period',
  });

  if (!rev) return null;
  const isProposed = rev.status === 'Proposed';
  const isApproved = rev.status === 'Approved';
  const isApplied = rev.status === 'Applied';
  const arrearsTotal = arrears.reduce((s, a) => s + a.arrearsAmount, 0);
  const openPeriods = periods.filter(p => p.status !== 'Locked');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2"><div className="p-2 bg-emerald-100 rounded-xl"><TrendingUp size={18} className="text-emerald-600" /></div>
            <div><h2 className="text-base font-bold text-emerald-900">{rev.title}</h2>
              <p className="text-xs text-emerald-600">{basisLabel(rev.basis)} · {rev.method === 'Percentage' ? `${rev.value}%` : fmt(rev.value)} · effective {fmtDate(rev.effectiveFrom)} · <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[rev.status]}`}>{rev.status}</span></p></div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[46vh]">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground"><tr>
                  <th className="px-2 py-1.5 text-left">Employee</th>
                  <th className="px-2 py-1.5 text-right">Old CTC</th><th className="px-2 py-1.5 text-right">New CTC</th>
                  <th className="px-2 py-1.5 text-right">Old Gross</th><th className="px-2 py-1.5 text-right">New Gross</th>
                  <th className="px-2 py-1.5 text-right">Old Take-Home</th><th className="px-2 py-1.5 text-right">New Take-Home</th>
                  <th className="px-2 py-1.5 text-center">Item</th>
                </tr></thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className="border-t border-border">
                      <td className="px-2 py-1.5">{it.employeeCode} · {it.employeeName}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(it.oldCtcMonthly)}</td><td className="px-2 py-1.5 text-right font-semibold">{fmt(it.newCtcMonthly)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(it.oldGross)}</td><td className="px-2 py-1.5 text-right">{fmt(it.newGross)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(it.oldTakehome)}</td><td className="px-2 py-1.5 text-right font-semibold text-emerald-700">{fmt(it.newTakehome)}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${it.status === 'Applied' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{it.status}</span></td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={8} className="px-2 py-8 text-center text-muted-foreground">No items.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {isProposed && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-blue-800">Approval:</span>
              <input className="p-2 bg-white border border-border rounded-lg text-sm flex-1 min-w-[140px]" placeholder="Approver name" value={approver} onChange={e => setApprover(e.target.value)} />
              <button onClick={() => act(() => approveRevision(rev.id, approver), 'Revision approved.')} disabled={busy} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">Approve</button>
              <button onClick={() => act(() => rejectRevision(rev.id, 'Rejected by HR'), 'Revision rejected.')} disabled={busy} className="px-4 py-2 border border-rose-300 text-rose-700 text-sm font-semibold rounded-lg hover:bg-rose-50 disabled:opacity-50">Reject</button>
            </div>
          )}
          {isApproved && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <p className="text-xs text-emerald-800">Approved by <strong>{rev.approvedBy}</strong>. Applying supersedes each employee's salary assignment from {fmtDate(rev.effectiveFrom)} (prior kept as history), and computes back-period arrears into the chosen pay period.</p>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[11px] font-semibold text-emerald-700">Pay arrears in:</label>
                <select className="p-2 bg-white border border-border rounded-lg text-sm" value={payoutPeriodId} onChange={e => setPayoutPeriodId(e.target.value)}>
                  <option value="">Select payout period (optional)…</option>
                  {openPeriods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={() => act(async () => { const r = await applyRevision(rev.id, payoutPeriodId || undefined); if (!r.error && r.arrears) toast.info(`Arrears: ${r.arrears.count} period-line(s), total ${fmt(r.arrears.total)} → added to the payout run.`); return { error: r.error }; }, 'Revision applied — salaries updated.')} disabled={busy} className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"><Check size={15} /> Apply Revision</button>
              </div>
            </div>
          )}
          {isApplied && arrears.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <span className="text-xs font-semibold text-amber-800">Arrears — {arrears.length} period-line(s) · total {fmt(arrearsTotal)} {arrears.every(a => a.status === 'Paid') ? '(Paid)' : '(Pending in payout run)'}</span>
                <button onClick={() => setPrintDoc(buildArrearsDoc())} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100"><Printer size={13} /> Arrears Statement</button>
              </div>
              <div className="overflow-x-auto max-h-40 border border-amber-200 rounded-lg bg-white">
                <table className="w-full text-[11px]">
                  <thead className="bg-amber-100/60 text-amber-800"><tr><th className="px-2 py-1 text-left">Employee</th><th className="px-2 py-1 text-left">Period</th><th className="px-2 py-1 text-right">Paid</th><th className="px-2 py-1 text-right">Revised</th><th className="px-2 py-1 text-right">Arrears</th><th className="px-2 py-1 text-center">Status</th></tr></thead>
                  <tbody>{arrears.map(a => (
                    <tr key={a.id} className="border-t border-amber-100"><td className="px-2 py-1">{a.employeeCode} · {a.employeeName}</td><td className="px-2 py-1">{a.periodName}</td><td className="px-2 py-1 text-right">{fmt(a.paidGross)}</td><td className="px-2 py-1 text-right">{fmt(a.revisedGross)}</td><td className="px-2 py-1 text-right font-semibold text-amber-700">{fmt(a.arrearsAmount)}</td><td className="px-2 py-1 text-center">{a.status}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-border">
          <div>{(isProposed || isApproved) && <button onClick={() => act(() => cancelRevision(rev.id), 'Revision cancelled.')} disabled={busy} className="px-4 py-2 text-xs text-muted-foreground hover:text-rose-600">Cancel revision</button>}</div>
          <button onClick={() => setPrintDoc(buildDoc())} className="inline-flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent"><Printer size={15} /> View / Print</button>
        </div>
      </div>
      {printDoc && <ReportViewModal doc={printDoc} onClose={() => setPrintDoc(null)} />}
    </div>
  );
}
