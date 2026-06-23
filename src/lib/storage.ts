// ─────────────────────────────────────────────────────────────────────────────
// Secure file storage helpers (Supabase Storage)
// ─────────────────────────────────────────────────────────────────────────────
//
// Two buckets:
//   • `documents`        — PRIVATE. Files are never publicly reachable; they are
//                          served only through short-lived signed URLs. All
//                          uploaded documents go here.
//   • `employee-photos`  — PUBLIC read, with random/unguessable object paths.
//                          Lets a face photo render anywhere via a stable URL
//                          without a per-render signed-URL round-trip.
//
// Access is additionally gated by storage RLS (authenticated-only writes).

import { supabase } from '../supabase/client';

export const DOCUMENTS_BUCKET = 'documents';
export const PHOTOS_BUCKET = 'employee-photos';
export const LETTERHEAD_BUCKET = 'letterhead-assets';

/** Random, collision-resistant id for object paths. */
function rand(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Sanitize a filename for safe use inside a storage path. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

/**
 * Upload a file to a bucket under `<prefix>/<uuid>-<filename>`.
 * Returns the stored object path (relative to the bucket) or an error message.
 */
export async function uploadFile(
  bucket: string,
  prefix: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const path = `${prefix.replace(/^\/+|\/+$/g, '')}/${rand()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

/** Time-limited signed URL for a private object (default 1 hour). */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) { console.warn('[storage] signed url failed:', error.message); return null; }
  return data?.signedUrl ?? null;
}

/** Stable public URL for an object in a public bucket (e.g. employee photos). */
export function getPublicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Remove an object. Best-effort. */
export async function removeFile(bucket: string, path: string): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return error?.message ?? null;
}

// Employee photos live in the PRIVATE `employee-photos` bucket. We persist the
// object PATH on employees.photo_url and resolve a short-lived signed URL each
// time a photo is rendered (see resolvePhotoUrl / EmployeeAvatar).

/** Upload an employee photo to the private bucket; returns its object path. */
export async function uploadEmployeePhoto(
  employeeRef: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  return uploadFile(PHOTOS_BUCKET, `employees/${employeeRef || 'unassigned'}`, file);
}

/** Signed URL for a stored photo path (default 1 hour). Pass-through for blank/legacy values. */
export async function resolvePhotoUrl(pathOrUrl: string, expiresInSeconds = 3600): Promise<string | null> {
  if (!pathOrUrl) return null;
  // Legacy/public values (full URLs or data URIs) are returned as-is.
  if (/^(https?:|data:)/.test(pathOrUrl)) return pathOrUrl;
  return getSignedUrl(PHOTOS_BUCKET, pathOrUrl, expiresInSeconds);
}

// Letterhead/company-logo & banner images live in the PUBLIC `letterhead-assets`
// bucket. We store the stable public URL on the letterhead/establishment columns
// and render it directly (no signed-URL round trip) — these are non-sensitive
// branding assets. Replaces the old base64 data-URL-in-DB approach.

/**
 * Upload a letterhead image (logo / header banner / footer banner / company logo)
 * to the public bucket. Returns its stable public URL, or an error message.
 */
export async function uploadLetterheadImage(
  prefix: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) return { url: null, error: 'Please upload an image file.' };
  if (file.size > 5 * 1024 * 1024) return { url: null, error: 'Image must be under 5 MB.' };
  const { path, error } = await uploadFile(LETTERHEAD_BUCKET, prefix || 'misc', file);
  if (error || !path) return { url: null, error: error ?? 'upload failed' };
  return { url: getPublicUrl(LETTERHEAD_BUCKET, path), error: null };
}

/** Persist the photo object path onto the employee record (matched by employee code). */
export async function updateEmployeePhotoUrl(employeeCode: string, pathOrUrl: string): Promise<void> {
  if (!employeeCode) return;
  const { error } = await supabase
    .from('employees')
    .update({ photo_url: pathOrUrl })
    .or(`employee_id.eq.${employeeCode},current_employee_id.eq.${employeeCode}`);
  if (error) console.warn('[storage] photo_url update failed:', error.message);
}
