-- 20260615173412_harden_views_and_functions
-- (exported from the live Supabase migration history)

-- Make summary views run with the querying user's permissions/RLS
-- (instead of the view owner's), resolving the security_definer_view lint.
ALTER VIEW public.v_employee_summary       SET (security_invoker = on);
ALTER VIEW public.v_active_loans           SET (security_invoker = on);
ALTER VIEW public.v_leave_balance_summary  SET (security_invoker = on);
ALTER VIEW public.v_payroll_period_summary SET (security_invoker = on);

-- Pin a non-mutable search_path on existing functions (resolves
-- function_search_path_mutable lint; prevents search_path hijacking).
ALTER FUNCTION public.handle_updated_at()                                          SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_emi(numeric, numeric, integer)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.get_leave_balance(uuid, uuid, integer)                       SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_employee_id(text, integer)                          SET search_path = public, pg_temp;
