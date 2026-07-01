// Employee Self-Service portal document gateway.
//
// The ESS portal logs in via the verify_login RPC and has NO Supabase session, so
// ESS employees are the anon role and cannot touch Storage or the documents table
// under RLS. This service-role function is their only path. Each call re-verifies
// the employee's login_id + password (bcrypt) via verify_login before acting.
//
//   POST { action:'list_documents', login_id, password }
//        → { employment:[…view/download…], personal:[…with approval status…] }
//   POST { action:'upload_personal', login_id, password, doc_type, file_name,
//          mime_type, file_base64, signature }
//        → uploads to the private documents bucket + inserts a PENDING, self-signed
//          personal document. Employment doc_types are rejected.
//   POST { action:'signed_url', login_id, password, id }
//        → { url } short-lived signed URL for a document the employee owns.
//
// Deploy with --no-verify-jwt (ESS callers are unauthenticated). Service-role +
// SUPABASE_URL are injected automatically.

const URL_BASE = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DOCUMENTS_BUCKET = 'documents';

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

// Authenticate an ESS employee by re-checking credentials via verify_login (bcrypt,
// server-side). Returns the account (incl. employee_code) or null.
async function authenticate(loginId: string, password: string) {
  const r = await rest('rpc/verify_login', {
    method: 'POST', body: JSON.stringify({ p_login_id: String(loginId ?? '').trim(), p_password: String(password ?? '') }),
  });
  const a = r.ok ? r.body : null;
  if (!a || !a.employee_code) return null; // must be linked to an employee to own documents
  return a as { id: string; login_id: string; name: string; employee_code: string; employee_id: string };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// PostgREST filter matching the employee code and any legacy code/subpath rows.
const refFilter = (code: string) => `or=(entity_ref.eq.${code},entity_ref.like.${code}/*)`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const acct = await authenticate(body.login_id, body.password);
  if (!acct) return json({ error: 'invalid credentials' }, 401);
  const code = acct.employee_code;

  if (action === 'list_documents') {
    const q = await rest(`documents?entity_type=eq.employee&${refFilter(code)}&order=created_at.asc&select=*`);
    const rows = (q.body ?? []) as Record<string, unknown>[];
    const employment = rows.filter((r) => r.doc_group === 'employment');
    const personal = rows.filter((r) => r.doc_group === 'personal');
    return json({ employment, personal });
  }

  if (action === 'upload_personal') {
    const doc_type = String(body.doc_type ?? '');
    if (!PERSONAL_TYPES.has(doc_type)) return json({ error: 'only Personal Details documents can be uploaded here' }, 400);
    if (!body.signature) return json({ error: 'a digital signature is required' }, 400);
    const fileName = String(body.file_name ?? 'document');
    const bytes = b64ToBytes(String(body.file_base64 ?? ''));
    if (!bytes.length) return json({ error: 'empty file' }, 400);
    const mime = String(body.mime_type ?? 'application/octet-stream');

    // Store the object under employee/<code>/… then record a PENDING, self-signed row.
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
