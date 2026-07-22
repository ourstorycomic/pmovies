"use client";

import { Star } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { MovieCard } from "@/types/movie";
import { MovieActions } from "./movie-actions";

export function MovieCardView({ movie, href }: { movie: MovieCard; href?: string }) {
  const image = movie.poster_url || movie.thumb_url || "/window.svg";
  const rating = movie.tmdb?.vote_average;
  
  const formatEpisode = (ep: string) => {
    const match = ep.match(/(\d+\/\d+)/);
    if (match) return match[1];
    const numMatch = ep.match(/(\d+)/);
    if (numMatch) return `Tập ${numMatch[1]}`;
    return ep;
  };

  return (
    <motion.article whileHover={{ y: -6, scale: 1.03 }} className="group relative h-[310px] w-[190px] shrink-0 snap-start overflow-hidden rounded-md border border-white/10 bg-white/5 shadow-xl shadow-black/40">
      <Link href={href ?? `/movie/${movie.slug}`} className="block h-full">
        <img src={image} alt={movie.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
      </Link>
      {movie.category && movie.category.length > 0 && (
        <div className="absolute left-2 top-2 max-w-[90px] truncate rounded-md bg-cyan-500/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-950 shadow-md backdrop-blur-sm">
          {movie.category[0].name}
        </div>
      )}
      {movie.episode_current && movie.episode_current.toLowerCase() !== "full" && (
        <div className="absolute right-2 top-2 rounded-md bg-rose-500/90 px-2 py-1 text-[10px] font-bold tracking-wider text-white shadow-md backdrop-blur-sm">
          {formatEpisode(movie.episode_current)}
        </div>
      )}
      {rating != null && rating > 0 && (
        <div className="absolute right-2 top-8 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-bold text-amber-300 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          <Star size={11} fill="currentColor" className="shrink-0" />
          {rating.toFixed(1)}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 translate-y-3 bg-gradient-to-t from-black via-black/80 to-transparent p-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
        <h3 className="line-clamp-2 text-sm font-bold text-white">{movie.name}</h3>
        <p className="mb-3 mt-1 text-xs text-slate-300">{movie.quality} {movie.year}</p>
        <MovieActions movie={movie} compact />
      </div>
    </motion.article>
  );
}
