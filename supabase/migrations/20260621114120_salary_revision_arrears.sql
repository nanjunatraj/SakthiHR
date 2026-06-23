-- 20260621114120_salary_revision_arrears
-- Salary-revision arrears: when a revision is applied back-dated, the already-paid
-- months owe (revised gross − paid gross). Those per-period arrears are posted into
-- a payout payroll period through the component flagged is_arrears, and surfaced via
-- the payroll_entries.arrears line + a period-wise statement.

alter table salary_components add column if not exists is_arrears boolean not null default false;
alter table payroll_entries add column if not exists arrears numeric(12,2) not null default 0;

create table if not exists salary_revision_arrears (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references salary_revisions(id) on delete cascade,
  employee_id uuid not null references employees(id),
  period_id uuid references payroll_periods(id),         -- the back-period the arrears is for
  period_name text,
  paid_gross numeric not null default 0,                 -- gross actually paid that period
  revised_gross numeric not null default 0,              -- revised monthly gross
  arrears_amount numeric not null default 0,
  target_period_id uuid references payroll_periods(id),   -- payout period (HR-chosen)
  status text not null default 'Pending' check (status in ('Pending','Paid','Cancelled')),
  paid_run_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_sra_target on salary_revision_arrears(target_period_id, status);
create index if not exists idx_sra_revision on salary_revision_arrears(revision_id);
create index if not exists idx_sra_employee on salary_revision_arrears(employee_id);

alter table salary_revision_arrears enable row level security;
drop policy if exists "auth all salary_revision_arrears" on salary_revision_arrears;
create policy "auth all salary_revision_arrears" on salary_revision_arrears for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table salary_revision_arrears;
