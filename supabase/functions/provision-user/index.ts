// Privileged user provisioning — dependency-free (Deno built-in fetch only), so
// it boots even where the edge runtime has no outbound internet to fetch npm/esm
// modules. All calls target the internal Supabase URL (resolvable in-cluster).
//
//   POST { action:'create_org_admin', org_id, email, password, full_name }
//        → caller must be super_admin. Creates an auth user + org_admin membership.
//   POST { action:'create_user', org_id, email, password, full_name }
//        → caller must be super_admin OR org_admin of that org. Creates a user.
//   POST { action:'set_membership_status', membership_id, status }
//
// The service-role key never reaches the browser; the client calls this with its
// own JWT and we authorize the caller here before creating accounts.

const URL_BASE = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const svcHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

// REST helper (service role → bypasses RLS).
async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...svcHeaders, ...(init.headers ?? {}) } });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // 1. Identify the caller from their bearer token via GoTrue.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'missing token' }, 401);
  const userRes = await fetch(`${URL_BASE}/auth/v1/user`, { headers: { apikey: SERVICE, Authorization: `Bearer ${token}` } });
  if (!userRes.ok) return json({ error: 'invalid session' }, 401);
  const caller = await userRes.json();
  if (!caller?.id) return json({ error: 'invalid session' }, 401);

  // 2. Load caller roles.
  const mems = await rest(`memberships?user_id=eq.${caller.id}&status=eq.Active&select=role,org_id`);
  const roles: { role: string; org_id: string | null }[] = mems.body ?? [];
  const isSuper = roles.some((m) => m.role === 'super_admin');
  const isOrgAdminOf = (org: string) => roles.some((m) => m.role === 'org_admin' && m.org_id === org);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = String(body.action ?? '');

  if (action === 'create_org_admin' || action === 'create_user') {
    const org_id = String(body.org_id ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const full_name = String(body.full_name ?? '');
    const role = action === 'create_org_admin' ? 'org_admin' : 'user';

    if (!org_id || !email || !password) return json({ error: 'org_id, email and password are required' }, 400);
    if (role === 'org_admin' && !isSuper) return json({ error: 'only a super admin can create org admins' }, 403);
    if (role === 'user' && !isSuper && !isOrgAdminOf(org_id)) return json({ error: 'not allowed for this organization' }, 403);

    // Create the auth user.
    const createRes = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: 'POST', headers: svcHeaders,
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } }),
    });
    const created = await createRes.json();
    if (!createRes.ok || !created?.id) return json({ error: created?.msg ?? created?.error_description ?? 'could not create user' }, 400);

    // Link membership; roll back the auth user if that fails.
    const mem = await rest('memberships', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: created.id, org_id, role, email, full_name }),
    });
    if (!mem.ok) {
      await fetch(`${URL_BASE}/auth/v1/admin/users/${created.id}`, { method: 'DELETE', headers: svcHeaders });
      return json({ error: (mem.body?.message) ?? 'could not create membership' }, 400);
    }
    return json({ user_id: created.id, email, role });
  }

  if (action === 'set_membership_status') {
    const membership_id = String(body.membership_id ?? '');
    const status = String(body.status ?? '');
    if (!['Active', 'Inactive'].includes(status)) return json({ error: 'invalid status' }, 400);
    const found = await rest(`memberships?id=eq.${membership_id}&select=org_id`);
    const m = (found.body ?? [])[0];
    if (!m) return json({ error: 'membership not found' }, 404);
    if (!isSuper && !isOrgAdminOf(m.org_id)) return json({ error: 'not allowed' }, 403);
    const upd = await rest(`memberships?id=eq.${membership_id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (!upd.ok) return json({ error: 'update failed' }, 400);
    return json({ ok: true });
  }

  return json({ error: 'unknown action' }, 400);
});
