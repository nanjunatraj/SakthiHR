-- 20260618143850_deduction_entries_and_overtime_component
-- (exported from the live Supabase migration history)

-- Fines & deductions entries (DeductionEntry page was session-only)
create table if not exists public.deduction_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  category text not null,
  description text,
  amount numeric not null default 0,
  payroll_period_id uuid references public.payroll_periods(id) on delete set null,
  reference_no text,
  remarks text,
  status text not null default 'Draft',
  approved_by text,
  approved_at timestamptz,
  employee_approval_required boolean not null default false,
  employee_approval_status text,
  employee_approval_at timestamptz,
  employee_rejection_reason text,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.deduction_entries enable row level security;
drop policy if exists "authenticated all deduction_entries" on public.deduction_entries;
create policy "authenticated all deduction_entries" on public.deduction_entries for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.deduction_entries;

-- Overtime as a salary component: flag + rate config
alter table public.salary_components add column if not exists is_overtime boolean not null default false;
alter table public.salary_components add column if not exists overtime_multiplier numeric not null default 2;
alter table public.salary_components add column if not exists overtime_hours_per_month numeric not null default 208;
