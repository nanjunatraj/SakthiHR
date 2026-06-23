import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Users, CalendarCheck, ThumbsUp, ThumbsDown, Plane, HandCoins, Receipt, DoorOpen, TrendingUp, RefreshCw } from 'lucide-react';
import {
  loadTeamAttendance, loadManagerApprovals,
  managerActLeave, managerActLoan, managerActReimbursement,
  type TeamAttendance, type ManagerApprovals,
} from '../../lib/managerDashboard';
import { actApproval } from '../../lib/employeeExit';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ManagerDashboard({ managerId, managerName, onCountChange }: { managerId: string; managerName: string; onCountChange?: (n: number) => void }) {
  const [att, setAtt] = useState<{ periodName: string; rows: TeamAttendance[] }>({ periodName: '', rows: [] });
  const [appr, setAppr] = useState<ManagerApprovals>({ leaves: [], loans: [], reimbursements: [], resignations: [], increments: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [a, ap] = await Promise.all([loadTeamAttendance(managerId), loadManagerApprovals(managerId)]);
    setAtt(a); setAppr(ap);
    onCountChange?.(ap.leaves.length + ap.loans.length + ap.reimbursements.length + ap.resignations.length);
    setLoading(false);
  }, [managerId, onCountChange]);
  useEffect(() => { void reload(); }, [reload]);

  const act = async (fn: () => Promise<{ error: string | null }>, ok: string) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) toast.error(error); else { toast.success(ok); await reload(); } }
    finally { setBusy(false); }
  };

  const Decide = ({ onYes, onNo }: { onYes: () => void; onNo: () => void }) => (
    <div className="flex items-center gap-1.5 shrink-0">
      <button disabled={busy} onClick={onYes} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"><ThumbsUp size={12} /> Approve</button>
      <button disabled={busy} onClick={onNo} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-50 disabled:opacity-50"><ThumbsDown size={12} /> Reject</button>
    </div>
  );

  const Section = ({ icon: Icon, title, count, color, children }: { icon: React.ElementType; title: string; count: number; color: string; children: React.ReactNode }) => (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/30 border-b border-border">
        <Icon size={15} className={color} />
        <h3 className="text-sm font-bold">{title}</h3>
        {count > 0 && <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{count} pending</span>}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
  const Empty = ({ text }: { text: string }) => <p className="px-4 py-4 text-xs text-muted-foreground">{text}</p>;
  const Who = ({ name, code }: { name: string; code: string }) => <div><p className="text-sm font-semibold">{name}</p><p className="text-[10px] font-mono text-muted-foreground">{code}</p></div>;

  const pendingTotal = appr.leaves.length + appr.loans.length + appr.reimbursements.length + appr.resignations.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Users size={20} className="text-indigo-600" /> My Team</h2>
          <p className="text-xs text-muted-foreground">{att.rows.length} direct report(s) · {pendingTotal} pending first-level approval(s). Your decisions are recommendations — HR finalises.</p>
        </div>
        <button onClick={() => void reload()} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {/* Team attendance */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/30 border-b border-border">
          <CalendarCheck size={15} className="text-teal-600" /><h3 className="text-sm font-bold">Team Attendance</h3>
          {att.periodName && <span className="ml-auto text-[10px] text-muted-foreground">{att.periodName}</span>}
        </div>
        {att.rows.length === 0 ? <Empty text="No direct reports." /> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead className="bg-accent/20 text-muted-foreground"><tr><th className="px-3 py-2 text-left">Employee</th><th className="px-2 py-2 text-center">Present</th><th className="px-2 py-2 text-center">Absent</th><th className="px-2 py-2 text-center">Leave</th><th className="px-2 py-2 text-center">LOP</th><th className="px-2 py-2 text-center">Half-Day</th><th className="px-2 py-2 text-center">OT hrs</th></tr></thead>
            <tbody className="divide-y divide-border">{att.rows.map(r => (
              <tr key={r.employeeId} className="hover:bg-accent/20"><td className="px-3 py-2"><Who name={r.name} code={r.code} /></td><td className="px-2 py-2 text-center font-semibold text-green-700">{r.present}</td><td className="px-2 py-2 text-center text-rose-600">{r.absent}</td><td className="px-2 py-2 text-center">{r.leave}</td><td className="px-2 py-2 text-center text-amber-600">{r.lop}</td><td className="px-2 py-2 text-center">{r.halfDay}</td><td className="px-2 py-2 text-center">{r.otHours}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {/* Leaves */}
      <Section icon={Plane} title="Leave Approvals" count={appr.leaves.length} color="text-teal-600">
        {appr.leaves.length === 0 ? <Empty text="No pending leave requests from your team." /> : appr.leaves.map(l => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            <Who name={l.name} code={l.code} />
            <div className="text-xs text-muted-foreground flex-1 min-w-[160px]"><span className="font-medium text-foreground">{l.leaveType}</span> · {l.days} day(s) · {fmtDate(l.fromDate)} – {fmtDate(l.toDate)}{l.reason ? ` · ${l.reason}` : ''}</div>
            <Decide onYes={() => act(() => managerActLeave(l.id, 'Approved', managerId), 'Leave recommended for approval.')} onNo={() => act(() => managerActLeave(l.id, 'Rejected', managerId), 'Leave rejected.')} />
          </div>
        ))}
      </Section>

      {/* Loans */}
      <Section icon={HandCoins} title="Loan Approvals" count={appr.loans.length} color="text-amber-600">
        {appr.loans.length === 0 ? <Empty text="No pending loan applications from your team." /> : appr.loans.map(l => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            <Who name={l.name} code={l.code} />
            <div className="text-xs text-muted-foreground flex-1 min-w-[160px]"><span className="font-medium text-foreground">{l.loanType}</span> · {fmt(l.principal)} · {l.tenure} mo · EMI {fmt(l.emi)}{l.purpose ? ` · ${l.purpose}` : ''}</div>
            <Decide onYes={() => act(() => managerActLoan(l.id, 'Approved', managerId), 'Loan recommended for approval.')} onNo={() => act(() => managerActLoan(l.id, 'Rejected', managerId), 'Loan rejected.')} />
          </div>
        ))}
      </Section>

      {/* Resignations */}
      <Section icon={DoorOpen} title="Resignation Approvals" count={appr.resignations.length} color="text-rose-600">
        {appr.resignations.length === 0 ? <Empty text="No resignations awaiting your approval." /> : appr.resignations.map(r => (
          <div key={r.approvalId} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            <Who name={r.employeeName} code={r.employeeCode} />
            <div className="text-xs text-muted-foreground flex-1 min-w-[160px]"><span className="font-medium text-foreground">{r.exitType}</span> · LWD {fmtDate(r.lastWorkingDay)} · {r.role} (L{r.level})</div>
            <Decide onYes={() => act(() => actApproval(r.approvalId, 'Approved', managerName), 'Resignation approved.')} onNo={() => act(() => actApproval(r.approvalId, 'Rejected', managerName), 'Resignation rejected.')} />
          </div>
        ))}
      </Section>

      {/* Reimbursements (all other) */}
      <Section icon={Receipt} title="Reimbursement Approvals" count={appr.reimbursements.length} color="text-violet-600">
        {appr.reimbursements.length === 0 ? <Empty text="No pending reimbursement claims from your team." /> : appr.reimbursements.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            <Who name={c.name} code={c.code} />
            <div className="text-xs text-muted-foreground flex-1 min-w-[160px]"><span className="font-medium text-foreground">{fmt(c.amount)}</span> · {c.category}{c.description ? ` · ${c.description}` : ''} · {c.hasBill ? 'with bill' : 'no bill'}</div>
            <Decide onYes={() => act(() => managerActReimbursement(c.id, 'Approved', managerId), 'Reimbursement recommended for approval.')} onNo={() => act(() => managerActReimbursement(c.id, 'Rejected', managerId), 'Reimbursement rejected.')} />
          </div>
        ))}
      </Section>

      {/* Increments — view only */}
      <Section icon={TrendingUp} title="Increments (view only)" count={0} color="text-emerald-600">
        {appr.increments.length === 0 ? <Empty text="No salary increments for your team." /> : appr.increments.map(i => (
          <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            <Who name={i.name} code={i.code} />
            <div className="text-xs text-muted-foreground flex-1 min-w-[160px]">{i.title} · {fmt(i.oldCtc)} → <span className="font-semibold text-emerald-700">{fmt(i.newCtc)}</span>/mo</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{i.revStatus}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}
