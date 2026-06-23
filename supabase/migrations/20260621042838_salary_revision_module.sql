-- 20260621042838_salary_revision_module
-- Salary Revision framework: a revision proposed from a payroll period, by
-- Percentage or Amount on a basis (CTC/Gross/Net/TakeHome), for a scope of
-- employees (all / location / department / designation / category / selected),
-- with an approval step (Proposed -> Approved -> Applied). Per-employee items
-- carry the old vs new (solved) values + new component overrides.

create table if not exists salary_revisions (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  basis text not null default 'CTC' check (basis in ('CTC','Gross','Net','TakeHome')),
  method text not null default 'Percentage' check (method in ('Percentage','Amount')),
  value numeric not null default 0,
  payroll_period_id uuid references payroll_periods(id),
  effective_from date,
  scope text not null default 'all' check (scope in ('all','location','department','designation','category','selected')),
  scope_ref jsonb,
  status text not null default 'Proposed' check (status in ('Proposed','Approved','Rejected','Applied','Cancelled')),
  proposed_by text,
  approved_by text,
  approved_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists salary_revision_items (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references salary_revisions(id) on delete cascade,
  employee_id uuid not null references employees(id),
  structure_id uuid,
  old_ctc_monthly numeric not null default 0,
  old_gross numeric not null default 0,
  old_net numeric not null default 0,
  old_takehome numeric not null default 0,
  new_ctc_monthly numeric not null default 0,
  new_gross numeric not null default 0,
  new_net numeric not null default 0,
  new_takehome numeric not null default 0,
  new_component_values jsonb,
  status text not null default 'Pending' check (status in ('Pending','Applied','Skipped')),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_salary_revision_items_revision on salary_revision_items(revision_id);
create index if not exists idx_salary_revision_items_employee on salary_revision_items(employee_id);

alter table salary_revisions enable row level security;
alter table salary_revision_items enable row level security;

drop policy if exists "auth all salary_revisions" on salary_revisions;
create policy "auth all salary_revisions" on salary_revisions for all to authenticated using (true) with check (true);
drop policy if exists "auth all salary_revision_items" on salary_revision_items;
create policy "auth all salary_revision_items" on salary_revision_items for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table salary_revisions;
alter publication supabase_realtime add table salary_revision_items;
