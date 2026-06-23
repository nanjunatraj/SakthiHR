-- 20260618003321_leave_policies
-- (exported from the live Supabase migration history)

create table if not exists public.leave_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  effective_from date,
  effective_to date,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leave_policy_entitlements (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.leave_policies(id) on delete cascade,
  leave_type_id uuid references public.leave_types(id) on delete set null,
  leave_type_name text,
  leave_type_code text,
  leave_type_color text,
  days_per_year numeric not null default 0,
  max_consecutive_days integer not null default 0,
  min_days_per_application numeric not null default 0,
  allow_half_day boolean not null default true,
  advance_notice_days integer not null default 0,
  accrual_frequency text not null default 'Monthly',
  accrual_days_per_cycle numeric not null default 0,
  accrue_on_probation boolean not null default true,
  waiting_period_days integer not null default 0,
  carry_forward_policy text not null default 'None',
  max_carry_forward_days numeric not null default 0,
  carry_forward_percentage numeric not null default 0,
  carry_forward_expiry_months integer not null default 0,
  encashment_policy text not null default 'None',
  max_encashment_days_per_year numeric not null default 0,
  encashment_multiplier numeric not null default 1,
  encashment_taxable boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.leave_policies enable row level security;
alter table public.leave_policy_entitlements enable row level security;
drop policy if exists leave_policies_authenticated_all on public.leave_policies;
create policy leave_policies_authenticated_all on public.leave_policies for all to authenticated using (true) with check (true);
drop policy if exists leave_policy_entitlements_authenticated_all on public.leave_policy_entitlements;
create policy leave_policy_entitlements_authenticated_all on public.leave_policy_entitlements for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.leave_policies;
