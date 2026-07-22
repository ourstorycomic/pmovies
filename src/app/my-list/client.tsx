"use client";

import { useBookmarks } from "@/hooks/use-bookmarks";
import { MovieCardView } from "@/components/movies/movie-card";

export function MyListClient() {
  const { bookmarks, isLoaded } = useBookmarks();

  if (!isLoaded) {
    return <div className="mt-8 flex gap-4"><div className="h-[310px] w-[190px] animate-pulse rounded-md bg-white/10" /></div>;
  }

  if (bookmarks.length === 0) {
    return <p className="mt-8 text-slate-400">Bạn chưa lưu bộ phim nào.</p>;
  }

  return (
    <div className="mt-8 flex flex-wrap gap-4">
      {bookmarks.map((movie) => (
        <MovieCardView key={movie.slug} movie={movie} />
      ))}
    </div>
  );
}
