"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { MovieCard } from "@/types/movie";
import { MovieActions } from "./movie-actions";

export function MovieCardView({ movie, href }: { movie: MovieCard; href?: string }) {
  const image = movie.poster_url || movie.thumb_url || "/window.svg";
  return (
    <motion.article whileHover={{ y: -6, scale: 1.03 }} className="group relative h-[310px] w-[190px] shrink-0 snap-start overflow-hidden rounded-md border border-white/10 bg-white/5 shadow-xl shadow-black/40">
      <Link href={href ?? `/movie/${movie.slug}`} className="block h-full">
        <img src={image} alt={movie.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
      </Link>
      <div className="absolute inset-x-0 bottom-0 translate-y-3 bg-gradient-to-t from-black via-black/80 to-transparent p-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
        <h3 className="line-clamp-2 text-sm font-bold text-white">{movie.name}</h3>
        <p className="mb-3 mt-1 text-xs text-slate-300">{movie.quality} {movie.year}</p>
        <MovieActions movie={movie} compact />
      </div>
    </motion.article>
  );
}
