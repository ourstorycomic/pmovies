import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("watch_room_messages")
    .delete()
    .lt("created_at", new Date(Date.now() - 3 * 60 * 1000).toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
