-- 20260617033107_create_letterhead_assets_bucket
-- (exported from the live Supabase migration history)

-- Public bucket for letterhead/company logo & banner images (non-sensitive, rendered directly).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('letterhead-assets', 'letterhead-assets', true, 5242880,
        array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (objects are also reachable via getPublicUrl); authenticated write/update/delete.
drop policy if exists "letterhead_assets_read" on storage.objects;
create policy "letterhead_assets_read" on storage.objects
  for select using (bucket_id = 'letterhead-assets');

drop policy if exists "letterhead_assets_insert" on storage.objects;
create policy "letterhead_assets_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'letterhead-assets');

drop policy if exists "letterhead_assets_update" on storage.objects;
create policy "letterhead_assets_update" on storage.objects
  for update to authenticated using (bucket_id = 'letterhead-assets') with check (bucket_id = 'letterhead-assets');

drop policy if exists "letterhead_assets_delete" on storage.objects;
create policy "letterhead_assets_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'letterhead-assets');
