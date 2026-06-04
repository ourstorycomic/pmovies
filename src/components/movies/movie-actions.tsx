"use client";

import { Bookmark, Heart, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { MovieCard } from "@/types/movie";

export function MovieActions({ movie, compact = false }: { movie: MovieCard; compact?: boolean }) {
  const { user } = useAuth();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<"save" | "like" | null>(null);

  async function requireUser() {
    if (!user) {
      window.location.href = "/auth";
      return false;
    }
    return true;
  }

  async function saveMovie() {
    if (!(await requireUser())) return;
    setBusy("save");
    await supabase.from("saved_movies").upsert({
      user_id: user!.id,
      movie_slug: movie.slug,
      movie_name: movie.name,
      poster_url: movie.poster_url ?? movie.thumb_url,
    });
    setBusy(null);
  }

  async function likeMovie() {
    if (!(await requireUser())) return;
    setBusy("like");
    await supabase.from("liked_movies").upsert({ user_id: user!.id, movie_slug: movie.slug });
    setBusy(null);
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild className={compact ? "h-9 px-3" : ""}><Link href={`/movie/${movie.slug}`}><Play size={16} /> Play</Link></Button>
      <Button variant="glass" className={compact ? "h-9 w-9 px-0" : ""} onClick={likeMovie} disabled={busy === "like"} title="Like"><Heart size={16} /></Button>
      <Button variant="glass" className={compact ? "h-9 w-9 px-0" : ""} onClick={saveMovie} disabled={busy === "save"} title="Save"><Bookmark size={16} /></Button>
    </div>
  );
}
