// Durable ESS portal session (token-based). ESS employees have no Supabase
// session, so login issues an opaque token (persisted in localStorage) that the
// employee-portal edge function validates on every call — the portal survives a
// page refresh without keeping the employee's password.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { SystemUserAccount } from './credentials';

const fdb = supabase as unknown as SupabaseClient;
const TOKEN_KEY = 'sakthihr.portalToken';

export function getPortalToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setPortalToken(t: string) { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } }
export function clearPortalToken() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }

async function invoke<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await fdb.functions.invoke('employee-portal', { body });
  if (error) {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    let msg = error.message;
    try { const b = ctx?.json ? await ctx.json() : null; if (b?.error) msg = b.error; } catch { /* ignore */ }
    return { data: null, error: msg };
  }
  const r = (data ?? {}) as { error?: string };
  if (r.error) return { data: null, error: r.error };
  return { data: data as T, error: null };
}

/** Authenticate an employee, persist the session token, and return the account. */
export async function portalLogin(loginId: string, password: string): Promise<{ account: SystemUserAccount | null; error: string | null }> {
  const { data, error } = await invoke<{ token: string; account: SystemUserAccount }>({ action: 'login', login_id: loginId.trim(), password });
  if (error || !data?.token) return { account: null, error: error ?? 'login failed' };
  setPortalToken(data.token);
  return { account: data.account, error: null };
}

/**
 * Open a portal session for a staff member who is already signed in via Supabase
 * Auth and is also an employee — no password needed. Their JWT is exchanged for a
 * portal token server-side. Used by the "My Self-Service" / workspace switch.
 */
export async function portalSessionFromAuth(): Promise<{ account: SystemUserAccount | null; error: string | null }> {
  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) return { account: null, error: 'not signed in' };
  const { data, error } = await invoke<{ token: string; account: SystemUserAccount }>({ action: 'session_from_auth', access_token: accessToken });
  if (error || !data?.token) return { account: null, error: error ?? 'could not open portal' };
  setPortalToken(data.token);
  return { account: data.account, error: null };
}

/** Re-hydrate the account from the stored token (on page load). */
export async function portalSession(): Promise<{ account: SystemUserAccount | null; error: string | null }> {
  const token = getPortalToken();
  if (!token) return { account: null, error: 'no session' };
  const { data, error } = await invoke<{ account: SystemUserAccount }>({ action: 'session', token });
  if (error || !data?.account) { clearPortalToken(); return { account: null, error: error ?? 'session expired' }; }
  return { account: data.account, error: null };
}

/** End the portal session (server-side + local). */
export async function portalLogout(): Promise<void> {
  const token = getPortalToken();
  if (token) await invoke({ action: 'logout', token });
  clearPortalToken();
}
