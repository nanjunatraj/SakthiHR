-- 20260617193115_vpf_percentage_assignment
-- (exported from the live Supabase migration history)

-- Per-employee Voluntary PF percentage (extra employee PF over the statutory rate).
alter table public.employee_salary_assignments
  add column if not exists vpf_percentage numeric not null default 0;
