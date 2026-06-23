// One-off: create the first admin auth user via the Supabase Auth admin API.
// Reads the local-only SUPABASE_SECRET_KEY from .env (never bundled to client).
// Usage: node scripts/create-admin.mjs <email> <password>
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
  })
);

const url = env.VITE_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
const [, , email, password] = process.argv;
if (!email || !password) { console.error('Usage: node scripts/create-admin.mjs <email> <password>'); process.exit(1); }

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true }),
});
const body = await res.json();
if (!res.ok) { console.error('FAILED', res.status, JSON.stringify(body)); process.exit(1); }
console.log('CREATED user id:', body.id, 'email:', body.email);
