-- ============================================
-- LOCALLINK DATABASE SCHEMA
-- ============================================

-- USERS (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  phone_number text,
  name text,
  profile_photo_url text,
  location geography(Point, 4326),
  block_flat text,
  created_at timestamptz default now()
);

-- SOCIETIES (for Local/Community level)
create table public.societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  location geography(Point, 4326),
  created_at timestamptz default now()
);

-- SOCIETY MEMBERS
create table public.society_members (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  joined_at timestamptz default now(),
  unique(society_id, user_id)
);

-- BUSINESSES
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles on delete cascade,
  name text not null,
  category text,
  description text,
  photo_url text,
  open_time time,
  close_time time,
  is_open boolean default true,
  location geography(Point, 4326),
  address text,
  created_at timestamptz default now()
);

-- POSTS (shared table for individual / business / local levels)
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade,
  type text check (type in ('individual', 'business', 'local')) not null,
  category text,
  title text not null,
  description text,
  photo_url text,
  event_date date,
  event_time time,
  location geography(Point, 4326),
  society_id uuid references public.societies on delete set null,
  business_id uuid references public.businesses on delete set null,
  expires_at timestamptz,
  status text check (status in ('active', 'expired', 'resolved')) default 'active',
  created_at timestamptz default now()
);

-- INTERESTS (for "I'm Interested" button on individual-level posts)
create table public.interests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- CHATS
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts on delete set null,
  user_one_id uuid references public.profiles on delete cascade,
  user_two_id uuid references public.profiles on delete cascade,
  created_at timestamptz default now(),
  unique(user_one_id, user_two_id, post_id)
);

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats on delete cascade,
  sender_id uuid references public.profiles on delete cascade,
  content text not null,
  sent_at timestamptz default now()
);

-- REPLIES (for local-level community threads)
create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES for fast geo + lookup queries
-- ============================================
create index posts_location_idx on public.posts using gist (location);
create index businesses_location_idx on public.businesses using gist (location);
create index profiles_location_idx on public.profiles using gist (location);
create index posts_type_idx on public.posts (type);
create index posts_society_idx on public.posts (society_id);
create index messages_chat_idx on public.messages (chat_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) — required for Supabase
-- ============================================
alter table public.profiles enable row level security;
alter table public.societies enable row level security;
alter table public.society_members enable row level security;
alter table public.businesses enable row level security;
alter table public.posts enable row level security;
alter table public.interests enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.replies enable row level security;

-- Basic policies: logged-in users can read everything (public feed),
-- but can only insert/update/delete their own data.

-- Profiles
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Societies (read-only for all logged in users for now)
create policy "Societies are viewable by everyone" on public.societies
  for select using (true);

-- Society members
create policy "Society members viewable by everyone" on public.society_members
  for select using (true);
create policy "Users can join societies" on public.society_members
  for insert with check (auth.uid() = user_id);

-- Businesses
create policy "Businesses are viewable by everyone" on public.businesses
  for select using (true);
create policy "Owners can insert their business" on public.businesses
  for insert with check (auth.uid() = owner_id);
create policy "Owners can update their business" on public.businesses
  for update using (auth.uid() = owner_id);

-- Posts
create policy "Posts are viewable by everyone" on public.posts
  for select using (true);
create policy "Users can insert their own posts" on public.posts
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own posts" on public.posts
  for update using (auth.uid() = user_id);
create policy "Users can delete their own posts" on public.posts
  for delete using (auth.uid() = user_id);

-- Interests
create policy "Interests are viewable by everyone" on public.interests
  for select using (true);
create policy "Users can express interest" on public.interests
  for insert with check (auth.uid() = user_id);

-- Chats
create policy "Users can view their own chats" on public.chats
  for select using (auth.uid() = user_one_id or auth.uid() = user_two_id);
create policy "Users can create chats" on public.chats
  for insert with check (auth.uid() = user_one_id or auth.uid() = user_two_id);

-- Messages
create policy "Users can view messages in their chats" on public.messages
  for select using (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
      and (chats.user_one_id = auth.uid() or chats.user_two_id = auth.uid())
    )
  );
create policy "Users can send messages in their chats" on public.messages
  for insert with check (auth.uid() = sender_id);

-- Replies
create policy "Replies are viewable by everyone" on public.replies
  for select using (true);
create policy "Users can insert their own replies" on public.replies
  for insert with check (auth.uid() = user_id);