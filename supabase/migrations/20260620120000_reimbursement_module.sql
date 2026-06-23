-- 20260620120000_reimbursement_module
-- Reimbursement framework: per-employee expense claims (with or without bills),
-- raised by the employee or against the employee by HR, verified & closed in the
-- Pre-Payroll process. Plus a salary-component "reimbursement" flag.

create table if not exists reimbursement_claims (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  payroll_period_id uuid references payroll_periods(id) on delete set null,
  category text not null default 'general',
  description text,
  amount numeric not null default 0,
  has_bill boolean not null default false,
  bill_reference text,
  reference_no text,
  raised_by text not null default 'employee' check (raised_by = any (array['employee','hr'])),
  status text not null default 'Pending' check (status = any (array['Pending','Verified','Rejected','Closed','Paid'])),
  verified_by text,
  verified_at timestamptz,
  remarks text,
  rejection_reason text,
  salary_component_id uuid references salary_components(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reimbursement_claims_employee_idx on reimbursement_claims(employee_id);
create index if not exists reimbursement_claims_period_idx on reimbursement_claims(payroll_period_id);
create index if not exists reimbursement_claims_status_idx on reimbursement_claims(status);

alter table reimbursement_claims enable row level security;
drop policy if exists reimbursement_claims_all on reimbursement_claims;
create policy reimbursement_claims_all on reimbursement_claims for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table reimbursement_claims;

-- Mark a salary component as a Reimbursement head (like the Overtime flag).
alter table salary_components add column if not exists is_reimbursement boolean not null default false;
