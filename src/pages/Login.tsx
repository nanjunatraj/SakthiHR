import React, { useEffect, useState } from 'react';
import { useLocation, useParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User as UserIcon, Loader2, ShieldCheck, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAndActivate, getActiveTenant } from '../lib/tenant';

/**
 * Login screen. Two modes:
 *  - generic ("/login"): asks for Establishment Code + Username + Password.
 *  - scoped ("/:estCode", e.g. "/SAKTHI"): the establishment comes from the URL,
 *    so the page only asks for Username + Password.
 */
export default function Login() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const params = useParams();
  const scopedCode = (params.estCode ?? '').toUpperCase();
  const scoped = scopedCode.length > 0;

  const [establishmentCode, setEstablishmentCode] = useState(scoped ? scopedCode : (getActiveTenant()?.code ?? ''));
  const [estName, setEstName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(scoped);
  const [resolveFailed, setResolveFailed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  // Scoped mode: resolve the establishment from the URL up-front — point the app at
  // its tenant project and show its name. An unknown/inactive code gets a clear message.
  useEffect(() => {
    if (!scoped) return;
    let active = true;
    void (async () => {
      const r = await resolveAndActivate(scopedCode);
      if (!active) return;
      if (r.error) { setError(r.error); setResolveFailed(true); }
      else setEstName(r.tenant?.name ?? scopedCode);
      setResolving(false);
    })();
    return () => { active = false; };
  }, [scoped, scopedCode]);

  // Already signed in → bounce to the app.
  if (!loading && user) return <Navigate to={from} replace />;

  // A username maps to that tenant's login email. Real emails (containing "@") pass
  // through unchanged; a bare username (e.g. ADMIN) becomes admin@<code>.local —
  // matching the address provisioned for each establishment's default ADMIN.
  const toEmail = (input: string, code: string) =>
    input.includes('@') ? input.trim() : `${input.trim().toLowerCase()}@${code.toLowerCase()}.local`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const code = scoped ? scopedCode : establishmentCode;

    // 1) Resolve the establishment code and point the app at its tenant project.
    const resolved = await resolveAndActivate(code);
    if (resolved.error) {
      setSubmitting(false);
      setError(resolved.error);
      return;
    }

    // 2) Authenticate against the now-active tenant project.
    const { error } = await signIn(toEmail(username, code), password);
    if (error) {
      setSubmitting(false);
      setError(error);
      return;
    }

    // 3) Reload so every context re-initialises against the tenant client and
    //    picks up the freshly-stored session.
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-8 pt-8 pb-6 text-center border-b border-border">
            <img
              src="/logo.png"
              alt="SakthiHR — Payroll &amp; Compliance Software"
              className="h-28 w-auto mx-auto mb-3 object-contain"
            />
            {scoped ? (
              <p className="text-sm text-muted-foreground mt-1">
                {resolving
                  ? 'Loading establishment…'
                  : <>Sign in to <span className="font-semibold text-foreground">{estName ?? scopedCode}</span> <span className="font-mono text-xs">({scopedCode})</span></>}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Sign in to your HRMS &amp; Payroll workspace</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            {!scoped && (
              <div className="space-y-1.5">
                <label htmlFor="establishment" className="text-sm font-medium text-foreground">Establishment Code</label>
                <div className="relative">
                  <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="establishment"
                    type="text"
                    autoComplete="organization"
                    required
                    value={establishmentCode}
                    onChange={(e) => setEstablishmentCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SAKTHI"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-foreground">Username</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ADMIN"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || (scoped && (resolving || resolveFailed))}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium shadow-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Authorised personnel only. Contact your administrator for access.
        </p>
      </motion.div>
    </div>
  );
}
