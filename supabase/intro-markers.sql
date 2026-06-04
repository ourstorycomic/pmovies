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

alter table public.intro_markers enable row level security;

drop policy if exists "Public can read intro markers" on public.intro_markers;

create policy "Public can read intro markers"
  on public.intro_markers for select
  using (true);
