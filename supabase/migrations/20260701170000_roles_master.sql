-- Role Master: make User Master roles data-driven so establishments can define
-- their own custom roles in addition to the built-ins. Until now roles were a
-- fixed set pinned by a CHECK constraint and hardcoded in the app.
--
--  * new `public.roles` table — one row per role (built-in or custom).
--  * `system_users.role` now references a role by name (soft link, no FK so any
--    legacy value survives); the fixed CHECK is dropped.
--  * verify_login / current_user_context return the role's `is_staff`, `all_access`
--    and `sections` so login routing and admin menu/route gating work for ANY
--    role, including custom ones.

-- ── roles table ────────────────────────────────────────────────────────────────
create table if not exists public.roles (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  description        text,
  -- true: signs into the Admin app; false: Employee Self-Service portal only.
  is_staff           boolean not null default true,
  -- shortcut for full access to every menu section (Super Admin / Admin).
  all_access         boolean not null default false,
  -- menu sections this role may reach (ignored when all_access = true).
  sections           text[] not null default '{}',
  -- default module-privilege template used to pre-fill a new user's privileges.
  -- [] means "derive a sensible template from the sections above".
  default_privileges jsonb not null default '[]'::jsonb,
  color              text not null default 'gray',
  -- built-in roles cannot be deleted or renamed from the UI.
  is_system          boolean not null default false,
  active             boolean not null default true,
  sort_order         integer not null default 100,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Roles are now validated against this table, not a hardcoded list.
alter table public.system_users drop constraint if exists system_users_role_check;

-- ── seed built-in roles (requested set + existing roles kept for back-compat) ────
insert into public.roles (name, description, is_staff, all_access, sections, color, is_system, sort_order) values
  ('Super Admin',        'Full platform and establishment access.',                       true,  true,  '{}',                                                         'red',     true, 1),
  ('Admin',              'Full establishment administrator.',                             true,  true,  '{}',                                                         'orange',  true, 2),
  ('HR Manager',         'Manages HR, attendance, leave and reports.',                    true,  false, '{Dashboard,HRMS,Attendance,Leave,Reports}',                  'blue',    true, 3),
  ('HR Executive',       'Day-to-day HR operations (no reports export by default).',      true,  false, '{Dashboard,HRMS,Attendance,Leave}',                          'cyan',    true, 4),
  ('Payroll Manager',    'Runs payroll, deductions and payroll reports.',                 true,  false, '{Dashboard,Payroll,Deductions,Reports}',                     'emerald', true, 5),
  ('Payroll Executive',  'Processes payroll and deductions.',                             true,  false, '{Dashboard,Payroll,Deductions}',                             'teal',    true, 6),
  ('Department Manager', 'Manages their department''s people, attendance and leave.',     true,  false, '{Dashboard,HRMS,Attendance,Leave,Reports}',                  'violet',  true, 7),
  ('Department Head',    'Departmental head with HR, attendance, leave and reports.',     true,  false, '{Dashboard,HRMS,Attendance,Leave,Reports}',                  'indigo',  true, 8),
  ('Finance Head',       'Finance oversight of payroll, deductions and reports.',         true,  false, '{Dashboard,Payroll,Deductions,Reports}',                     'green',   true, 9),
  ('Auditor',            'Read-only access to dashboards and reports.',                   true,  false, '{Dashboard,Reports}',                                        'amber',   true, 10),
  ('Employee',           'Employee Self-Service portal only.',                            false, false, '{}',                                                         'gray',    true, 11)
on conflict (name) do nothing;

-- ── who may edit the Role Master (Super Admin / Admin) ───────────────────────────
create or replace function public.is_role_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.system_users su
    where su.auth_user_id = auth.uid()
      and coalesce(su.status, 'Active') <> 'Inactive'
      and su.role in ('Super Admin', 'Admin')
  );
$$;
grant execute on function public.is_role_admin() to authenticated;

-- ── RLS: everyone signed in can read roles; only role-admins can write ───────────
alter table public.roles enable row level security;
drop policy if exists roles_read_all on public.roles;
create policy roles_read_all on public.roles for select to authenticated using (true);
drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write on public.roles for all to authenticated
  using (public.is_role_admin()) with check (public.is_role_admin());

-- ── verify_login: also return is_staff / all_access / sections for the role ───────
CREATE OR REPLACE FUNCTION public.verify_login(p_login_id text, p_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare rec record;
begin
  select su.id, su.name, su.login_id, su.role, su.must_change_password, su.employee_id, su.password,
         e.employee_id as employee_code, e.mobile_number, e.email,
         r.is_staff, r.all_access, r.sections
  into rec
  from public.system_users su
  left join public.employees e on e.id = su.employee_id
  left join public.roles r on r.name = su.role
  where su.login_id = trim(p_login_id)
  limit 1;

  if rec.id is null then return null; end if;
  if not public.system_users_password_matches(rec.password, p_password) then return null; end if;

  return json_build_object(
    'id', rec.id,
    'name', rec.name,
    'login_id', rec.login_id,
    'role', rec.role,
    'is_staff', coalesce(rec.is_staff, true),
    'all_access', coalesce(rec.all_access, false),
    'sections', coalesce(rec.sections, array[]::text[]),
    'must_change_password', rec.must_change_password,
    'employee_id', rec.employee_id,
    'employee_code', rec.employee_code,
    'mobile', rec.mobile_number,
    'email', rec.email
  );
end;
$function$;

-- ── current_user_context: add role sections / flags for admin gating ─────────────
CREATE OR REPLACE FUNCTION public.current_user_context()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'role', su.role,
    'employee_id', su.employee_id,
    'employee_code', e.employee_id,
    'is_staff', coalesce(r.is_staff, true),
    'all_access', coalesce(r.all_access, false),
    'sections', coalesce(r.sections, array[]::text[])
  )
  from public.system_users su
  left join public.employees e on e.id = su.employee_id
  left join public.roles r on r.name = su.role
  where su.auth_user_id = auth.uid()
    and coalesce(su.status, 'Active') = 'Active'
  limit 1;
$function$;
grant execute on function public.current_user_context() to authenticated;
