-- 20260618024312_system_users_login_id_password
-- (exported from the live Supabase migration history)

alter table public.system_users add column if not exists login_id text;
alter table public.system_users add column if not exists password text;

create unique index if not exists system_users_login_id_unique
  on public.system_users (login_id)
  where login_id is not null;

comment on column public.system_users.login_id is 'Login identifier (Employee ID for auto-created employee accounts).';
comment on column public.system_users.password is 'Initial/plaintext password placeholder (defaults to Employee ID; user is prompted to change on first login).';
