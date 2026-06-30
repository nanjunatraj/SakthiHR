import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// The build-time credentials point at the CONTROL-PLANE project: the establishments
// registry + provisioning functions. This project also hosts the SAKTHI tenant.
const CONTROL_URL = import.meta.env.VITE_SUPABASE_URL as string;
const CONTROL_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const TENANT_STORAGE_KEY = 'sakthihr.activeTenant';

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

// Back-compat: every `import { supabase }` across the app keeps working and always
// forwards to the currently-active tenant client.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = activeClient as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(activeClient) : value;
  },
}) as SupabaseClient<Database>;
