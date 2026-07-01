import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserRound, LayoutDashboard, ArrowRight, Loader2, LogOut } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { portalSessionFromAuth } from '../lib/portalSession';
import { setWorkspace } from '../lib/workspace';

/**
 * Shown after login to a staff member who is also an employee (e.g. an Admin or
 * HR Manager on the payroll). They pick their workspace: their own Self-Service
 * portal (the default) or the Admin app for their role. The choice is remembered
 * for the session; either side can switch later.
 */
export default function WorkspaceChooser({ onChooseAdmin }: { onChooseAdmin: () => void }) {
  const { staffRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  const goSelfService = async () => {
    setOpening(true);
    const { error } = await portalSessionFromAuth();
    if (error) { setOpening(false); toast.error(error); return; }
    setWorkspace('ess');
    navigate('/self-service', { replace: true });
  };

  const goAdmin = () => { setWorkspace('admin'); onChooseAdmin(); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="SakthiHR" className="h-20 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-foreground">Where would you like to go?</h1>
          <p className="text-sm text-muted-foreground mt-1">Your account can access both workspaces. Pick one to continue.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Employee Self-Service — default */}
          <button
            onClick={() => void goSelfService()}
            disabled={opening}
            className="group text-left rounded-2xl border-2 border-primary bg-card p-6 shadow-sm hover:shadow-md transition disabled:opacity-60"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {opening ? <Loader2 size={22} className="animate-spin" /> : <UserRound size={22} />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 rounded-full px-2 py-0.5">Default</span>
            </div>
            <h2 className="font-bold text-foreground">Employee Self-Service</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Payslips, leave, loans, and your personal documents.</p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              {opening ? 'Opening…' : 'Continue'} <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>

          {/* Admin app — per role */}
          <button
            onClick={goAdmin}
            disabled={opening}
            className="group text-left rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md hover:border-foreground/20 transition disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground mb-3">
              <LayoutDashboard size={22} />
            </div>
            <h2 className="font-bold text-foreground">Admin Dashboard</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              {staffRole ? `${staffRole} workspace` : 'Manage employees, payroll and reports.'}
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
              Continue <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>
        </div>

        <div className="text-center mt-6">
          <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
