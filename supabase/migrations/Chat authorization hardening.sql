drop policy if exists "Users can express interest" on public.interests;
create policy "Users can express interest in active activities"
on public.interests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts
    where posts.id = interests.post_id
      and posts.type = 'individual'
      and posts.status = 'active'
      and posts.user_id <> (select auth.uid())
  )
);

drop policy if exists "Users can create chats" on public.chats;
create policy "Interested users can create activity chats"
on public.chats
for insert
to authenticated
with check (
  user_one_id = (select auth.uid())
  and post_id is not null
  and exists (
    select 1
    from public.posts
    join public.interests on interests.post_id = posts.id
    where posts.id = chats.post_id
      and posts.type = 'individual'
      and posts.status = 'active'
      and posts.user_id = chats.user_two_id
      and interests.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can send messages in their chats" on public.messages;
create policy "Chat members can send their own messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and (
        chats.user_one_id = (select auth.uid())
        or chats.user_two_id = (select auth.uid())
      )
  )
);