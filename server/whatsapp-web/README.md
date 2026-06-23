# SakthiHR — WhatsApp Web companion service

Links a WhatsApp number to SakthiHR by **scanning a QR with your phone** (via
[whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)), then sends
messages to employees and writes delivery acks back into Supabase
(`whatsapp_notifications`) so the app's **Check** button shows status.

> ⚠️ **Unofficial & against WhatsApp's Terms of Service.** whatsapp-web.js automates
> WhatsApp Web; the linked number **can be banned**, the session can drop, and there's
> no SLA. The supported path is the **WhatsApp Cloud API** (already built into the app —
> Establishment Master → Provider → *Cloud API*). Use this only if you accept the risk.

## What it is
A tiny Node/Express service that holds the WhatsApp Web session. The browser app can't
do this itself (it needs a real Chromium + an always-on process), so it runs separately
and the app talks to it over HTTP.

Endpoints (all require header `x-api-key: <API_KEY>`):
| Method | Path | Purpose |
|---|---|---|
| GET  | `/status` | `{ status, me, hasQr }` |
| GET  | `/qr`     | `{ qr: <dataURL> }` — render & scan in WhatsApp → Linked devices |
| POST | `/send`   | `{ to, message, employeeId?, category? }` → `{ wamid, status }` |
| POST | `/logout` | Unlink the number |

## Run locally (dev)
```bash
cd server/whatsapp-web
cp .env.example .env        # set API_KEY + SUPABASE_SERVICE_ROLE_KEY
npm install
npm start                   # listens on http://localhost:8787
```
Then in the app: **Establishment Master → WhatsApp → Provider: WhatsApp Web**, set
**Service URL** = `http://localhost:8787` and **API Key** = the same `API_KEY`. Open the
QR panel, scan it from your phone (WhatsApp → Settings → Linked devices → Link a device).

## Host it (production)
Needs **always-on** + a **persistent disk** for the session (`.wwebjs_auth`), so it
survives restarts and doesn't re-prompt for the QR. A Dockerfile is included.

- **Render / Railway / Fly.io** (easiest): deploy this folder as a Docker service, attach
  a persistent volume mounted at `/app/.wwebjs_auth`, set the env vars from `.env.example`.
  Avoid free tiers that sleep — sleeping drops the session.
- **A small VPS** (DigitalOcean/Hetzner/EC2): `docker build -t sakthihr-wa . && docker run -d
  --env-file .env -p 8787:8787 -v wa_session:/app/.wwebjs_auth sakthihr-wa`.

Set **ALLOW_ORIGIN** to your app's URL and put the service behind HTTPS. The
`SUPABASE_SERVICE_ROLE_KEY` lives ONLY here (never in the front-end).

## Env
See `.env.example`: `PORT`, `API_KEY`, `ALLOW_ORIGIN`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_PATH`.
