// ESS-portal document client. The portal has no Supabase session, so all document
// operations go through the `employee-portal` Edge Function (service role), which
// re-verifies the employee's login_id + password on every call.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { SignatureData } from '../components/AadhaarOTPSigning';

const fdb = supabase as unknown as SupabaseClient;

export interface PortalDocument {
  id: string;
  file_name: string;
  doc_group: 'employment' | 'personal';
  doc_type: string | null;
  approval_status: 'approved' | 'pending' | 'rejected';
  uploaded_via: 'admin' | 'portal';
  signed: boolean;
  signature: SignatureData | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface PortalCreds { loginId: string; password: string; }

async function call<T>(creds: PortalCreds, body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await fdb.functions.invoke('employee-portal', {
    body: { login_id: creds.loginId, password: creds.password, ...body },
  });
  if (error) {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    let msg = error.message;
    try { const b = ctx?.json ? await ctx.json() : null; if (b?.error) msg = b.error; } catch { /* ignore */ }
    return { data: null, error: msg };
  }
  const r = (data ?? {}) as { error?: string };
  if (r.error) return { data: null, error: r.error };
  return { data: data as T, error: null };
}

export async function listPortalDocuments(creds: PortalCreds): Promise<{ employment: PortalDocument[]; personal: PortalDocument[]; error: string | null }> {
  const { data, error } = await call<{ employment: PortalDocument[]; personal: PortalDocument[] }>(creds, { action: 'list_documents' });
  return { employment: data?.employment ?? [], personal: data?.personal ?? [], error };
}

export async function uploadPersonalDoc(
  creds: PortalCreds,
  file: File,
  docType: string,
  signature: SignatureData,
): Promise<{ error: string | null }> {
  const file_base64 = await fileToBase64(file);
  const { error } = await call(creds, {
    action: 'upload_personal', doc_type: docType,
    file_name: file.name, mime_type: file.type || 'application/octet-stream',
    file_base64, signature,
  });
  return { error };
}

export async function openPortalDocument(creds: PortalCreds, id: string): Promise<string | null> {
  const { data } = await call<{ url: string }>(creds, { action: 'signed_url', id });
  const url = data?.url ?? null;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
  return url;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? '');
      resolve(res.includes(',') ? res.slice(res.indexOf(',') + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
