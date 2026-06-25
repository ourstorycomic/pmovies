"use client";

import { Copy, Send, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { VideoPlayer, type PlayerPendingRequest } from "@/components/player/video-player";
import { Button } from "@/components/ui/button";
import { getGuestIdentity, type GuestIdentity } from "@/lib/guest";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Room = {
  id: string;
  host_user_id?: string | null;
  host_guest_id: string;
  host_token_hash?: string | null;
  host_name?: string;
  movie_name: string;
  movie_slug?: string;
  poster_url?: string;
  stream_url: string;
  episode_name?: string;
  intro_start_time?: number;
  intro_end_time?: number;
  episodes_json?: { name?: string; slug?: string; link_m3u8?: string }[];
};

type Message = {
  id: string;
  user_id?: string | null;
  guest_id?: string | null;
  display_name?: string;
  body: string;
  created_at: string;
};

type ControlRequest = {
  id: string;
  guestId: string;
  guestName: string;
  type: "seek" | "pause" | "play";
  time?: number;
};

function getTabPresenceId(roomId: string) {
  const key = `pmovies_presence:${roomId}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  sessionStorage.setItem(key, value);
  return value;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function RoomChat({
  messages,
  body,
  setBody,
  sendMessage,
  compact = false,
}: {
  messages: Message[];
  body: string;
  setBody: (value: string) => void;
  sendMessage: (event: React.FormEvent) => void;
  compact?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className={`flex h-full min-h-0 flex-col rounded-lg border border-white/10 bg-black/35 shadow-2xl shadow-black/40 backdrop-blur-xl ${compact ? "max-h-[78dvh]" : ""}`}>
      <div className="border-b border-white/10 p-4">
        <h2 className="font-bold text-white">Room Chat</h2>
        <p className="text-xs text-slate-400">Only host can control playback.</p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className="rounded-md bg-white/5 p-3">
            <p className="text-xs text-cyan-200">{message.display_name || message.guest_id?.slice(0, 8) || message.user_id?.slice(0, 8) || "Guest"}</p>
            <p className="mt-1 text-sm text-white">{message.body}</p>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/10 p-3">
        <input value={body} onChange={(event) => setBody(event.target.value)} className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/45 px-3 text-white outline-none focus:border-cyan-300" placeholder="Chat..." />
        <Button className="h-10 px-3"><Send size={16} /></Button>
      </form>
    </div>
  );
}

export function WatchPartyRoom({ room, userId, initialMessages }: { room: Room; userId: string | null; initialMessages: Message[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [guest, setGuest] = useState<GuestIdentity | null>(null);
  const [hasHostToken, setHasHostToken] = useState(false);
  const isHost = hasHostToken;
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [viewerCount, setViewerCount] = useState(1);
  const [pendingRequests, setPendingRequests] = useState<ControlRequest[]>([]);
  const [requestResolutionKey, setRequestResolutionKey] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => setGuest(getGuestIdentity()));
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(`pmovies_room_chat:${room.id}`);
    if (cached) {
      const localMessages = JSON.parse(cached) as Message[];
      queueMicrotask(() => {
        setMessages((items) => {
          const seen = new Set(items.map((item) => item.id));
          return [...localMessages.filter((item) => !seen.has(item.id)), ...items].slice(-100);
        });
      });
    }
  }, [room.id]);

  useEffect(() => {
    localStorage.setItem(`pmovies_room_chat:${room.id}`, JSON.stringify(messages.slice(-100)));
  }, [messages, room.id]);

  useEffect(() => {
    async function checkHostToken() {
      const token = localStorage.getItem(`pmovies_host_token:${room.id}`);
      if (!token || !room.host_token_hash) {
        setHasHostToken(false);
        return;
      }
      setHasHostToken((await sha256(token)) === room.host_token_hash);
    }

    void checkHostToken();
  }, [room.host_token_hash, room.id]);

  useEffect(() => {
    if (!guest) return;
    const presenceId = getTabPresenceId(room.id);
    const channel = supabase
      .channel(`watch-room:${room.id}`, { config: { presence: { key: presenceId } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "watch_room_messages", filter: `room_id=eq.${room.id}` }, (payload) => {
        setMessages((items) => [...items, payload.new as Message]);
      })
      .on("broadcast", { event: "player_state" }, ({ payload }) => {
        if (isHost || !videoRef.current) return;
        const video = videoRef.current as HTMLVideoElement & { __pmoviesRemoteApplying?: boolean; __pmoviesHostState?: { time: number; paused: boolean } };
        applyingRemoteRef.current = true;
        video.__pmoviesRemoteApplying = true;
        video.__pmoviesHostState = { time: payload.time, paused: payload.paused };
        if (typeof payload.time === "number" && Math.abs(video.currentTime - payload.time) > 0.75) video.currentTime = payload.time;
        if (payload.paused === false) void video.play().catch(() => undefined);
        if (payload.paused === true) video.pause();
        window.setTimeout(() => {
          applyingRemoteRef.current = false;
          video.__pmoviesRemoteApplying = false;
        }, 400);
      })
      .on("broadcast", { event: "control_request" }, ({ payload }) => {
        if (!isHost) return;
        setPendingRequests((prev) => [...prev.filter((r) => r.guestId !== payload.guestId), payload as ControlRequest]);
      })
      .on("broadcast", { event: "control_cancel" }, ({ payload }) => {
        if (!isHost) return;
        setPendingRequests((prev) => prev.filter((r) => r.id !== payload.requestId));
      })
      .on("broadcast", { event: "control_response" }, ({ payload }) => {
        if (!guest || payload.guestId !== guest.id) return;
        setRequestResolutionKey(`${payload.requestId}:${payload.accepted}:${Date.now()}`);
      })
      .on("presence", { event: "sync" }, () => {
        const count = Object.keys(channel.presenceState()).length;
        setViewerCount(count);
        void fetch(`/api/watch-rooms/${room.id}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewer_count: count }),
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ guest_id: guest.id, tab_id: presenceId, name: guest.name, joined_at: new Date().toISOString(), is_host: isHost });
        }
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [guest, isHost, room.id, supabase]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetch(`/api/watch-rooms/${room.id}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewer_count: viewerCount }),
      });
      void fetch("/api/watch-rooms/cleanup-messages", { method: "POST" });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [room.id, viewerCount]);

  useEffect(() => {
    if (!isHost) return;
    let lastSent = 0;
    let attachedVideo: HTMLVideoElement | null = null;
    let heartbeat: number | null = null;

    const sendState = async (video: HTMLVideoElement, reason: "play" | "pause" | "seek" | "heartbeat") => {
      if (applyingRemoteRef.current || !channelRef.current) return;
      const now = Date.now();
      if (reason === "heartbeat" && now - lastSent < 1500) return;
      lastSent = now;
      await channelRef.current.send({
        type: "broadcast",
        event: "player_state",
        payload: {
          reason,
          time: video.currentTime,
          paused: video.paused,
          playbackRate: video.playbackRate,
          at: now,
        },
      });
    };

    const attach = () => {
      const video = videoRef.current;
      if (!video || attachedVideo === video) return;
      attachedVideo = video;

      const onPlay = () => void sendState(video, "play");
      const onPause = () => void sendState(video, "pause");
      const onSeeked = () => void sendState(video, "seek");

      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("seeked", onSeeked);
      heartbeat = window.setInterval(() => void sendState(video, "heartbeat"), 2000);

      cleanupVideo = () => {
        if (heartbeat) window.clearInterval(heartbeat);
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("seeked", onSeeked);
      };
    };

    let cleanupVideo = () => {};
    const attachPoll = window.setInterval(attach, 150);
    attach();

    return () => {
      window.clearInterval(attachPoll);
      cleanupVideo();
    };
  }, [isHost]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody("");
    const identity = guest ?? getGuestIdentity();
    await supabase.from("watch_room_messages").insert({
      room_id: room.id,
      user_id: userId,
      guest_id: identity.id,
      display_name: identity.name,
      body: text,
    });
  }

  function sendControlRequest(type: "seek" | "pause" | "play", time?: number) {
    const identity = guest ?? getGuestIdentity();
    const request: ControlRequest = {
      id: crypto.randomUUID(),
      guestId: identity.id,
      guestName: identity.name,
      type,
      time: type === "seek" ? time : videoRef.current?.currentTime,
    };
    void channelRef.current?.send({ type: "broadcast", event: "control_request", payload: request });
    return request.id;
  }

  function cancelControlRequest(requestId?: string) {
    if (!requestId) return;
    void channelRef.current?.send({ type: "broadcast", event: "control_cancel", payload: { requestId } });
  }

  async function respondToRequest(requestId: string, accepted: boolean) {
    const request = pendingRequests.find((r) => r.id === requestId);
    if (!request || !videoRef.current) return;
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

    if (accepted) {
      if (request.type === "seek" && typeof request.time === "number") videoRef.current.currentTime = request.time;
      if (request.type === "pause") videoRef.current.pause();
      if (request.type === "play") await videoRef.current.play().catch(() => undefined);
      await channelRef.current?.send({
        type: "broadcast",
        event: "player_state",
        payload: {
          reason: request.type,
          time: videoRef.current.currentTime,
          paused: videoRef.current.paused,
          at: Date.now(),
        },
      });
    }

    await channelRef.current?.send({
      type: "broadcast",
      event: "control_response",
      payload: { requestId: request.id, guestId: request.guestId, accepted },
    });
  }

  return (
    <div className="grid gap-4 px-3 pb-6 sm:gap-6 sm:px-0 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <div>
          <VideoPlayer
            src={room.stream_url}
            poster={room.poster_url}
            externalRef={videoRef}
            locked={!isHost}
            onRequest={(request) => sendControlRequest(request.type, request.time)}
            onCancelRequest={cancelControlRequest}
            pendingRequests={isHost ? pendingRequests as PlayerPendingRequest[] : undefined}
            onRespondRequest={respondToRequest}
            resumeKey={`party:${room.id}`}
            introStart={room.intro_start_time ?? 0}
            introEnd={room.intro_end_time ?? 0}
            requestResolutionKey={requestResolutionKey}
            fullscreenOverlay={<RoomChat messages={messages} body={body} setBody={setBody} sendMessage={sendMessage} compact />}
          />
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:mt-4 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[.16em] text-cyan-200 sm:text-sm sm:tracking-[.18em]">{isHost ? "Host controls enabled" : "Viewer mode"}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(room.id)}
                className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-100"
              >
                <Copy size={14} /> ID {room.id.slice(0, 8)}
              </button>
              <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-1 text-sm text-white">
                <UsersRound size={15} /> {viewerCount} in room
              </span>
            </div>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">{room.movie_name}</h1>
          <p className="mt-1 text-sm text-slate-400">Host: {room.host_name || "User 1"} · You: {guest?.name || "Guest"}</p>
          {room.episode_name && <p className="mt-1 text-slate-300">{room.episode_name}</p>}
        </div>
        {room.episodes_json?.length ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:mt-4 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-bold text-white">Episodes</h2>
              <p className="text-xs text-slate-400">{isHost ? "Host can jump to the movie episode page." : "Current room episode list."}</p>
            </div>
            <div className="flex snap-x gap-2 overflow-x-auto pb-2">
              {room.episodes_json.map((episode) => {
                const active = episode.name === room.episode_name;
                const content = (
                  <span className={`inline-flex h-10 min-w-24 items-center justify-center rounded-md border px-3 text-sm font-semibold ${active ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/10 bg-black/30 text-white"}`}>
                    {episode.name}
                  </span>
                );
                return isHost && room.movie_slug && episode.slug ? (
                  <Link key={episode.slug} href={`/movie/${room.movie_slug}?episode=${encodeURIComponent(episode.slug)}`}>{content}</Link>
                ) : (
                  <div key={episode.slug ?? episode.name}>{content}</div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
      <aside className="h-[420px] min-w-0 sm:h-[520px] lg:h-[620px]">
        <RoomChat messages={messages} body={body} setBody={setBody} sendMessage={sendMessage} />
      </aside>
    </div>
  );
}
