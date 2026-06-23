-- 20260620151029_employee_exit_workflow
-- Type-driven exit workflow: resignation approval chain + workflow flags.

alter table employee_exits add column if not exists submitted_by text not null default 'hr';
alter table employee_exits add column if not exists notice_waived boolean not null default false;
alter table employee_exits add column if not exists acceptance_issued boolean not null default false;

create table if not exists exit_approvals (
  id uuid primary key default gen_random_uuid(),
  exit_id uuid not null references employee_exits(id) on delete cascade,
  level integer not null default 1,
  role text not null,
  approver_employee_id uuid references employees(id) on delete set null,
  approver_name text,
  status text not null default 'Pending' check (status = any (array['Pending','Approved','Rejected','Skipped'])),
  remarks text,
  acted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists exit_approvals_exit_idx on exit_approvals(exit_id);
create index if not exists exit_approvals_approver_idx on exit_approvals(approver_employee_id, status);

alter table exit_approvals enable row level security;
drop policy if exists exit_approvals_all on exit_approvals;
create policy exit_approvals_all on exit_approvals for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table exit_approvals;
