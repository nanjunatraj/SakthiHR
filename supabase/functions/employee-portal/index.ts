// Employee Self-Service portal gateway.
//
// ESS employees have no Supabase session (they authenticate via verify_login), so
// this service-role function is their gateway to Storage + the documents table.
// Auth is token-based: `login` issues an opaque token (stored in portal_sessions),
// and every other action is authenticated by that token (durable across refresh —
// no password kept client-side).
//
//   POST { action:'login', login_id, password }   → { token, account }
//   POST { action:'session', token }              → { account }        (re-hydrate on refresh)
//   POST { action:'logout', token }               → { ok }
//   POST { action:'list_documents', token }       → { employment, personal }
//   POST { action:'upload_personal', token, doc_type, file_name, mime_type, file_base64, signature }
//   POST { action:'signed_url', token, id }       → { url }
//
// Deploy with --no-verify-jwt. Service-role + SUPABASE_URL injected automatically.

const URL_BASE = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DOCUMENTS_BUCKET = 'documents';
const SESSION_DAYS = 7;

const PERSONAL_TYPES = new Set(['id_proof', 'education_certificate', 'address_proof', 'medical_certificate', 'other']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...svc, ...(init.headers ?? {}) } });
  const t = await res.text();
  return { ok: res.ok, status: res.status, body: t ? JSON.parse(t) : null };
}

interface Account {
  id: string; name: string; loginId: string; password: ''; role: string | null;
  mustChangePassword: boolean; employeeId: string | null; employeeCode: string | null;
  mobile: string | null; email: string | null;
}

// Build the client-facing account shape from a system_users row (+ employee code).
async function accountFor(systemUserId: string): Promise<Account | null> {
  const q = await rest(`system_users?id=eq.${systemUserId}&select=id,name,login_id,role,must_change_password,employee_id,phone,email,employees:employee_id(employee_id)`);
  const r = (q.body ?? [])[0];
  if (!r) return null;
  const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees;
  return {
    id: r.id, name: r.name ?? '', loginId: r.login_id ?? '', password: '', role: r.role ?? null,
    mustChangePassword: Boolean(r.must_change_password),
    employeeId: r.employee_id ?? null, employeeCode: emp?.employee_id ?? null,
    mobile: r.phone ?? null, email: r.email ?? null,
  };
}

// Validate a portal token → its session row (or null when missing/expired).
async function sessionForToken(token: string): Promise<{ system_user_id: string; employee_code: string | null } | null> {
  if (!token) return null;
  const q = await rest(`portal_sessions?token=eq.${encodeURIComponent(token)}&select=system_user_id,employee_code,expires_at`);
  const row = (q.body ?? [])[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await rest(`portal_sessions?token=eq.${encodeURIComponent(token)}`, { method: 'DELETE' });
    return null;
  }
  return { system_user_id: row.system_user_id, employee_code: row.employee_code };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

const newToken = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
const refFilter = (code: string) => `or=(entity_ref.eq.${code},entity_ref.like.${code}/*)`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  // ── login: verify credentials, issue a durable token ──
  if (action === 'login') {
    const v = await rest('rpc/verify_login', {
      method: 'POST', body: JSON.stringify({ p_login_id: String(body.login_id ?? '').trim(), p_password: String(body.password ?? '') }),
    });
    const a = v.ok ? v.body : null;
    if (!a) return json({ error: 'invalid credentials' }, 401);
    const token = newToken();
    const ins = await rest('portal_sessions', {
      method: 'POST',
      body: JSON.stringify({
        token, system_user_id: a.id, login_id: a.login_id,
        employee_id: a.employee_id ?? null, employee_code: a.employee_code ?? null,
        expires_at: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(),
      }),
    });
    if (!ins.ok) return json({ error: 'could not start session' }, 500);
    const account = await accountFor(a.id);
    return json({ token, account });
  }

  // Everything below is token-authenticated.
  const token = String(body.token ?? '');
  const sess = await sessionForToken(token);
  if (!sess) return json({ error: 'session expired' }, 401);

  if (action === 'session') {
    const account = await accountFor(sess.system_user_id);
    if (!account) return json({ error: 'account not found' }, 404);
    return json({ account });
  }

  if (action === 'logout') {
    await rest(`portal_sessions?token=eq.${encodeURIComponent(token)}`, { method: 'DELETE' });
    return json({ ok: true });
  }

  const code = sess.employee_code;
  if (!code) return json({ error: 'no employee linked to this account' }, 400);

  if (action === 'list_documents') {
    const q = await rest(`documents?entity_type=eq.employee&${refFilter(code)}&order=created_at.asc&select=*`);
    const rows = (q.body ?? []) as Record<string, unknown>[];
    return json({ employment: rows.filter((r) => r.doc_group === 'employment'), personal: rows.filter((r) => r.doc_group === 'personal') });
  }

  if (action === 'upload_personal') {
    const doc_type = String(body.doc_type ?? '');
    if (!PERSONAL_TYPES.has(doc_type)) return json({ error: 'only Personal Details documents can be uploaded here' }, 400);
    if (!body.signature) return json({ error: 'a digital signature is required' }, 400);
    const fileName = String(body.file_name ?? 'document');
    const bytes = b64ToBytes(String(body.file_base64 ?? ''));
    if (!bytes.length) return json({ error: 'empty file' }, 400);
    const mime = String(body.mime_type ?? 'application/octet-stream');

    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const objectPath = `employee/${code}/${crypto.randomUUID()}-${safe}`;
    const up = await fetch(`${URL_BASE}/storage/v1/object/${DOCUMENTS_BUCKET}/${objectPath}`, {
      method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': mime }, body: bytes,
    });
    if (!up.ok) return json({ error: `upload failed (${up.status})` }, 502);

    const ins = await rest('documents', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        entity_type: 'employee', entity_ref: code, category: 'Personal Details',
        file_name: fileName, file_path: objectPath, bucket: DOCUMENTS_BUCKET,
        mime_type: mime, size_bytes: bytes.length,
        doc_group: 'personal', doc_type, uploaded_via: 'portal',
        approval_status: 'pending', signed: true, signature: body.signature,
      }),
    });
    if (!ins.ok) {
      await fetch(`${URL_BASE}/storage/v1/object/${DOCUMENTS_BUCKET}/${objectPath}`, { method: 'DELETE', headers: svc });
      return json({ error: 'could not record document' }, 500);
    }
    return json({ ok: true, document: (ins.body ?? [])[0] ?? null });
  }

  if (action === 'signed_url') {
    const id = String(body.id ?? '');
    const q = await rest(`documents?id=eq.${id}&entity_type=eq.employee&${refFilter(code)}&select=file_path,bucket`);
    const doc = (q.body ?? [])[0];
    if (!doc) return json({ error: 'not found' }, 404);
    const s = await fetch(`${URL_BASE}/storage/v1/object/sign/${doc.bucket || DOCUMENTS_BUCKET}/${doc.file_path}`, {
      method: 'POST', headers: svc, body: JSON.stringify({ expiresIn: 300 }),
    });
    const sj = await s.json().catch(() => ({}));
    if (!s.ok || !sj?.signedURL) return json({ error: 'could not sign url' }, 500);
    return json({ url: `${URL_BASE}/storage/v1${sj.signedURL}` });
  }

  return json({ error: 'unknown action' }, 400);
});
