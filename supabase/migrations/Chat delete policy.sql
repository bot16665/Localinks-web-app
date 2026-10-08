drop policy if exists "Chat members can delete conversations" on public.chats;
create policy "Chat members can delete conversations"
on public.chats
for delete
to authenticated
using (
  user_one_id = (select auth.uid())
  or user_two_id = (select auth.uid())
);