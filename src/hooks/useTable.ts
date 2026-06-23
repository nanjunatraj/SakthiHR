import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

// A loosely-typed view of the client for dynamic (runtime table-name) access.
// The strongly-typed `supabase` only accepts literal table names; this generic
// hook is parameterised by a string, so we use the generic-schema client here.
// Per-call result shapes are re-applied via the hook's <Row> type parameter.
const db = supabase as unknown as SupabaseClient;

type OrderBy = { column: string; ascending?: boolean };

interface UseTableOptions {
  /** Columns to select (supports PostgREST embedded resources, e.g. "*, department:departments(name)"). */
  select?: string;
  /** Server-side ordering. */
  orderBy?: OrderBy;
}

export interface UseTableResult<Row, Insert, Update> {
  rows: Row[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  insert: (values: Insert) => Promise<{ data: Row | null; error: string | null }>;
  update: (id: string, values: Update) => Promise<{ data: Row | null; error: string | null }>;
  remove: (id: string) => Promise<{ error: string | null }>;
}

/**
 * Live, typed access to a single Supabase table.
 *
 * - Loads the rows once on mount.
 * - Subscribes to Postgres Realtime and refetches on any change, so a write on
 *   one device shows up on every other connected device within ~a second.
 *   (Refetching — rather than patching in the payload — keeps embedded/joined
 *   selects and server-side ordering correct, which incremental patching can't.)
 * - insert/update/remove persist to Postgres; the resulting Realtime event
 *   refreshes the list (including on the device that made the change), so the
 *   database stays the single source of truth.
 */
export function useTable<Row extends { id: string }, Insert = Partial<Row>, Update = Partial<Row>>(
  table: string,
  options: UseTableOptions = {},
): UseTableResult<Row, Insert, Update> {
  const { select = '*', orderBy } = options;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = useCallback(async () => {
    let query = db.from(table).select(select);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await query;
    if (error) {
      setError(error.message);
    } else {
      setRows((data ?? []) as unknown as Row[]);
      setError(null);
    }
    setLoading(false);
  }, [table, select, orderBy?.column, orderBy?.ascending]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchRows();

    const scheduleRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { if (active) void fetchRows(); }, 120);
    };

    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefetch)
      .subscribe();

    return () => {
      active = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [table, fetchRows]);

  // After every successful write we refetch directly (in addition to the Realtime
  // subscription) so the list updates even if the table isn't in the Realtime
  // publication or the socket is unavailable.
  const insert = useCallback(async (values: Insert) => {
    const { data, error } = await db.from(table).insert(values as never).select(select).single();
    if (!error) void fetchRows();
    return { data: (data as unknown as Row) ?? null, error: error?.message ?? null };
  }, [table, select, fetchRows]);

  const update = useCallback(async (id: string, values: Update) => {
    const { data, error } = await db.from(table).update(values as never).eq('id', id).select(select).single();
    if (!error) void fetchRows();
    return { data: (data as unknown as Row) ?? null, error: error?.message ?? null };
  }, [table, select, fetchRows]);

  const remove = useCallback(async (id: string) => {
    const { error } = await db.from(table).delete().eq('id', id);
    if (!error) void fetchRows();
    return { error: error?.message ?? null };
  }, [table, fetchRows]);

  return { rows, loading, error, refetch: fetchRows, insert, update, remove };
}
