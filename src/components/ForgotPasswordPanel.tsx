import React, { useState } from 'react';
import { Lock, User as UserIcon, Building2, KeyRound, Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { sendResetOtp, confirmResetOtp } from '../lib/passwordReset';

/**
 * Forgot-password flow rendered inside the login screen. Two steps:
 *   1) request — Username (+ Establishment Code when not scoped) → email an OTP.
 *   2) verify  — enter the code + a new password → reset it.
 */
export default function ForgotPasswordPanel({
  scoped, initialCode, onBack, onDone,
}: {
  scoped: boolean;
  initialCode: string;
  onBack: () => void;
  onDone: (message: string) => void;
}) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [code, setCode] = useState(initialCode);
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const effectiveCode = scoped ? initialCode : code;

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error, maskedEmail } = await sendResetOtp(effectiveCode, username);
    setBusy(false);
    if (error) { setError(error); return; }
    setSentTo(maskedEmail ?? null);
    setStep('verify');
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await confirmResetOtp(effectiveCode, username, otp, password);
    setBusy(false);
    if (error) { setError(error); return; }
    onDone('Password reset. Please sign in with your new password.');
  };

  const inputBase =
    'w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition';

  return (
    <div className="px-8 py-7">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to sign in
      </button>

      {step === 'request' ? (
        <form onSubmit={request} className="space-y-5">
          <div>
            <h2 className="font-semibold text-foreground">Reset your password</h2>
            <p className="text-xs text-muted-foreground mt-1">We'll email a one-time code to the address on your account.</p>
          </div>

          {!scoped && (
            <div className="space-y-1.5">
              <label htmlFor="fp-code" className="text-sm font-medium text-foreground">Establishment Code</label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="fp-code" type="text" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SAKTHI" className={`${inputBase} uppercase tracking-wide`} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="fp-username" className="text-sm font-medium text-foreground">Username</label>
            <div className="relative">
              <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input id="fp-username" type="text" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="ADMIN" className={inputBase} />
            </div>
          </div>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium shadow-sm hover:opacity-90 transition disabled:opacity-60">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <MailCheck size={18} />} Send code
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-5">
          <div>
            <h2 className="font-semibold text-foreground">Enter the code</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {sentTo ? <>A code was sent to <span className="font-medium text-foreground">{sentTo}</span>.</> : 'Check your email for the code.'} Enter it below with your new password.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fp-otp" className="text-sm font-medium text-foreground">One-time code</label>
            <div className="relative">
              <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input id="fp-otp" type="text" inputMode="numeric" autoComplete="one-time-code" required value={otp}
                onChange={(e) => setOtp(e.target.value)} placeholder="123456" className={`${inputBase} tracking-[0.3em] font-mono`} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fp-pass" className="text-sm font-medium text-foreground">New password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input id="fp-pass" type="password" autoComplete="new-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputBase} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fp-confirm" className="text-sm font-medium text-foreground">Confirm new password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input id="fp-confirm" type="password" autoComplete="new-password" required value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={inputBase} />
            </div>
          </div>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium shadow-sm hover:opacity-90 transition disabled:opacity-60">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} Reset password
          </button>

          <button type="button" onClick={() => { setStep('request'); setError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground">
            Didn't get a code? Try again
          </button>
        </form>
      )}
    </div>
  );
}
