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
  host_user_id uuid not null references auth.users(id) on delete cascade,
  movie_slug text not null,
  movie_name text not null,
  poster_url text,
  stream_url text not null,
  episode_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.watch_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.saved_movies enable row level security;
alter table public.liked_movies enable row level security;
alter table public.watch_rooms enable row level security;
alter table public.watch_room_messages enable row level security;

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

create policy "Liked movies are viewable by owner"
  on public.liked_movies for select
  using (auth.uid() = user_id);

create policy "Liked movies are insertable by owner"
  on public.liked_movies for insert
  with check (auth.uid() = user_id);

create policy "Liked movies are deletable by owner"
  on public.liked_movies for delete
  using (auth.uid() = user_id);

create policy "Authenticated users can view watch rooms"
  on public.watch_rooms for select
  using (auth.role() = 'authenticated');

create policy "Users can create hosted watch rooms"
  on public.watch_rooms for insert
  with check (auth.uid() = host_user_id);

create policy "Hosts can update watch rooms"
  on public.watch_rooms for update
  using (auth.uid() = host_user_id)
  with check (auth.uid() = host_user_id);

create policy "Authenticated users can view room messages"
  on public.watch_room_messages for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can send room messages"
  on public.watch_room_messages for insert
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.watch_room_messages;

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
