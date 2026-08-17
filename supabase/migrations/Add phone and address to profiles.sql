alter table public.profiles
add column if not exists phone_number text;

alter table public.profiles
add column if not exists address text;