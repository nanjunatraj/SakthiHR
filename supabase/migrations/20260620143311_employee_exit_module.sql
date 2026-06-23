-- 20260620143311_employee_exit_module
-- Employee Exit (separation) framework: exit records, dept-wise clearances, and the
-- Full & Final settlement; plus employees.relieving_date.

create table if not exists employee_exits (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  exit_type text not null default 'Resignation' check (exit_type = any (array['Resignation','Termination','Retirement','Absconding','End of Contract','Death'])),
  resignation_date date,
  last_working_day date,
  notice_days integer not null default 0,
  notice_served boolean not null default true,
  reason text,
  status text not null default 'Initiated' check (status = any (array['Initiated','In Clearance','Settled','Relieved','Cancelled'])),
  rehire_eligible boolean not null default true,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employee_exits_employee_idx on employee_exits(employee_id);
create index if not exists employee_exits_status_idx on employee_exits(status);

create table if not exists exit_clearances (
  id uuid primary key default gen_random_uuid(),
  exit_id uuid not null references employee_exits(id) on delete cascade,
  department text not null,
  status text not null default 'Pending' check (status = any (array['Pending','Cleared','NA'])),
  remarks text,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists exit_clearances_exit_idx on exit_clearances(exit_id);

create table if not exists exit_settlements (
  id uuid primary key default gen_random_uuid(),
  exit_id uuid not null unique references employee_exits(id) on delete cascade,
  pending_salary numeric not null default 0,
  leave_encash_days numeric not null default 0,
  leave_encash_amount numeric not null default 0,
  gratuity_amount numeric not null default 0,
  bonus_amount numeric not null default 0,
  loan_recovery numeric not null default 0,
  notice_recovery numeric not null default 0,
  other_additions numeric not null default 0,
  other_deductions numeric not null default 0,
  net_settlement numeric not null default 0,
  settled_on date,
  status text not null default 'Draft' check (status = any (array['Draft','Finalised'])),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table employees add column if not exists relieving_date date;

alter table employee_exits enable row level security;
alter table exit_clearances enable row level security;
alter table exit_settlements enable row level security;
drop policy if exists employee_exits_all on employee_exits;
drop policy if exists exit_clearances_all on exit_clearances;
drop policy if exists exit_settlements_all on exit_settlements;
create policy employee_exits_all on employee_exits for all to authenticated using (true) with check (true);
create policy exit_clearances_all on exit_clearances for all to authenticated using (true) with check (true);
create policy exit_settlements_all on exit_settlements for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table employee_exits;
alter publication supabase_realtime add table exit_clearances;
alter publication supabase_realtime add table exit_settlements;
