import type { MovieCard } from "@/types/movie";
import { MovieCardView } from "./movie-card";
import { ScrollRow } from "./scroll-row";

export function MovieRow({ title, movies }: { title: string; movies: MovieCard[] }) {
  if (!movies?.length) return null;
  return (
    <section className="py-7">
      <div className="mb-4 flex items-end justify-between px-4 sm:px-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-cyan-300/50 to-transparent ml-5" />
      </div>
      <ScrollRow>
        {movies.map((movie) => <MovieCardView key={movie.slug} movie={movie} />)}
      </ScrollRow>
    </section>
  );
}
