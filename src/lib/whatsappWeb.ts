// Client for the self-hosted WhatsApp Web companion service (whatsapp-web.js).
// The service holds the QR-linked session; this just talks to it over HTTP using
// the Service URL + API Key configured in Establishment Master. Delivery acks are
// written by the service into whatsapp_notifications (read via lib/whatsappCloud).

import { loadWaConfig } from './whatsappCloud';
import type { SendResult } from './whatsappCloud';

export type WebStatus = 'starting' | 'qr' | 'authenticated' | 'ready' | 'disconnected' | 'unreachable';

export interface WebState { status: WebStatus; me: string | null; hasQr: boolean }

async function call(path: string, init?: RequestInit): Promise<Response> {
  const cfg = await loadWaConfig();
  const base = (cfg.webServiceUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('No WhatsApp Web service URL configured.');
  return fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.webApiKey || '', ...(init?.headers ?? {}) },
  });
}

/** Connection status of the companion service ('unreachable' when it can't be reached). */
export async function getWebStatus(): Promise<WebState> {
  try {
    const res = await call('/status');
    if (!res.ok) return { status: 'unreachable', me: null, hasQr: false };
    const d = await res.json();
    return { status: (d.status as WebStatus) ?? 'disconnected', me: d.me ?? null, hasQr: Boolean(d.hasQr) };
  } catch {
    return { status: 'unreachable', me: null, hasQr: false };
  }
}

/** Current QR (data URL) to scan, or null when not in the 'qr' state. */
export async function getWebQr(): Promise<string | null> {
  try {
    const res = await call('/qr');
    if (!res.ok) return null;
    const d = await res.json();
    return (d.qr as string) ?? null;
  } catch {
    return null;
  }
}

/** Send a message through the linked WhatsApp Web session. */
export async function sendViaWeb(opts: { to?: string | null; message: string; employeeId?: string | null; category?: string }): Promise<SendResult> {
  try {
    const res = await call('/send', { method: 'POST', body: JSON.stringify({ to: opts.to ?? '', message: opts.message, employeeId: opts.employeeId ?? null, category: opts.category ?? 'general' }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { wamid: null, status: 'Failed', error: (d.error as string) ?? `Service error ${res.status}` };
    return { wamid: d.wamid ?? null, status: d.status ?? 'Failed', error: d.error ?? null };
  } catch (e) {
    return { wamid: null, status: 'Failed', error: `Service unreachable: ${(e as Error).message}` };
  }
}

/** Unlink the WhatsApp number from the companion service. */
export async function logoutWeb(): Promise<{ error: string | null }> {
  try {
    const res = await call('/logout', { method: 'POST' });
    return res.ok ? { error: null } : { error: `Service error ${res.status}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
