// Persistence layer for uploaded documents (metadata in `public.documents`,
// files in the private `documents` storage bucket).

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { SignatureData } from '../components/AadhaarOTPSigning';
import { uploadFile, removeFile, getSignedUrl, DOCUMENTS_BUCKET } from './storage';
import type { DocGroup, ApprovalStatus, UploadedVia } from './employeeDocuments';

const db = supabase as unknown as SupabaseClient;

export interface StoredDocument {
  id: string;
  entity_type: string;
  entity_ref: string;
  category: string | null;
  file_name: string;
  file_path: string;
  bucket: string;
  mime_type: string | null;
  size_bytes: number | null;
  signed: boolean;
  signature: SignatureData | null;
  doc_group: DocGroup | null;
  doc_type: string | null;
  approval_status: ApprovalStatus;
  uploaded_via: UploadedVia;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

/** Categorised upload metadata (group + subtype) for the Employee Documents Repository. */
export interface DocMeta {
  group: DocGroup;
  type: string;
  /** friendly category label stored alongside the slug. */
  category?: string;
}

/** Documents for one entity (optionally filtered by category). */
export async function listDocuments(entityType: string, entityRef: string, category?: string): Promise<StoredDocument[]> {
  let q = db.from('documents').select('*').eq('entity_type', entityType).eq('entity_ref', entityRef);
  if (category) q = q.eq('category', category);
  const { data, error } = await q.order('created_at', { ascending: true });
  if (error) { console.warn('[documents] list failed:', error.message); return []; }
  return (data ?? []) as StoredDocument[];
}

/**
 * Documents for one employee in a given group. `entityRef` is the employee code;
 * we match both the code itself and any legacy `code/subpath` rows.
 */
export async function listByGroup(entityType: string, entityRef: string, group: DocGroup): Promise<StoredDocument[]> {
  const { data, error } = await db.from('documents').select('*')
    .eq('entity_type', entityType).eq('doc_group', group)
    .or(`entity_ref.eq.${entityRef},entity_ref.like.${entityRef}/*`)
    .order('created_at', { ascending: true });
  if (error) { console.warn('[documents] listByGroup failed:', error.message); return []; }
  return (data ?? []) as StoredDocument[];
}

/** Upload a file to the private bucket and record its metadata row. */
export async function uploadDocument(
  entityType: string,
  entityRef: string,
  category: string,
  file: File,
  meta?: DocMeta,
): Promise<{ doc: StoredDocument | null; error: string | null }> {
  const { path, error: upErr } = await uploadFile(DOCUMENTS_BUCKET, `${entityType}/${entityRef}`, file);
  if (upErr || !path) return { doc: null, error: upErr ?? 'upload failed' };

  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await db.from('documents').insert({
    entity_type: entityType,
    entity_ref: entityRef,
    category: meta?.category ?? category,
    file_name: file.name,
    file_path: path,
    bucket: DOCUMENTS_BUCKET,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: auth?.user?.id ?? null,
    // Categorised repository fields. Admin uploads are auto-approved; the RLS
    // check blocks a non-admin owner from ever inserting an employment doc.
    doc_group: meta?.group ?? null,
    doc_type: meta?.type ?? null,
    uploaded_via: 'admin',
    approval_status: 'approved',
  }).select('*').single();

  if (error) {
    // Roll back the orphaned object if the metadata insert failed.
    void removeFile(DOCUMENTS_BUCKET, path);
    return { doc: null, error: error.message };
  }
  return { doc: data as StoredDocument, error: null };
}

/** Approve a pending (employee-portal) document. */
export async function approveDocument(id: string): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db.from('documents').update({
    approval_status: 'approved', approved_by: auth?.user?.id ?? null,
    approved_at: new Date().toISOString(), rejection_reason: null,
  }).eq('id', id);
  return error?.message ?? null;
}

/** Reject a pending (employee-portal) document, recording the reason. */
export async function rejectDocument(id: string, reason: string): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db.from('documents').update({
    approval_status: 'rejected', approved_by: auth?.user?.id ?? null,
    approved_at: new Date().toISOString(), rejection_reason: reason,
  }).eq('id', id);
  return error?.message ?? null;
}

/** Persist the signature onto a document row. */
export async function signDocument(id: string, signature: SignatureData): Promise<string | null> {
  const { error } = await db.from('documents').update({ signed: true, signature }).eq('id', id);
  return error?.message ?? null;
}

/** Delete a document row and its stored object. */
export async function deleteDocument(doc: Pick<StoredDocument, 'id' | 'bucket' | 'file_path'>): Promise<string | null> {
  const { error } = await db.from('documents').delete().eq('id', doc.id);
  if (error) return error.message;
  void removeFile(doc.bucket || DOCUMENTS_BUCKET, doc.file_path);
  return null;
}

/** Short-lived signed URL for a private document (for the in-app viewer). */
export async function documentSignedUrl(doc: Pick<StoredDocument, 'bucket' | 'file_path'>): Promise<string | null> {
  return getSignedUrl(doc.bucket || DOCUMENTS_BUCKET, doc.file_path, 300);
}

/** Open a private document in a new tab via a short-lived signed URL. */
export async function openDocument(doc: Pick<StoredDocument, 'bucket' | 'file_path'>): Promise<void> {
  const url = await documentSignedUrl(doc);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}
