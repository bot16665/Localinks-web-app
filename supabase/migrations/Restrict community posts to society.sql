drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Users can view posts in their community"
on public.posts
for select
to authenticated
using (
  type <> 'local'
  or user_id = (select auth.uid())
  or society_id = (
    select profile.society_id
    from public.profiles as profile
    where profile.id = (select auth.uid())
  )
);

drop policy if exists "Replies are viewable by everyone" on public.replies;
create policy "Users can view replies in their community"
on public.replies
for select
to authenticated
using (
  exists (
    select 1
    from public.posts as post
    where post.id = replies.post_id
      and (
        post.type <> 'local'
        or post.user_id = (select auth.uid())
        or post.society_id = (
          select profile.society_id
          from public.profiles as profile
          where profile.id = (select auth.uid())
        )
      )
  )
);

drop policy if exists "Users can insert their own replies" on public.replies;
create policy "Users can reply in their community"
on public.replies
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts as post
    where post.id = replies.post_id
      and (
        post.type <> 'local'
        or post.society_id = (
          select profile.society_id
          from public.profiles as profile
          where profile.id = (select auth.uid())
        )
      )
  )
);

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
    post.id,
    post.user_id,
    post.type,
    post.category,
    post.title,
    post.description,
    post.photo_url,
    post.event_date,
    post.event_time,
    post.status,
    post.created_at,
    ST_Distance(post.location::geography, profile.current_location::geography) / 1000 as distance_km,
    author.name as author_name,
    author.profile_photo_url as author_photo_url
  from public.posts as post
  join public.profiles as author on author.id = post.user_id
  join public.profiles as profile on profile.id = (select auth.uid())
  where post_type = 'individual'
    and post.type = post_type
    and post.status = 'active'
    and post.location is not null
    and profile.current_location is not null
    and ST_DWithin(
      post.location::geography,
      profile.current_location::geography,
      least(greatest(coalesce(radius_km, 10), 1), 25) * 1000
    )
  order by distance_km asc;
$$;

revoke all on function public.nearby_posts(double precision, text) from public, anon;
grant execute on function public.nearby_posts(double precision, text) to authenticated;