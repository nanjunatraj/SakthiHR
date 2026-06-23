-- 20260617132926_add_breaks_jsonb_to_shifts
-- (exported from the live Supabase migration history)

-- Multiple, user-configurable breaks per shift (Short Break, Lunch, Tea, etc.).
-- Each element: { id, name, startTime, endTime, durationMinutes, paid }.
-- Legacy break_* columns are kept (mirror the aggregate) for backward compatibility.
alter table public.shifts add column if not exists breaks jsonb not null default '[]'::jsonb;
