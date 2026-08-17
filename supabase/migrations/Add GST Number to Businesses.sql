-- ============================================
-- ADD GST NUMBER TO BUSINESSES (required)
-- ============================================
alter table public.businesses
add column if not exists gst_number text;

-- ============================================
-- BUSINESS PHOTOS (menu, food, shop interior, etc.)
-- ============================================
create table if not exists public.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade,
  photo_url text not null,
  caption text,
  created_at timestamptz default now()
);

create index if not exists business_photos_business_idx on public.business_photos (business_id);

alter table public.business_photos enable row level security;

drop policy if exists "Business photos are viewable by everyone" on public.business_photos;
create policy "Business photos are viewable by everyone" on public.business_photos
  for select using (true);

drop policy if exists "Owners can add photos to their business" on public.business_photos;
create policy "Owners can add photos to their business" on public.business_photos
  for insert with check (
    exists (
      select 1 from public.businesses
      where businesses.id = business_photos.business_id
      and businesses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners can delete their business photos" on public.business_photos;
create policy "Owners can delete their business photos" on public.business_photos
  for delete using (
    exists (
      select 1 from public.businesses
      where businesses.id = business_photos.business_id
      and businesses.owner_id = auth.uid()
    )
  );

-- ============================================
-- BUSINESS REVIEWS
-- ============================================
create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  rating int check (rating >= 1 and rating <= 5) not null,
  comment text,
  created_at timestamptz default now(),
  unique(business_id, user_id)
);

create index if not exists business_reviews_business_idx on public.business_reviews (business_id);

alter table public.business_reviews enable row level security;

drop policy if exists "Reviews are viewable by everyone" on public.business_reviews;
create policy "Reviews are viewable by everyone" on public.business_reviews
  for select using (true);

drop policy if exists "Users can add their own review" on public.business_reviews;
create policy "Users can add their own review" on public.business_reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own review" on public.business_reviews;
create policy "Users can update their own review" on public.business_reviews
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own review" on public.business_reviews;
create policy "Users can delete their own review" on public.business_reviews
  for delete using (auth.uid() = user_id);