create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  plan_type text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_movies (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_slug text not null,
  movie_name text not null,
  poster_url text,
  added_at timestamptz not null default now(),
  primary key (user_id, movie_slug)
);

create table if not exists public.liked_movies (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_slug)
);

create table if not exists public.watch_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid references auth.users(id) on delete set null,
  host_guest_id text,
  host_token_hash text,
  host_name text not null default 'User 1',
  movie_slug text not null,
  movie_name text not null,
  poster_url text,
  stream_url text not null,
  episode_name text,
  intro_start_time numeric not null default 0,
  intro_end_time numeric not null default 0,
  episodes_json jsonb not null default '[]'::jsonb,
  viewer_count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.watch_rooms
  alter column host_user_id drop not null;

alter table public.watch_rooms add column if not exists host_guest_id text;
alter table public.watch_rooms add column if not exists host_token_hash text;
alter table public.watch_rooms add column if not exists host_name text not null default 'User 1';
alter table public.watch_rooms add column if not exists intro_start_time numeric not null default 0;
alter table public.watch_rooms add column if not exists intro_end_time numeric not null default 0;
alter table public.watch_rooms add column if not exists episodes_json jsonb not null default '[]'::jsonb;
alter table public.watch_rooms add column if not exists viewer_count integer not null default 0;
alter table public.watch_rooms add column if not exists last_seen_at timestamptz not null default now();

update public.watch_rooms
set host_guest_id = coalesce(host_guest_id, host_user_id::text, id::text)
where host_guest_id is null;

alter table public.watch_rooms
  alter column host_guest_id set not null;

create table if not exists public.watch_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  guest_id text,
  display_name text,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.watch_room_messages
  alter column user_id drop not null;

alter table public.watch_room_messages add column if not exists guest_id text;
alter table public.watch_room_messages add column if not exists display_name text;

create table if not exists public.intro_markers (
  id uuid primary key default gen_random_uuid(),
  movie_slug text not null,
  season_number integer not null default 1,
  start_time numeric not null default 0,
  end_time numeric not null,
  confidence numeric not null default 0,
  method text not null default 'audio_fingerprint',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (movie_slug, season_number)
);

alter table public.profiles enable row level security;
alter table public.saved_movies enable row level security;
alter table public.liked_movies enable row level security;
alter table public.watch_rooms enable row level security;
alter table public.watch_room_messages enable row level security;
alter table public.intro_markers enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Profiles are insertable by owner" on public.profiles;
drop policy if exists "Profiles are updateable by owner" on public.profiles;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Profiles are updateable by owner"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Saved movies are viewable by owner" on public.saved_movies;
drop policy if exists "Saved movies are insertable by owner" on public.saved_movies;
drop policy if exists "Saved movies are updateable by owner" on public.saved_movies;
drop policy if exists "Saved movies are deletable by owner" on public.saved_movies;

create policy "Saved movies are viewable by owner"
  on public.saved_movies for select
  using (auth.uid() = user_id);

create policy "Saved movies are insertable by owner"
  on public.saved_movies for insert
  with check (auth.uid() = user_id);

create policy "Saved movies are updateable by owner"
  on public.saved_movies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Saved movies are deletable by owner"
  on public.saved_movies for delete
  using (auth.uid() = user_id);

drop policy if exists "Liked movies are viewable by owner" on public.liked_movies;
drop policy if exists "Liked movies are insertable by owner" on public.liked_movies;
drop policy if exists "Liked movies are deletable by owner" on public.liked_movies;

create policy "Liked movies are viewable by owner"
  on public.liked_movies for select
  using (auth.uid() = user_id);

create policy "Liked movies are insertable by owner"
  on public.liked_movies for insert
  with check (auth.uid() = user_id);

create policy "Liked movies are deletable by owner"
  on public.liked_movies for delete
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can view watch rooms" on public.watch_rooms;
drop policy if exists "Users can create hosted watch rooms" on public.watch_rooms;
drop policy if exists "Hosts can update watch rooms" on public.watch_rooms;
drop policy if exists "Public can view watch rooms" on public.watch_rooms;
drop policy if exists "Public can create watch rooms" on public.watch_rooms;
drop policy if exists "Public hosts can update watch rooms" on public.watch_rooms;
drop policy if exists "Public can heartbeat watch rooms" on public.watch_rooms;
drop policy if exists "Public can cleanup inactive watch rooms" on public.watch_rooms;

create policy "Public can view watch rooms"
  on public.watch_rooms for select
  using (true);

create policy "Public can create watch rooms"
  on public.watch_rooms for insert
  with check (host_guest_id is not null and host_name is not null);

create policy "Public can heartbeat watch rooms"
  on public.watch_rooms for update
  using (true)
  with check (true);

create policy "Public can cleanup inactive watch rooms"
  on public.watch_rooms for delete
  using (last_seen_at < now() - interval '10 minutes');

drop policy if exists "Authenticated users can view room messages" on public.watch_room_messages;
drop policy if exists "Authenticated users can send room messages" on public.watch_room_messages;
drop policy if exists "Public can view room messages" on public.watch_room_messages;
drop policy if exists "Public can send room messages" on public.watch_room_messages;
drop policy if exists "Public can cleanup old room messages" on public.watch_room_messages;

create policy "Public can view room messages"
  on public.watch_room_messages for select
  using (true);

create policy "Public can send room messages"
  on public.watch_room_messages for insert
  with check (body is not null and coalesce(display_name, guest_id, user_id::text) is not null);

create policy "Public can cleanup old room messages"
  on public.watch_room_messages for delete
  using (created_at < now() - interval '3 minutes');

drop policy if exists "Public can read intro markers" on public.intro_markers;

create policy "Public can read intro markers"
  on public.intro_markers for select
  using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.watch_room_messages;
  exception
    when duplicate_object then null;
  end;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
