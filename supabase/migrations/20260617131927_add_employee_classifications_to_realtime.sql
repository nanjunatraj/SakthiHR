-- 20260617131927_add_employee_classifications_to_realtime
-- (exported from the live Supabase migration history)

-- useTable() refreshes its list from Realtime change events; this table was the
-- only master missing from the publication, so inserts persisted but never appeared.
alter publication supabase_realtime add table public.employee_classifications;

-- remove the diagnostic test row
delete from public.employee_classifications where code = '__TST__' and name = '__TEST_CLASS__';
