import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;

export interface LookupValue {
  id: string;
  code: string | null;
  label: string;
  sort_order: number;
  metadata: Record<string, unknown> | null;
}

// Session cache so the same category isn't refetched by every component.
const cache = new Map<string, LookupValue[]>();
const inflight = new Map<string, Promise<LookupValue[]>>();

async function load(category: string): Promise<LookupValue[]> {
  const hit = cache.get(category);
  if (hit) return hit;
  if (!inflight.has(category)) {
    inflight.set(category, (async () => {
      const { data } = await db
        .from('lookup_values')
        .select('id, code, label, sort_order, metadata')
        .eq('category', category)
        .eq('is_active', true)
        .order('sort_order');
      const rows = (data ?? []) as LookupValue[];
      cache.set(category, rows);
      return rows;
    })());
  }
  return inflight.get(category)!;
}

/** Live (cached) list of lookup values for a category, e.g. useLookup('shift_category'). */
export function useLookup(category: string): LookupValue[] {
  const [rows, setRows] = useState<LookupValue[]>(() => cache.get(category) ?? []);
  useEffect(() => {
    let active = true;
    void load(category).then(r => { if (active) setRows(r); });
    return () => { active = false; };
  }, [category]);
  return rows;
}
