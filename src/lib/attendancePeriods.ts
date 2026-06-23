import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const ppdb = supabase as unknown as SupabaseClient;

/** A payroll period, normalised for use by the attendance-entry screens. */
export interface AttPeriod {
  id: string;
  name: string;
  code: string;
  fromDate: string;
  toDate: string;
  status: string;
}

/** Load all payroll periods (most recent first) from the `payroll_periods` table. */
export async function loadPayrollPeriods(): Promise<AttPeriod[]> {
  const { data } = await ppdb
    .from('payroll_periods')
    .select('id, name, code, from_date, to_date, status')
    .order('from_date', { ascending: false });
  return ((data ?? []) as Record<string, any>[]).map(r => ({
    id: r.id,
    name: r.name ?? '',
    code: r.code ?? '',
    fromDate: r.from_date ?? '',
    toDate: r.to_date ?? '',
    status: r.status ?? 'Open',
  }));
}

/** Is the date (YYYY-MM-DD) within the period's range (inclusive)? */
export function isWithinPeriod(date: string, period?: AttPeriod | null): boolean {
  if (!period || !date) return false;
  return date >= period.fromDate && date <= period.toDate;
}

/** A period is editable for attendance entry unless it is locked/closed. */
export function isPeriodLocked(period?: AttPeriod | null): boolean {
  const s = (period?.status ?? '').toLowerCase();
  return s === 'locked' || s === 'closed';
}

/** React hook: loads payroll periods once and exposes loading state. */
export function usePayrollPeriods(): { periods: AttPeriod[]; loading: boolean } {
  const [periods, setPeriods] = useState<AttPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void loadPayrollPeriods().then(p => { if (active) { setPeriods(p); setLoading(false); } });
    return () => { active = false; };
  }, []);
  return { periods, loading };
}
