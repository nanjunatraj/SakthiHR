import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Mail, RefreshCw, MailCheck, Eye, CheckCircle2, MailX, Clock, Search, ChevronDown, ChevronRight, Users, Layers } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../supabase/client';
import { loadEmailDeliveries, subscribeEmailDeliveries, emailCategoryMeta, type EmailDelivery, type EmailStatus } from '../lib/email';

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

export default function EmailCommunications() {
  const [rows, setRows] = useState<EmailDelivery[]>([]);
  const [empMap, setEmpMap] = useState<Map<string, { name: string; code: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'employee' | 'module'>('employee');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [deliveries, emps] = await Promise.all([
      loadEmailDeliveries({ limit: 1000 }),
      db.from('employees').select('id, employee_id, first_name, middle_name, last_name'),
    ]);
    const m = new Map<string, { name: string; code: string }>();
    ((emps.data ?? []) as Record<string, string>[]).forEach(e => m.set(e.id, {
      name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '), code: e.employee_id ?? '',
    }));
    setEmpMap(m); setRows(deliveries); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeEmailDeliveries(() => { void load(); }), [load]);

  // Module (category) filter options, built from the slugs actually present, shown as
  // friendly module labels (Payslip, Offer Letter, Fines…) and sorted by label.
  const catOptions = useMemo(() => {
    const slugs = [...new Set(rows.map(r => r.category).filter(Boolean))];
    return slugs
      .map(slug => ({ slug, label: emailCategoryMeta(slug).label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (cat && r.category !== cat) return false;
    if (status && r.status !== status) return false;
    if (search) {
      const e = r.employeeId ? empMap.get(r.employeeId) : undefined;
      const hay = `${r.toEmail ?? ''} ${r.documentTitle ?? ''} ${e?.name ?? ''} ${e?.code ?? ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [rows, cat, status, search, empMap]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(r => { c[r.status as EmailStatus] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  // Build collapsible groups for the current grouping dimension. Each group carries
  // its own little tally (total / sent / failed) for the section header.
  const groups = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, { key: string; label: string; sublabel?: string; color?: string; rows: EmailDelivery[] }>();
    filtered.forEach(r => {
      let key: string, label: string, sublabel: string | undefined, color: string | undefined;
      if (groupBy === 'employee') {
        const e = r.employeeId ? empMap.get(r.employeeId) : undefined;
        key = r.employeeId ?? '__none__';
        label = e?.name || 'Unassigned';
        sublabel = e?.code || undefined;
      } else {
        const meta = emailCategoryMeta(r.category);
        key = r.category ?? '';
        label = meta.label;
        color = meta.color;
      }
      let g = map.get(key);
      if (!g) { g = { key, label, sublabel, color, rows: [] }; map.set(key, g); }
      g.rows.push(r);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy, empMap]);

  const tally = (gr: EmailDelivery[]) => ({
    total: gr.length,
    sent: gr.filter(r => ['Sent', 'Opened', 'Viewed', 'Confirmed'].includes(r.status)).length,
    failed: gr.filter(r => ['Failed', 'Bounced'].includes(r.status)).length,
  });

  const renderRow = (r: EmailDelivery) => {
    const e = r.employeeId ? empMap.get(r.employeeId) : undefined;
    const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.Queued;
    const Icon = st.icon;
    return (
      <tr key={r.id} className="hover:bg-accent/20">
        <td className="px-3 py-2.5">{e ? <div><div className="font-semibold">{e.name}</div><div className="text-[10px] font-mono text-muted-foreground">{e.code}</div></div> : <span className="text-muted-foreground">—</span>}</td>
        <td className="px-3 py-2.5"><span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ${emailCategoryMeta(r.category).color}`}>{emailCategoryMeta(r.category).label}</span></td>
        <td className="px-3 py-2.5">{r.documentTitle ?? '—'}</td>
        <td className="px-3 py-2.5 font-mono text-[11px]">{r.toEmail ?? '—'}</td>
        <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${st.bg} ${st.text}`}><Icon size={11} /> {st.label}</span>{r.error ? <div className="text-[10px] text-red-600 mt-0.5">{r.error}</div> : null}</td>
        <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.sentAt)}</td>
        <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.openedAt)}</td>
        <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.docOpenedAt)}</td>
        <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.confirmedAt)}</td>
      </tr>
    );
  };

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
              <h1 className="text-xl font-bold">Email Communications</h1>
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
              <option value="">All modules</option>
              {catOptions.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card">
              <option value="">All statuses</option>
              {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}
            </select>
            <div className="inline-flex items-center rounded-lg border border-border overflow-hidden text-sm bg-card">
              <span className="px-2.5 py-2 text-muted-foreground text-xs font-semibold border-r border-border">Group by</span>
              <button onClick={() => setGroupBy('employee')} className={`inline-flex items-center gap-1 px-3 py-2 font-medium ${groupBy === 'employee' ? 'bg-blue-600 text-white' : 'hover:bg-accent'}`}><Users size={13} /> Employee</button>
              <button onClick={() => setGroupBy('module')} className={`inline-flex items-center gap-1 px-3 py-2 font-medium border-l border-border ${groupBy === 'module' ? 'bg-blue-600 text-white' : 'hover:bg-accent'}`}><Layers size={13} /> Module</button>
              <button onClick={() => setGroupBy('none')} className={`px-3 py-2 font-medium border-l border-border ${groupBy === 'none' ? 'bg-blue-600 text-white' : 'hover:bg-accent'}`}>None</button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-accent/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-left">Module</th>
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
                  ) : groups ? (
                    groups.map(g => {
                      const t = tally(g.rows);
                      const open = !collapsed.has(g.key);
                      return (
                        <Fragment key={g.key}>
                          <tr className="bg-accent/40 cursor-pointer select-none hover:bg-accent/60" onClick={() => toggleGroup(g.key)}>
                            <td colSpan={9} className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {open ? <ChevronDown size={15} className="text-muted-foreground" /> : <ChevronRight size={15} className="text-muted-foreground" />}
                                {groupBy === 'module'
                                  ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${g.color}`}>{g.label}</span>
                                  : <span className="font-bold text-sm">{g.label}</span>}
                                {g.sublabel ? <span className="text-[11px] font-mono text-muted-foreground">{g.sublabel}</span> : null}
                                <span className="ml-auto flex items-center gap-3 text-[11px] font-semibold">
                                  <span className="text-muted-foreground">{t.total} email{t.total !== 1 ? 's' : ''}</span>
                                  <span className="text-green-600">{t.sent} sent</span>
                                  {t.failed > 0 ? <span className="text-red-600">{t.failed} failed</span> : null}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {open ? g.rows.map(renderRow) : null}
                        </Fragment>
                      );
                    })
                  ) : filtered.map(renderRow)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
