alter table public.chats
  drop constraint if exists chats_post_id_fkey;

alter table public.chats
  add constraint chats_post_id_fkey
  foreign key (post_id)
  references public.posts(id)
  on delete cascade;