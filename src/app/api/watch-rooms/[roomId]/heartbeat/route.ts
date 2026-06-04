import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { viewer_count } = await request.json() as { viewer_count?: number };
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("watch_rooms")
    .update({
      viewer_count: Math.max(0, viewer_count ?? 0),
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", roomId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
