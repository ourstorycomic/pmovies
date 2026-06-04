"use client";

import { Copy, Loader2, UsersRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getGuestIdentity } from "@/lib/guest";
import type { MovieDetail } from "@/types/movie";

export function CreateWatchPartyButton({
  movie,
  streamUrl,
  episodeName,
  introStart = 0,
  introEnd = 0,
}: {
  movie: MovieDetail;
  streamUrl?: string;
  episodeName?: string;
  introStart?: number;
  introEnd?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [roomUrl, setRoomUrl] = useState("");
  const [error, setError] = useState("");
  const canCreate = Boolean(streamUrl && streamUrl !== "null" && streamUrl !== "undefined" && !streamUrl.includes("url=null") && !streamUrl.includes("url=undefined"));

  async function createRoom() {
    setError("");
    if (!canCreate) {
      setError(`This episode does not have a playable HLS stream yet. Current stream: ${streamUrl || "empty"}`);
      return;
    }
    const guest = getGuestIdentity();
    setBusy(true);
    try {
      const response = await fetch("/api/watch-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie_slug: movie.slug,
          movie_name: movie.name,
          poster_url: movie.poster_url || movie.thumb_url,
          stream_url: streamUrl,
          episode_name: episodeName,
          intro_start_time: introStart,
          intro_end_time: introEnd,
          episodes: movie.episodes?.flatMap((server) => server.server_data).filter((episode) => episode.link_m3u8).map((episode) => ({
            name: episode.name,
            slug: episode.slug,
            link_m3u8: episode.link_m3u8,
          })),
          guest_id: guest.id,
          guest_name: guest.name,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Could not create watch room.");
        return;
      }
      if (!payload.url) {
        setError("Watch room was created without a valid URL.");
        return;
      }
      if (payload.roomId && payload.hostToken) {
        sessionStorage.setItem(`pmovies_host_token:${payload.roomId}`, payload.hostToken);
      }
      const absolute = `${window.location.origin}${payload.url}`;
      setRoomUrl(absolute);
      await navigator.clipboard?.writeText(absolute);
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create watch room.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <Button variant="glass" onClick={createRoom} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <UsersRound size={16} />}
        Watch together
      </Button>
      {roomUrl && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(roomUrl)}
          className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-left text-xs text-cyan-100"
        >
          <Copy size={14} />
          <span className="truncate">{roomUrl}</span>
        </button>
      )}
      {error && <p className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
    </div>
  );
}
