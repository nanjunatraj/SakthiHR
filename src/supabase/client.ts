import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// The build-time credentials point at the CONTROL-PLANE project: the establishments
// registry + provisioning functions. This project also hosts the SAKTHI tenant.
const CONTROL_URL = import.meta.env.VITE_SUPABASE_URL as string;
const CONTROL_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const TENANT_STORAGE_KEY = 'sakthihr.activeTenant';
// Set while the platform super admin is "accessing a tenant as Admin" from the
// Platform Administration console. Holds the tenant code being impersonated.
const ADMIN_ACCESS_KEY = 'sakthihr.adminAccess';

export interface TenantConfig {
  code: string;
  name: string;
  apiUrl: string;
  anonKey: string;
}

const authOpts = {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
} as const;

function makeClient(url: string, key: string): SupabaseClient<Database> {
  // supabase-js derives its localStorage session key from the project URL, so
  // separate tenant projects keep separate sessions automatically.
  return createClient<Database>(url, key, authOpts);
}

/** Fixed control-plane client — establishments registry, resolver, provisioning fns. */
export const controlPlane: SupabaseClient<Database> = makeClient(CONTROL_URL, CONTROL_KEY);

/** Project ref of the control plane itself (also hosts SAKTHI) — never deletable. */
export const CONTROL_REF = CONTROL_URL.replace(/^https?:\/\//, '').split('.')[0];

function loadSavedTenant(): TenantConfig | null {
  try {
    const raw = localStorage.getItem(TENANT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TenantConfig) : null;
  } catch {
    return null;
  }
}

let activeConfig: TenantConfig | null = loadSavedTenant();
// Active tenant client. Until the user selects an establishment by code we fall back
// to the control plane (which also hosts the SAKTHI tenant).
let activeClient: SupabaseClient<Database> =
  activeConfig ? makeClient(activeConfig.apiUrl, activeConfig.anonKey) : controlPlane;

export function getActiveTenant(): TenantConfig | null {
  return activeConfig;
}

export function getActiveClient(): SupabaseClient<Database> {
  return activeClient;
}

/**
 * Point the app at a tenant project. The caller should reload the app afterwards
 * so React contexts (AuthContext, etc.) re-initialise against the new client.
 */
export function setActiveTenant(cfg: TenantConfig): SupabaseClient<Database> {
  activeConfig = cfg;
  localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(cfg));
  activeClient = makeClient(cfg.apiUrl, cfg.anonKey);
  return activeClient;
}

export function clearActiveTenant(): void {
  activeConfig = null;
  localStorage.removeItem(TENANT_STORAGE_KEY);
  activeClient = controlPlane;
}

/**
 * Admin-access ("impersonation") mode. When the platform super admin opens a
 * tenant via "Access as Admin", we record the tenant code so the rest of the app
 * knows to show the tenant's HR dashboard (not the platform console) and to offer
 * a "Return to Platform Administration" exit.
 */
export function getAdminAccess(): string | null {
  try { return localStorage.getItem(ADMIN_ACCESS_KEY); } catch { return null; }
}

export function setAdminAccess(code: string): void {
  try { localStorage.setItem(ADMIN_ACCESS_KEY, code); } catch { /* ignore */ }
}

export function clearAdminAccess(): void {
  try { localStorage.removeItem(ADMIN_ACCESS_KEY); } catch { /* ignore */ }
}

/**
 * Leave admin-access mode: sign out of the impersonated tenant, drop the active
 * tenant, and fall back to the control plane (where the super admin's own session
 * still lives). The caller should reload so contexts re-initialise.
 */
export async function exitAdminAccess(): Promise<void> {
  try { await activeClient.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
  clearAdminAccess();
  clearActiveTenant();
}

// Back-compat: every `import { supabase }` across the app keeps working and always
// forwards to the currently-active tenant client.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = activeClient as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(activeClient) : value;
  },
}) as SupabaseClient<Database>;
