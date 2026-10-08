drop policy if exists "Users can delete their own business images" on storage.objects;

create policy "Users can delete their own business images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-images'
  and owner_id = (select auth.uid()::text)
);