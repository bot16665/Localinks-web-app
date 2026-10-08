-- Public post reads retain content but never expose the source coordinates.
revoke select on public.posts from anon, authenticated;
grant select (
  id, user_id, type, category, title, description, photo_url,
  event_date, event_time, society_id, business_id, expires_at,
  status, created_at
) on public.posts to authenticated;

-- Business owners may read their own private fields. Public screens use the safe view
-- or nearby_businesses RPC instead of selecting raw rows.
drop policy if exists "Businesses are viewable by everyone" on public.businesses;
drop policy if exists "Owners can view their own business" on public.businesses;
create policy "Owners can view their own business"
on public.businesses
for select
to authenticated
using (owner_id = (select auth.uid()));

grant select on public.businesses to authenticated;

create or replace view public.public_businesses
with (security_barrier = true)
as
select
  id, owner_id, name, category, description, photo_url,
  open_time, close_time, is_open, address, created_at
from public.businesses;

revoke all on public.public_businesses from public, anon, authenticated;
grant select on public.public_businesses to authenticated;

-- Society coordinates are private; authenticated clients can read only directory fields.
revoke select on public.societies from anon, authenticated;
grant select (id, name, address, created_at) on public.societies to authenticated;

drop policy if exists "Authenticated users can create societies" on public.societies;
create policy "Authenticated users can create societies"
on public.societies
for insert
to authenticated
with check ((select auth.uid()) is not null);

create or replace function public.set_my_society(target_society_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles as profile
  set society_id = target_society_id,
      home_location = coalesce(
        (select society.location from public.societies as society where society.id = target_society_id),
        profile.home_location
      )
  where profile.id = auth.uid()
    and exists (select 1 from public.societies as society where society.id = target_society_id);

  if not found then
    raise exception 'Society not found';
  end if;
end;
$function$;

revoke all on function public.set_my_society(uuid) from public, anon;
grant execute on function public.set_my_society(uuid) to authenticated;

