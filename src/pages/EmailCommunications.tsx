import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Mail, RefreshCw, MailCheck, Eye, CheckCircle2, MailX, Clock, Search } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../supabase/client';
import { loadEmailDeliveries, subscribeEmailDeliveries, type EmailDelivery, type EmailStatus } from '../lib/email';

const db = supabase as unknown as SupabaseClient;

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  Queued: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Clock, label: 'Queued' },
  Sent: { bg: 'bg-green-100', text: 'text-green-700', icon: MailCheck, label: 'Sent' },
  Opened: { bg: 'bg-sky-100', text: 'text-sky-700', icon: MailCheck, label: 'Opened' },
  Viewed: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: Eye, label: 'Attachment Viewed' },
  Confirmed: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, label: 'Receipt Confirmed' },
  Simulated: { bg: 'bg-violet-100', text: 'text-violet-700', icon: MailCheck, label: 'Simulated' },
  Failed: { bg: 'bg-red-100', text: 'text-red-700', icon: MailX, label: 'Failed' },
  Bounced: { bg: 'bg-amber-100', text: 'text-amber-700', icon: MailX, label: 'Bounced' },
  'No Email': { bg: 'bg-gray-100', text: 'text-gray-500', icon: MailX, label: 'No Email' },
};

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const CATS = ['payslip', 'letter', 'report', 'notification', 'general'];

export default function EmailCommunications() {
  const [rows, setRows] = useState<EmailDelivery[]>([]);
  const [empMap, setEmpMap] = useState<Map<string, { name: string; code: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [deliveries, emps] = await Promise.all([
      loadEmailDeliveries({ category: cat || undefined, limit: 1000 }),
      db.from('employees').select('id, employee_id, first_name, middle_name, last_name'),
    ]);
    const m = new Map<string, { name: string; code: string }>();
    ((emps.data ?? []) as Record<string, string>[]).forEach(e => m.set(e.id, {
      name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '), code: e.employee_id ?? '',
    }));
    setEmpMap(m); setRows(deliveries); setLoading(false);
  }, [cat]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeEmailDeliveries(() => { void load(); }), [load]);

  const filtered = useMemo(() => rows.filter(r => {
    if (status && r.status !== status) return false;
    if (search) {
      const e = r.employeeId ? empMap.get(r.employeeId) : undefined;
      const hay = `${r.toEmail ?? ''} ${r.documentTitle ?? ''} ${e?.name ?? ''} ${e?.code ?? ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [rows, status, search, empMap]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(r => { c[r.status as EmailStatus] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const Summary = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Mail size={22} className="text-blue-600" /></div>
            <div>
              <h1 className="text-xl font-bold font-serif">Email Communications</h1>
              <p className="text-xs text-muted-foreground">Per-employee, per-document delivery status — sent, opened, attachment viewed, receipt confirmed.</p>
            </div>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-accent"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>

        <div className="p-8 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Summary label="Total" value={rows.length} color="text-foreground" />
            <Summary label="Sent" value={counts.Sent ?? 0} color="text-green-600" />
            <Summary label="Opened" value={counts.Opened ?? 0} color="text-sky-600" />
            <Summary label="Viewed" value={counts.Viewed ?? 0} color="text-indigo-600" />
            <Summary label="Confirmed" value={counts.Confirmed ?? 0} color="text-emerald-600" />
            <Summary label="Failed" value={(counts.Failed ?? 0) + (counts.Bounced ?? 0)} color="text-red-600" />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee, email, document…" className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card" />
            </div>
            <select value={cat} onChange={e => setCat(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card">
              <option value="">All categories</option>
              {CATS.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card">
              <option value="">All statuses</option>
              {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}
            </select>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-left">Category</th>
                    <th className="px-3 py-2.5 text-left">Document</th>
                    <th className="px-3 py-2.5 text-left">To</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5 text-left">Sent</th>
                    <th className="px-3 py-2.5 text-left">Opened</th>
                    <th className="px-3 py-2.5 text-left">Viewed</th>
                    <th className="px-3 py-2.5 text-left">Confirmed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">{loading ? 'Loading…' : 'No emails yet. Send a payslip, letter or report to get started.'}</td></tr>
                  ) : filtered.map(r => {
                    const e = r.employeeId ? empMap.get(r.employeeId) : undefined;
                    const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.Queued;
                    const Icon = st.icon;
                    return (
                      <tr key={r.id} className="hover:bg-accent/20">
                        <td className="px-3 py-2.5">{e ? <div><div className="font-semibold">{e.name}</div><div className="text-[10px] font-mono text-muted-foreground">{e.code}</div></div> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2.5 capitalize">{r.category}</td>
                        <td className="px-3 py-2.5">{r.documentTitle ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">{r.toEmail ?? '—'}</td>
                        <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${st.bg} ${st.text}`}><Icon size={11} /> {st.label}</span>{r.error ? <div className="text-[10px] text-red-600 mt-0.5">{r.error}</div> : null}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.sentAt)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.openedAt)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.docOpenedAt)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.confirmedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
