-- 20260617012143_add_half_day_columns_to_holidays
-- (exported from the live Supabase migration history)

ALTER TABLE public.holidays
  ADD COLUMN IF NOT EXISTS is_half_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS half_day_session text;
