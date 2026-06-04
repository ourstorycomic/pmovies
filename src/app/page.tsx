import { MotionShell } from "@/components/motion-shell";
import { MovieActions } from "@/components/movies/movie-actions";
import { MovieCardView } from "@/components/movies/movie-card";
import { MovieRow } from "@/components/movies/movie-row";
import { fetchKkJson } from "@/lib/kkphim";
import { stripHtml } from "@/lib/utils";
import type { MovieCard } from "@/types/movie";

type MovieListPayload = {
  items?: MovieCard[];
  data?: { items?: MovieCard[]; movies?: MovieCard[] };
};

function pickMovies(payload: MovieListPayload | null): MovieCard[] {
  if (!payload) return [];
  return payload.items ?? payload.data?.items ?? payload.data?.movies ?? [];
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const keyword = q?.trim();

  if (q !== undefined && !keyword) {
    return (
      <MotionShell>
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 pt-16 sm:px-8">
          <section className="w-full rounded-lg border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Search</p>
            <h1 className="mt-3 text-4xl font-black text-white">Find a movie</h1>
            <form action="/" className="mt-7 flex flex-col gap-3 sm:flex-row">
              <input
                name="q"
                autoFocus
                placeholder="Movie name, actor, keyword..."
                className="h-12 flex-1 rounded-md border border-white/10 bg-black/35 px-4 text-white outline-none focus:border-cyan-300"
              />
              <button className="h-12 rounded-md bg-cyan-300 px-6 font-bold text-slate-950 shadow-[0_0_28px_rgba(103,232,249,.35)] hover:bg-cyan-200">
                Search
              </button>
            </form>
          </section>
        </main>
      </MotionShell>
    );
  }

  if (keyword) {
    const results = pickMovies(await fetchKkJson(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=36`) as MovieListPayload | null);
    return (
      <MotionShell>
        <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-8">
          <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Search</p>
            <h1 className="mt-2 text-4xl font-black text-white">Results for {keyword}</h1>
            <form action="/" className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                name="q"
                defaultValue={keyword}
                className="h-11 flex-1 rounded-md border border-white/10 bg-black/35 px-4 text-white outline-none focus:border-cyan-300"
              />
              <button className="h-11 rounded-md bg-cyan-300 px-5 font-bold text-slate-950">Search</button>
            </form>
            <p className="mt-2 text-slate-300">{results.length} movies found</p>
          </div>
          <div className="flex flex-wrap gap-4">
            {results.map((movie) => <MovieCardView key={movie.slug} movie={movie} />)}
          </div>
        </main>
      </MotionShell>
    );
  }

  const [latest, action, shows, anime] = await Promise.all([
    fetchKkJson("/danh-sach/phim-moi-cap-nhat-v3?page=1"),
    fetchKkJson("/v1/api/danh-sach/phim-le?page=1&limit=24"),
    fetchKkJson("/v1/api/danh-sach/tv-shows?page=1&limit=24"),
    fetchKkJson("/v1/api/danh-sach/hoat-hinh?page=1&limit=24"),
  ]);
  const latestMovies = pickMovies(latest as MovieListPayload | null);
  const hero = latestMovies[0];

  return (
    <MotionShell>
      {hero && (
        <section className="relative min-h-[78vh] overflow-hidden pt-16">
          <img src={hero.thumb_url || hero.poster_url} alt={hero.name} className="absolute inset-0 h-full w-full object-cover opacity-65" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
          <div className="relative mx-auto flex min-h-[72vh] max-w-7xl items-end px-4 pb-16 sm:px-8">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[.2em] text-cyan-200 backdrop-blur-xl">Phim moi cap nhat</p>
              <h1 className="text-5xl font-black text-white drop-shadow-2xl sm:text-7xl">{hero.name}</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-200">{stripHtml(hero.origin_name)} {hero.episode_current ? ` - ${hero.episode_current}` : ""}</p>
              <div className="mt-7"><MovieActions movie={hero} /></div>
            </div>
          </div>
        </section>
      )}
      <div className="-mt-8 pb-16">
        <MovieRow title="Latest Releases" movies={latestMovies} seeMoreHref="/browse?type=phim-moi-cap-nhat" />
        <MovieRow title="Action & Feature Films" movies={pickMovies(action as MovieListPayload | null)} seeMoreHref="/browse?type=phim-le" />
        <MovieRow title="TV Shows" movies={pickMovies(shows as MovieListPayload | null)} seeMoreHref="/browse?type=tv-shows" />
        <MovieRow title="Anime" movies={pickMovies(anime as MovieListPayload | null)} seeMoreHref="/browse?type=hoat-hinh" />
      </div>
    </MotionShell>
  );
}
