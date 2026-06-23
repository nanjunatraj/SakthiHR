-- 20260617173806_employee_id_pattern
-- (exported from the live Supabase migration history)

-- Configurable Employee ID generation pattern, set in Establishment Master.
alter table public.establishment
  add column if not exists employee_id_pattern jsonb;
