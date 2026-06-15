import { MotionShell } from "@/components/motion-shell";
import { Pagination } from "@/components/ui/pagination";
import { MovieCardView } from "@/components/movies/movie-card";
import { fetchKkJson } from "@/lib/kkphim";
import type { MovieCard } from "@/types/movie";

type Option = { name: string; slug: string };
type PaginationInfo = { totalItems: number; totalItemsPerPage: number; currentPage: number; totalPages: number };
type BrowsePayload = {
  data?: { items?: MovieCard[]; params?: { pagination?: PaginationInfo } };
  items?: MovieCard[];
  pagination?: PaginationInfo;
};

const typeLists = [
  ["phim-moi-cap-nhat", "Latest"],
  ["phim-le", "Movies"],
  ["tv-shows", "TV Shows"],
  ["hoat-hinh", "Anime"],
  ["phim-vietsub", "Vietsub"],
  ["phim-thuyet-minh", "Thuyet Minh"],
  ["phim-long-tieng", "Long Tieng"],
];

function pickItems(payload: BrowsePayload | null) {
  return payload?.items ?? payload?.data?.items ?? [];
}

function pickPagination(payload: BrowsePayload | null) {
  return payload?.pagination ?? payload?.data?.params?.pagination ?? null;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; category?: string; country?: string; year?: string; sort_lang?: string; page?: string }>;
}) {
  const params = await searchParams;
  const type = params.type || "phim-le";
  const query = new URLSearchParams({
    page: params.page || "1",
    limit: "48",
    sort_field: "modified.time",
    sort_type: "desc",
  });
  for (const key of ["category", "country", "year", "sort_lang"] as const) {
    if (params[key]) query.set(key, params[key]!);
  }

  const [moviesPayload, categoriesPayload, countriesPayload] = await Promise.all([
    fetchKkJson(type === "phim-moi-cap-nhat"
      ? `/danh-sach/phim-moi-cap-nhat-v3?page=${encodeURIComponent(params.page || "1")}`
      : `/v1/api/danh-sach/${encodeURIComponent(type)}?${query.toString()}`
    ) as Promise<BrowsePayload | null>,
    fetchKkJson("/the-loai") as Promise<Option[] | { data?: Option[] } | null>,
    fetchKkJson("/quoc-gia") as Promise<Option[] | { data?: Option[] } | null>,
  ]);

  const movies = pickItems(moviesPayload);
  const pagination = pickPagination(moviesPayload);
  const currentPage = pagination?.currentPage || parseInt(params.page || "1", 10) || 1;
  const totalPages = pagination?.totalPages || 1;
  const categories = Array.isArray(categoriesPayload) ? categoriesPayload : categoriesPayload?.data ?? [];
  const countries = Array.isArray(countriesPayload) ? countriesPayload : countriesPayload?.data ?? [];

  return (
    <MotionShell>
      <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-8">
        <section className="mb-8 rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Browse</p>
              <h1 className="mt-2 text-4xl font-black text-white">Discover Movies</h1>
            </div>
          </div>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select name="type" defaultValue={type} className="h-11 rounded-md border border-white/10 bg-black/40 px-3 text-white">
              {typeLists.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select name="category" defaultValue={params.category || ""} className="h-11 rounded-md border border-white/10 bg-black/40 px-3 text-white">
              <option value="">All genres</option>
              {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
            <select name="country" defaultValue={params.country || ""} className="h-11 rounded-md border border-white/10 bg-black/40 px-3 text-white">
              <option value="">All countries</option>
              {countries.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
            <select name="year" defaultValue={params.year || ""} className="h-11 rounded-md border border-white/10 bg-black/40 px-3 text-white">
              <option value="">All years</option>
              {Array.from({ length: 20 }, (_, index) => 2026 - index).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button className="h-11 rounded-md bg-cyan-300 px-5 font-bold text-slate-950 shadow-[0_0_28px_rgba(103,232,249,.28)]">Apply</button>
          </form>
        </section>
        <div className="flex flex-wrap gap-4">
          {movies.map((movie) => {
            const href = type === "phim-thuyet-minh" ? `/movie/${movie.slug}?server=thuyet-minh` : `/movie/${movie.slug}`;
            return <MovieCardView key={movie.slug} movie={movie} href={href} />;
          })}
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildUrl={(page) => {
            const q = new URLSearchParams();
            if (type !== "phim-le") q.set("type", type);
            for (const key of ["category", "country", "year", "sort_lang"] as const) {
              if (params[key]) q.set(key, params[key]!);
            }
            q.set("page", page.toString());
            return `/browse?${q.toString()}`;
          }}
        />
      </main>
    </MotionShell>
  );
}
