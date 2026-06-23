-- 20260617183009_salary_component_statutory_type
-- (exported from the live Supabase migration history)

-- Classify each salary component's statutory role so payroll & breakdowns can link
-- them properly regardless of code: Basic, PF, ESI, Professional Tax, Income Tax (TDS).
alter table public.salary_components
  add column if not exists statutory_type text not null default 'none';  -- none|basic|pf|esi|professional_tax|income_tax

-- Carry over the earlier income-tax flag.
update public.salary_components set statutory_type = 'income_tax'
  where is_income_tax = true and statutory_type = 'none';
