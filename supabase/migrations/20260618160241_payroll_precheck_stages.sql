-- 20260618160241_payroll_precheck_stages
-- (exported from the live Supabase migration history)

create table if not exists public.payroll_precheck_stages (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  stage text not null,
  status text not null default 'Open',
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, stage)
);
alter table public.payroll_precheck_stages enable row level security;
drop policy if exists "authenticated all payroll_precheck_stages" on public.payroll_precheck_stages;
create policy "authenticated all payroll_precheck_stages" on public.payroll_precheck_stages for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.payroll_precheck_stages;
