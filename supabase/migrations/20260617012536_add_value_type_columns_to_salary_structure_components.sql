-- 20260617012536_add_value_type_columns_to_salary_structure_components
-- (exported from the live Supabase migration history)

ALTER TABLE public.salary_structure_components
  ADD COLUMN IF NOT EXISTS value_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS custom_values numeric[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selected_custom_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS formula text;
