alter table public.profiles
  add column if not exists society_id uuid
  references public.societies(id)
  on delete set null;

create index if not exists profiles_society_id_idx
  on public.profiles (society_id);

notify pgrst, 'reload schema';