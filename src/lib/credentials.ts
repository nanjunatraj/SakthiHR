import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { sendNotificationEmail } from './email';

const cdb = supabase as unknown as SupabaseClient;

export interface SystemUserAccount {
  id: string;
  name: string;
  loginId: string;
  password: string;
  role: string | null;         // User Master role — drives login routing/menu access
  isStaff: boolean;            // role.is_staff — true: Admin app, false: Self-Service only
  mustChangePassword: boolean;
  employeeId: string | null;   // employees.id uuid
  employeeCode: string | null; // employees.employee_id text
  mobile: string | null;
  email: string | null;
}

/** Generate a reasonably strong random password (meets the ESS strength rules). */
export function generatePassword(length = 10): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  // Guarantee one of each class, then fill the rest.
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(special);
  for (let i = pwd.length; i < length; i++) pwd += pick(all);
  // Shuffle so the guaranteed chars aren't always in front.
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Verify a login (login_id + password) against the User Master.
 *
 * The Self-Service portal runs unauthenticated (the `anon` Postgres role), which
 * an authenticated-only RLS policy forbids from reading `system_users`. Auth is
 * therefore done by the `verify_login` SECURITY DEFINER RPC, which validates the
 * password server-side (bcrypt) and never returns the stored hash.
 */
export async function verifyLogin(loginId: string, password: string): Promise<SystemUserAccount | null> {
  const { data, error } = await cdb.rpc('verify_login', { p_login_id: loginId.trim(), p_password: password });
  if (error || !data) return null;
  const r = data as Record<string, any>;
  return {
    id: r.id,
    name: r.name ?? '',
    loginId: r.login_id ?? '',
    password: '',            // never returned by the server
    role: r.role ?? null,
    isStaff: r.is_staff !== false,   // default staff when the flag is absent
    mustChangePassword: Boolean(r.must_change_password),
    employeeId: r.employee_id ?? null,
    employeeCode: r.employee_code ?? null,
    mobile: r.mobile ?? null,
    email: r.email ?? null,
  };
}

function passwordMessageHtml(name: string, loginId: string, password: string): string {
  return `<p>Hello ${name || loginId}, your SakthiHR portal password has been reset.</p>` +
    `<p><strong>Login ID:</strong> ${loginId}<br/><strong>New Password:</strong> ${password}</p>` +
    `<p>Please log in to the Employee Self-Service Portal and change your password on first login.</p>`;
}

/** Reset an account's password to a freshly generated one, flag must-change, and notify by email. */
export async function resetPasswordAndNotify(loginId: string): Promise<{
  error: string | null;
  password?: string;
  account?: SystemUserAccount;
  notified?: boolean;
}> {
  const password = generatePassword();
  // `reset_password` (SECURITY DEFINER) stores the new password (hashed by a
  // trigger) and returns the account's contact details for the notification.
  const { data, error } = await cdb.rpc('reset_password', { p_login_id: loginId.trim(), p_new_password: password });
  if (error) return { error: error.message };
  const r = (data ?? {}) as { error?: string | null; account?: Record<string, any> };
  if (r.error || !r.account) return { error: r.error ?? 'No user account found for this Employee ID.' };
  const a = r.account;
  const account: SystemUserAccount = {
    id: a.id,
    name: a.name ?? '',
    loginId: a.login_id ?? '',
    password: '',
    role: a.role ?? null,
    isStaff: a.is_staff !== false,
    mustChangePassword: true,
    employeeId: a.employee_id ?? null,
    employeeCode: null,
    mobile: a.mobile ?? null,
    email: a.email ?? null,
  };
  const mail = await sendNotificationEmail({
    employeeId: account.employeeId,
    toEmail: account.email,
    category: 'credentials',
    subject: 'SakthiHR Portal Password Reset',
    message: passwordMessageHtml(account.name, account.loginId, password),
  });
  return { error: null, password, account, notified: !!account.email && !mail.error };
}

/** Change an account's password after verifying the current one; clears the must-change flag. */
export async function changePassword(loginId: string, currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
  // Verification + write happen server-side in the `change_password` RPC, so the
  // unauthenticated portal never needs to read `system_users`.
  const { data, error } = await cdb.rpc('change_password', {
    p_login_id: loginId.trim(),
    p_current: currentPassword,
    p_new: newPassword,
  });
  if (error) return { error: error.message };
  const r = (data ?? {}) as { error?: string | null };
  return { error: r.error ?? null };
}
