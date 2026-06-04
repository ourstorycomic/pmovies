import Link from "next/link";
import type { MovieCard } from "@/types/movie";
import { MovieCardView } from "./movie-card";
import { ScrollRow } from "./scroll-row";

export function MovieRow({ title, movies, seeMoreHref }: { title: string; movies: MovieCard[]; seeMoreHref?: string }) {
  if (!movies?.length) return null;
  return (
    <section className="py-7">
      <div className="mb-4 flex items-end justify-between px-4 sm:px-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
        <div className="ml-5 h-px flex-1 bg-gradient-to-r from-cyan-300/50 to-transparent" />
        {seeMoreHref && (
          <Link href={seeMoreHref} className="ml-4 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-cyan-100 backdrop-blur-xl transition hover:border-cyan-300/40 hover:bg-cyan-300/10">
            See more
          </Link>
        )}
      </div>
      <ScrollRow>
        {movies.map((movie) => <MovieCardView key={movie.slug} movie={movie} />)}
      </ScrollRow>
    </section>
  );
}
