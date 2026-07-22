"use client";

import { Bookmark, Heart, Play } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { MovieCard } from "@/types/movie";
import { useBookmarks } from "@/hooks/use-bookmarks";

export function MovieActions({ movie, compact = false }: { movie: MovieCard; compact?: boolean }) {
  const { user } = useAuth();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<"like" | null>(null);
  const { isBookmarked, addBookmark, removeBookmark, isLoaded } = useBookmarks();
  
  const saved = isBookmarked(movie.slug);

  async function requireUser() {
    if (!user) {
      window.location.href = "/auth";
      return false;
    }
    return true;
  }

  async function toggleBookmark() {
    if (!isLoaded) return;
    if (saved) {
      removeBookmark(movie.slug);
    } else {
      addBookmark(movie);
    }
  }

  async function likeMovie() {
    if (!(await requireUser())) return;
    setBusy("like");
    await supabase.from("liked_movies").upsert({ user_id: user!.id, movie_slug: movie.slug });
    setBusy(null);
  }

  const pathname = usePathname();
  const isCurrentMoviePage = pathname === `/movie/${movie.slug}`;

  function handlePlayClick(e: React.MouseEvent) {
    if (isCurrentMoviePage) {
      e.preventDefault();
      document.getElementById("player")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild className={compact ? "h-9 px-3" : ""}>
        <Link href={`/movie/${movie.slug}`} onClick={handlePlayClick}><Play size={16} /> Play</Link>
      </Button>
      <Button variant="glass" className={compact ? "h-9 w-9 px-0" : ""} onClick={likeMovie} disabled={busy === "like"} title="Like"><Heart size={16} /></Button>
      <Button variant="glass" className={compact ? "h-9 w-9 px-0" : ""} onClick={toggleBookmark} title={saved ? "Remove from List" : "Add to List"}>
        <Bookmark size={16} className={saved ? "fill-cyan-300 text-cyan-300" : ""} />
      </Button>
    </div>
  );
}
