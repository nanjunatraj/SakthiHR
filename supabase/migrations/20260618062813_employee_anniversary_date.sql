-- 20260618062813_employee_anniversary_date
-- (exported from the live Supabase migration history)

alter table public.employees add column if not exists anniversary_date date;
comment on column public.employees.anniversary_date is 'Wedding anniversary date (captured when marital status is Married) — used for greetings.';
