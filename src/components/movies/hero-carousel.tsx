"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Play, Star, Sparkles, ChevronLeft, ChevronRight, Users, Film, Clapperboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MovieCard } from "@/types/movie";
import { stripHtml } from "@/lib/utils";

export function HeroCarousel({ movies }: { movies: MovieCard[] }) {
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const featured = movies.slice(0, 6);

  useEffect(() => {
    if (featured.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % featured.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [featured.length, isHovered]);

  if (!featured.length) return null;
  const current = featured[index];
  const bgImage = current.thumb_url || current.poster_url;
  const rating = current.tmdb?.vote_average;

  const nextSlide = () => setIndex((prev) => (prev + 1) % featured.length);
  const prevSlide = () => setIndex((prev) => (prev - 1 + featured.length) % featured.length);

  return (
    <section 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative min-h-[82vh] overflow-hidden pt-16 select-none bg-black"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.slug}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={bgImage}
            alt={current.name}
            className="h-full w-full object-cover object-center opacity-70 filter brightness-95"
          />
          {/* Gradient vignettes */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent sm:via-black/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/30 to-black/40" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="relative mx-auto flex min-h-[76vh] max-w-7xl items-end px-4 pb-16 sm:px-8">
        <div className="max-w-3xl z-10">
          {/* Badges row */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/15 px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-cyan-200 backdrop-blur-xl shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <Sparkles size={13} className="text-cyan-300" /> Phim Thịnh Hành #{index + 1}
            </span>

            {current.quality && (
              <span className="rounded-md border border-white/20 bg-black/60 px-2 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md">
                {current.quality}
              </span>
            )}

            {current.year && (
              <span className="rounded-md border border-white/10 bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200 backdrop-blur-md">
                {current.year}
              </span>
            )}

            {current.episode_current && (
              <span className="rounded-md border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300 backdrop-blur-md">
                {current.episode_current}
              </span>
            )}

            {rating != null && rating > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-black/60 px-2 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md">
                <Star size={12} fill="currentColor" /> {rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] sm:text-6xl md:text-7xl leading-tight">
            {current.name}
          </h1>

          <p className="mt-3 text-sm font-semibold text-cyan-300/90 sm:text-base">
            {stripHtml(current.origin_name)}
          </p>

          {/* Categories */}
          {current.category && current.category.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {current.category.slice(0, 4).map((c) => (
                <span key={c.slug || c.name} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 backdrop-blur-md">
                  {c.name}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={`/movie/${current.slug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-cyan-300 px-6 py-3 font-bold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.5)] transition hover:scale-105 active:scale-95"
            >
              <Play size={18} fill="currentColor" /> Xem Phim Ngay
            </Link>

            <Link
              href={`/movie/${current.slug}#watch-party`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur-xl transition hover:bg-white/20 hover:border-cyan-400/50 active:scale-95"
            >
              <Users size={18} className="text-cyan-300" /> Xem Chung (Watch Party)
            </Link>
          </div>
        </div>

        {/* Thumbnail switcher on bottom-right (Desktop) */}
        <div className="hidden lg:flex flex-col items-end gap-2 ml-auto z-10 pb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Top Phim Nổi Bật</p>
          <div className="flex gap-2">
            {featured.map((item, idx) => (
              <button
                key={item.slug}
                onClick={() => setIndex(idx)}
                className={`group relative h-16 w-24 overflow-hidden rounded-md border transition-all duration-300 ${
                  index === idx
                    ? "border-cyan-400 scale-105 ring-2 ring-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                    : "border-white/20 opacity-60 hover:opacity-100"
                }`}
                title={item.name}
              >
                <img src={item.thumb_url || item.poster_url} alt={item.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <span className="absolute bottom-1 left-1.5 right-1.5 truncate text-[10px] font-bold text-white">
                  #{idx + 1} {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Slide Navigation Arrows */}
      <button
        type="button"
        onClick={prevSlide}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10 transition hover:bg-cyan-400 hover:text-slate-950 active:scale-95"
        aria-label="Phim trước"
      >
        <ChevronLeft size={24} />
      </button>

      <button
        type="button"
        onClick={nextSlide}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10 transition hover:bg-cyan-400 hover:text-slate-950 active:scale-95"
        aria-label="Phim sau"
      >
        <ChevronRight size={24} />
      </button>

      {/* Mobile Slide Dots */}
      <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-1.5 lg:hidden">
        {featured.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === idx ? "w-7 bg-cyan-400" : "w-1.5 bg-white/30"
            }`}
            aria-label={`Chuyển tới slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
