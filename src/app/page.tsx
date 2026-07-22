import { MotionShell } from "@/components/motion-shell";
import { MovieActions } from "@/components/movies/movie-actions";
import { MovieCardView } from "@/components/movies/movie-card";
import { MovieRow } from "@/components/movies/movie-row";
import { JoinRoomForm } from "@/components/watch-party/join-room-form";
import { fetchKkJson } from "@/lib/kkphim";
import { stripHtml, normalizeVietnameseSearch } from "@/lib/utils";
import { redirect } from "next/navigation";
import type { MovieCard } from "@/types/movie";

type MovieListPayload = {
  items?: MovieCard[];
  data?: { items?: MovieCard[]; movies?: MovieCard[] };
};

function pickMovies(payload: MovieListPayload | null): MovieCard[] {
  if (!payload) return [];
  return payload.items ?? payload.data?.items ?? payload.data?.movies ?? [];
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; country?: string }> }) {
  const { q, category, country } = await searchParams;
  let keyword = q?.trim();
  if (keyword) {
    keyword = normalizeVietnameseSearch(keyword);
  }



  if (keyword && keyword.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    redirect(`/watch-party/${keyword}`);
  }

  if (q !== undefined && !keyword && !category && !country) {
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
            <div className="mt-8 border-t border-white/10 pt-8">
              <p className="mb-4 text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Watch Party</p>
              <JoinRoomForm />
            </div>
          </section>
        </main>
      </MotionShell>
    );
  }

  if (keyword || category || country) {
    const queryParts = [];
    let overrideKeyword = keyword;

    if (category === "found-footage" && !overrideKeyword) {
      overrideKeyword = "found footage";
    }

    if (overrideKeyword) queryParts.push(`keyword=${encodeURIComponent(overrideKeyword)}`);
    if (category && category !== "found-footage") queryParts.push(`category=${encodeURIComponent(category)}`);
    if (country) queryParts.push(`country=${encodeURIComponent(country)}`);
    queryParts.push(`limit=36`);

    const results = pickMovies(await fetchKkJson(`/v1/api/tim-kiem?${queryParts.join("&")}`) as MovieListPayload | null);

    const CATEGORIES = [
      { slug: "", name: "Tất cả thể loại" },
      { slug: "hanh-dong", name: "Hành Động" },
      { slug: "kinh-di", name: "Kinh Dị" },
      { slug: "tinh-cam", name: "Tình Cảm" },
      { slug: "hai-huoc", name: "Hài Hước" },
      { slug: "co-trang", name: "Cổ Trang" },
      { slug: "tam-ly", name: "Tâm Lý" },
      { slug: "hinh-su", name: "Hình Sự" },
      { slug: "phieu-luu", name: "Phiêu Lưu" },
      { slug: "vien-tuong", name: "Viễn Tưởng" },
      { slug: "khoa-hoc", name: "Khoa Học" },
      { slug: "found-footage", name: "Found Footage" },
    ];

    const COUNTRIES = [
      { slug: "", name: "Tất cả quốc gia" },
      { slug: "au-my", name: "Âu Mỹ" },
      { slug: "han-quoc", name: "Hàn Quốc" },
      { slug: "trung-quoc", name: "Trung Quốc" },
      { slug: "nhat-ban", name: "Nhật Bản" },
      { slug: "thai-lan", name: "Thái Lan" },
      { slug: "viet-nam", name: "Việt Nam" },
    ];

    return (
      <MotionShell>
        <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-8">
          <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Search</p>
            <h1 className="mt-2 text-4xl font-black text-white">Results {keyword ? `for ${keyword}` : ''}</h1>
            
            <form action="/" className="mt-5 flex flex-wrap gap-3">
              <input type="hidden" name="q" value={keyword || ""} />
              <select name="category" defaultValue={category || ""} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300">
                {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <select name="country" defaultValue={country || ""} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300">
                {COUNTRIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <button className="h-10 rounded-md bg-cyan-300 px-5 text-sm font-bold text-slate-950">Filter</button>
            </form>

            <p className="mt-4 text-slate-300">{results.length} movies found</p>
            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">

              <span className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Watch Party</span>
              <div className="flex-1 max-w-sm"><JoinRoomForm /></div>
            </div>
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
  const actionMovies = pickMovies(action as MovieListPayload | null);
  const hero = actionMovies[0] || latestMovies[0];

  return (
    <MotionShell>
      {hero && (
        <section className="relative min-h-[78vh] overflow-hidden pt-16">
          <img src={hero.thumb_url || hero.poster_url} alt={hero.name} className="absolute inset-0 h-full w-full object-cover opacity-65" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
          <div className="relative mx-auto flex min-h-[72vh] max-w-7xl items-end px-4 pb-16 sm:px-8">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[.2em] text-cyan-200 backdrop-blur-xl">Trending Feature</p>
              <h1 className="text-5xl font-black text-white drop-shadow-2xl sm:text-7xl">{hero.name}</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-200">{stripHtml(hero.origin_name)} {hero.episode_current ? ` - ${hero.episode_current}` : ""}</p>
              <div className="mt-7"><MovieActions movie={hero} /></div>
              <div className="mt-8"><JoinRoomForm /></div>
            </div>
          </div>
        </section>
      )}
      <div className="-mt-8 pb-16">
        <MovieRow title="Latest Releases" movies={latestMovies} seeMoreHref="/browse?type=phim-moi-cap-nhat" />
        <MovieRow title="Action & Feature Films" movies={actionMovies} seeMoreHref="/browse?type=phim-le" />
        <MovieRow title="TV Shows" movies={pickMovies(shows as MovieListPayload | null)} seeMoreHref="/browse?type=tv-shows" />
        <MovieRow title="Anime" movies={pickMovies(anime as MovieListPayload | null)} seeMoreHref="/browse?type=hoat-hinh" />
      </div>
    </MotionShell>
  );
}
