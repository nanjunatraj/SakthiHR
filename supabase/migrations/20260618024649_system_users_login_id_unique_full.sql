-- 20260618024649_system_users_login_id_unique_full
-- (exported from the live Supabase migration history)

drop index if exists public.system_users_login_id_unique;
-- Plain unique index (multiple NULLs allowed by Postgres) so ON CONFLICT (login_id) works for upsert.
create unique index if not exists system_users_login_id_unique
  on public.system_users (login_id);
