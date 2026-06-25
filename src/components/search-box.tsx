"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

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
    <form onSubmit={submit} className="hidden h-10 w-[260px] items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 backdrop-blur-xl md:flex">
      <Search size={16} className="text-slate-300" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search movies or paste Room ID..."
        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
      />
    </form>
  );
}
