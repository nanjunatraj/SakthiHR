import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { sendNotificationEmail } from './email';

const cdb = supabase as unknown as SupabaseClient;

export interface SystemUserAccount {
  id: string;
  name: string;
  loginId: string;
  password: string;
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

/** Resolve a User Master account by login_id, joined to the employee's contact details. */
export async function findAccountByLoginId(loginId: string): Promise<SystemUserAccount | null> {
  const { data } = await cdb
    .from('system_users')
    .select('id, name, login_id, password, must_change_password, employee_id, employees:employee_id(employee_id, mobile_number, email)')
    .eq('login_id', loginId.trim())
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, any>;
  const emp = r.employees ?? null;
  return {
    id: r.id,
    name: r.name ?? '',
    loginId: r.login_id ?? '',
    password: r.password ?? '',
    mustChangePassword: Boolean(r.must_change_password),
    employeeId: r.employee_id ?? null,
    employeeCode: emp?.employee_id ?? null,
    mobile: emp?.mobile_number ?? null,
    email: emp?.email ?? null,
  };
}

/** Verify a login (login_id + password) against the User Master. Returns the account or null. */
export async function verifyLogin(loginId: string, password: string): Promise<SystemUserAccount | null> {
  const acct = await findAccountByLoginId(loginId);
  if (!acct) return null;
  return acct.password === password ? acct : null;
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
  const acct = await findAccountByLoginId(loginId);
  if (!acct) return { error: 'No user account found for this Employee ID.' };
  const password = generatePassword();
  const { error } = await cdb
    .from('system_users')
    .update({ password, must_change_password: true, updated_at: new Date().toISOString() })
    .eq('id', acct.id);
  if (error) return { error: error.message };
  const mail = await sendNotificationEmail({
    employeeId: acct.employeeId,
    toEmail: acct.email,
    category: 'credentials',
    subject: 'SakthiHR Portal Password Reset',
    message: passwordMessageHtml(acct.name, acct.loginId, password),
  });
  return { error: null, password, account: acct, notified: !!acct.email && !mail.error };
}

/** Change an account's password after verifying the current one; clears the must-change flag. */
export async function changePassword(loginId: string, currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
  const acct = await findAccountByLoginId(loginId);
  if (!acct) return { error: 'Account not found.' };
  if (acct.password !== currentPassword) return { error: 'Current password is incorrect.' };
  const { error } = await cdb
    .from('system_users')
    .update({ password: newPassword, must_change_password: false, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', acct.id);
  return { error: error?.message ?? null };
}
