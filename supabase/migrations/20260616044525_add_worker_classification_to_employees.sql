-- 20260616044525_add_worker_classification_to_employees
-- (exported from the live Supabase migration history)

alter table public.employees
  add column if not exists worker_classification text;

comment on column public.employees.worker_classification is
  'Statutory labour classification: Employee, Worker, Apprentice, Contract Labour, Fixed Term Employee, Contract For Service, Temporary, Other.';
