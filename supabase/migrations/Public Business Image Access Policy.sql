drop policy if exists "Business images are publicly viewable" on storage.objects;
create policy "Business images are publicly viewable"
on storage.objects for select
using (bucket_id = 'business-images');

drop policy if exists "Authenticated users can upload business images" on storage.objects;
create policy "Authenticated users can upload business images"
on storage.objects for insert
with check (bucket_id = 'business-images' and auth.role() = 'authenticated');