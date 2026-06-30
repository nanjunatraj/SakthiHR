-- Control-plane: the registry of tenant establishments (each = a separate Supabase
-- project). This project doubles as the SAKTHI tenant. Code + Name are fixed after
-- creation. Service-role keys are NOT stored here (kept in Vault, server-side only).

create table if not exists public.establishments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  project_ref text,
  api_url text,
  anon_key text,
  status text not null default 'Provisioning'
    check (status in ('Provisioning','Active','Suspended','Failed')),
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_compacted_at timestamptz,
  constraint establishments_code_format check (code ~ '^[A-Z0-9]{2,10}$')
);

drop trigger if exists trg_establishments_updated_at on public.establishments;
create trigger trg_establishments_updated_at before update on public.establishments
  for each row execute function public.handle_updated_at();

-- Code and Name are fixed (immutable) once an establishment exists.
create or replace function public.establishments_lock_fixed_fields()
returns trigger language plpgsql as $$
begin
  if new.code is distinct from old.code then
    raise exception 'Establishment code is fixed and cannot be changed';
  end if;
  if new.name is distinct from old.name then
    raise exception 'Establishment name is fixed and cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_establishments_lock_fixed on public.establishments;
create trigger trg_establishments_lock_fixed before update on public.establishments
  for each row execute function public.establishments_lock_fixed_fields();

-- Platform super admin = a Super Admin in system_users linked to the calling auth user.
create or replace function public.is_platform_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.system_users
    where auth_user_id = auth.uid()
      and role = 'Super Admin'
      and coalesce(status, 'Active') = 'Active'
  );
$$;

alter table public.establishments enable row level security;
drop policy if exists establishments_superadmin_all on public.establishments;
create policy establishments_superadmin_all on public.establishments
  for all to authenticated
  using (public.is_platform_super_admin())
  with check (public.is_platform_super_admin());

-- Anon-callable resolver: returns ONLY non-secret connection info for an Active
-- establishment, so the desktop login screen can bootstrap the tenant client.
create or replace function public.resolve_establishment(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'code', code, 'name', name, 'api_url', api_url, 'anon_key', anon_key, 'status', status
  )
  from public.establishments
  where code = upper(trim(p_code)) and status = 'Active'
  limit 1;
$$;
revoke all on function public.resolve_establishment(text) from public;
grant execute on function public.resolve_establishment(text) to anon, authenticated;
