alter table public.profiles
  add column if not exists discovery_radius_km smallint not null default 5,
  add column if not exists in_app_notifications_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_discovery_radius_km_range'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_discovery_radius_km_range
      check (discovery_radius_km between 1 and 25);
  end if;
end;
$$;