"use client";

import { Search, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { MovieCard } from "@/types/movie";
import Link from "next/link";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<MovieCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (!value || value === searchParams.get("q")) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const json = await res.json();
        const items = json.data?.items ?? json.items ?? json.data?.movies ?? [];
        setSuggestions(items.slice(0, 5));
        setShowDropdown(true);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, searchParams]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      router.push(`/watch-party/${value}`);
      return;
    }
    router.push(value ? `/?q=${encodeURIComponent(value)}` : "/");
  }

  return (
    <form ref={containerRef} onSubmit={submit} className="relative hidden h-10 w-[260px] items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 backdrop-blur-xl md:flex">
      <Search size={16} className="text-slate-300" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        placeholder="Search movies or paste Room ID..."
        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
      />
      {loading && <Loader2 size={14} className="animate-spin text-slate-400 absolute right-3 top-3" />}
      
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto overflow-x-hidden rounded-md border border-white/10 bg-slate-950/95 shadow-xl backdrop-blur-xl">
          {suggestions.map((movie) => (
            <Link
              key={movie.slug}
              href={`/movie/${movie.slug}`}
              onClick={() => setShowDropdown(false)}
              className="flex items-center gap-3 border-b border-white/5 p-2 transition-colors hover:bg-white/10 last:border-0"
            >
              <img src={movie.thumb_url || movie.poster_url} alt={movie.name} className="h-12 w-9 rounded object-cover" />
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-semibold text-white">{movie.name}</p>
                <p className="truncate text-xs text-slate-400">{movie.origin_name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </form>
  );
}
