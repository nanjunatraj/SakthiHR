import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, ChevronLeft, ChevronRight, Inbox, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;

interface PollOptionResult { id: string; text: string; votes: number; }
interface ActivePoll {
  id: string;
  title: string;
  description: string;
  type: string;
  endDate: string | null;
  totalRecipients: number;
  responseCount: number;
  options: PollOptionResult[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface PollWidgetProps { compact?: boolean }

/**
 * Dashboard poll summary — read-only, sourced from the polls / poll_options /
 * poll_votes tables. Shows live response distributions for active polls.
 * (Employees cast votes in the Self-Service portal; HR manages polls in /polls.)
 */
export default function PollWidget({ compact = false }: PollWidgetProps) {
  const navigate = useNavigate();
  const [polls, setPolls] = useState<ActivePoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: pollRows } = await db
        .from('polls')
        .select('id, title, description, type, end_date, total_recipients')
        .eq('status', 'Active')
        .order('created_at', { ascending: false });
      const list = (pollRows ?? []) as Record<string, any>[];
      if (list.length === 0) { if (active) { setPolls([]); setLoading(false); } return; }

      const ids = list.map(p => p.id);
      const [{ data: optRows }, { data: voteRows }] = await Promise.all([
        db.from('poll_options').select('id, poll_id, text, sort_order').in('poll_id', ids).order('sort_order'),
        db.from('poll_votes').select('poll_id, option_id, employee_id').in('poll_id', ids),
      ]);
      const opts = (optRows ?? []) as Record<string, any>[];
      const votes = (voteRows ?? []) as Record<string, any>[];

      const assembled: ActivePoll[] = list.map(p => {
        const pollOpts = opts.filter(o => o.poll_id === p.id);
        const pollVotes = votes.filter(v => v.poll_id === p.id);
        const voteByOption = new Map<string, number>();
        pollVotes.forEach(v => { if (v.option_id) voteByOption.set(v.option_id, (voteByOption.get(v.option_id) ?? 0) + 1); });
        const responders = new Set(pollVotes.map(v => v.employee_id).filter(Boolean));
        return {
          id: p.id,
          title: p.title ?? '',
          description: p.description ?? '',
          type: p.type ?? 'Single Choice',
          endDate: p.end_date ?? null,
          totalRecipients: Number(p.total_recipients ?? 0),
          responseCount: responders.size,
          options: pollOpts.map(o => ({ id: o.id, text: o.text ?? '', votes: voteByOption.get(o.id) ?? 0 })),
        };
      });
      if (active) { setPolls(assembled); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const poll = polls[index];
  const totalVotes = poll ? poll.options.reduce((s, o) => s + o.votes, 0) : 0;
  const responseRate = poll && poll.totalRecipients > 0
    ? Math.round((poll.responseCount / poll.totalRecipients) * 100)
    : null;

  return (
    <div className={`bg-card rounded-xl border border-border shadow-sm overflow-hidden ${compact ? '' : 'h-full'} flex flex-col`}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-accent/20">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          <h2 className="text-sm font-bold">Active Polls</h2>
          {polls.length > 0 && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{polls.length}</span>
          )}
        </div>
        <button onClick={() => navigate('/polls')} className="text-primary text-xs font-medium flex items-center gap-1">
          Manage <ArrowUpRight size={12} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 p-6"><div className="h-32 flex items-center justify-center text-sm text-muted-foreground">Loading polls…</div></div>
      ) : !poll ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-8 min-h-[200px]">
          <Inbox size={28} className="mb-2 opacity-50" />
          <p className="text-sm">No active polls.</p>
          <button onClick={() => navigate('/polls')} className="mt-3 text-xs font-semibold text-primary hover:underline">Create a poll</button>
        </div>
      ) : (
        <div className="flex-1 p-5 flex flex-col">
          <div className="mb-3">
            <h3 className="font-bold text-sm">{poll.title}</h3>
            {poll.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{poll.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Users size={10} /> {poll.responseCount}{poll.totalRecipients > 0 ? `/${poll.totalRecipients}` : ''} responded</span>
              {poll.endDate && <span>· Ends {formatDate(poll.endDate)}</span>}
              {responseRate !== null && <span className="font-semibold text-primary">· {responseRate}% rate</span>}
            </div>
          </div>

          <div className="space-y-2 flex-1">
            {poll.options.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">This poll has no options to display.</p>
            )}
            {poll.options.map(opt => {
              const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
              return (
                <div key={opt.id}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-medium truncate pr-2">{opt.text}</span>
                    <span className="text-muted-foreground shrink-0">{opt.votes} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-accent overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 size={11} className="text-green-500" /> {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
            </span>
            {polls.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIndex(i => (i - 1 + polls.length) % polls.length)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
                ><ChevronLeft size={14} /></button>
                <span className="text-[10px] text-muted-foreground">{index + 1} / {polls.length}</span>
                <button
                  onClick={() => setIndex(i => (i + 1) % polls.length)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
                ><ChevronRight size={14} /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
