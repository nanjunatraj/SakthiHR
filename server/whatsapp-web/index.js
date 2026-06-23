// SakthiHR — WhatsApp Web companion service (whatsapp-web.js).
//
// Runs a persistent WhatsApp Web session on a headless Chromium. The SakthiHR app
// links a number by scanning the QR this service exposes, then sends messages and
// receives delivery acks — which are written back into the Supabase
// `whatsapp_notifications` table so the app's existing Check button shows status.
//
// ⚠️  whatsapp-web.js is UNOFFICIAL and against WhatsApp's Terms of Service. The
//     linked number can be banned, sessions can drop, and there is no SLA. The
//     official path is the WhatsApp Cloud API (already in the app). Use at your own risk.
//
// Endpoints (all require header `x-api-key: <API_KEY>`):
//   GET  /status  -> { status, me, hasQr }
//   GET  /qr      -> { qr: <dataURL> }   (scan this with WhatsApp → Linked devices)
//   POST /send    -> { to, message, employeeId?, category? } => { wamid, status }
//   POST /logout  -> unlink the number
//
// Env: PORT, API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOW_ORIGIN

import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const { Client, LocalAuth } = pkg;

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.API_KEY || '';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

const db = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

// ── WhatsApp client ───────────────────────────────────────────────────────────
let status = 'starting';   // starting | qr | authenticated | ready | disconnected
let qrDataUrl = null;
let me = null;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: process.env.SESSION_PATH || './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
});

client.on('qr', async (qr) => { status = 'qr'; qrDataUrl = await qrcode.toDataURL(qr); console.log('[wa] QR ready — scan it in the app or terminal.'); });
client.on('authenticated', () => { status = 'authenticated'; qrDataUrl = null; });
client.on('ready', () => { status = 'ready'; qrDataUrl = null; me = client.info?.wid?.user ?? null; console.log(`[wa] ready as +${me}`); });
client.on('auth_failure', (m) => { status = 'disconnected'; console.error('[wa] auth failure', m); });
client.on('disconnected', (r) => { status = 'disconnected'; me = null; console.warn('[wa] disconnected', r); setTimeout(() => client.initialize().catch(console.error), 3000); });

const ACK = { 1: 'Sent', 2: 'Delivered', 3: 'Read', 4: 'Read' };
client.on('message_ack', async (msg, ack) => {
  const mapped = ACK[ack];
  if (!mapped || !db) return;
  const wamid = msg?.id?._serialized;
  if (!wamid) return;
  await db.from('whatsapp_notifications').update({ status: mapped, status_at: new Date().toISOString() }).eq('wamid', wamid);
});

client.initialize().catch(console.error);

// ── HTTP API ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: ALLOW_ORIGIN }));
app.use(express.json());

// API-key gate (so only the app can drive this service).
app.use((req, res, next) => {
  if (API_KEY && req.header('x-api-key') !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

app.get('/status', (_req, res) => res.json({ status, me, hasQr: Boolean(qrDataUrl) }));
app.get('/qr', (_req, res) => res.json({ qr: qrDataUrl, status }));

app.post('/send', async (req, res) => {
  const to = String(req.body?.to ?? '').replace(/\D/g, '');
  const message = String(req.body?.message ?? '');
  const employeeId = req.body?.employeeId ?? null;
  const category = req.body?.category ?? 'general';

  const log = async (st, error, wamid = null) => {
    if (db) await db.from('whatsapp_notifications').insert({
      employee_id: employeeId, to_phone: req.body?.to ?? to, category, message,
      status: st, provider: 'web', wamid, error, status_at: new Date().toISOString(),
    });
  };

  if (status !== 'ready') { await log('Failed', `Not linked (status: ${status}).`); return res.json({ wamid: null, status: 'Failed', error: `Not linked (status: ${status}). Scan the QR first.` }); }
  if (!to) { await log('No Number', 'No phone number.'); return res.json({ wamid: null, status: 'No Number', error: 'No phone number.' }); }
  if (!message) return res.json({ wamid: null, status: 'Failed', error: 'Empty message.' });

  try {
    const sent = await client.sendMessage(`${to}@c.us`, message);
    const wamid = sent?.id?._serialized ?? null;
    await log('Sent', null, wamid);
    res.json({ wamid, status: 'Sent', error: null });
  } catch (e) {
    await log('Failed', e.message);
    res.json({ wamid: null, status: 'Failed', error: e.message });
  }
});

app.post('/logout', async (_req, res) => {
  try { await client.logout(); status = 'disconnected'; me = null; qrDataUrl = null; setTimeout(() => client.initialize().catch(console.error), 1500); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`[wa] WhatsApp Web service listening on :${PORT}`));
