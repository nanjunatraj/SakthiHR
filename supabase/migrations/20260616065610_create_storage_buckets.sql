-- 20260616065610_create_storage_buckets
-- (exported from the live Supabase migration history)

-- Private bucket for uploaded documents (served only via short-lived signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
  array['application/pdf','image/jpeg','image/png','image/jpg','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- Public bucket for employee photos (low-sensitivity; random unguessable paths).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-photos', 'employee-photos', true, 5242880,
  array['image/jpeg','image/png','image/jpg','image/webp'])
on conflict (id) do nothing;

-- Storage RLS: documents readable/writable only by authenticated users.
create policy "documents_authenticated_read" on storage.objects
  for select to authenticated using (bucket_id = 'documents');
create policy "documents_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');
create policy "documents_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'documents') with check (bucket_id = 'documents');
create policy "documents_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'documents');

-- employee-photos: public read (bucket is public); authenticated may write.
create policy "photos_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'employee-photos');
create policy "photos_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'employee-photos') with check (bucket_id = 'employee-photos');
create policy "photos_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'employee-photos');
