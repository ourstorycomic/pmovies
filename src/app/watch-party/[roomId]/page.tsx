import { redirect } from "next/navigation";
import { MotionShell } from "@/components/motion-shell";
import { WatchPartyRoom } from "@/components/watch-party/watch-party-room";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function WatchPartyPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: room } = await supabase.from("watch_rooms").select("*").eq("id", roomId).single();
  if (!room) redirect("/");

  const { data: messages } = await supabase
    .from("watch_room_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <MotionShell>
      <main className="mx-auto min-h-screen max-w-7xl px-4 pb-16 pt-24 sm:px-8">
        <WatchPartyRoom room={room} userId={user?.id ?? null} initialMessages={messages ?? []} />
      </main>
    </MotionShell>
  );
}
