alter table public.profiles
  add column if not exists current_location geography(Point, 4326),
  add column if not exists home_location geography(Point, 4326);

update public.profiles
set current_location = coalesce(current_location, location),
    home_location = coalesce(home_location, location)
where location is not null;

drop policy if exists "Authenticated users can create societies" on public.societies;
create policy "Authenticated users can create societies"
on public.societies
for insert
to authenticated
with check ((select auth.uid()) is not null);

create or replace function public.nearby_posts(
  radius_km double precision default 10,
  post_type text default 'individual'
)
returns table (
  id uuid,
  user_id uuid,
  type text,
  category text,
  title text,
  description text,
  photo_url text,
  event_date date,
  event_time time,
  status text,
  created_at timestamptz,
  distance_km double precision,
  author_name text,
  author_photo_url text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    p.user_id,
    p.type,
    p.category,
    p.title,
    p.description,
    p.photo_url,
    p.event_date,
    p.event_time,
    p.status,
    p.created_at,
    ST_Distance(p.location::geography, profile.current_location::geography) / 1000 as distance_km,
    author.name as author_name,
    author.profile_photo_url as author_photo_url
  from public.posts as p
  join public.profiles as author on author.id = p.user_id
  join public.profiles as profile on profile.id = (select auth.uid())
  where p.type = post_type
    and p.status = 'active'
    and p.location is not null
    and profile.current_location is not null
    and ST_DWithin(
      p.location::geography,
      profile.current_location::geography,
      least(greatest(coalesce(radius_km, 10), 1), 25) * 1000
    )
  order by distance_km asc;
$$;

create or replace function public.nearby_businesses(
  radius_km double precision default 10,
  filter_category text default null
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  category text,
  description text,
  photo_url text,
  open_time time,
  close_time time,
  is_open boolean,
  address text,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    b.id,
    b.owner_id,
    b.name,
    b.category,
    b.description,
    b.photo_url,
    b.open_time,
    b.close_time,
    b.is_open,
    b.address,
    ST_Distance(b.location::geography, profile.current_location::geography) / 1000 as distance_km
  from public.businesses as b
  join public.profiles as profile on profile.id = (select auth.uid())
  where b.location is not null
    and profile.current_location is not null
    and (filter_category is null or b.category = filter_category)
    and ST_DWithin(
      b.location::geography,
      profile.current_location::geography,
      least(greatest(coalesce(radius_km, 10), 1), 25) * 1000
    )
  order by distance_km asc;
$$;

revoke all on function public.nearby_posts(double precision, text) from public, anon;
grant execute on function public.nearby_posts(double precision, text) to authenticated;
revoke all on function public.nearby_businesses(double precision, text) from public, anon;
grant execute on function public.nearby_businesses(double precision, text) to authenticated;