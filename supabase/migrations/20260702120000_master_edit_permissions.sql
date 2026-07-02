-- Role-gated master editing.
--
-- Business rules:
--   • Only a Super Admin may change the Establishment identity (Name). The
--     establishment CODE is fixed in the control-plane registry and is not
--     editable in-tenant (the registry already locks code + name to the
--     platform Super Admin, and makes them immutable once created).
--   • Only Super Admin / Admin may CHANGE the configuration masters
--     (create / edit / delete). Every other authenticated staff role may only
--     VIEW them.
--   • Asset Management (assets, asset_categories, asset_allocations) is the
--     explicit exception — it stays writable by any authenticated staff role.
--
-- Enforcement is server-side (RLS + a trigger); the app mirrors it in the UI.
-- Operational / transactional tables (payroll runs, leave requests, employee
-- records, lookups, etc.) are intentionally left open so day-to-day work by
-- non-admin roles keeps functioning.

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- is_role_admin() (Super Admin / Admin) already exists from the Role Master
-- migration. Add a Super-Admin-only predicate for the establishment identity.
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.system_users su
    where su.auth_user_id = auth.uid()
      and coalesce(su.status, 'Active') <> 'Inactive'
      and su.role = 'Super Admin'
  );
$$;
grant execute on function public.is_super_admin() to authenticated;

-- ── Master tables: read-all, admin-only write ────────────────────────────────
-- Replace the open "authenticated all" policy on each config master with a
-- read-all + admin-write pair. Existing policy names vary, so drop whatever is
-- there first (idempotent).
do $$
declare
  master_tables text[] := array[
    -- Establishment & locations
    'establishment', 'work_locations', 'location_bank_accounts', 'location_documents',
    'departments', 'designations',
    -- HR masters
    'employee_types', 'employee_groups', 'employee_categories',
    'employee_classifications', 'employee_sections', 'employee_grades',
    -- Shifts
    'shifts',
    -- Leave configuration
    'holiday_lists', 'holidays', 'leave_types', 'leave_policies',
    'leave_policy_entitlements', 'leave_policy_allocations',
    -- Payroll setup masters (NOT payroll_periods / runs / entries — those are operational)
    'salary_components', 'salary_structures', 'salary_structure_components',
    'pay_heads', 'pf_esi_config', 'tds_slabs', 'professional_tax_slabs', 'loan_types',
    -- Letters & templates
    'letter_categories', 'letter_template_models', 'letter_templates', 'letterheads'
  ];
  t text;
  pol record;
begin
  foreach t in array master_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_read_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_role_admin()) with check (public.is_role_admin())',
      t || '_admin_write', t);
  end loop;
end $$;

-- ── Establishment identity: only a Super Admin may rename ─────────────────────
-- Admins may edit every other establishment field (addresses, statutory, bank,
-- letterhead, …) but the Name is Super-Admin-only. Skipped when there is no
-- authenticated user (service-role provisioning / SECURITY DEFINER RPCs).
create or replace function public.enforce_establishment_identity()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not public.is_super_admin()
     and new.name is distinct from old.name then
    raise exception 'Only a Super Admin can change the Establishment Name.';
  end if;
  return new;
end;
$$;

drop trigger if exists establishment_identity_guard on public.establishment;
create trigger establishment_identity_guard
  before update on public.establishment
  for each row execute function public.enforce_establishment_identity();
