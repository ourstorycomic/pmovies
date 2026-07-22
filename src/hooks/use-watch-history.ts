"use client";

import { useState, useEffect } from "react";

export type WatchHistoryItem = {
  key: string;
  time: number;
  duration: number;
  updated_at: number;
  meta: {
    slug: string;
    name: string;
    thumb_url: string;
    episodeName?: string;
  };
};

export function useWatchHistory() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  useEffect(() => {
    try {
      const indexRaw = localStorage.getItem("pmovies_resume_index");
      if (!indexRaw) return;
      const keys = JSON.parse(indexRaw) as string[];
      
      const items: WatchHistoryItem[] = [];
      for (const key of keys) {
        const itemRaw = localStorage.getItem(key);
        if (itemRaw) {
          const item = JSON.parse(itemRaw);
          if (item.meta && item.meta.slug) {
            items.push({
              key,
              time: item.time,
              duration: item.duration,
              updated_at: item.updated_at,
              meta: item.meta,
            });
          }
        }
      }
      
      setHistory(items.sort((a, b) => b.updated_at - a.updated_at));
    } catch (e) {
      console.error("Failed to parse watch history", e);
    }
  }, []);

  return history;
}
