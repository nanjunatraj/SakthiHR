-- Lets the provisioning Edge Function (service role) find an existing Supabase
-- Auth account by email, so re-saving a staff user updates that account's
-- password instead of failing on a duplicate email. Restricted to service_role.
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = auth, public
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
