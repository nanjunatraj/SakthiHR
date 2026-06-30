// Manage an existing establishment (caller must be the platform super admin).
//
//   POST { action:'compact',  code }   → VACUUM (ANALYZE) the tenant database
//   POST { action:'suspend',  code }   → pause the tenant project
//   POST { action:'restore',  code }   → restore a paused tenant project
//   POST { action:'admin_session', code } → mint an ADMIN session on the tenant so
//                                            the desktop can "access portal as Admin"
//
// Secrets: SUPABASE_ACCESS_TOKEN (Management API). Auto-present: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Tenant service keys are read from Vault via the
// vault_get_tenant_key control-plane RPC.

const CP_URL = Deno.env.get('SUPABASE_URL')!;
const CP_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MGMT_TOKEN = Deno.env.get('SUPABASE_ACCESS_TOKEN') ?? '';
const MGMT = 'https://api.supabase.com';
// Ref of the control-plane project itself — never deletable (it also hosts SAKTHI).
const CP_REF = CP_URL.replace('https://', '').split('.')[0];

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!MGMT_TOKEN) return json({ error: 'Management not configured: set SUPABASE_ACCESS_TOKEN.' }, 500);

  // Authorize: platform super admin only.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'missing token' }, 401);
  const who = await fetch(`${CP_URL}/auth/v1/user`, { headers: { apikey: CP_SERVICE, Authorization: `Bearer ${token}` } });
  if (!who.ok) return json({ error: 'invalid session' }, 401);
  const caller = await who.json();
  const callerRow = await cpRest(`system_users?auth_user_id=eq.${caller.id}&select=role`);
  if (!(callerRow.body ?? []).some((r: { role: string }) => r.role === 'Super Admin')) {
    return json({ error: 'only the platform super admin can manage establishments' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const code = String(body.code ?? '').trim().toUpperCase();

  const reg = await cpRest(`establishments?code=eq.${encodeURIComponent(code)}&select=*`);
  const est = (reg.body ?? [])[0];
  if (!est) return json({ error: 'establishment not found' }, 404);
  const ref = est.project_ref as string;
  if (!ref) return json({ error: 'establishment has no project yet' }, 400);

  try {
    if (action === 'compact') {
      const r = await fetch(`${MGMT}/v1/projects/${ref}/database/query`, {
        method: 'POST', headers: mgmtHeaders, body: JSON.stringify({ query: 'VACUUM (ANALYZE);' }),
      });
      if (!r.ok) throw new Error(`compact failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
      await cpRest(`establishments?code=eq.${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify({ last_compacted_at: new Date().toISOString() }) });
      return json({ ok: true });
    }

    if (action === 'suspend' || action === 'restore') {
      const r = await fetch(`${MGMT}/v1/projects/${ref}/${action === 'suspend' ? 'pause' : 'restore'}`, { method: 'POST', headers: mgmtHeaders });
      if (!r.ok) throw new Error(`${action} failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
      await cpRest(`establishments?code=eq.${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify({ status: action === 'suspend' ? 'Suspended' : 'Active' }) });
      return json({ ok: true });
    }

    if (action === 'delete') {
      // Safety: never delete the control-plane project (it also hosts SAKTHI).
      if (ref === CP_REF) return json({ error: 'The platform/SAKTHI project cannot be deleted.' }, 400);
      const del = await fetch(`${MGMT}/v1/projects/${ref}`, { method: 'DELETE', headers: mgmtHeaders });
      // 404 means the project is already gone — treat as success so the registry can be cleaned up.
      if (!del.ok && del.status !== 404) throw new Error(`delete project failed (${del.status}): ${(await del.text()).slice(0, 200)}`);
      await cpRest('rpc/vault_delete_tenant_key', { method: 'POST', body: JSON.stringify({ p_ref: ref }) }).catch(() => {});
      await cpRest(`establishments?code=eq.${encodeURIComponent(code)}`, { method: 'DELETE' });
      return json({ ok: true });
    }

    if (action === 'admin_session') {
      // Read the tenant service key from Vault, then mint an ADMIN session via a
      // server-verified magic link (no password needed).
      const keyRes = await cpRest('rpc/vault_get_tenant_key', { method: 'POST', body: JSON.stringify({ p_ref: ref }) });
      const serviceKey = keyRes.body as string | null;
      if (!serviceKey) throw new Error('tenant service key unavailable');
      const apiUrl = est.api_url as string;
      const adminEmail = `admin@${code.toLowerCase()}.local`;
      const tHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

      const linkRes = await fetch(`${apiUrl}/auth/v1/admin/generate_link`, {
        method: 'POST', headers: tHeaders, body: JSON.stringify({ type: 'magiclink', email: adminEmail }),
      });
      const link = await linkRes.json();
      if (!linkRes.ok || !link?.hashed_token) throw new Error(`could not generate admin link: ${link?.msg ?? linkRes.status}`);

      const verifyRes = await fetch(`${apiUrl}/auth/v1/verify`, {
        method: 'POST', headers: { apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'magiclink', token: link.hashed_token }),
      });
      const session = await verifyRes.json();
      if (!verifyRes.ok || !session?.access_token) throw new Error(`could not mint admin session: ${session?.msg ?? verifyRes.status}`);

      return json({
        ok: true, name: est.name, api_url: apiUrl, anon_key: est.anon_key,
        access_token: session.access_token, refresh_token: session.refresh_token,
      });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
