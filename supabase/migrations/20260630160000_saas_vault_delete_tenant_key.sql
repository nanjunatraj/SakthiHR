-- Remove a tenant's stored service-role key from Vault when its establishment is
-- deleted. Service-role only (used by the manage-establishment edge function).
create or replace function public.vault_delete_tenant_key(p_ref text)
returns void language plpgsql security definer set search_path = public, vault as $$
begin
  delete from vault.secrets where name = 'tenant_service_key_' || p_ref;
end; $$;

revoke all on function public.vault_delete_tenant_key(text) from public, anon, authenticated;
grant execute on function public.vault_delete_tenant_key(text) to service_role;
