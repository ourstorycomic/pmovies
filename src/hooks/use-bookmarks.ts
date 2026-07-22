"use client";

import { useState, useEffect } from "react";
import type { MovieCard } from "@/types/movie";

const BOOKMARKS_KEY = "pmovies_bookmarks";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<MovieCard[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      if (raw) {
        setBookmarks(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Failed to load bookmarks", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const addBookmark = (movie: MovieCard) => {
    const next = [movie, ...bookmarks.filter(m => m.slug !== movie.slug)];
    setBookmarks(next);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  };

  const removeBookmark = (slug: string) => {
    const next = bookmarks.filter(m => m.slug !== slug);
    setBookmarks(next);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  };

  const isBookmarked = (slug: string) => {
    return bookmarks.some(m => m.slug === slug);
  };

  return { bookmarks, isLoaded, addBookmark, removeBookmark, isBookmarked };
}
