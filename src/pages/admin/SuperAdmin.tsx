import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Plus, ShieldCheck, UserPlus, Loader2, Mail, KeyRound, Hash } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTable } from '../../hooks/useTable';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase/client';

interface Org { id: string; name: string; code: string; status: string; created_at: string }
interface Membership { id: string; org_id: string | null; role: string; status: string; email: string | null; full_name: string | null }

export default function SuperAdmin() {
  const { user, isSuperAdmin, loading } = useAuth();
  const orgs = useTable<Org>('organizations', { orderBy: { column: 'created_at', ascending: true } });
  const mems = useTable<Membership>('memberships', { orderBy: { column: 'created_at', ascending: true } });

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Console is super-admin only (hooks above run unconditionally per React rules).
  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!name.trim()) { toast.error('Organization name is required.'); return; }
    if (!/^[A-Z0-9]{2,10}$/.test(cleanCode)) { toast.error('Code must be 2–10 letters/numbers (e.g. ACME).'); return; }
    setCreatingOrg(true);
    const { error } = await orgs.insert({ name: name.trim(), code: cleanCode, status: 'Active', created_by: user?.id } as Partial<Org>);
    setCreatingOrg(false);
    if (error) { toast.error(error.includes('duplicate') ? `Code "${cleanCode}" is already taken.` : error); return; }
    toast.success(`Organization "${name.trim()}" created.`);
    setName(''); setCode('');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4 flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg"><ShieldCheck size={22} className="text-primary" /></div>
        <div>
          <h1 className="text-xl font-bold">Platform Administration</h1>
          <p className="text-xs text-muted-foreground">Create organizations and their administrators.</p>
        </div>
        <button onClick={() => { void supabase.auth.signOut(); }} className="ml-auto text-sm text-muted-foreground hover:text-foreground">Sign out</button>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Create organization */}
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={createOrg}
          className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2"><Plus size={18} className="text-primary" /> New Organization</h2>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Industries Pvt Ltd"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Shorthand code</label>
              <div className="relative">
                <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ACME" maxLength={10}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 outline-none text-sm font-mono uppercase" />
              </div>
            </div>
            <button type="submit" disabled={creatingOrg}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-60 text-sm font-medium">
              {creatingOrg ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />} Create
            </button>
          </div>
        </motion.form>

        {/* Organizations list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base flex items-center gap-2"><Building2 size={18} className="text-primary" /> Organizations</h2>
            <span className="text-xs text-muted-foreground">{orgs.rows.length} total</span>
          </div>
          {orgs.loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!orgs.loading && orgs.rows.length === 0 && (
            <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border text-muted-foreground text-sm">
              No organizations yet — create your first one above.
            </div>
          )}
          {orgs.rows.map((org) => (
            <OrgCard key={org.id} org={org}
              admins={mems.rows.filter((m) => m.org_id === org.id && m.role === 'org_admin')}
              onChanged={() => { void mems.refetch(); }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OrgCard({ org, admins, onChanged }: { org: Org; admins: Membership[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 8) { toast.error('Email and a password of 8+ characters are required.'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('provision-user', {
      body: { action: 'create_org_admin', org_id: org.id, email: email.trim(), password, full_name: fullName.trim() },
    });
    setBusy(false);
    const errMsg = error?.message ?? (data as { error?: string })?.error;
    if (errMsg) { toast.error(errMsg); return; }
    toast.success(`Org admin ${email.trim()} created for ${org.code}.`);
    setEmail(''); setFullName(''); setPassword(''); setOpen(false);
    onChanged();
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-5">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{org.code.slice(0, 2)}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm">{org.name}</h3>
          <span className="text-[11px] font-mono bg-accent text-muted-foreground px-1.5 py-0.5 rounded">{org.code}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${org.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{org.status}</span>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-primary/20 text-primary hover:bg-primary/10 transition">
          <UserPlus size={13} /> Add admin
        </button>
      </div>

      {admins.length > 0 && (
        <div className="px-5 pb-3 -mt-1 flex flex-wrap gap-2">
          {admins.map((a) => (
            <span key={a.id} className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border ${a.status === 'Active' ? 'bg-accent border-border text-foreground' : 'bg-gray-50 border-gray-200 text-muted-foreground line-through'}`}>
              <ShieldCheck size={11} className="text-primary" /> {a.email ?? a.full_name ?? 'admin'}
            </span>
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={createAdmin} className="border-t border-border bg-accent/20 p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@acme.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 outline-none text-sm" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Temporary password</label>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 outline-none text-sm font-mono" />
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent text-muted-foreground">Cancel</button>
            <button type="submit" disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-60 text-sm font-medium">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Create admin
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
