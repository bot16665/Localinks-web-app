update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id in ('business-images', 'community-images');

drop policy if exists "Authenticated users can upload business images" on storage.objects;
create policy "Authenticated users can upload owned business images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-images'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "Authenticated users can upload community images" on storage.objects;
create policy "Authenticated users can upload owned community images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-images'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "Community images are publicly viewable" on storage.objects;
create policy "Community images are publicly viewable"
on storage.objects
for select
using (bucket_id = 'community-images');

drop policy if exists "Users can delete their own community images" on storage.objects;
create policy "Users can delete their own community images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-images'
  and owner_id = (select auth.uid()::text)
);