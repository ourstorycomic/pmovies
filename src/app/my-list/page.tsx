import { MotionShell } from "@/components/motion-shell";
import { MyListClient } from "./client";

export const metadata = {
  title: "My List | PMovies",
  description: "Your saved movies",
};

export default function MyListPage() {
  return (
    <MotionShell>
      <main className="mx-auto min-h-screen max-w-7xl px-4 pt-28 sm:px-8">
        <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Library</p>
          <h1 className="mt-2 text-4xl font-black text-white">My List</h1>
          <p className="mt-2 text-slate-300">Những bộ phim bạn đã lưu để xem lại.</p>
        </div>
        <MyListClient />
      </main>
    </MotionShell>
  );
}
