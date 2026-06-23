-- 20260616044649_create_loan_emi_skip_requests
-- (exported from the live Supabase migration history)

-- Employee requests to skip an EMI for a given pay period.
-- Two-level approval: reporting manager, then HR.
create table if not exists public.loan_emi_skip_requests (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  payroll_period_id uuid references public.payroll_periods(id) on delete set null,
  emi_month_number integer,
  reason text not null,
  status text not null default 'Pending'
    check (status in ('Pending','ManagerApproved','Approved','Rejected')),
  manager_status text not null default 'Pending'
    check (manager_status in ('Pending','Approved','Rejected')),
  manager_id uuid references public.employees(id) on delete set null,
  manager_acted_on timestamptz,
  manager_remarks text,
  hr_status text not null default 'Pending'
    check (hr_status in ('Pending','Approved','Rejected')),
  hr_id uuid references public.employees(id) on delete set null,
  hr_acted_on timestamptz,
  hr_remarks text,
  requested_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.loan_emi_skip_requests is 'Employee EMI-skip requests for a pay period, approved by reporting manager then HR.';
create index if not exists loan_emi_skip_loan_id_idx on public.loan_emi_skip_requests(loan_id);
create index if not exists loan_emi_skip_employee_id_idx on public.loan_emi_skip_requests(employee_id);
create index if not exists loan_emi_skip_status_idx on public.loan_emi_skip_requests(status);

alter table public.loan_emi_skip_requests enable row level security;
create policy loan_emi_skip_requests_authenticated_all
  on public.loan_emi_skip_requests for all to authenticated using (true) with check (true);
