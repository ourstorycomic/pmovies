"use client";

import Link from "next/link";
import { Flame, Star } from "lucide-react";
import type { MovieCard } from "@/types/movie";
import { ScrollRow } from "./scroll-row";

export function TopTenRow({ movies }: { movies: MovieCard[] }) {
  const top10 = movies.slice(0, 10);
  if (!top10.length) return null;

  return (
    <section className="py-7">
      <div className="mb-4 flex items-end justify-between px-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Flame size={18} />
          </span>
          <h2 className="text-xl font-black text-white sm:text-2xl tracking-tight">
            Top 10 Phim Xem Nhiều Nhất
          </h2>
        </div>
        <div className="ml-5 h-px flex-1 bg-gradient-to-r from-rose-500/50 via-cyan-400/30 to-transparent" />
      </div>

      <ScrollRow>
        {top10.map((movie, index) => {
          const rank = index + 1;
          const image = movie.poster_url || movie.thumb_url || "/window.svg";
          const rating = movie.tmdb?.vote_average;

          return (
            <div key={movie.slug} className="group relative flex shrink-0 items-end snap-start py-2">
              {/* Giant Rank Number */}
              <span 
                className="select-none font-black leading-none text-transparent drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] -mr-6 sm:-mr-8 z-0 pointer-events-none text-[100px] sm:text-[140px]"
                style={{
                  WebkitTextStroke: "3px rgba(255, 255, 255, 0.4)",
                  textShadow: "0 0 20px rgba(103, 232, 249, 0.2)",
                }}
              >
                {rank}
              </span>

              {/* Movie Card */}
              <Link
                href={`/movie/${movie.slug}`}
                className="relative z-10 h-[260px] w-[160px] sm:h-[300px] sm:w-[185px] overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl transition-all duration-300 group-hover:-translate-y-2 group-hover:scale-105 group-hover:border-cyan-400/60 group-hover:shadow-[0_0_25px_rgba(34,211,238,0.35)]"
              >
                <img
                  src={image}
                  alt={movie.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />

                {/* Top badge */}
                <div className="absolute left-2 top-2 rounded-md bg-gradient-to-r from-rose-600 to-amber-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-lg">
                  TOP {rank}
                </div>

                {rating != null && rating > 0 && (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-sm">
                    <Star size={10} fill="currentColor" /> {rating.toFixed(1)}
                  </div>
                )}

                {/* Info gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 transition-opacity">
                  <h3 className="line-clamp-2 text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {movie.name}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-300">
                    {movie.quality || "HD"} {movie.year ? `• ${movie.year}` : ""}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </ScrollRow>
    </section>
  );
}
