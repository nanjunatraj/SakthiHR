-- Denormalize basic identity onto memberships so admin consoles can list
-- members (email/name) without reading the protected auth.users table.
alter table public.memberships add column if not exists email     text;
alter table public.memberships add column if not exists full_name text;
