-- 20260618011508_leave_policy_allocations
-- (exported from the live Supabase migration history)

create table if not exists public.leave_policy_allocations (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.leave_policies(id) on delete cascade,
  policy_name text not null,
  policy_code text,
  filter_criteria jsonb not null default '{}'::jsonb,
  allocated_employees jsonb not null default '[]'::jsonb,
  effective_from date,
  effective_to date,
  status text not null default 'Active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leave_policy_allocations enable row level security;

drop policy if exists "authenticated all leave_policy_allocations" on public.leave_policy_allocations;
create policy "authenticated all leave_policy_allocations" on public.leave_policy_allocations
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.leave_policy_allocations;
