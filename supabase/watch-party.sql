create table if not exists public.watch_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid references auth.users(id) on delete set null,
  host_guest_id text not null,
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

alter table public.watch_rooms
  add column if not exists host_guest_id text,
  add column if not exists host_token_hash text,
  add column if not exists host_name text not null default 'User 1',
  add column if not exists intro_start_time numeric not null default 0,
  add column if not exists intro_end_time numeric not null default 0,
  add column if not exists episodes_json jsonb not null default '[]'::jsonb,
  add column if not exists viewer_count integer not null default 0,
  add column if not exists last_seen_at timestamptz not null default now();

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
  alter column user_id drop not null,
  add column if not exists guest_id text,
  add column if not exists display_name text;

alter table public.watch_rooms enable row level security;
alter table public.watch_room_messages enable row level security;

drop policy if exists "Authenticated users can view watch rooms" on public.watch_rooms;
drop policy if exists "Users can create hosted watch rooms" on public.watch_rooms;
drop policy if exists "Hosts can update watch rooms" on public.watch_rooms;
drop policy if exists "Public can view watch rooms" on public.watch_rooms;
drop policy if exists "Public can create watch rooms" on public.watch_rooms;
drop policy if exists "Public hosts can update watch rooms" on public.watch_rooms;
drop policy if exists "Public can heartbeat watch rooms" on public.watch_rooms;
drop policy if exists "Public can cleanup inactive watch rooms" on public.watch_rooms;
drop policy if exists "Authenticated users can view room messages" on public.watch_room_messages;
drop policy if exists "Authenticated users can send room messages" on public.watch_room_messages;
drop policy if exists "Public can view room messages" on public.watch_room_messages;
drop policy if exists "Public can send room messages" on public.watch_room_messages;
drop policy if exists "Public can cleanup old room messages" on public.watch_room_messages;

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

create policy "Public can view room messages"
  on public.watch_room_messages for select
  using (true);

create policy "Public can send room messages"
  on public.watch_room_messages for insert
  with check (body is not null and coalesce(display_name, guest_id, user_id::text) is not null);

create policy "Public can cleanup old room messages"
  on public.watch_room_messages for delete
  using (created_at < now() - interval '3 minutes');

do $$
begin
  begin
    alter publication supabase_realtime add table public.watch_room_messages;
  exception
    when duplicate_object then null;
  end;
end $$;
