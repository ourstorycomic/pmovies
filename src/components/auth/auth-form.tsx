"use client";

import { Film, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthForm() {
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);

    if (mode === "register" && !result.data.session) {
      setMessage("Account created. Supabase is asking for email confirmation, so please check your inbox before signing in.");
      return;
    }

    if (result.data.user) {
      await supabase.from("profiles").upsert({
        user_id: result.data.user.id,
        display_name: displayName || result.data.user.email?.split("@")[0],
        avatar_url: result.data.user.user_metadata?.avatar_url ?? null,
      });
    }

    window.location.href = next;
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-md bg-cyan-300 p-2 text-slate-950 shadow-[0_0_32px_rgba(103,232,249,.4)]">
          <Film size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{mode === "login" ? "Welcome back" : "Create profile"}</h1>
          <p className="text-sm text-slate-400">Premium streaming, private by design.</p>
        </div>
      </div>
      {mode === "register" && (
        <input className="mb-3 h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-cyan-300" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      )}
      <input className="mb-3 h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-cyan-300" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="mb-5 h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-cyan-300" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {message && <p className="mb-4 text-sm text-amber-300">{message}</p>}
      <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" size={16} />}{mode === "login" ? "Sign in" : "Create account"}</Button>
      <button type="button" className="mt-5 w-full text-sm text-slate-300 hover:text-white" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
