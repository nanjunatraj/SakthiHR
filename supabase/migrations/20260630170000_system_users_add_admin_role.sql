-- Add an "Admin" role to system_users: a full establishment administrator that is
-- distinct from the platform-level "Super Admin" (which alone flags the platform
-- super admin via is_platform_super_admin()). Admin users land on the normal HR
-- dashboard, not the Platform Administration console.
alter table public.system_users drop constraint if exists system_users_role_check;
alter table public.system_users add constraint system_users_role_check
  check (role = any (array[
    'Super Admin'::text, 'Admin'::text, 'HR Manager'::text,
    'Payroll Manager'::text, 'Department Manager'::text, 'Employee'::text, 'Auditor'::text
  ]));
