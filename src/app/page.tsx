import { MotionShell } from "@/components/motion-shell";
import { MovieRow } from "@/components/movies/movie-row";
import { ContinueWatchingRow } from "@/components/movies/continue-watching-row";
import { JoinRoomForm } from "@/components/watch-party/join-room-form";
import { HeroCarousel } from "@/components/movies/hero-carousel";
import { QuickFilterBar } from "@/components/movies/quick-filter-bar";
import { TopTenRow } from "@/components/movies/top-ten-row";
import { CatalogStatsBanner } from "@/components/movies/catalog-stats-banner";
import { TrendingSearches } from "@/components/movies/trending-searches";
import { fetchKkJson } from "@/lib/kkphim";
import { normalizeVietnameseSearch } from "@/lib/utils";
import { redirect } from "next/navigation";
import type { MovieCard } from "@/types/movie";

type MovieListPayload = {
  items?: MovieCard[];
  data?: { items?: MovieCard[]; movies?: MovieCard[]; params?: { pagination?: { totalItems?: number; totalItemsPerPage?: number; currentPage?: number; totalPages?: number } } };
  params?: { pagination?: { totalItems?: number; totalItemsPerPage?: number; currentPage?: number; totalPages?: number } };
};

function pickMovies(payload: MovieListPayload | null): MovieCard[] {
  if (!payload) return [];
  return payload.items ?? payload.data?.items ?? payload.data?.movies ?? [];
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; country?: string; page?: string }> }) {
  const { q, category, country, page } = await searchParams;
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
            <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Tìm kiếm</p>
            <h1 className="mt-3 text-4xl font-black text-white">Khám phá kho phim</h1>
            <form action="/browse" className="mt-7 flex flex-col gap-3 sm:flex-row">
              <input
                name="q"
                autoFocus
                placeholder="Tên phim, diễn viên, từ khóa..."
                className="h-12 flex-1 rounded-md border border-white/10 bg-black/35 px-4 text-white outline-none focus:border-cyan-300"
              />
              <button className="h-12 rounded-md bg-cyan-300 px-6 font-bold text-slate-950 shadow-[0_0_28px_rgba(103,232,249,.35)] hover:bg-cyan-200">
                Tìm kiếm
              </button>
            </form>
            <div className="mt-8 border-t border-white/10 pt-8">
              <p className="mb-4 text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Xem chung cùng bạn bè</p>
              <JoinRoomForm />
            </div>
          </section>
        </main>
      </MotionShell>
    );
  }

  if (keyword || category || country) {
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);
    if (category) params.set("category", category);
    if (country) params.set("country", country);
    redirect(`/browse?${params.toString()}`);
  }

  const [latest, series, action, anime, shows] = await Promise.all([
    fetchKkJson("/danh-sach/phim-moi-cap-nhat-v3?page=1"),
    fetchKkJson("/v1/api/danh-sach/phim-bo?page=1&limit=24"),
    fetchKkJson("/v1/api/danh-sach/phim-le?page=1&limit=24"),
    fetchKkJson("/v1/api/danh-sach/hoat-hinh?page=1&limit=24"),
    fetchKkJson("/v1/api/danh-sach/tv-shows?page=1&limit=24"),
  ]);

  const latestMovies = pickMovies(latest as MovieListPayload | null);
  const seriesMovies = pickMovies(series as MovieListPayload | null);
  const actionMovies = pickMovies(action as MovieListPayload | null);
  const animeMovies = pickMovies(anime as MovieListPayload | null);
  const showMovies = pickMovies(shows as MovieListPayload | null);

  // Combine top movies for the Hero Carousel (mix of blockbusters & hot series)
  const heroMovies = [
    ...actionMovies.slice(0, 3),
    ...seriesMovies.slice(0, 2),
    ...latestMovies.slice(0, 2),
  ].filter(
    (m, idx, arr) => arr.findIndex((x) => x.slug === m.slug) === idx
  );

  // Top 10 trending row (from action & series)
  const topTenMovies = [
    ...actionMovies.slice(0, 5),
    ...seriesMovies.slice(0, 5),
  ].filter(
    (m, idx, arr) => arr.findIndex((x) => x.slug === m.slug) === idx
  ).slice(0, 10);

  return (
    <MotionShell>
      {/* 1. Hero Carousel 6 phim bom tấn xoay vòng */}
      <HeroCarousel movies={heroMovies} />

      {/* 2. Thanh phân loại danh mục nhanh */}
      <QuickFilterBar />

      {/* 3. Từ khóa tìm kiếm thịnh hành */}
      <TrendingSearches />

      <div className="pb-16 space-y-4">
        {/* Tiếp tục xem nếu có lịch sử */}
        <ContinueWatchingRow />

        {/* 4. Top 10 Phim Xem Nhiều Nhất phong cách Netflix */}
        <TopTenRow movies={topTenMovies} />

        {/* 5. Banner thông số kho phim khủng */}
        <CatalogStatsBanner />

        {/* 6. Các hàng phim đầy đủ thể loại */}
        <MovieRow 
          title="🔥 Phim Mới Cập Nhật Hôm Nay" 
          movies={latestMovies} 
          seeMoreHref="/browse?type=phim-moi-cap-nhat" 
        />

        <MovieRow 
          title="📺 Phim Bộ Đang Hot (K-Drama, C-Drama)" 
          movies={seriesMovies} 
          seeMoreHref="/browse?type=phim-bo" 
        />

        <MovieRow 
          title="🍿 Phim Điện Ảnh & Chiếu Rạp Đặc Sắc" 
          movies={actionMovies} 
          seeMoreHref="/browse?type=phim-le" 
        />

        <MovieRow 
          title="⚔️ Thế Giới Anime & Hoạt Hình" 
          movies={animeMovies} 
          seeMoreHref="/browse?type=hoat-hinh" 
        />

        <MovieRow 
          title="🌟 TV Shows & Truyền Hình Hấp Dẫn" 
          movies={showMovies} 
          seeMoreHref="/browse?type=tv-shows" 
        />
      </div>
    </MotionShell>
  );
}
