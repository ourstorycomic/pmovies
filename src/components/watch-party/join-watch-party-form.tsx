"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function JoinWatchPartyForm() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");

  function joinRoom(event: React.FormEvent) {
    event.preventDefault();
    const value = roomId.trim();
    setError("");

    const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const id = match?.[0] ?? value;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setError("Enter a valid room ID.");
      return;
    }

    router.push(`/watch-party/${id}`);
  }

  return (
    <form onSubmit={joinRoom} className="mt-3 flex max-w-xl flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:flex-row">
      <div className="min-w-0 flex-1">
        <input
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          className="h-11 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
          placeholder="Enter watch room ID..."
        />
        {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
      </div>
      <Button type="submit" variant="glass" className="h-11 shrink-0">
        <LogIn size={16} />
        Join
      </Button>
    </form>
  );
}
