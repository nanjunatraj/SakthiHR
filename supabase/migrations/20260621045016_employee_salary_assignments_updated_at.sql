-- 20260621045016_employee_salary_assignments_updated_at
-- The handle_updated_at() trigger on employee_salary_assignments references
-- NEW.updated_at, but the column was never added — so any UPDATE fails (42703).
-- (The old upsert path only did DELETE+INSERT, hiding this.) Add the column so
-- updates — e.g. the salary-revision supersede that closes the prior assignment —
-- succeed.
alter table employee_salary_assignments add column if not exists updated_at timestamptz not null default now();
