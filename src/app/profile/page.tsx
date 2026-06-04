import { redirect } from "next/navigation";
import { MotionShell } from "@/components/motion-shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

  return (
    <MotionShell>
      <main className="mx-auto flex min-h-screen max-w-4xl items-center px-4 pt-16 sm:px-8">
        <section className="w-full rounded-lg border border-white/10 bg-white/5 p-8 shadow-2xl shadow-purple-950/20 backdrop-blur-xl">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-200">Profile</p>
          <h1 className="mt-3 text-4xl font-black text-white">{profile?.display_name ?? user.email}</h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-black/30 p-4"><p className="text-sm text-slate-400">Email</p><p className="mt-2 text-white">{user.email}</p></div>
            <div className="rounded-md border border-white/10 bg-black/30 p-4"><p className="text-sm text-slate-400">Plan</p><p className="mt-2 text-white">{profile?.plan_type ?? "free"}</p></div>
            <div className="rounded-md border border-white/10 bg-black/30 p-4"><p className="text-sm text-slate-400">User ID</p><p className="mt-2 truncate text-white">{user.id}</p></div>
          </div>
        </section>
      </main>
    </MotionShell>
  );
}
