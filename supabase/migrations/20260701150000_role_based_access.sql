-- Role-based access: expose the User Master role so the app can (a) route each
-- login to the right main page (Employee → Self-Service, staff → Admin app) and
-- (b) gate the admin menu/routes by role (HR Manager vs Admin vs Super Admin).
--
--  * verify_login now returns `role` (the ESS/portal login path).
--  * current_user_role() returns the caller's system_users.role for the admin app
--    (staff authenticate via Supabase Auth, so it keys off auth.uid()).

-- verify_login: same as before, but also returns the account's role.
CREATE OR REPLACE FUNCTION public.verify_login(p_login_id text, p_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare rec record;
begin
  select su.id, su.name, su.login_id, su.role, su.must_change_password, su.employee_id, su.password,
         e.employee_id as employee_code, e.mobile_number, e.email
  into rec
  from public.system_users su
  left join public.employees e on e.id = su.employee_id
  where su.login_id = trim(p_login_id)
  limit 1;

  if rec.id is null then return null; end if;
  if not public.system_users_password_matches(rec.password, p_password) then return null; end if;

  return json_build_object(
    'id', rec.id,
    'name', rec.name,
    'login_id', rec.login_id,
    'role', rec.role,
    'must_change_password', rec.must_change_password,
    'employee_id', rec.employee_id,
    'employee_code', rec.employee_code,
    'mobile', rec.mobile_number,
    'email', rec.email
  );
end;
$function$;

-- current_user_role: the signed-in staff member's role, resolved from the
-- Supabase Auth session (auth.uid() → system_users.auth_user_id). Returns null
-- for a user with no matching User Master row. SECURITY DEFINER so it works
-- regardless of the system_users RLS policy.
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role
  from public.system_users
  where auth_user_id = auth.uid()
    and coalesce(status, 'Active') = 'Active'
  limit 1;
$function$;

grant execute on function public.current_user_role() to authenticated;
