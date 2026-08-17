create or replace function nearby_businesses(
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
    ST_Distance(
      b.location::geography,
      (select location::geography from public.profiles where id = auth.uid())
    ) / 1000 as distance_km
  from public.businesses b
  where b.location is not null
    and (select location from public.profiles where id = auth.uid()) is not null
    and (filter_category is null or b.category = filter_category)
    and ST_DWithin(
      b.location::geography,
      (select location::geography from public.profiles where id = auth.uid()),
      radius_km * 1000
    )
  order by distance_km asc;
$$;