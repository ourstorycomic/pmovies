import Link from "next/link";
import { Search, TrendingUp } from "lucide-react";

const TRENDING_KEYWORDS = [
  "Cyberpunk",
  "One Piece",
  "Conan",
  "Deadpool",
  "Dune",
  "Harry Potter",
  "Spider-Man",
  "Jujutsu Kaisen",
  "Squid Game",
  "Avatar",
  "Avengers",
  "Batman",
];

export function TrendingSearches() {
  return (
    <section className="my-6 px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-cyan-300 mr-2">
          <TrendingUp size={14} /> Tìm kiếm phổ biến:
        </span>
        {TRENDING_KEYWORDS.map((kw) => (
          <Link
            key={kw}
            href={`/browse?q=${encodeURIComponent(kw)}`}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-200 transition active:scale-95"
          >
            #{kw}
          </Link>
        ))}
      </div>
    </section>
  );
}
