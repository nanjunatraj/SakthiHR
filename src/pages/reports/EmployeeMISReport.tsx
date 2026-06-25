import { formatDate } from '../../utils/date';
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, PieChart, Users, UserCheck, UserMinus, UserPlus, RefreshCw,
  Building2, Briefcase, MapPin, Layers, Users2, Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ComponentType } from 'react';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../supabase/client';

const db = supabase as unknown as SupabaseClient;

const MIS_SELECT =
  'id, employee_id, first_name, middle_name, last_name, gender, status, date_of_joining, relieving_date, ' +
  'designation:designations(name), department:departments(name), work_location:work_locations(name), employee_type:employee_types(name)';

interface MisRow { [key: string]: any; }

const fullName = (r: MisRow) => [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ');

// Count occurrences of a string dimension, '(Unassigned)' for blanks, sorted desc.
function distribution(rows: MisRow[], pick: (r: MisRow) => string | null | undefined) {
  const m = new Map<string, number>();
  rows.forEach(r => { const k = (pick(r) || '(Unassigned)').toString(); m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

const PALETTE = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-fuchsia-500'];

function DistCard({ icon: Icon, title, data, total }: {
  icon: ComponentType<{ size?: number; className?: string }>; title: string;
  data: { label: string; count: number }[]; total: number;
}) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-accent/30">
        <div className="flex items-center gap-2"><Icon size={16} className="text-primary" /><h3 className="font-bold text-sm">{title}</h3></div>
        <span className="text-[11px] text-muted-foreground">{data.length} {data.length === 1 ? 'group' : 'groups'}</span>
      </div>
      <div className="p-4 space-y-2.5 max-h-[320px] overflow-y-auto">
        {data.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : data.map((d, i) => (
          <div key={d.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="truncate pr-2 font-medium">{d.label}</span>
              <span className="text-muted-foreground shrink-0">{d.count} · {total ? Math.round((d.count / total) * 100) : 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-accent overflow-hidden">
              <div className={`h-full rounded-full ${PALETTE[i % PALETTE.length]}`} style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EmployeeMISReport() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MisRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from('employees').select(MIS_SELECT).order('date_of_joining', { ascending: false });
    if (error) { console.warn('[employee-mis] load failed:', error.message); setRows([]); }
    else setRows((data ?? []) as MisRow[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const exited = rows.filter(r => !!r.relieving_date).length;
    const active = total - exited;
    const year = new Date().getFullYear();
    const joinersYtd = rows.filter(r => r.date_of_joining && new Date(r.date_of_joining).getFullYear() === year).length;
    const exitsYtd = rows.filter(r => r.relieving_date && new Date(r.relieving_date).getFullYear() === year).length;
    return { total, active, exited, joinersYtd, exitsYtd };
  }, [rows]);

  const byDept = useMemo(() => distribution(rows, r => r.department?.name), [rows]);
  const byDesig = useMemo(() => distribution(rows, r => r.designation?.name), [rows]);
  const byLoc = useMemo(() => distribution(rows, r => r.work_location?.name), [rows]);
  const byType = useMemo(() => distribution(rows, r => r.employee_type?.name), [rows]);
  const byGender = useMemo(() => distribution(rows, r => r.gender), [rows]);
  const byStatus = useMemo(() => distribution(rows, r => r.status), [rows]);

  const recentJoiners = useMemo(
    () => rows.filter(r => r.date_of_joining).slice(0, 6),
    [rows]);

  const year = new Date().getFullYear();
  const kpis: { icon: ComponentType<{ size?: number; className?: string }>; label: string; value: number; color: string; bg: string }[] = [
    { icon: Users, label: 'Total Employees', value: stats.total, color: 'text-blue-600', bg: 'bg-blue-100' },
    { icon: UserCheck, label: 'Active', value: stats.active, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { icon: UserMinus, label: 'Exited', value: stats.exited, color: 'text-rose-600', bg: 'bg-rose-100' },
    { icon: UserPlus, label: `Joiners (${year})`, value: stats.joinersYtd, color: 'text-violet-600', bg: 'bg-violet-100' },
    { icon: Activity, label: `Exits (${year})`, value: stats.exitsYtd, color: 'text-amber-600', bg: 'bg-amber-100' },
  ];

  const fmtDate = (s?: string | null) => formatDate(s);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/employee')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-blue-100 rounded-lg"><PieChart size={22} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold">MIS Reports</h1>
                <p className="text-xs text-muted-foreground">Headcount distribution by department, designation, location, type & gender — with joiners and exits.</p>
              </div>
            </div>
            <button onClick={() => void load()} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-accent">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {kpis.map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${k.bg}`}><Icon size={20} className={k.color} /></div>
                  <div>
                    <div className={`text-2xl font-bold ${k.color}`}>{loading ? '…' : k.value}</div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{k.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Distributions */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <DistCard icon={Building2} title="By Department" data={byDept} total={stats.total} />
            <DistCard icon={Briefcase} title="By Designation" data={byDesig} total={stats.total} />
            <DistCard icon={MapPin} title="By Work Location" data={byLoc} total={stats.total} />
            <DistCard icon={Layers} title="By Employee Type" data={byType} total={stats.total} />
            <DistCard icon={Users2} title="By Gender" data={byGender} total={stats.total} />
            <DistCard icon={Activity} title="By Status" data={byStatus} total={stats.total} />
          </div>

          {/* Recent joiners */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-accent/30">
              <UserPlus size={16} className="text-primary" /><h3 className="font-bold text-sm">Recent Joiners</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-accent/20 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Employee</th>
                    <th className="px-5 py-2.5 text-left">Designation</th>
                    <th className="px-5 py-2.5 text-left">Department</th>
                    <th className="px-5 py-2.5 text-left">Location</th>
                    <th className="px-5 py-2.5 text-left">Date of Joining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Loading…</td></tr>
                  ) : recentJoiners.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No employees found.</td></tr>
                  ) : recentJoiners.map(r => (
                    <tr key={r.id} className="hover:bg-accent/20">
                      <td className="px-5 py-2.5"><div className="font-semibold">{fullName(r)}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employee_id || '—'}</div></td>
                      <td className="px-5 py-2.5">{r.designation?.name || '—'}</td>
                      <td className="px-5 py-2.5">{r.department?.name || '—'}</td>
                      <td className="px-5 py-2.5">{r.work_location?.name || '—'}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{fmtDate(r.date_of_joining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
