-- Store/retrieve tenant service-role keys in Vault. Used only by the control-plane
-- Edge Functions (service_role); never exposed to anon/authenticated.
create extension if not exists supabase_vault;

create or replace function public.vault_store_tenant_key(p_ref text, p_service_key text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_name text := 'tenant_service_key_' || p_ref; v_id uuid;
begin
  select id into v_id from vault.secrets where name = v_name;
  if v_id is null then
    perform vault.create_secret(p_service_key, v_name, 'SakthiHR tenant service role key');
  else
    perform vault.update_secret(v_id, p_service_key);
  end if;
end; $$;

create or replace function public.vault_get_tenant_key(p_ref text)
returns text language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'tenant_service_key_' || p_ref limit 1;
$$;

revoke all on function public.vault_store_tenant_key(text, text) from public, anon, authenticated;
revoke all on function public.vault_get_tenant_key(text) from public, anon, authenticated;
grant execute on function public.vault_store_tenant_key(text, text) to service_role;
grant execute on function public.vault_get_tenant_key(text) to service_role;
