"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

export function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  function scroll(direction: "left" | "right") {
    ref.current?.scrollBy({
      left: direction === "left" ? -window.innerWidth * 0.82 : window.innerWidth * 0.82,
      behavior: "smooth",
    });
  }

  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/10 bg-black/60 text-white backdrop-blur-xl transition hover:bg-cyan-300 hover:text-slate-950 sm:h-12 sm:w-12"
        aria-label="Scroll left"
      >
        <ChevronLeft />
      </button>
      <div ref={ref} className="flex snap-x gap-4 overflow-x-auto scroll-smooth px-16 pb-4 sm:px-20 [scrollbar-width:thin] [scrollbar-color:rgba(103,232,249,.55)_transparent]">
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/10 bg-black/60 text-white backdrop-blur-xl transition hover:bg-cyan-300 hover:text-slate-950 sm:h-12 sm:w-12"
        aria-label="Scroll right"
      >
        <ChevronRight />
      </button>
    </div>
  );
}
