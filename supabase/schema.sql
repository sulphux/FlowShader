-- NodeShader: schemat bazy pod konta, projekty online, limity i licencje.
-- Uruchom w Supabase: Dashboard → SQL Editor → New query → wklej → Run.

-- === PROFILE UŻYTKOWNIKÓW ===================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Użytkownik',
  storage_limit_bytes bigint not null default 10485760  -- 10 MB na użytkownika
);

-- Profil tworzy się automatycznie przy rejestracji
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'Użytkownik'))
  on conflict (id) do nothing;
  return new;
end $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- === PROJEKTY ===============================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  json jsonb not null,
  size_bytes bigint not null,
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  license text not null default 'all-rights-reserved'
    check (license in ('all-rights-reserved', 'cc-by', 'cc-by-nc', 'cc0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists projects_public_idx on public.projects(visibility) where visibility = 'public';

-- === LIMIT MIEJSCA (egzekwowany po stronie bazy) ============================

create or replace function public.enforce_storage_limit() returns trigger as $$
begin
  if (select coalesce(sum(size_bytes), 0) from public.projects
      where owner_id = new.owner_id and id <> new.id) + new.size_bytes
     > (select storage_limit_bytes from public.profiles where id = new.owner_id) then
    raise exception 'storage limit exceeded';
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists projects_limit on public.projects;
create trigger projects_limit
  before insert or update on public.projects
  for each row execute function public.enforce_storage_limit();

-- === UPRAWNIENIA (Row Level Security) =======================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- Profil: każdy zalogowany czyta swój; edycja tylko własnego
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  using (id = auth.uid()) with check (id = auth.uid());

-- Projekty: właściciel ma pełny dostęp
drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Projekty public i unlisted: odczyt dla wszystkich
-- (unlisted chroni nieodgadywalny UUID w linku, jak "kto ma link" w Google Docs)
drop policy if exists projects_shared_read on public.projects;
create policy projects_shared_read on public.projects for select
  using (visibility in ('public', 'unlisted'));
