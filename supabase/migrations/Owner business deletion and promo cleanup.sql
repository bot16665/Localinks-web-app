grant delete on table public.businesses to authenticated;

drop policy if exists "Owners can delete their business" on public.businesses;
create policy "Owners can delete their business"
on public.businesses
for delete
to authenticated
using (owner_id = (select auth.uid()));

alter table public.posts
  drop constraint if exists posts_business_id_fkey;

alter table public.posts
  add constraint posts_business_id_fkey
  foreign key (business_id)
  references public.businesses(id)
  on delete cascade;