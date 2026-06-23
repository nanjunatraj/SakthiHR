-- 20260615173316_fix_rls_and_realtime
-- (exported from the live Supabase migration history)

-- Migration 0001: Fix recursive RLS + enable Realtime
-- Replaces self-referential system_users policies (which caused
-- "42P17 infinite recursion") with clean authenticated-only access,
-- and enables Realtime on every operational table.

DO $$
DECLARE
  tbl  TEXT;
  pol  RECORD;
  tables TEXT[] := ARRAY[
    'establishment', 'work_locations', 'location_bank_accounts', 'letterheads',
    'location_documents', 'departments', 'designations', 'employee_types',
    'employee_groups', 'employee_categories', 'employee_sections', 'employee_grades',
    'shifts', 'employees', 'system_users', 'user_privileges', 'employee_statutory',
    'employee_education', 'employee_family', 'employee_bank_accounts',
    'employee_documents', 'employee_languages', 'employee_work_experience',
    'attendance_records', 'holiday_lists', 'holidays', 'leave_types',
    'leave_requests', 'leave_balances', 'payroll_periods', 'salary_components',
    'salary_structures', 'salary_structure_components', 'employee_salary_assignments',
    'payroll_runs', 'payroll_entries', 'pf_esi_config', 'tds_slabs', 'loan_types',
    'loans', 'loan_emi_schedule', 'pay_heads'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I;', pol.policyname, tbl);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      tbl || '_authenticated_all', tbl
    );

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
    END IF;
  END LOOP;
END $$;
