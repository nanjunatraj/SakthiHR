// WhatsApp Business Cloud API client. Sends go through the `whatsapp` Edge Function
// (which holds the access token server-side and calls Meta's Graph API); delivery
// status is pushed back by Meta webhooks into whatsapp_notifications and read here.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const wdb = supabase as unknown as SupabaseClient;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? '';
/** Public webhook/callback URL to register in the Meta App dashboard. */
export const WA_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp`;

export type WaProvider = 'cloud' | 'web' | 'off';

export interface WaConfig {
  enabled: boolean;
  provider: WaProvider;
  phoneNumberId: string;
  displayNumber: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  /** WhatsApp Web companion service (whatsapp-web.js) — base URL + API key. */
  webServiceUrl: string;
  webApiKey: string;
}

export interface WaMessage {
  id: string;
  employeeId: string | null;
  toPhone: string;
  category: string;
  message: string;
  status: string;        // Queued | Sent | Delivered | Read | Failed | No Number | Simulated
  provider: string;      // 'sim' | 'cloud'
  wamid: string | null;
  statusAt: string | null;
  error: string | null;
  createdAt: string;
}

/** Establishment WhatsApp Cloud API config (non-secret; the access token is a server secret). */
export async function loadWaConfig(): Promise<WaConfig> {
  const { data } = await wdb.from('establishment')
    .select('wa_enabled, wa_provider, wa_phone_number_id, wa_display_number, wa_business_account_id, wa_webhook_verify_token, wa_web_service_url, wa_web_api_key')
    .limit(1).maybeSingle();
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    enabled: Boolean(r.wa_enabled),
    provider: ((r.wa_provider as WaProvider) ?? 'cloud'),
    phoneNumberId: (r.wa_phone_number_id as string) ?? '',
    displayNumber: (r.wa_display_number as string) ?? '',
    businessAccountId: (r.wa_business_account_id as string) ?? '',
    webhookVerifyToken: (r.wa_webhook_verify_token as string) ?? '',
    webServiceUrl: (r.wa_web_service_url as string) ?? '',
    webApiKey: (r.wa_web_api_key as string) ?? '',
  };
}

const rowToMessage = (r: Record<string, unknown>): WaMessage => ({
  id: r.id as string, employeeId: (r.employee_id as string) ?? null, toPhone: (r.to_phone as string) ?? '',
  category: (r.category as string) ?? 'general', message: (r.message as string) ?? '',
  status: (r.status as string) ?? 'Sent', provider: (r.provider as string) ?? 'sim',
  wamid: (r.wamid as string) ?? null, statusAt: (r.status_at as string) ?? null,
  error: (r.error as string) ?? null, createdAt: (r.created_at as string) ?? '',
});

export interface SendResult { wamid: string | null; status: string; error: string | null }

/**
 * Send a WhatsApp message via the Cloud API Edge Function. The function logs the
 * message (and its Meta id) to whatsapp_notifications; status then arrives by webhook.
 */
export async function sendViaCloud(opts: { to?: string | null; message: string; employeeId?: string | null; category?: string }): Promise<SendResult> {
  try {
    const { data, error } = await wdb.functions.invoke('whatsapp', {
      body: { action: 'send', to: opts.to ?? '', message: opts.message, employeeId: opts.employeeId ?? null, category: opts.category ?? 'general' },
    });
    if (error) return { wamid: null, status: 'Failed', error: error.message };
    const r = (data ?? {}) as SendResult;
    return { wamid: r.wamid ?? null, status: r.status ?? 'Failed', error: r.error ?? null };
  } catch (e) {
    return { wamid: null, status: 'Failed', error: (e as Error).message };
  }
}

/** Most-recent WhatsApp message to an employee (for the Check delivery-status button). */
export async function latestStatusForEmployee(employeeId: string): Promise<WaMessage | null> {
  const { data } = await wdb.from('whatsapp_notifications')
    .select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data ? rowToMessage(data as Record<string, unknown>) : null;
}

/** Recent WhatsApp messages to an employee (status history). */
export async function recentForEmployee(employeeId: string, limit = 5): Promise<WaMessage[]> {
  const { data } = await wdb.from('whatsapp_notifications')
    .select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map(rowToMessage);
}

/** Subscribe to live status changes for an employee's messages; returns an unsubscribe fn. */
export function subscribeEmployeeStatus(employeeId: string, onChange: () => void): () => void {
  const ch = wdb.channel(`wa-status-${employeeId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_notifications', filter: `employee_id=eq.${employeeId}` }, () => onChange())
    .subscribe();
  return () => { void wdb.removeChannel(ch); };
}

export const STATUS_STYLE: Record<string, string> = {
  Queued: 'bg-gray-100 text-gray-600 border-gray-200',
  Sent: 'bg-blue-100 text-blue-700 border-blue-200',
  Delivered: 'bg-teal-100 text-teal-700 border-teal-200',
  Read: 'bg-green-100 text-green-700 border-green-200',
  Failed: 'bg-rose-100 text-rose-700 border-rose-200',
  'No Number': 'bg-amber-100 text-amber-700 border-amber-200',
  Simulated: 'bg-violet-100 text-violet-700 border-violet-200',
};
