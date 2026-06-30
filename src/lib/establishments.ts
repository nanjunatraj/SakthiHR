import type { SupabaseClient } from '@supabase/supabase-js';
import { controlPlane, setActiveTenant } from '../supabase/client';

// The establishments registry + provisioning functions live ONLY on the control
// plane, so this module always talks to the control-plane client (never the
// active tenant client).
const cp = controlPlane as unknown as SupabaseClient;

export interface Establishment {
  id: string;
  code: string;
  name: string;
  project_ref: string | null;
  api_url: string | null;
  anon_key: string | null;
  status: 'Provisioning' | 'Active' | 'Suspended' | 'Failed';
  error: string | null;
  last_compacted_at: string | null;
  created_at: string;
}

export type ManageAction = 'compact' | 'suspend' | 'restore';

/** Best-effort extraction of the JSON `error` an Edge Function returned on a non-2xx. */
async function fnError(error: unknown): Promise<string> {
  const e = error as { message?: string; context?: { json?: () => Promise<{ error?: string }> } };
  try {
    const body = e?.context?.json ? await e.context.json() : null;
    if (body?.error) return body.error;
  } catch { /* fall through */ }
  return e?.message ?? 'Request failed.';
}

export async function isPlatformSuperAdmin(): Promise<boolean> {
  const { data } = await cp.rpc('is_platform_super_admin');
  return data === true;
}

export async function listEstablishments(): Promise<{ rows: Establishment[]; error: string | null }> {
  const { data, error } = await cp.from('establishments').select('*').order('created_at', { ascending: true });
  return { rows: (data as Establishment[] | null) ?? [], error: error?.message ?? null };
}

/** Provision a new establishment (separate Supabase project) via the edge function. */
export async function createEstablishment(code: string, name: string): Promise<{ error: string | null }> {
  const { data, error } = await cp.functions.invoke('provision-establishment', {
    body: { code: code.trim().toUpperCase(), name: name.trim() },
  });
  if (error) return { error: await fnError(error) };
  const r = (data ?? {}) as { error?: string };
  return { error: r.error ?? null };
}

export async function manageEstablishment(action: ManageAction, code: string): Promise<{ error: string | null }> {
  const { data, error } = await cp.functions.invoke('manage-establishment', { body: { action, code } });
  if (error) return { error: await fnError(error) };
  const r = (data ?? {}) as { error?: string };
  return { error: r.error ?? null };
}

/**
 * Open a tenant's portal as its ADMIN: the edge function mints an admin session
 * on that tenant; we point the app at it, set the session, and reload.
 */
export async function accessAsAdmin(code: string): Promise<{ error: string | null }> {
  const { data, error } = await cp.functions.invoke('manage-establishment', { body: { action: 'admin_session', code } });
  if (error) return { error: await fnError(error) };
  const r = (data ?? {}) as { error?: string; name?: string; api_url?: string; anon_key?: string; access_token?: string; refresh_token?: string };
  if (r.error || !r.api_url || !r.anon_key) return { error: r.error ?? 'Could not open an admin session.' };
  const client = setActiveTenant({ code, name: r.name ?? code, apiUrl: r.api_url, anonKey: r.anon_key });
  if (r.access_token && r.refresh_token) {
    await client.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
  }
  window.location.reload();
  return { error: null };
}
