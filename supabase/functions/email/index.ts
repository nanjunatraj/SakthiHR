// Email gateway + open/attachment/receipt tracking.
//
// One Edge Function, branched by request:
//   • POST { action:'send', id }                  → render the email (body + tracking pixel +
//       tracked "View / Download" link + "Confirm Receipt" link), attach the stored HTML
//       document, send via SMTP (config read from the establishment row), update the
//       email_deliveries row (Sent/Failed + message id).
//   • GET  ?a=open&t=TOKEN                         → 1×1 gif; marks the mail Opened.
//   • GET  ?a=doc&t=TOKEN                          → marks the attachment Viewed; 302 → signed doc URL.
//   • GET  ?a=confirm&t=TOKEN                      → marks Confirmed; returns a confirmation page.
//
// SMTP credentials live on the establishment row (per project decision) and are read here
// server-side via the service role. Deploy with --no-verify-jwt so the unauthenticated
// open/doc/confirm links (clicked from the employee's mail client) can reach it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const DOCUMENTS_BUCKET = 'documents';

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

const FN_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1/email`;

// 1×1 transparent GIF.
const PIXEL = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));

// Status rank — open/doc/confirm only advance the status forward, never backward.
const RANK: Record<string, number> = { Queued: 0, Simulated: 1, Sent: 2, Opened: 3, Viewed: 4, Confirmed: 5 };
const advance = (cur: string, next: string) => ((RANK[next] ?? 0) > (RANK[cur] ?? 0) ? next : cur);

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const db = admin();

  // ── Tracking endpoints (GET) ──────────────────────────────────────────────
  const action = url.searchParams.get('a');
  const token = url.searchParams.get('t');
  if (req.method === 'GET' && action && token) {
    const { data: row } = await db.from('email_deliveries').select('*').eq('token', token).maybeSingle();

    if (action === 'open') {
      if (row) {
        await db.from('email_deliveries').update({
          opened_at: row.opened_at ?? new Date().toISOString(),
          status: advance(row.status, 'Opened'),
          updated_at: new Date().toISOString(),
        }).eq('id', row.id);
      }
      return new Response(PIXEL, { headers: { ...CORS, 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } });
    }

    if (action === 'doc') {
      let target = '';
      if (row) {
        await db.from('email_deliveries').update({
          opened_at: row.opened_at ?? new Date().toISOString(),
          doc_opened_at: row.doc_opened_at ?? new Date().toISOString(),
          status: advance(row.status, 'Viewed'),
          updated_at: new Date().toISOString(),
        }).eq('id', row.id);
        if (row.doc_path) {
          const { data: signed } = await db.storage.from(DOCUMENTS_BUCKET).createSignedUrl(row.doc_path, 3600);
          target = signed?.signedUrl ?? '';
        }
      }
      if (target) return new Response(null, { status: 302, headers: { ...CORS, Location: target } });
      return new Response('<h2 style="font-family:system-ui">Document is no longer available.</h2>', {
        headers: { ...CORS, 'Content-Type': 'text/html' },
      });
    }

    if (action === 'confirm') {
      if (row) {
        await db.from('email_deliveries').update({
          opened_at: row.opened_at ?? new Date().toISOString(),
          confirmed_at: row.confirmed_at ?? new Date().toISOString(),
          status: advance(row.status, 'Confirmed'),
          updated_at: new Date().toISOString(),
        }).eq('id', row.id);
      }
      const title = esc(row?.document_title ?? 'Document');
      return new Response(
        `<!doctype html><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
         <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:80px auto;text-align:center;padding:32px;border:1px solid #e2e8f0;border-radius:16px;">
           <div style="font-size:48px;line-height:1">✓</div>
           <h2 style="color:#0f766e;margin:12px 0 6px;">Receipt Confirmed</h2>
           <p style="color:#475569;">Thank you — your receipt of <strong>${title}</strong> has been recorded.</p>
         </div>`,
        { headers: { ...CORS, 'Content-Type': 'text/html' } },
      );
    }
    return json({ error: 'unknown action' }, 400);
  }

  // ── Send (POST) ────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let id = '';
    try { id = (await req.json())?.id ?? ''; } catch { /* ignore */ }
    if (!id) return json({ error: 'id required' }, 400);

    const { data: row } = await db.from('email_deliveries').select('*').eq('id', id).maybeSingle();
    if (!row) return json({ error: 'delivery not found' }, 404);
    if (!row.to_email) {
      await db.from('email_deliveries').update({ status: 'No Email', updated_at: new Date().toISOString() }).eq('id', id);
      return json({ status: 'No Email' });
    }

    const { data: est } = await db.from('establishment')
      .select('email_enabled, email_provider, email_host, email_port, email_secure, email_username, email_password, email_from_name, email_from_address, email_reply_to')
      .limit(1).maybeSingle();

    if (!est?.email_enabled || est?.email_provider !== 'smtp' || !est?.email_host || !est?.email_from_address) {
      await db.from('email_deliveries').update({ status: 'Failed', error: 'Email not configured', updated_at: new Date().toISOString() }).eq('id', id);
      return json({ error: 'Email not configured' }, 400);
    }

    // Build the email body: message + tracked links + 1×1 open pixel.
    const t = encodeURIComponent(row.token);
    const docLink = `${FN_BASE}?a=doc&t=${t}`;
    const confirmLink = `${FN_BASE}?a=confirm&t=${t}`;
    const openPixel = `${FN_BASE}?a=open&t=${t}`;
    const btn = 'display:inline-block;padding:10px 18px;border-radius:8px;font-weight:600;text-decoration:none;';
    const bodyHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;max-width:640px;margin:auto;">
        ${row.body_html ?? `<p>Please find your <strong>${esc(row.document_title ?? 'document')}</strong> attached.</p>`}
        ${row.doc_path ? `<p style="margin:20px 0;"><a href="${docLink}" style="${btn}background:#4f46e5;color:#fff;">View / Download ${esc(row.document_title ?? 'Document')}</a></p>` : ''}
        <p style="margin:20px 0;"><a href="${confirmLink}" style="${btn}background:#0f766e;color:#fff;">✓ Confirm Receipt</a></p>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px;">If you received this in error, please ignore it. This is an automated message.</p>
      </div>
      <img src="${openPixel}" width="1" height="1" alt="" style="display:none" />`;

    // Attachment — the stored document. A PDF is attached as binary (base64);
    // anything else (HTML) is attached as text. Type is inferred from the path.
    const attachments: Array<Record<string, unknown>> = [];
    if (row.doc_path) {
      const { data: file } = await db.storage.from(DOCUMENTS_BUCKET).download(row.doc_path);
      if (file) {
        const safe = String(row.document_title ?? 'document').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'document';
        if (String(row.doc_path).toLowerCase().endsWith('.pdf')) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let bin = '';
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          attachments.push({ filename: `${safe}.pdf`, content: btoa(bin), encoding: 'base64', contentType: 'application/pdf' });
        } else {
          const text = await file.text();
          attachments.push({ filename: `${safe}.html`, content: text, encoding: 'text', contentType: 'text/html; charset=utf-8' });
        }
      }
    }

    // Implicit TLS is used only on port 465; 587/25 connect in plaintext and STARTTLS-upgrade
    // automatically (denomailer). Tying tls:true to every port breaks 587 with
    // "received corrupt message of type InvalidContentType".
    const port = Number(est.email_port) || (est.email_secure ? 465 : 587);
    const useTls = est.email_secure === false ? false : port === 465;
    const client = new SMTPClient({
      connection: {
        hostname: est.email_host,
        port,
        tls: useTls,
        auth: est.email_username ? { username: est.email_username, password: est.email_password ?? '' } : undefined,
      },
    });

    try {
      await client.send({
        from: est.email_from_name ? `${est.email_from_name} <${est.email_from_address}>` : est.email_from_address,
        to: row.to_email,
        replyTo: est.email_reply_to || undefined,
        subject: row.subject ?? row.document_title ?? 'Document',
        html: bodyHtml,
        // deno-lint-ignore no-explicit-any
        attachments: attachments as any,
      });
      await client.close();
      await db.from('email_deliveries').update({
        status: 'Sent', provider: 'smtp', sent_at: new Date().toISOString(),
        message_id: `smtp-${Date.now()}`, error: null, updated_at: new Date().toISOString(),
      }).eq('id', id);
      return json({ status: 'Sent' });
    } catch (e) {
      try { await client.close(); } catch { /* ignore */ }
      const msg = e instanceof Error ? e.message : String(e);
      await db.from('email_deliveries').update({ status: 'Failed', error: msg, updated_at: new Date().toISOString() }).eq('id', id);
      return json({ error: msg }, 502);
    }
  }

  return json({ error: 'unsupported request' }, 405);
});
