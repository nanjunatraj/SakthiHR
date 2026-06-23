-- 20260617180123_salary_assignment_component_values
-- (exported from the live Supabase migration history)

-- Per-employee personalised component values (Variable / Custom overrides) for the
-- assigned salary structure. Lets a structure be copied to an employee and tuned per employee.
alter table public.employee_salary_assignments
  add column if not exists component_values jsonb;

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.employee_salary_assignments'; exception when duplicate_object then null; end;
end $$;
