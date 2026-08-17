drop function if exists nearby_posts(double precision, double precision, double precision, text);

create or replace function nearby_posts(
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
    ST_Distance(
      p.location::geography,
      (select location::geography from public.profiles where id = auth.uid())
    ) / 1000 as distance_km,
    pr.name as author_name,
    pr.profile_photo_url as author_photo_url
  from public.posts p
  join public.profiles pr on pr.id = p.user_id
  where p.type = post_type
    and p.status = 'active'
    and p.location is not null
    and (select location from public.profiles where id = auth.uid()) is not null
    and ST_DWithin(
      p.location::geography,
      (select location::geography from public.profiles where id = auth.uid()),
      radius_km * 1000
    )
  order by distance_km asc;
$$;