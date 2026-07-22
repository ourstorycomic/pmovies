"use client";

import { useWatchHistory } from "@/hooks/use-watch-history";
import Link from "next/link";
import { Play } from "lucide-react";

export function ContinueWatchingRow() {
  const history = useWatchHistory();

  if (history.length === 0) return null;

  return (
    <section className="mt-12 mb-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-black text-white sm:text-2xl">Tiếp tục xem</h2>
      </div>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {history.map((item) => {
          const progress = item.duration > 0 ? (item.time / item.duration) * 100 : 0;
          
          return (
            <Link 
              key={item.key} 
              href={`/movie/${item.meta.slug}`}
              className="group relative h-[180px] w-[320px] shrink-0 snap-start overflow-hidden rounded-md border border-white/10 bg-white/5 shadow-xl shadow-black/40"
            >
              <img src={item.meta.thumb_url} alt={item.meta.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent transition duration-300 group-hover:bg-black/50" />
              
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
                 <div className="rounded-full bg-cyan-400 p-3 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.5)]">
                   <Play fill="currentColor" size={24} className="ml-1" />
                 </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-3">
                <h3 className="line-clamp-1 text-sm font-bold text-white">{item.meta.name}</h3>
                {item.meta.episodeName && (
                  <p className="mt-1 text-xs text-slate-300">{item.meta.episodeName}</p>
                )}
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
