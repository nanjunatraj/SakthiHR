-- Option A: secure ESS credential handling.
-- The Employee Self-Service portal runs as the `anon` Postgres role (no Supabase
-- auth session). `system_users` has an authenticated-only RLS policy, so anon
-- could never read it — breaking login, change-password, and reset. These
-- SECURITY DEFINER functions validate credentials server-side without exposing
-- the table (or any password) to the anon key. Passwords are also moved from
-- plaintext to bcrypt.

create extension if not exists pgcrypto with schema extensions;

-- 1. Hash any existing plaintext passwords (bcrypt hashes begin with "$2").
update public.system_users
set password = extensions.crypt(password, extensions.gen_salt('bf'))
where password is not null and password <> '' and password not like '$2%';

-- 2. Auto-hash on every write so any path (User Master, Employee Master, RPCs)
--    that sets a plaintext password stores it hashed. Already-hashed values are
--    left untouched (idempotent).
create or replace function public.hash_system_user_password()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.password is not null and new.password <> '' and new.password not like '$2%' then
    new.password := extensions.crypt(new.password, extensions.gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_system_users_hash_password on public.system_users;
create trigger trg_system_users_hash_password
  before insert or update of password on public.system_users
  for each row execute function public.hash_system_user_password();

-- helper: password match supporting bcrypt + legacy plaintext
create or replace function public.system_users_password_matches(stored text, supplied text)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when stored is null then false
    when stored like '$2%' then stored = extensions.crypt(supplied, stored)
    else stored = supplied
  end;
$$;

-- 3a. ESS login — returns the account (never the password) only on a match.
create or replace function public.verify_login(p_login_id text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare rec record;
begin
  select su.id, su.name, su.login_id, su.must_change_password, su.employee_id, su.password,
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
    'must_change_password', rec.must_change_password,
    'employee_id', rec.employee_id,
    'employee_code', rec.employee_code,
    'mobile', rec.mobile_number,
    'email', rec.email
  );
end;
$$;

-- 3b. ESS change password — verifies current, sets new (trigger hashes it).
create or replace function public.change_password(p_login_id text, p_current text, p_new text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare rec record;
begin
  select id, password into rec from public.system_users where login_id = trim(p_login_id) limit 1;
  if rec.id is null then return json_build_object('error', 'Account not found.'); end if;
  if not public.system_users_password_matches(rec.password, p_current) then
    return json_build_object('error', 'Current password is incorrect.');
  end if;
  update public.system_users
    set password = p_new, must_change_password = false,
        password_changed_at = now(), updated_at = now()
    where id = rec.id;
  return json_build_object('error', null);
end;
$$;

-- 3c. Reset password — stores the supplied new password (trigger hashes it) and
--     returns contact details so the client can email the credentials.
create or replace function public.reset_password(p_login_id text, p_new_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare rec record;
begin
  select su.id, su.name, su.login_id, su.employee_id, e.email, e.mobile_number
  into rec
  from public.system_users su
  left join public.employees e on e.id = su.employee_id
  where su.login_id = trim(p_login_id)
  limit 1;
  if rec.id is null then return json_build_object('error', 'No user account found for this Employee ID.'); end if;
  update public.system_users
    set password = p_new_password, must_change_password = true, updated_at = now()
    where id = rec.id;
  return json_build_object(
    'error', null,
    'account', json_build_object(
      'id', rec.id, 'name', rec.name, 'login_id', rec.login_id,
      'employee_id', rec.employee_id, 'email', rec.email, 'mobile', rec.mobile_number
    )
  );
end;
$$;

-- 4. Expose the RPCs to the ESS portal (anon) and the admin app (authenticated).
revoke all on function public.verify_login(text, text) from public;
revoke all on function public.change_password(text, text, text) from public;
revoke all on function public.reset_password(text, text) from public;
grant execute on function public.verify_login(text, text) to anon, authenticated;
grant execute on function public.change_password(text, text, text) to anon, authenticated;
grant execute on function public.reset_password(text, text) to anon, authenticated;
