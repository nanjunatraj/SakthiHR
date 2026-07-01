-- Staff members can also be employees (e.g. an Admin or HR Manager who is on the
-- payroll). To offer them a choice of workspace after login — Self-Service or the
-- Admin app — the client needs to know both the caller's role AND whether they are
-- linked to an employee record. current_user_context() returns both, keyed off the
-- Supabase Auth session (auth.uid() → system_users.auth_user_id).
CREATE OR REPLACE FUNCTION public.current_user_context()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'role', su.role,
    'employee_id', su.employee_id,
    'employee_code', e.employee_id
  )
  from public.system_users su
  left join public.employees e on e.id = su.employee_id
  where su.auth_user_id = auth.uid()
    and coalesce(su.status, 'Active') = 'Active'
  limit 1;
$function$;

grant execute on function public.current_user_context() to authenticated;
