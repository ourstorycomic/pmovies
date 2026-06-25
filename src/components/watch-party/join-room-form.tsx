"use client";

import { UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinRoomForm() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = roomId.trim();
    if (!id) return;
    router.push(`/watch-party/${id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-2 shadow-xl backdrop-blur-xl">
      <div className="flex h-10 items-center justify-center pl-3 pr-2 text-cyan-300">
        <UsersRound size={18} />
      </div>
      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Enter Room ID to join..."
        className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        disabled={!roomId.trim()}
        className="h-10 rounded-md bg-cyan-300 px-4 text-sm font-bold text-slate-950 disabled:opacity-50"
      >
        Join
      </button>
    </form>
  );
}
