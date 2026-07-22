import { MotionShell } from "@/components/motion-shell";
import { MovieCardView } from "@/components/movies/movie-card";
import { fetchKkJson } from "@/lib/kkphim";
import type { MovieCard } from "@/types/movie";
import { Pagination } from "@/components/pagination";
import { CATEGORIES, COUNTRIES, RATINGS, SORTS, TYPES, YEARS } from "@/lib/constants";
import Link from "next/link";

type MovieListPayload = {
  items?: MovieCard[];
  data?: { items?: MovieCard[]; movies?: MovieCard[]; params?: { pagination?: { totalItems?: number; totalItemsPerPage?: number; currentPage?: number; totalPages?: number } } };
  seoOnPage?: { seoOnPage: { titleHead: string; descriptionHead: string } };
  params?: { pagination?: { totalItems?: number; totalItemsPerPage?: number; currentPage?: number; totalPages?: number } };
};

function pickMovies(payload: MovieListPayload | null): MovieCard[] {
  if (!payload) return [];
  return payload.items ?? payload.data?.items ?? payload.data?.movies ?? [];
}

export const metadata = {
  title: "Browse Movies | PMovies",
  description: "Browse and discover movies by category, country, and year.",
};

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; category?: string; country?: string; sort?: string; year?: string; rating?: string; page?: string }> }) {
  const { q, type, category, country, sort, year, rating, page } = await searchParams;
  let keyword = q?.trim() || "";
  let overrideCategory = category;
  
  if (category === "found-footage" && !keyword) {
    keyword = "found footage";
    overrideCategory = undefined; // don't send category to API
  }
  
  const currentPage = Number(page) || 1;
  const currentSort = sort || "modified.time";

  let url = (type && !keyword) ? `/v1/api/danh-sach/${type}?limit=35&page=${currentPage}` : `/v1/api/tim-kiem?limit=35&page=${currentPage}`;
  
  if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
  if (overrideCategory) url += `&category=${overrideCategory}`;
  if (country) url += `&country=${country}`;
  if (year) url += `&year=${year}`;
  url += `&sort_field=${currentSort.split(".")[0]}&sort_type=desc`;

  const payload = await fetchKkJson(url) as MovieListPayload | null;
  let movies = pickMovies(payload);
  
  if (rating) {
    const minRating = Number(rating);
    movies = movies.filter(m => (m.tmdb?.vote_average || 0) >= minRating);
  }
  
  if (keyword) {
    const lowerKeyword = keyword.toLowerCase();
    movies.sort((a, b) => {
      const aName = (a.name || "").toLowerCase();
      const bName = (b.name || "").toLowerCase();
      if (aName === lowerKeyword && bName !== lowerKeyword) return -1;
      if (bName === lowerKeyword && aName !== lowerKeyword) return 1;
      if (aName.startsWith(lowerKeyword) && !bName.startsWith(lowerKeyword)) return -1;
      if (bName.startsWith(lowerKeyword) && !aName.startsWith(lowerKeyword)) return 1;
      return 0;
    });
  }
  
  movies = movies.slice(0, 35); // Enforce 35 limit in case API/cache ignores it
  const title = payload?.seoOnPage?.seoOnPage?.titleHead ?? (type ? "Danh sách phim" : "Khám phá phim");

  return (
    <MotionShell>
      <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-8">
        <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Discover</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">{title.replace(" | KKPHIM", "")}</h1>
          
          <form action="/browse" className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <input
              name="q"
              defaultValue={keyword}
              placeholder="Search movie..."
              className="h-10 min-w-[200px] flex-1 rounded-md border border-white/10 bg-black/50 px-4 text-sm text-white outline-none focus:border-cyan-300"
            />
            <select name="type" defaultValue={type || ""} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300">
              {TYPES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select name="category" defaultValue={category || ""} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300">
              {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select name="country" defaultValue={country || ""} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300">
              {COUNTRIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select name="year" defaultValue={year || ""} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300">
              {YEARS.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select name="rating" defaultValue={rating || ""} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300">
              {RATINGS.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select name="sort" defaultValue={currentSort} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none focus:border-cyan-300">
              {SORTS.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <button className="h-10 rounded-md bg-cyan-300 px-5 text-sm font-bold text-slate-950 hover:bg-cyan-200">Lọc Phim</button>
          </form>
        </div>

        <div className="flex flex-wrap gap-4">
          {movies.map((movie) => <MovieCardView key={movie.slug} movie={movie} />)}
        </div>

        {movies.length > 0 && (
          <Pagination 
            currentPage={currentPage} 
            totalPages={payload?.data?.params?.pagination?.totalPages ?? payload?.params?.pagination?.totalPages ?? 1} 
            searchParams={new URLSearchParams(await searchParams as any)} 
          />
        )}
        
        {movies.length === 0 && (
          <p className="mt-8 text-center text-slate-400">Không tìm thấy phim nào phù hợp.</p>
        )}
      </main>
    </MotionShell>
  );
}
