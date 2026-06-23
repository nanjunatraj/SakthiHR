// ─────────────────────────────────────────────────────────────────────────────
// Digital Signing Framework — Aadhaar OTP eSign
// ─────────────────────────────────────────────────────────────────────────────
//
// This module is the single integration point for digitally signing uploaded
// documents using Aadhaar-based OTP authentication (UIDAI eSign model).
//
// Flow (see <AadhaarOTPSigning/> for the UI):
//   1. Operator enters the 12-digit Aadhaar of the signer + records consent.
//   2. An OTP is requested against the Aadhaar-linked mobile (UIDAI OTP API).
//   3. The OTP is verified and an eSign transaction is created, returning a
//      signature hash + transaction id (UIDAI eSign / ASP gateway).
//   4. The resulting SignatureData is attached to the document and recorded
//      here as an immutable audit entry in `document_signatures`.
//
// PRODUCTION NOTE: real UIDAI eSign must go through a licensed ASP/ESP gateway
// (e.g. NSDL/CDAC/Protean) over a server-side endpoint — the Aadhaar number and
// OTP must never be sent to a third party from the browser, and the signature is
// a PKCS#7 produced by the ESP. The current UI simulates steps 2–3 for demo
// purposes; swap `requestOtp`/`verifyOtpAndSign` below for real gateway calls
// (ideally proxied through a Supabase Edge Function) without touching callers.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { SignatureData } from '../components/AadhaarOTPSigning';

// document_signatures isn't in the generated Database type yet; use a loose client.
const db = supabase as unknown as SupabaseClient;

export interface SignatureMeta {
  /** Human-readable document name. */
  documentName: string;
  /** Optional grouping, e.g. "Statutory", "Education", "Factory License". */
  documentCategory?: string;
  /** Where the document lives, e.g. "employee", "work_location", "establishment". */
  source?: string;
}

/**
 * Persist a completed signature as an immutable audit record. Best-effort:
 * never throws, so a transient DB/RLS issue can't block the signing UX (the
 * signature is still attached to the in-memory/parent document either way).
 */
export async function recordSignature(sig: SignatureData, meta: SignatureMeta): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await db.from('document_signatures').insert({
      document_ref: sig.documentId,
      document_name: meta.documentName,
      document_category: meta.documentCategory ?? null,
      source: meta.source ?? null,
      signer_name: sig.signerName,
      signer_employee_id: sig.signerEmployeeId,
      signed_by: auth?.user?.id ?? null,
      aadhaar_last4: sig.aadhaarLast4,
      transaction_id: sig.transactionId,
      signature_hash: sig.signatureHash,
      signed_at: sig.signedAt,
    });
    if (error) console.warn('[digitalSignature] audit insert failed:', error.message);
  } catch (e) {
    console.warn('[digitalSignature] audit insert error:', e);
  }
}

/** Fetch audit records for a set of document refs (e.g. to show signed state). */
export async function fetchSignatures(documentRefs: string[]): Promise<SignatureData[]> {
  if (!documentRefs.length) return [];
  const { data } = await db
    .from('document_signatures')
    .select('document_ref, signer_name, signer_employee_id, aadhaar_last4, transaction_id, signature_hash, signed_at')
    .in('document_ref', documentRefs);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    documentId: r.document_ref as string,
    signerName: (r.signer_name as string) ?? '',
    signerEmployeeId: (r.signer_employee_id as string) ?? '',
    aadhaarLast4: (r.aadhaar_last4 as string) ?? '',
    transactionId: (r.transaction_id as string) ?? '',
    signatureHash: (r.signature_hash as string) ?? '',
    signedAt: (r.signed_at as string) ?? '',
  }));
}
