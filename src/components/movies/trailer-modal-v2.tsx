"use client";
import { useState } from "react";
import { X, Play } from "lucide-react";

export function TrailerModalV2({ trailerId }: { trailerId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col justify-start lg:pt-2">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-cyan-200">Trailer</p>
        <div 
          onClick={() => setIsOpen(true)}
          className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl transition hover:border-cyan-300/50"
        >
          <img 
            src={`https://img.youtube.com/vi/${trailerId}/hqdefault.jpg`} 
            alt="Trailer" 
            className="h-full w-full object-cover opacity-60 transition group-hover:scale-105 group-hover:opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 text-white shadow-xl transition group-hover:scale-110 group-hover:bg-red-600">
              <Play fill="currentColor" size={24} className="ml-1" />
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-full max-w-5xl px-4">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute -top-10 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-0 sm:-top-12"
            >
              <X size={24} />
            </button>
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${trailerId}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
