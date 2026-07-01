import { resolveAndActivate } from './tenant';
import { getActiveClient } from '../supabase/client';
import { usernameToEmail, maskEmail } from './loginIdentity';

// Forgot-password via email OTP, powered by Supabase Auth's recovery flow:
//   1) sendResetOtp → resolve the establishment, point the app at its tenant
//      project, and email a one-time code to the account's address.
//   2) confirmResetOtp → verify the code (type 'recovery' → a short-lived session)
//      and set the new password on that Supabase Auth account.
//
// Operational prerequisites (per tenant project):
//   - Custom SMTP configured (the built-in sender is heavily rate-limited and not
//     for production), and the account must have a real, deliverable email
//     (admin@<code>.local addresses cannot receive mail).
//   - The "Reset Password" email template must surface the code, e.g. include
//     "{{ .Token }}" — otherwise the email only carries a magic link, not an OTP.

export async function sendResetOtp(code: string, username: string): Promise<{ error: string | null; maskedEmail?: string }> {
  if (!username.trim()) return { error: 'Please enter your Username.' };
  const resolved = await resolveAndActivate(code);
  if (resolved.error) return { error: resolved.error };

  const email = usernameToEmail(username, code);
  const { error } = await getActiveClient().auth.resetPasswordForEmail(email);
  if (error) return { error: error.message };
  return { error: null, maskedEmail: maskEmail(email) };
}

export async function confirmResetOtp(
  code: string,
  username: string,
  token: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  if (!token.trim()) return { error: 'Enter the code from your email.' };
  if (newPassword.length < 6) return { error: 'New password must be at least 6 characters.' };

  const resolved = await resolveAndActivate(code);
  if (resolved.error) return { error: resolved.error };

  const client = getActiveClient();
  const email = usernameToEmail(username, code);

  const { error: vErr } = await client.auth.verifyOtp({ email, token: token.trim(), type: 'recovery' });
  if (vErr) return { error: /expired|invalid/i.test(vErr.message) ? 'That code is invalid or has expired. Request a new one.' : vErr.message };

  const { error: uErr } = await client.auth.updateUser({ password: newPassword });
  if (uErr) return { error: uErr.message };

  // Leave no lingering recovery session — the user should sign in fresh.
  await client.auth.signOut({ scope: 'local' }).catch(() => {});
  return { error: null };
}
