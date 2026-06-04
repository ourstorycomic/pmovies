import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("watch_rooms")
    .delete()
    .lt("last_seen_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json() as {
    movie_slug?: string;
    movie_name?: string;
    poster_url?: string;
    stream_url?: string;
    episode_name?: string;
    intro_start_time?: number;
    intro_end_time?: number;
    episodes?: { name?: string; slug?: string; link_m3u8?: string }[];
    guest_id?: string;
    guest_name?: string;
  };

  if (!body.movie_slug || !body.movie_name || !body.stream_url || !body.guest_id) {
    return NextResponse.json({ error: "Missing room payload" }, { status: 400 });
  }

  const hostToken = randomBytes(32).toString("base64url");
  const hostTokenHash = createHash("sha256").update(hostToken).digest("hex");

  const { data, error } = await supabase
    .from("watch_rooms")
    .insert({
      host_user_id: user?.id ?? null,
      host_guest_id: body.guest_id,
      host_token_hash: hostTokenHash,
      host_name: user?.email?.split("@")[0] ?? body.guest_name ?? "User 1",
      movie_slug: body.movie_slug,
      movie_name: body.movie_name,
      poster_url: body.poster_url,
      stream_url: body.stream_url,
      episode_name: body.episode_name,
      intro_start_time: body.intro_start_time ?? 0,
      intro_end_time: body.intro_end_time ?? 0,
      episodes_json: body.episodes ?? [],
    })
    .select("id")
    .single();

  if (error) {
    const needsSql =
      error.message.includes("watch_rooms") ||
      error.message.includes("host_guest_id") ||
      error.message.includes("host_token_hash") ||
      error.message.includes("host_name") ||
      error.message.includes("schema cache");
    return NextResponse.json(
      {
        error: needsSql
          ? "Watch Party database is not ready. Run supabase/watch-party.sql in Supabase SQL Editor, then retry."
          : error.message,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ roomId: data.id, hostToken, url: `/watch-party/${data.id}` });
}
