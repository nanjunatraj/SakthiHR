-- 20260617185911_payroll_settings_bonus_gratuity_overrides
-- (exported from the live Supabase migration history)

-- Bonus (statutory) configuration + gratuity accrual flag on the org-wide payroll settings.
alter table public.pf_esi_config
  add column if not exists bonus_enabled boolean not null default false,
  add column if not exists bonus_percentage numeric not null default 8.33,
  add column if not exists bonus_wage_ceiling numeric not null default 7000,
  add column if not exists bonus_eligibility_limit numeric not null default 21000,
  add column if not exists gratuity_accrual_enabled boolean not null default true;

-- Per-employee PF/ESI/PT eligibility + rates + ceilings (employee & employer), default from settings.
alter table public.employee_salary_assignments
  add column if not exists statutory_overrides jsonb;

-- Gratuity exit settlements.
create table if not exists public.gratuity_settlements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  settlement_date date not null,
  years_of_service numeric not null default 0,
  last_basic numeric not null default 0,
  gratuity_amount numeric not null default 0,
  formula text,
  remarks text,
  created_at timestamptz not null default now()
);
alter table public.gratuity_settlements enable row level security;
drop policy if exists gratuity_settlements_authenticated_all on public.gratuity_settlements;
create policy gratuity_settlements_authenticated_all on public.gratuity_settlements for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.gratuity_settlements;
