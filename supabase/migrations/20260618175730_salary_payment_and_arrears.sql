-- 20260618175730_salary_payment_and_arrears
-- (exported from the live Supabase migration history)

-- Salary payment status on the payroll run
alter table payroll_runs add column if not exists payment_status text not null default 'Pending';
alter table payroll_runs drop constraint if exists payroll_runs_payment_status_check;
alter table payroll_runs add constraint payroll_runs_payment_status_check check (payment_status = any (array['Pending','Paid']));
alter table payroll_runs add column if not exists paid_at timestamptz;
alter table payroll_runs add column if not exists payment_reference text;
alter table payroll_runs add column if not exists payment_mode text;

-- Employee-wise arrears from a post-payment re-run
create table if not exists payroll_arrears (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references payroll_periods(id) on delete cascade,
  payroll_run_id uuid references payroll_runs(id) on delete set null,
  employee_id uuid not null references employees(id) on delete cascade,
  previous_net numeric not null default 0,
  revised_net numeric not null default 0,
  arrears_amount numeric not null default 0,
  breakdown jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id)
);
alter table payroll_arrears enable row level security;
drop policy if exists payroll_arrears_all on payroll_arrears;
create policy payroll_arrears_all on payroll_arrears for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table payroll_arrears;
