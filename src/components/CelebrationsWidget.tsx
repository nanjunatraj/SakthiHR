import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { toast } from 'react-toastify';
import { Cake, Heart, Gift, Send, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { sendWhatsApp } from '../lib/credentials';

const cdb = supabase as unknown as SupabaseClient;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface CelebEmployee {
  id: string;
  name: string;
  department: string;
  mobile: string | null;
  dob: string | null;
  anniversary: string | null;
  avatar: string;
}

interface CelebEvent {
  empId: string;
  name: string;
  department: string;
  mobile: string | null;
  avatar: string;
  type: 'birthday' | 'anniversary';
  day: number;          // day of month
  years: number | null; // anniversary years (if computable)
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

export default function CelebrationsWidget() {
  const [employees, setEmployees] = useState<CelebEmployee[]>([]);
  const [company, setCompany] = useState('our organization');
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  // Month being viewed (defaults to the current month).
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    let active = true;
    void (async () => {
      const [{ data: emps }, { data: est }] = await Promise.all([
        cdb.from('employees').select('id, first_name, middle_name, last_name, date_of_birth, anniversary_date, mobile_number, status, department:departments(name)'),
        cdb.from('establishment').select('name').limit(1).maybeSingle(),
      ]);
      if (!active) return;
      const rows = ((emps ?? []) as Record<string, any>[])
        .filter(e => (e.status ?? 'Active') === 'Active')
        .map(e => {
          const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ');
          return {
            id: e.id, name, department: e.department?.name ?? '—', mobile: e.mobile_number ?? null,
            dob: e.date_of_birth ?? null, anniversary: e.anniversary_date ?? null,
            avatar: name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
          } as CelebEmployee;
        });
      setEmployees(rows);
      if ((est as any)?.name) setCompany((est as any).name);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // Events falling in the viewed month.
  const events = useMemo(() => {
    const out: CelebEvent[] = [];
    const parse = (d: string) => { const dt = new Date(d + 'T00:00:00'); return isNaN(dt.getTime()) ? null : dt; };
    employees.forEach(e => {
      if (e.dob) { const d = parse(e.dob); if (d && d.getMonth() === view.m) out.push({ empId: e.id, name: e.name, department: e.department, mobile: e.mobile, avatar: e.avatar, type: 'birthday', day: d.getDate(), years: null }); }
      if (e.anniversary) { const d = parse(e.anniversary); if (d && d.getMonth() === view.m) out.push({ empId: e.id, name: e.name, department: e.department, mobile: e.mobile, avatar: e.avatar, type: 'anniversary', day: d.getDate(), years: view.y - d.getFullYear() > 0 ? view.y - d.getFullYear() : null }); }
    });
    return out.sort((a, b) => a.day - b.day);
  }, [employees, view]);

  const eventsByDay = useMemo(() => {
    const m = new Map<number, CelebEvent[]>();
    events.forEach(ev => { const a = m.get(ev.day) ?? []; a.push(ev); m.set(ev.day, a); });
    return m;
  }, [events]);

  const today = new Date();
  const isCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();
  const todayDate = today.getDate();

  // Calendar grid for the viewed month.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [view]);

  const shiftMonth = (dir: number) => setView(v => {
    const d = new Date(v.y, v.m + dir, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const sendWishes = async (ev: CelebEvent) => {
    const key = `${ev.empId}-${ev.type}`;
    setSending(key);
    const msg = ev.type === 'birthday'
      ? `🎂 Dear ${ev.name}, wishing you a very Happy Birthday! 🎉 May the year ahead bring you joy, good health, and success. Warm wishes from all of us at ${company}.`
      : `💐 Dear ${ev.name}, warm wishes on your${ev.years ? ` ${ordinal(ev.years)}` : ''} Wedding Anniversary! 🎉 Wishing you and your family love and happiness. Best regards from all of us at ${company}.`;
    const { error } = await sendWhatsApp({ employeeId: ev.empId, phone: ev.mobile, category: ev.type === 'birthday' ? 'birthday-greeting' : 'anniversary-greeting', message: msg });
    setSending(null);
    if (error) { toast.error(`Could not send wishes: ${error}`); return; }
    setSent(prev => new Set(prev).add(key));
    toast.success(ev.mobile ? `${ev.type === 'birthday' ? 'Birthday' : 'Anniversary'} wishes sent to ${ev.name} on WhatsApp.` : `Wishes recorded for ${ev.name} (no mobile on file).`);
  };

  const bdayCount = events.filter(e => e.type === 'birthday').length;
  const annivCount = events.filter(e => e.type === 'anniversary').length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-100 rounded-lg"><Gift size={18} className="text-rose-600" /></div>
          <div>
            <h2 className="text-lg font-bold">Celebrations</h2>
            <p className="text-[11px] text-muted-foreground">Birthdays & anniversaries — send wishes from {company}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-accent/40 rounded-lg px-2 py-1">
          <button onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-accent text-muted-foreground"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold w-28 text-center">{MONTHS[view.m]} {view.y}</span>
          <button onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-accent text-muted-foreground"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Mini calendar */}
        <div>
          <div className="flex items-center gap-3 mb-2 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Birthday ({bdayCount})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500" /> Anniversary ({annivCount})</span>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center text-[9px] font-bold text-muted-foreground">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={`b${i}`} />;
              const evs = eventsByDay.get(d);
              const isToday = isCurrentMonth && d === todayDate;
              const hasB = evs?.some(e => e.type === 'birthday');
              const hasA = evs?.some(e => e.type === 'anniversary');
              return (
                <div key={d} className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-[11px] ${isToday ? 'border-primary bg-primary/5 font-bold' : evs ? 'border-rose-200 bg-rose-50/60' : 'border-transparent'}`}>
                  <span className={evs ? 'font-semibold' : 'text-muted-foreground'}>{d}</span>
                  {evs && (
                    <span className="flex gap-0.5 mt-0.5">
                      {hasB && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                      {hasA && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Event list */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">This Month ({events.length})</p>
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {loading && <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading…</p>}
            {!loading && events.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Cake size={24} className="mx-auto mb-2 opacity-60" />
                <p className="text-sm">No celebrations in {MONTHS[view.m]}.</p>
              </div>
            )}
            {events.map(ev => {
              const key = `${ev.empId}-${ev.type}`;
              const isToday = isCurrentMonth && ev.day === todayDate;
              const done = sent.has(key);
              return (
                <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${isToday ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${ev.type === 'birthday' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>{ev.avatar}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {ev.name}
                      {isToday && <span className="text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">TODAY</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {ev.type === 'birthday' ? <Cake size={10} className="text-rose-500" /> : <Heart size={10} className="text-violet-500" />}
                      {ev.type === 'birthday' ? 'Birthday' : `Anniversary${ev.years ? ` · ${ordinal(ev.years)}` : ''}`} · {MONTHS_SHORT[view.m]} {ev.day}
                    </p>
                  </div>
                  <button onClick={() => sendWishes(ev)} disabled={done || sending === key}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${done ? 'bg-green-50 text-green-700 border border-green-200 cursor-default' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                    {sending === key ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {done ? 'Sent' : 'Send Wishes'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
