import { redirect } from "next/navigation";
import { MotionShell } from "@/components/motion-shell";
import { MovieCardView } from "@/components/movies/movie-card";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function MyListPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { data } = await supabase.from("saved_movies").select("*").eq("user_id", user.id).order("added_at", { ascending: false });

  return (
    <MotionShell>
      <main className="mx-auto min-h-screen max-w-7xl px-4 pt-28 sm:px-8">
        <h1 className="text-4xl font-black text-white">My List</h1>
        <div className="mt-8 flex flex-wrap gap-4">
          {data?.map((movie) => <MovieCardView key={movie.movie_slug} movie={{ slug: movie.movie_slug, name: movie.movie_name, poster_url: movie.poster_url }} />)}
        </div>
      </main>
    </MotionShell>
  );
}
