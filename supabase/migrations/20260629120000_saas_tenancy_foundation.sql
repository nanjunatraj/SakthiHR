-- ============================================================================
-- Phase 2 — SaaS multi-tenancy foundation
-- ----------------------------------------------------------------------------
-- Introduces platform-level tenancy on top of the (previously single-company)
-- schema:
--   * organizations  — each tenant; has a unique shorthand `code` (e.g. SAKTHI)
--   * memberships     — user ↔ org ↔ role (super_admin / org_admin / user)
--   * org_id on every tenant table, backfilled into a default org
--   * org-scoped RLS everywhere, via SECURITY DEFINER helpers (no recursion)
--
-- Roles:
--   super_admin — platform owner; org_id NULL; sees/manages everything
--   org_admin   — manages users + data within their org
--   user        — scoped to their org
-- Idempotent.
-- ============================================================================

-- 1. Platform tables ---------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique check (code ~ '^[A-Z0-9]{2,10}$'),
  status     text not null default 'Active',
  plan       text not null default 'standard',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid references public.organizations(id) on delete cascade,
  role       text not null check (role in ('super_admin','org_admin','user')),
  status     text not null default 'Active',
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);
-- one platform super_admin row per user (org_id is NULL for super_admins)
create unique index if not exists memberships_superadmin_uniq
  on public.memberships(user_id) where role = 'super_admin' and org_id is null;
create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_org_idx  on public.memberships(org_id);

-- 2. Helper functions (SECURITY DEFINER → bypass RLS → no policy recursion) ---
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and role = 'super_admin' and status = 'Active'
  );
$$;

create or replace function public.auth_user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.memberships
  where user_id = auth.uid() and status = 'Active' and org_id is not null;
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = p_org
      and role = 'org_admin' and status = 'Active'
  );
$$;

-- 3. RLS for the platform tables --------------------------------------------
alter table public.organizations enable row level security;
alter table public.memberships  enable row level security;

drop policy if exists organizations_superadmin_all on public.organizations;
drop policy if exists organizations_member_read    on public.organizations;
create policy organizations_superadmin_all on public.organizations for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy organizations_member_read on public.organizations for select to authenticated
  using (id in (select public.auth_user_org_ids()));

drop policy if exists memberships_superadmin_all on public.memberships;
drop policy if exists memberships_self_read      on public.memberships;
drop policy if exists memberships_orgadmin_read   on public.memberships;
drop policy if exists memberships_orgadmin_manage on public.memberships;
create policy memberships_superadmin_all on public.memberships for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy memberships_self_read on public.memberships for select to authenticated
  using (user_id = auth.uid());
create policy memberships_orgadmin_manage on public.memberships for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- 4. Default organization + super admin -------------------------------------
insert into public.organizations (name, code, status)
  values ('Sakthi Management Services', 'SAKTHI', 'Active')
  on conflict (code) do nothing;

insert into public.memberships (user_id, org_id, role)
  select u.id, null, 'super_admin' from auth.users u where u.email = 'smshosur139@gmail.com'
  on conflict do nothing;

-- 5. org_id + org-scoped RLS on every tenant table --------------------------
do $do$
declare
  r record;
  v_org uuid;
begin
  select id into v_org from public.organizations where code = 'SAKTHI';

  for r in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in ('organizations','memberships')
  loop
    -- tables are in the Realtime publication; updates need a replica identity
    execute format('alter table public.%I replica identity full', r.tablename);
    -- add + backfill org_id
    execute format('alter table public.%I add column if not exists org_id uuid references public.organizations(id) on delete cascade', r.tablename);
    execute format('update public.%I set org_id = %L where org_id is null', r.tablename, v_org);
    execute format('create index if not exists %I on public.%I(org_id)', r.tablename || '_org_id_idx', r.tablename);

    -- org-scoped RLS: super admin sees all; everyone else only their org(s)
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('drop policy if exists %I on public.%I', r.tablename || '_org_isolation', r.tablename);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_super_admin() or org_id in (select public.auth_user_org_ids())) with check (public.is_super_admin() or org_id in (select public.auth_user_org_ids()))',
      r.tablename || '_org_isolation', r.tablename
    );
  end loop;
end
$do$;
