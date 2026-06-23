-- 20260617011030_documents_per_entity_rls
-- (exported from the live Supabase migration history)

-- ============================================================================
-- Per-entity document isolation + HR/Admin full access
-- ============================================================================
-- Replaces the permissive `authenticated USING(true)` policies on documents,
-- document_signatures and the storage buckets with role-aware, owner-scoped RLS.
--
-- Privileged roles (full access): Super Admin, HR Manager.
-- Regular employee: only documents prefixed with their own employee code.
-- Org docs (work_location/establishment): admin/HR only.
-- employee-photos: broadly READABLE (avatars app-wide); writes = admin or owner.
-- ----------------------------------------------------------------------------

create or replace function public.is_doc_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.system_users su
    where su.auth_user_id = auth.uid()
      and coalesce(su.status, 'Active') <> 'Inactive'
      and (su.role ilike '%admin%' or su.role ilike '%hr%' or su.role ilike 'human resource%')
  );
$$;

create or replace function public.owns_employee_doc(p_entity_type text, p_entity_ref text)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_entity_type = 'employee'
    and exists (
      select 1
      from public.system_users su
      join public.employees e on e.id = su.employee_id
      where su.auth_user_id = auth.uid()
        and (
             p_entity_ref =  e.employee_id          or p_entity_ref like e.employee_id || '/%'
          or p_entity_ref =  e.current_employee_id  or p_entity_ref like e.current_employee_id || '/%'
        )
    );
$$;

create or replace function public.owns_storage_doc(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.system_users su
    join public.employees e on e.id = su.employee_id
    where su.auth_user_id = auth.uid()
      and (p_name like 'employee/' || e.employee_id || '/%'
        or p_name like 'employee/' || e.current_employee_id || '/%')
  );
$$;

create or replace function public.owns_storage_photo(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.system_users su
    join public.employees e on e.id = su.employee_id
    where su.auth_user_id = auth.uid()
      and (p_name like 'employees/' || e.employee_id || '/%'
        or p_name like 'employees/' || e.current_employee_id || '/%')
  );
$$;

-- ---- public.documents -------------------------------------------------------
drop policy if exists documents_authenticated_all on public.documents;

create policy documents_admin_all on public.documents
  for all to authenticated using (public.is_doc_admin()) with check (public.is_doc_admin());
create policy documents_owner_select on public.documents
  for select to authenticated using (public.owns_employee_doc(entity_type, entity_ref));
create policy documents_owner_insert on public.documents
  for insert to authenticated with check (public.owns_employee_doc(entity_type, entity_ref));
create policy documents_owner_update on public.documents
  for update to authenticated using (public.owns_employee_doc(entity_type, entity_ref))
  with check (public.owns_employee_doc(entity_type, entity_ref));
create policy documents_owner_delete on public.documents
  for delete to authenticated using (public.owns_employee_doc(entity_type, entity_ref));

-- ---- public.document_signatures ---------------------------------------------
drop policy if exists document_signatures_authenticated_all on public.document_signatures;

create policy docsig_admin_all on public.document_signatures
  for all to authenticated using (public.is_doc_admin()) with check (public.is_doc_admin());
create policy docsig_owner_select on public.document_signatures
  for select to authenticated using (exists (
    select 1 from public.documents d
    where d.id::text = document_ref and public.owns_employee_doc(d.entity_type, d.entity_ref)));
create policy docsig_owner_insert on public.document_signatures
  for insert to authenticated with check (exists (
    select 1 from public.documents d
    where d.id::text = document_ref and public.owns_employee_doc(d.entity_type, d.entity_ref)));

-- ---- storage.objects : documents bucket -------------------------------------
drop policy if exists documents_authenticated_read   on storage.objects;
drop policy if exists documents_authenticated_insert on storage.objects;
drop policy if exists documents_authenticated_update on storage.objects;
drop policy if exists documents_authenticated_delete on storage.objects;

create policy documents_obj_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.is_doc_admin())
  with check (bucket_id = 'documents' and public.is_doc_admin());
create policy documents_obj_owner_select on storage.objects
  for select to authenticated using (bucket_id = 'documents' and public.owns_storage_doc(name));
create policy documents_obj_owner_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and public.owns_storage_doc(name));
create policy documents_obj_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.owns_storage_doc(name))
  with check (bucket_id = 'documents' and public.owns_storage_doc(name));
create policy documents_obj_owner_delete on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and public.owns_storage_doc(name));

-- ---- storage.objects : employee-photos bucket -------------------------------
drop policy if exists photos_authenticated_read   on storage.objects;
drop policy if exists photos_authenticated_insert on storage.objects;
drop policy if exists photos_authenticated_update on storage.objects;
drop policy if exists photos_authenticated_delete on storage.objects;

create policy photos_obj_read on storage.objects
  for select to authenticated using (bucket_id = 'employee-photos');
create policy photos_obj_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'employee-photos' and (public.is_doc_admin() or public.owns_storage_photo(name)));
create policy photos_obj_update on storage.objects
  for update to authenticated
  using (bucket_id = 'employee-photos' and (public.is_doc_admin() or public.owns_storage_photo(name)))
  with check (bucket_id = 'employee-photos' and (public.is_doc_admin() or public.owns_storage_photo(name)));
create policy photos_obj_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'employee-photos' and (public.is_doc_admin() or public.owns_storage_photo(name)));

-- ---- Bootstrap: keep the existing live operator as Super Admin --------------
insert into public.system_users (auth_user_id, name, email, role, status)
select 'dc888ec9-825d-4048-9e19-83eaf506b928', 'Tharun', 'tharunnnanju@gmail.com', 'Super Admin', 'Active'
where not exists (
  select 1 from public.system_users where auth_user_id = 'dc888ec9-825d-4048-9e19-83eaf506b928'
);
