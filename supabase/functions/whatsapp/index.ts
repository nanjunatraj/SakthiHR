// WhatsApp Business Cloud API (Meta) gateway.
//
// One Edge Function handles three things, branched by request:
//   • POST { action:'send', to, message, employeeId?, category? }  → send a text message
//     via the Graph API and log it (with the returned message id) to whatsapp_notifications.
//   • GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…   → Meta webhook verification.
//   • POST { object:'whatsapp_business_account', … }               → Meta delivery-status webhook;
//     updates whatsapp_notifications rows by message id (sent/delivered/read/failed).
//
// Secrets: WHATSAPP_TOKEN (Meta access token) — set by the user, never stored in the DB.
// Establishment row holds the non-secret config (phone number id, verify token, enabled flag).
//
// Deploy with --no-verify-jwt so Meta's webhook (unauthenticated) can reach it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH_VERSION = 'v21.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

const STATUS_MAP: Record<string, string> = { sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed' };

async function loadConfig(db: ReturnType<typeof admin>) {
  const { data } = await db.from('establishment')
    .select('wa_enabled, wa_phone_number_id, wa_webhook_verify_token').limit(1).maybeSingle();
  return (data ?? {}) as { wa_enabled?: boolean; wa_phone_number_id?: string; wa_webhook_verify_token?: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = admin();

  // ── Meta webhook verification (GET) ────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const cfg = await loadConfig(db);
    if (mode === 'subscribe' && token && token === cfg.wa_webhook_verify_token) {
      return new Response(challenge ?? '', { status: 200, headers: CORS });
    }
    return new Response('Forbidden', { status: 403, headers: CORS });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* empty body */ }

  // ── Meta delivery-status webhook (POST) ────────────────────────────────────
  if (payload.object === 'whatsapp_business_account') {
    try {
      const entries = (payload.entry ?? []) as Array<Record<string, any>>;
      for (const e of entries) {
        for (const ch of (e.changes ?? [])) {
          for (const st of (ch.value?.statuses ?? [])) {
            const wamid = st.id as string;
            const status = STATUS_MAP[st.status as string] ?? (st.status as string);
            const err = st.errors?.[0]?.title ?? st.errors?.[0]?.message ?? null;
            const at = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString();
            if (wamid) await db.from('whatsapp_notifications').update({ status, status_at: at, error: err }).eq('wamid', wamid);
          }
        }
      }
    } catch (_e) { /* always 200 so Meta doesn't retry-storm */ }
    return new Response('EVENT_RECEIVED', { status: 200, headers: CORS });
  }

  // ── Send a message (POST { action:'send', … }) ─────────────────────────────
  if (payload.action === 'send') {
    const to = String(payload.to ?? '').replace(/\D/g, '');
    const message = String(payload.message ?? '');
    const employeeId = (payload.employeeId as string) ?? null;
    const category = (payload.category as string) ?? 'general';

    const logFail = async (status: string, error: string) => {
      await db.from('whatsapp_notifications').insert({
        employee_id: employeeId, to_phone: payload.to ?? null, category, message,
        status, provider: 'cloud', error, status_at: new Date().toISOString(),
      });
      return json({ wamid: null, status, error }, 200);
    };

    if (!to) return logFail('No Number', 'No phone number provided.');
    if (!message) return json({ wamid: null, status: 'Failed', error: 'Empty message.' }, 200);

    const cfg = await loadConfig(db);
    if (!cfg.wa_enabled || !cfg.wa_phone_number_id) return logFail('Failed', 'WhatsApp Cloud API is not enabled / Phone Number ID missing in Establishment Master.');

    const token = Deno.env.get('WHATSAPP_TOKEN');
    if (!token) return logFail('Failed', 'Server secret WHATSAPP_TOKEN is not set.');

    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${cfg.wa_phone_number_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: message } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = body?.error?.message ?? `Graph API error ${res.status}`;
        return logFail('Failed', err);
      }
      const wamid = body?.messages?.[0]?.id ?? null;
      await db.from('whatsapp_notifications').insert({
        employee_id: employeeId, to_phone: payload.to ?? to, category, message,
        status: 'Sent', provider: 'cloud', wamid, status_at: new Date().toISOString(),
      });
      return json({ wamid, status: 'Sent', error: null }, 200);
    } catch (e) {
      return logFail('Failed', `Send failed: ${(e as Error).message}`);
    }
  }

  return json({ error: 'Unrecognised request.' }, 400);
});
