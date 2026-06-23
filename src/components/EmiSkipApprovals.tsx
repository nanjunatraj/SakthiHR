import React, { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import { CalendarOff, UserCheck, ShieldCheck, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;

interface SkipRow {
  id: string;
  loan_id: string;
  reason: string;
  status: string;
  manager_status: string;
  hr_status: string;
  requested_on: string;
  employees: { first_name: string | null; last_name: string | null; employee_id: string | null } | null;
  payroll_periods: { name: string } | null;
  loans: { emi_amount: number } | null;
}

const BADGE: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Approved: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
  ManagerApproved: 'bg-blue-100 text-blue-700 border-blue-200',
};

function overallStatus(manager: string, hr: string): string {
  if (manager === 'Rejected' || hr === 'Rejected') return 'Rejected';
  if (manager === 'Approved' && hr === 'Approved') return 'Approved';
  if (manager === 'Approved') return 'ManagerApproved';
  return 'Pending';
}

export default function EmiSkipApprovals() {
  const [rows, setRows] = useState<SkipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from('loan_emi_skip_requests')
      .select('id, loan_id, reason, status, manager_status, hr_status, requested_on, employees!loan_emi_skip_requests_employee_id_fkey(first_name, last_name, employee_id), payroll_periods(name), loans(emi_amount)')
      .order('requested_on', { ascending: false });
    setRows((data ?? []) as unknown as SkipRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('realtime:loan_emi_skip_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_emi_skip_requests' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const act = async (row: SkipRow, stage: 'manager' | 'hr', decision: 'Approved' | 'Rejected') => {
    setBusy(`${row.id}-${stage}`);
    const manager_status = stage === 'manager' ? decision : row.manager_status;
    const hr_status = stage === 'hr' ? decision : row.hr_status;
    const patch: Record<string, unknown> = {
      manager_status,
      hr_status,
      status: overallStatus(manager_status, hr_status),
      updated_at: new Date().toISOString(),
    };
    if (stage === 'manager') patch.manager_acted_on = new Date().toISOString();
    if (stage === 'hr') patch.hr_acted_on = new Date().toISOString();
    const { error } = await db.from('loan_emi_skip_requests').update(patch).eq('id', row.id);
    setBusy(null);
    if (error) { toast.error(`Update failed: ${error.message}`); return; }
    toast.success(`${stage === 'manager' ? 'Manager' : 'HR'} ${decision.toLowerCase()} recorded.`);
    void load();
  };

  const name = (r: SkipRow) => [r.employees?.first_name, r.employees?.last_name].filter(Boolean).join(' ') || r.employees?.employee_id || 'Employee';

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <div className="p-2 bg-rose-100 rounded-lg"><CalendarOff size={18} className="text-rose-600" /></div>
        <div>
          <h3 className="font-bold text-sm">EMI Skip Requests</h3>
          <p className="text-xs text-muted-foreground">Two-stage approval — reporting manager, then HR.</p>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} request{rows.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" /> Loading requests…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No EMI-skip requests yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{name(r)}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${BADGE[r.status] ?? BADGE.Pending}`}>
                      {r.status === 'ManagerApproved' ? 'Awaiting HR' : r.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Skip <strong>{r.payroll_periods?.name ?? '—'}</strong> EMI
                    {r.loans?.emi_amount ? ` · ₹${Number(r.loans.emi_amount).toLocaleString('en-IN')}/mo` : ''}
                  </p>
                  <p className="text-xs mt-1.5 text-foreground/80">“{r.reason}”</p>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Clock size={10} /> Requested {r.requested_on}</p>
                </div>

                <div className="flex flex-col gap-2">
                  {/* Manager stage */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-28 justify-center ${BADGE[r.manager_status]}`}>
                      <UserCheck size={11} /> Mgr: {r.manager_status}
                    </span>
                    {r.manager_status === 'Pending' && (
                      <>
                        <button disabled={busy === `${r.id}-manager`} onClick={() => act(r, 'manager', 'Approved')} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50" title="Manager approve"><CheckCircle2 size={14} /></button>
                        <button disabled={busy === `${r.id}-manager`} onClick={() => act(r, 'manager', 'Rejected')} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50" title="Manager reject"><XCircle size={14} /></button>
                      </>
                    )}
                  </div>
                  {/* HR stage — enabled once manager approves */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-28 justify-center ${BADGE[r.hr_status]}`}>
                      <ShieldCheck size={11} /> HR: {r.hr_status}
                    </span>
                    {r.hr_status === 'Pending' && r.manager_status === 'Approved' && (
                      <>
                        <button disabled={busy === `${r.id}-hr`} onClick={() => act(r, 'hr', 'Approved')} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50" title="HR approve"><CheckCircle2 size={14} /></button>
                        <button disabled={busy === `${r.id}-hr`} onClick={() => act(r, 'hr', 'Rejected')} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50" title="HR reject"><XCircle size={14} /></button>
                      </>
                    )}
                    {r.hr_status === 'Pending' && r.manager_status !== 'Approved' && (
                      <span className="text-[10px] text-muted-foreground">awaiting manager</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
