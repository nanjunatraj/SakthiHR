import React, { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { resolvePhotoUrl } from '../lib/storage';

const db = supabase as unknown as SupabaseClient;

// Shared, lazily-loaded map of employee code → photo object PATH (in the private
// employee-photos bucket), so every avatar across the app can show the real
// photo without each view re-querying. Loaded once and cached for the session.
let photoCache: Record<string, string> | null = null;
// Resolved signed-URL cache keyed by stored path, so repeated avatars of the
// same employee don't each mint a new signed URL.
const signedUrlCache = new Map<string, string>();
let inflight: Promise<Record<string, string>> | null = null;
const subscribers = new Set<() => void>();

async function loadPhotoMap(): Promise<Record<string, string>> {
  if (photoCache) return photoCache;
  if (!inflight) {
    inflight = (async () => {
      const { data } = await db.from('employees').select('employee_id, current_employee_id, photo_url');
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: { employee_id: string | null; current_employee_id: string | null; photo_url: string | null }) => {
        if (r.photo_url) {
          if (r.employee_id) map[r.employee_id] = r.photo_url;
          if (r.current_employee_id) map[r.current_employee_id] = r.photo_url;
        }
      });
      photoCache = map;
      subscribers.forEach(fn => fn());
      return map;
    })();
  }
  return inflight;
}

/** Call after uploading a new photo so already-mounted avatars refresh. */
export function primeEmployeePhoto(code: string, url: string) {
  photoCache = { ...(photoCache ?? {}), [code]: url };
  subscribers.forEach(fn => fn());
}

interface EmployeeAvatarProps {
  /** Initials shown when no photo is available. */
  initials?: string;
  name?: string;
  /** Explicit photo URL (skips the lookup). */
  photoUrl?: string;
  /** Employee code to resolve a photo from the shared cache. */
  employeeCode?: string;
  /** Pixel size of the square. */
  size?: number;
  /** Corner rounding. */
  rounded?: 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

function initialsFrom(name?: string, initials?: string): string {
  if (initials) return initials;
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

/**
 * Employee avatar that renders the uploaded photo when one exists (by explicit
 * URL or resolved from the shared cache via employeeCode), falling back to
 * initials. Use this everywhere an employee face/initial is shown.
 */
export default function EmployeeAvatar({
  initials, name, photoUrl, employeeCode, size = 32, rounded = 'lg', className = '',
}: EmployeeAvatarProps) {
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;

    // Turn a stored path (or explicit value) into a renderable (signed) URL.
    const resolve = async (value?: string) => {
      if (!value) { if (active) setResolved(undefined); return; }
      const cached = signedUrlCache.get(value);
      if (cached) { if (active) setResolved(cached); return; }
      const url = await resolvePhotoUrl(value);
      if (url) signedUrlCache.set(value, url);
      if (active) setResolved(url ?? undefined);
    };

    if (photoUrl) { void resolve(photoUrl); return; }
    if (!employeeCode) { setResolved(undefined); return; }

    const update = () => { void resolve(photoCache?.[employeeCode]); };
    subscribers.add(update);
    void loadPhotoMap().then(update);
    return () => { active = false; subscribers.delete(update); };
  }, [photoUrl, employeeCode]);

  const radius = rounded === 'full' ? '9999px' : rounded === 'xl' ? '0.75rem' : rounded === 'lg' ? '0.5rem' : '0.375rem';

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={name ?? 'Employee photo'}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover' }}
        className={`shrink-0 bg-accent ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.max(9, size * 0.36) }}
      className={`shrink-0 bg-primary/10 text-primary font-bold flex items-center justify-center ${className}`}
    >
      {initialsFrom(name, initials)}
    </div>
  );
}
