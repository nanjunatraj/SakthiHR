// Provision a new establishment = a brand-new, isolated Supabase project.
//
//   POST { code, name }  (caller must be the platform super admin)
//
// Steps: authorize → insert registry row (Provisioning) → create project via the
// Management API → poll until healthy → apply the tenant schema template (+ seed)
// → create the default ADMIN (Supabase Auth + system_users) → record anon key and
// store the service key in Vault → mark the registry row Active. Any failure marks
// the row Failed with the error.
//
// Required Edge Function secrets (set on the control-plane project):
//   SUPABASE_ACCESS_TOKEN  — Management API token (account → access tokens)
//   SUPABASE_ORG_ID        — organization to create projects in
//   SUPABASE_PROJECT_REGION (optional, default ap-south-1)
// Auto-present in the runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const CP_URL = Deno.env.get('SUPABASE_URL')!;
const CP_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MGMT_TOKEN = Deno.env.get('SUPABASE_ACCESS_TOKEN') ?? '';
const ORG_ID = Deno.env.get('SUPABASE_ORG_ID') ?? '';
const REGION = Deno.env.get('SUPABASE_PROJECT_REGION') ?? 'ap-south-1';
const MGMT = 'https://api.supabase.com';
const ARTIFACT_BUCKET = 'platform-artifacts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const cpHeaders = { apikey: CP_SERVICE, Authorization: `Bearer ${CP_SERVICE}`, 'Content-Type': 'application/json' };
const mgmtHeaders = { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' };

async function cpRest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CP_URL}/rest/v1/${path}`, { ...init, headers: { ...cpHeaders, ...(init.headers ?? {}) } });
  const t = await res.text();
  return { ok: res.ok, status: res.status, body: t ? JSON.parse(t) : null };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomPassword = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(18))).map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 56]).join('');

// Run SQL on a tenant project through the Management API.
async function tenantQuery(ref: string, query: string) {
  const res = await fetch(`${MGMT}/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: mgmtHeaders, body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`tenant query failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json().catch(() => null);
}

async function setRegistry(code: string, patch: Record<string, unknown>) {
  await cpRest(`establishments?code=eq.${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!MGMT_TOKEN || !ORG_ID) return json({ error: 'Provisioning is not configured: set SUPABASE_ACCESS_TOKEN and SUPABASE_ORG_ID secrets.' }, 500);

  // Authorize: caller must be the platform super admin.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'missing token' }, 401);
  const who = await fetch(`${CP_URL}/auth/v1/user`, { headers: { apikey: CP_SERVICE, Authorization: `Bearer ${token}` } });
  if (!who.ok) return json({ error: 'invalid session' }, 401);
  const caller = await who.json();
  const callerRow = await cpRest(`system_users?auth_user_id=eq.${caller.id}&select=role`);
  if (!(callerRow.body ?? []).some((r: { role: string }) => r.role === 'Super Admin')) {
    return json({ error: 'only the platform super admin can create establishments' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? '').trim().toUpperCase();
  const name = String(body.name ?? '').trim();
  if (!/^[A-Z0-9]{2,10}$/.test(code)) return json({ error: 'code must be 2–10 letters/numbers' }, 400);
  if (!name) return json({ error: 'name is required' }, 400);

  // Reserve the registry row (unique code guards against duplicates).
  const ins = await cpRest('establishments', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ code, name, status: 'Provisioning', created_by: caller.id }),
  });
  if (!ins.ok) return json({ error: ins.body?.message?.includes('duplicate') ? `Code "${code}" already exists.` : (ins.body?.message ?? 'could not create registry row') }, 400);

  try {
    // 1) Create the project.
    const dbPass = randomPassword();
    const createRes = await fetch(`${MGMT}/v1/projects`, {
      method: 'POST', headers: mgmtHeaders,
      body: JSON.stringify({ name: `SakthiHR-${code}`, organization_id: ORG_ID, region: REGION, db_pass: dbPass }),
    });
    if (!createRes.ok) throw new Error(`create project failed (${createRes.status}): ${(await createRes.text()).slice(0, 300)}`);
    const project = await createRes.json();
    const ref: string = project.id ?? project.ref;
    await setRegistry(code, { project_ref: ref });

    // 2) Poll until healthy (up to ~5 min).
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      const st = await fetch(`${MGMT}/v1/projects/${ref}`, { headers: mgmtHeaders });
      if (st.ok && (await st.json()).status === 'ACTIVE_HEALTHY') { healthy = true; break; }
    }
    if (!healthy) throw new Error('project did not become healthy in time');

    // 3) Apply schema template (+ optional seed) fetched from control-plane Storage.
    const dl = async (obj: string) => {
      const r = await fetch(`${CP_URL}/storage/v1/object/${ARTIFACT_BUCKET}/${obj}`, { headers: { Authorization: `Bearer ${CP_SERVICE}`, apikey: CP_SERVICE } });
      return r.ok ? r.text() : null;
    };
    const template = await dl('tenant_template.sql');
    if (!template) throw new Error(`tenant_template.sql not found in Storage bucket "${ARTIFACT_BUCKET}"`);
    await tenantQuery(ref, template);
    const seed = await dl('tenant_seed.sql');
    if (seed) await tenantQuery(ref, seed);

    // 4) Tenant API keys.
    const keysRes = await fetch(`${MGMT}/v1/projects/${ref}/api-keys`, { headers: mgmtHeaders });
    const keys = await keysRes.json();
    const anonKey = (keys.find?.((k: { name: string }) => k.name === 'anon') ?? {}).api_key;
    const serviceKey = (keys.find?.((k: { name: string }) => k.name === 'service_role') ?? {}).api_key;
    const apiUrl = `https://${ref}.supabase.co`;
    if (!anonKey || !serviceKey) throw new Error('could not read tenant API keys');

    // 5) Default ADMIN — Supabase Auth account via the tenant's GoTrue admin API…
    const tHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
    const adminEmail = `admin@${code.toLowerCase()}.local`;
    const mk = await fetch(`${apiUrl}/auth/v1/admin/users`, {
      method: 'POST', headers: tHeaders,
      body: JSON.stringify({ email: adminEmail, password: 'PASSWORD', email_confirm: true, user_metadata: { full_name: 'Administrator' } }),
    });
    const adminUser = await mk.json();
    if (!mk.ok || !adminUser?.id) throw new Error(`could not create ADMIN auth user: ${adminUser?.msg ?? mk.status}`);

    // …and the matching system_users row (login_id ADMIN / password PASSWORD, hashed by trigger).
    await tenantQuery(ref, `
      insert into public.establishment (name, short_name) values (${quote(name)}, ${quote(code)})
        on conflict do nothing;
      insert into public.system_users (name, email, role, status, login_id, password, must_change_password, auth_user_id)
        values ('Administrator', ${quote(adminEmail)}, 'Super Admin', 'Active', 'ADMIN', 'PASSWORD', true, ${quote(adminUser.id)});`);

    // 6) Store the service key in Vault (control-plane helper) and activate.
    await cpRest('rpc/vault_store_tenant_key', { method: 'POST', body: JSON.stringify({ p_ref: ref, p_service_key: serviceKey }) });
    await setRegistry(code, { api_url: apiUrl, anon_key: anonKey, status: 'Active', error: null });

    return json({ ok: true, code, project_ref: ref, api_url: apiUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await setRegistry(code, { status: 'Failed', error: msg });
    return json({ error: msg }, 500);
  }
});

// Minimal SQL literal quoting for values we control (uuids, short identifiers, names).
function quote(v: string) { return `'${String(v).replace(/'/g, "''")}'`; }
