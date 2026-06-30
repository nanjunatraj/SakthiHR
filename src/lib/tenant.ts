import type { SupabaseClient } from '@supabase/supabase-js';
import { controlPlane, setActiveTenant, clearActiveTenant, getActiveTenant, type TenantConfig } from '../supabase/client';

// Untyped view of the control-plane client for the resolver RPC (not in generated types).
const cp = controlPlane as unknown as SupabaseClient;

export { getActiveTenant, clearActiveTenant };
export type { TenantConfig };

/**
 * Resolve an Establishment Code against the control-plane registry and point the
 * app at that tenant's Supabase project. After this succeeds the caller should
 * authenticate (sign-in runs against the now-active tenant) and then reload the
 * app so contexts re-initialise against the tenant client.
 */
export async function resolveAndActivate(code: string): Promise<{ error: string | null; tenant?: TenantConfig }> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { error: 'Please enter your Establishment Code.' };
  const { data, error } = await cp.rpc('resolve_establishment', { p_code: trimmed });
  if (error) return { error: error.message };
  if (!data) return { error: 'Unknown or inactive Establishment Code.' };
  const r = data as { code: string; name: string; api_url: string; anon_key: string; status: string };
  if (r.status !== 'Active') return { error: `Establishment "${trimmed}" is ${r.status}.` };
  if (!r.api_url || !r.anon_key) return { error: 'This establishment is not fully provisioned yet. Try again shortly.' };
  const tenant: TenantConfig = { code: r.code, name: r.name, apiUrl: r.api_url, anonKey: r.anon_key };
  setActiveTenant(tenant);
  return { error: null, tenant };
}
