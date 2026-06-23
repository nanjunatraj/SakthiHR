-- 20260616050355_create_employee_classifications_master
-- (exported from the live Supabase migration history)

-- Employee Classification master (statutory labour-law engagement classification).
create table if not exists public.employee_classifications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  description text,
  status text not null default 'Active' check (status in ('Active','Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.employee_classifications is 'Employee classification master — Employee, Worker, Apprentice, Contract Labour, etc.';

alter table public.employee_classifications enable row level security;
create policy employee_classifications_authenticated_all
  on public.employee_classifications for all to authenticated using (true) with check (true);

insert into public.employee_classifications (name, code, description) values
  ('Employee', 'EMP', 'Regular employee on the rolls of the establishment.'),
  ('Worker', 'WRK', 'Worker as defined under applicable labour legislation.'),
  ('Apprentice', 'APP', 'Engaged under the Apprentices Act / apprenticeship scheme.'),
  ('Contract Labour', 'CL', 'Engaged through a contractor under the Contract Labour Act.'),
  ('Fixed Term Employee', 'FTE', 'Employed for a fixed term as per the engagement contract.'),
  ('Contract For Service', 'CFS', 'Independent contractor providing a contract for service.'),
  ('Temporary', 'TMP', 'Temporary / casual engagement for a short duration.'),
  ('Other', 'OTH', 'Any other classification not covered above.')
on conflict do nothing;

-- Keep the employees column name consistent with the renamed field.
alter table public.employees rename column worker_classification to employee_classification;
comment on column public.employees.employee_classification is
  'Employee classification (FK-by-name to employee_classifications master): Employee, Worker, Apprentice, Contract Labour, Fixed Term Employee, Contract For Service, Temporary, Other.';
