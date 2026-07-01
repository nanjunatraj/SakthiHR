import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Plus, ShieldCheck, Loader2, Hash, Database, LogIn, Pause, Play, RefreshCw, AlertTriangle, Trash2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { supabase, CONTROL_REF } from '../../supabase/client';
import {
  listEstablishments, createEstablishment, manageEstablishment, accessAsAdmin, deleteEstablishment, isPlatformSuperAdmin,
  type Establishment, type ManageAction,
} from '../../lib/establishments';

const STATUS_STYLES: Record<Establishment['status'], string> = {
  Active: 'bg-green-100 text-green-700 border-green-200',
  Provisioning: 'bg-amber-100 text-amber-700 border-amber-200',
  Suspended: 'bg-gray-100 text-gray-600 border-gray-200',
  Failed: 'bg-red-100 text-red-700 border-red-200',
};

export default function SuperAdmin() {
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Establishment[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingRows(true);
    const { rows, error } = await listEstablishments();
    if (error) toast.error(error);
    setRows(rows);
    setLoadingRows(false);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    void (async () => {
      const ok = await isPlatformSuperAdmin();
      if (!active) return;
      setAllowed(ok);
      if (ok) void refresh();
    })();
    return () => { active = false; };
  }, [loading, user, refresh]);

  // Console is platform-super-admin only.
  if (!loading && user && allowed === false) return <Navigate to="/" replace />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,10}$/.test(cleanCode)) { toast.error('Code must be 2–10 letters/numbers (e.g. ACME).'); return; }
    if (!name.trim()) { toast.error('Establishment name is required.'); return; }
    setCreating(true);
    const { error } = await createEstablishment(cleanCode, name);
    setCreating(false);
    if (error) { toast.error(error); return; }
    toast.success(`Provisioning "${name.trim()}" (${cleanCode}). This can take a few minutes.`);
    setCode(''); setName('');
    void refresh();
  };

  const runManage = async (action: ManageAction, est: Establishment, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyCode(est.code);
    const { error } = await manageEstablishment(action, est.code);
    setBusyCode(null);
    if (error) { toast.error(error); return; }
    toast.success(`${action} succeeded for ${est.code}.`);
    void refresh();
  };

  const openAsAdmin = async (est: Establishment) => {
    setBusyCode(est.code);
    const { error } = await accessAsAdmin(est.code);
    if (error) { setBusyCode(null); toast.error(error); }
    // on success the app reloads into the tenant
  };

  const removeEstablishment = async (est: Establishment) => {
    // Deletion is only allowed once an establishment has been suspended — this
    // forces a deliberate two-step (suspend, then delete) for a destructive act.
    if (est.status !== 'Suspended') {
      toast.error('Suspend this establishment before deleting it.');
      return;
    }
    const typed = window.prompt(
      `This PERMANENTLY deletes "${est.name}" (${est.code}) — its entire database and all data. This cannot be undone.\n\nType ${est.code} to confirm:`,
    );
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== est.code) { toast.error('Code did not match — deletion cancelled.'); return; }
    setBusyCode(est.code);
    const { error } = await deleteEstablishment(est.code);
    setBusyCode(null);
    if (error) { toast.error(error); return; }
    toast.success(`Establishment ${est.code} deleted.`);
    void refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4 flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg"><ShieldCheck size={22} className="text-primary" /></div>
        <div>
          <h1 className="text-xl font-bold">Platform Administration</h1>
          <p className="text-xs text-muted-foreground">Create and manage establishments — each is its own isolated database.</p>
        </div>
        <button onClick={() => { void supabase.auth.signOut().then(() => window.location.reload()); }} className="ml-auto text-sm text-muted-foreground hover:text-foreground">Sign out</button>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Create establishment */}
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={create}
          className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="font-bold text-base mb-1 flex items-center gap-2"><Plus size={18} className="text-primary" /> New Establishment</h2>
          <p className="text-xs text-muted-foreground mb-4">A separate empty database is provisioned with a default <span className="font-mono">ADMIN</span> / <span className="font-mono">PASSWORD</span> login. Code and name are fixed once created.</p>
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Establishment code</label>
              <div className="relative">
                <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ACME" maxLength={10}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 outline-none text-sm font-mono uppercase" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Industries Pvt Ltd"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 outline-none text-sm" />
            </div>
            <button type="submit" disabled={creating}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-60 text-sm font-medium">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />} Create
            </button>
          </div>
        </motion.form>

        {/* Establishments list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base flex items-center gap-2"><Building2 size={18} className="text-primary" /> Establishments</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{rows.length} total</span>
              <button onClick={() => void refresh()} className="text-muted-foreground hover:text-foreground" title="Refresh"><RefreshCw size={14} /></button>
            </div>
          </div>

          {loadingRows && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loadingRows && rows.length === 0 && (
            <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border text-muted-foreground text-sm">
              No establishments yet — create your first one above.
            </div>
          )}

          {rows.map((est) => {
            const busy = busyCode === est.code;
            const isPlatformProject = est.project_ref === CONTROL_REF;
            return (
              <div key={est.id} className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{est.code.slice(0, 2)}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm flex items-center gap-2">{est.name}
                      <span className="text-[11px] font-mono bg-accent text-muted-foreground px-1.5 py-0.5 rounded">{est.code}</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {est.project_ref ? <>project <span className="font-mono">{est.project_ref}</span></> : 'no project yet'}
                      {est.last_compacted_at && <> · compacted {new Date(est.last_compacted_at).toLocaleDateString('en-IN')}</>}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[est.status]}`}>{est.status}</span>
                </div>

                {est.status === 'Failed' && est.error && (
                  <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {est.error}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                  {!isPlatformProject && (
                    <button disabled={busy || est.status !== 'Active'} onClick={() => void openAsAdmin(est)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/20 text-primary hover:bg-primary/10 transition disabled:opacity-40">
                      <LogIn size={13} /> Access as Admin
                    </button>
                  )}
                  <button disabled={busy || est.status !== 'Active'} onClick={() => void runManage('compact', est, `Compact the database for ${est.code}? This runs VACUUM and may take a moment.`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent transition disabled:opacity-40">
                    <Database size={13} /> Compact DB
                  </button>
                  {est.status === 'Suspended' ? (
                    <button disabled={busy} onClick={() => void runManage('restore', est)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition disabled:opacity-40">
                      <Play size={13} /> Restore
                    </button>
                  ) : (
                    <button disabled={busy || est.status !== 'Active'} onClick={() => void runManage('suspend', est, `Suspend ${est.code}? Its users won't be able to sign in.`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent transition disabled:opacity-40">
                      <Pause size={13} /> Suspend
                    </button>
                  )}
                  {!isPlatformProject && (
                    <button disabled={busy || est.status !== 'Suspended'} onClick={() => void removeEstablishment(est)}
                      title={est.status !== 'Suspended' ? 'Suspend this establishment before it can be deleted' : `Delete ${est.code}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-40 ml-auto">
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                  {isPlatformProject && (
                    <span className="ml-auto text-[10px] text-muted-foreground italic">platform project — protected</span>
                  )}
                  {busy && <Loader2 size={14} className="animate-spin text-muted-foreground ml-1" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
