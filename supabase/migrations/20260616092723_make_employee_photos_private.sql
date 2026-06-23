-- 20260616092723_make_employee_photos_private
-- (exported from the live Supabase migration history)

-- Flip employee photos to a private bucket; access now requires auth + signed URLs.
update storage.buckets set public = false where id = 'employee-photos';

-- Authenticated read policy (public read no longer applies once the bucket is private).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'photos_authenticated_read'
  ) then
    create policy "photos_authenticated_read" on storage.objects
      for select to authenticated using (bucket_id = 'employee-photos');
  end if;
end $$;
