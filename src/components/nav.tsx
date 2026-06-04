"use client";

import { Bookmark, Film, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";

export function Nav() {
  const { user, signOut } = useAuth();
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/35 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-wide text-white">
          <span className="rounded-md bg-cyan-300 p-1.5 text-slate-950"><Film size={20} /></span> PMovies
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Suspense fallback={<div className="hidden h-10 w-[260px] rounded-md border border-white/10 bg-white/10 md:block" />}>
            <SearchBox />
          </Suspense>
          <Link className="hidden rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white sm:block" href="/browse">Browse</Link>
          <Link className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white md:hidden" href="/?q="><Search size={16} className="inline" /> Search</Link>
          {user && <Link className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white" href="/my-list"><Bookmark size={16} className="inline" /> My List</Link>}
          {user ? (
            <>
              <Link className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white" href="/profile"><UserRound size={16} className="inline" /></Link>
              <Button variant="glass" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <Button asChild><Link href="/auth">Sign in</Link></Button>
          )}
        </div>
      </div>
    </nav>
  );
}
