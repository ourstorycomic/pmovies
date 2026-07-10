"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BANDERSNATCH_VIDEO_URL, UNIQUE_CHOICE_POINTS, type ChoicePoint } from "./bandersnatch-data";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
export type BandersnatchVote = {
  choicePointId: string;
  choiceId: string;
  guestId: string;
  guestName: string;
};

type Props = {
  /** Pass through for Watch-Party. Host gets isHost=true */
  isWatchParty?: boolean;
  isHost?: boolean;
  guestId?: string;
  guestName?: string;
  /** Channel broadcast functions (watch-party integration) */
  onSendVote?: (vote: BandersnatchVote) => void;
  onSendChoice?: (choicePointId: string, choiceId: string) => void;
  /** Incoming events from other guests */
  incomingVote?: BandersnatchVote | null;
  incomingChoice?: { choicePointId: string; choiceId: string } | null;
  onReady?: (ref: HTMLVideoElement) => void;
};

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function formatTime(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(h > 0 ? 2 : 1, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${ss}` : `${m}:${ss}`;
}

/* ─────────────────────────────────────────────────────────────
   Choice Overlay — Netflix style
───────────────────────────────────────────────────────────── */
function ChoiceOverlay({
  cp,
  onChoose,
  isWatchParty,
  isHost,
  myVote,
  votes,
  countdown,
}: {
  cp: ChoicePoint;
  onChoose: (choiceId: string) => void;
  isWatchParty: boolean;
  isHost: boolean;
  myVote: string | null;
  votes: Record<string, number>;
  countdown: number;
}) {
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const maxMs = cp.endMs - cp.startMs;
  const pct = Math.max(0, Math.min(100, (countdown / (maxMs / 1000)) * 100));

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-end pb-16 sm:pb-20">
      {/* Gradient fog from bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

      <div className="relative z-10 w-full max-w-2xl px-4">
        {/* Description */}
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[.2em] text-amber-400 drop-shadow-lg sm:text-sm">
          {cp.descriptionVi}
        </p>

        {/* Countdown bar */}
        <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Choice buttons */}
        <div className={`grid gap-3 ${cp.choices.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
          {cp.choices.map((c, i) => {
            const voteCount = votes[c.id] ?? 0;
            const voted = myVote === c.id;
            const votePct = total > 0 ? Math.round((voteCount / total) * 100) : 0;

            return (
              <button
                key={c.id}
                onClick={() => onChoose(c.id)}
                className={`
                  group relative overflow-hidden rounded-xl border-2 px-4 py-4 text-left transition-all duration-200
                  ${voted
                    ? "border-amber-400 bg-amber-400/20 shadow-[0_0_24px_rgba(251,191,36,0.4)]"
                    : "border-white/20 bg-black/50 hover:border-white/60 hover:bg-white/10"
                  }
                `}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Vote bar fill */}
                {isWatchParty && total > 0 && (
                  <div
                    className="absolute inset-0 origin-left bg-white/5 transition-all duration-700"
                    style={{ transform: `scaleX(${votePct / 100})` }}
                  />
                )}

                <div className="relative">
                  <p className={`text-sm font-black leading-snug sm:text-base ${voted ? "text-amber-300" : "text-white"}`}>
                    {c.text}
                  </p>

                  {isWatchParty && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {voteCount} phiếu{total > 0 ? ` (${votePct}%)` : ""}
                      </span>
                      {voted && (
                        <span className="text-xs font-bold text-amber-400">✓ Đã chọn</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Letter label A / B / C */}
                <span className={`absolute right-3 top-3 text-xs font-black ${voted ? "text-amber-400" : "text-white/30"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
              </button>
            );
          })}
        </div>

        {isWatchParty && !isHost && myVote && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Đang chờ… Host sẽ áp dụng kết quả vote khi hết giờ.
          </p>
        )}
        {isWatchParty && isHost && (
          <p className="mt-3 text-center text-xs text-amber-400/70">
            Host: Phiếu nhiều nhất sẽ được chọn. Nếu bằng nhau → chọn ngẫu nhiên.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Player
───────────────────────────────────────────────────────────── */
export function BandersnatchPlayer({
  isWatchParty = false,
  isHost = true,
  guestId = "solo",
  guestName = "Bạn",
  onSendVote,
  onSendChoice,
  incomingVote,
  incomingChoice,
  onReady,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [seekFlash, setSeekFlash] = useState<"back" | "forward" | null>(null);
  const hideRef = useRef<number | null>(null);
  const seekFlashTimerRef = useRef<number | null>(null);
  const resolvingRef = useRef(false);
  const activeCPRef = useRef<ChoicePoint | null>(null);
  const votesRef = useRef<Record<string, number>>({});
  const flashTimerRef = useRef<number | null>(null);

  // Interactive state
  const [activeCP, setActiveCP] = useState<ChoicePoint | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [choiceHistory, setChoiceHistory] = useState<{ id: string; choice: string }[]>([]);
  const [lastChoiceFlash, setLastChoiceFlash] = useState<string | null>(null);
  const resolvedRef = useRef<Set<string>>(new Set());

  const choiceCountdown = activeCP
    ? Math.max(0, Math.ceil((activeCP.endMs - currentTime * 1000) / 1000))
    : 0;

  // Show controls temporarily
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideRef.current) window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  // Sync video state + choice detection (runs on native timeupdate, no extra React renders)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const sync = () => {
      setCurrentTime(v.currentTime);
      setDuration(v.duration || 0);
      setPaused(v.paused);
      setVolume(v.volume);
      setMuted(v.muted);
    };

    const checkChoices = () => {
      const ms = v.currentTime * 1000;
      const cp = activeCPRef.current;

      if (cp) {
        if (ms >= cp.endMs) {
          resolveChoiceRef.current(cp, null);
        }
        return;
      }

      for (const point of UNIQUE_CHOICE_POINTS) {
        if (resolvedRef.current.has(point.id)) continue;
        if (ms >= point.startMs && ms < point.endMs) {
          activeCPRef.current = point;
          setActiveCP(point);
          setMyVote(null);
          setVotes({});
          votesRef.current = {};
          break;
        }
      }
    };

    const onTimeUpdate = () => {
      sync();
      checkChoices();
    };

    const onWait = () => setBuffering(true);
    const onPlay2 = () => { setBuffering(false); sync(); };

    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("play", onPlay2);
    v.addEventListener("pause", sync);
    v.addEventListener("waiting", onWait);
    v.addEventListener("playing", onPlay2);
    v.addEventListener("canplay", onPlay2);
    v.addEventListener("seeked", checkChoices);
    if (onReady) v.addEventListener("loadedmetadata", () => onReady(v), { once: true });

    return () => {
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("play", onPlay2);
      v.removeEventListener("pause", sync);
      v.removeEventListener("waiting", onWait);
      v.removeEventListener("playing", onPlay2);
      v.removeEventListener("canplay", onPlay2);
      v.removeEventListener("seeked", checkChoices);
    };
  }, [onReady]);

  // Fullscreen listener
  useEffect(() => {
    const onFs = () => {
      const fs = Boolean(
        document.fullscreenElement ??
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement,
      );
      setIsFullscreen(fs);
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // When user seeks backward past a resolved choice, un-resolve it so they can choose again
  const prevTimeRef = useRef(0);
  useEffect(() => {
    const ms = currentTime * 1000;
    const prevMs = prevTimeRef.current;
    if (ms < prevMs - 3000) {
      for (const cp of UNIQUE_CHOICE_POINTS) {
        if (resolvedRef.current.has(cp.id) && cp.startMs > ms) {
          resolvedRef.current.delete(cp.id);
        }
      }
    }
    prevTimeRef.current = ms;
  }, [currentTime]);

  function markChoiceWindowResolved(cp: ChoicePoint) {
    for (const c of UNIQUE_CHOICE_POINTS) {
      if (c.startMs === cp.startMs && c.endMs === cp.endMs) {
        resolvedRef.current.add(c.id);
      }
    }
  }

  function applyChoice(cp: ChoicePoint, choiceId: string) {
    if (resolvedRef.current.has(cp.id)) return;
    markChoiceWindowResolved(cp);

    const chosen = cp.choices.find((c) => c.id === choiceId) ?? cp.choices[0];

    // Clear overlay immediately (sync ref + async state)
    activeCPRef.current = null;
    setActiveCP(null);
    setMyVote(null);
    setVotes({});
    votesRef.current = {};

    setChoiceHistory((h) => {
      if (h.some((entry) => entry.id === cp.id)) return h;
      return [...h, { id: cp.id, choice: chosen.text }];
    });

    // Small corner toast instead of fullscreen freeze
    setLastChoiceFlash(chosen.text);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setLastChoiceFlash(null), 900);

    const video = videoRef.current;
    if (!video) return;

    const targetSec = chosen.nextSegmentStartMs / 1000;
    const nowSec = video.currentTime;
    // Only seek when the branch jump is meaningful — otherwise let video keep playing
    if (Math.abs(targetSec - nowSec) > 1.5) {
      video.currentTime = targetSec;
    }
    if (video.paused) void video.play().catch(() => undefined);
  }

  function resolveChoice(cp: ChoicePoint, forcedId: string | null) {
    if (resolvingRef.current || resolvedRef.current.has(cp.id)) return;
    resolvingRef.current = true;

    let winnerId = forcedId;
    if (!winnerId) {
      const tally = votesRef.current;
      let max = -1;
      const tied: string[] = [];
      for (const c of cp.choices) {
        const n = tally[c.id] ?? 0;
        if (n > max) { max = n; tied.length = 0; tied.push(c.id); }
        else if (n === max) { tied.push(c.id); }
      }
      if (tied.length === 1) winnerId = tied[0];
      else if (tied.length > 1) winnerId = tied[Math.floor(Math.random() * tied.length)];
      else winnerId = cp.choices[0].id;
    }

    if (isWatchParty && isHost) {
      onSendChoice?.(cp.id, winnerId);
    }
    applyChoice(cp, winnerId);
    resolvingRef.current = false;
  }

  const resolveChoiceRef = useRef(resolveChoice);
  resolveChoiceRef.current = resolveChoice;

  // Incoming vote from channel (watch party)
  useEffect(() => {
    if (!incomingVote || !activeCP || incomingVote.choicePointId !== activeCP.id) return;
    setVotes((prev) => {
      const next = { ...prev, [incomingVote.choiceId]: (prev[incomingVote.choiceId] ?? 0) + 1 };
      votesRef.current = next;
      return next;
    });
  }, [incomingVote, activeCP]);

  // Incoming choice from host (watch party guests apply it)
  useEffect(() => {
    if (!incomingChoice || !activeCP) return;
    if (incomingChoice.choicePointId !== activeCP.id) return;
    if (!isHost) applyChoice(activeCP, incomingChoice.choiceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingChoice, activeCP, isHost]);

  function handleVote(choiceId: string) {
    if (!activeCP) return;
    const newVote = myVote === choiceId ? null : choiceId;

    // Remove old vote from tally
    if (myVote) {
      setVotes((prev) => ({ ...prev, [myVote]: Math.max(0, (prev[myVote] ?? 1) - 1) }));
    }

    if (newVote) {
      setVotes((prev) => {
        const next = { ...prev, [newVote]: (prev[newVote] ?? 0) + 1 };
        votesRef.current = next;
        return next;
      });
      onSendVote?.({ choicePointId: activeCP.id, choiceId: newVote, guestId, guestName });
    }
    setMyVote(newVote);

    // Solo mode or host: immediately resolve on pick
    if ((!isWatchParty || isHost) && newVote) {
      resolveChoice(activeCP, newVote);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, seconds));
  }

  function seekBy(delta: number, direction: "back" | "forward") {
    const video = videoRef.current;
    if (!video) return;
    seekTo(video.currentTime + delta);
    showControls();
    setSeekFlash(direction);
    if (seekFlashTimerRef.current) window.clearTimeout(seekFlashTimerRef.current);
    seekFlashTimerRef.current = window.setTimeout(() => setSeekFlash(null), 700);
  }

  function handleTimeline(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo(((event.clientX - rect.left) / rect.width) * (duration || 0));
    showControls();
  }

  function handleTimelineHover(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    setHoverPosition(percent * 100);
    setHoverTime(percent * (duration || 0));
  }

  async function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const elFs = el as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> };

    try {
      if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
        await screen.orientation?.unlock?.();
        if (document.exitFullscreen) await document.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
        return;
      }
      if (el.requestFullscreen) await el.requestFullscreen();
      else await elFs.webkitRequestFullscreen?.();
      await (screen.orientation as { lock?: (o: string) => Promise<void> })?.lock?.("landscape").catch(() => undefined);
    } catch {
      setIsFullscreen(Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement));
    }
  }

  const handleKeyDownRef = useRef({ togglePlay, showControls, seekBy, toggleFullscreen });
  handleKeyDownRef.current = { togglePlay, showControls, seekBy, toggleFullscreen };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        active?.tagName === "SELECT" ||
        (active as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        handleKeyDownRef.current.togglePlay();
        handleKeyDownRef.current.showControls();
      }
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault();
        const delta = e.code === "ArrowLeft" ? -10 : 10;
        handleKeyDownRef.current.seekBy(delta, e.code === "ArrowLeft" ? "back" : "forward");
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        void handleKeyDownRef.current.toggleFullscreen();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={showControls}
      onMouseEnter={showControls}
      onTouchStart={showControls}
      className={`pmovies-player group relative overflow-hidden bg-black shadow-2xl shadow-black/80 ${
        isFullscreen
          ? "fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center rounded-none"
          : "aspect-video rounded-xl"
      } [&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:items-center [&:fullscreen]:justify-center [&:fullscreen]:rounded-none ${controlsVisible || activeCP ? "cursor-auto" : "cursor-none"}`}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={BANDERSNATCH_VIDEO_URL}
        playsInline
        preload="auto"
        className="h-full w-full object-contain"
      />

      {/* Click to play/pause — works during choices too */}
      <button
        type="button"
        onClick={togglePlay}
        className={`absolute inset-0 z-10 ${activeCP ? "pointer-events-none" : ""}`}
        aria-label="Toggle playback"
      />

      {seekFlash !== null && (
        <div className="pointer-events-none absolute inset-0 z-25 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-xl bg-black/60 px-5 py-3 text-white backdrop-blur-sm animate-in fade-in zoom-in-90 duration-150">
            <span className="text-2xl font-black">{seekFlash === "back" ? "← 10s" : "10s →"}</span>
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />

      {/* Buffering spinner */}
      {buffering && !activeCP && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-amber-400" />
        </div>
      )}

      {/* Choice toast — corner, non-blocking */}
      {lastChoiceFlash && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-150">
          <div className="rounded-xl border border-amber-400/40 bg-black/75 px-5 py-2.5 text-center backdrop-blur-md shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Đã chọn</p>
            <p className="text-base font-black text-white">{lastChoiceFlash}</p>
          </div>
        </div>
      )}

      {/* Interactive Choice Overlay */}
      {activeCP && (
        <ChoiceOverlay
          cp={activeCP}
          onChoose={handleVote}
          isWatchParty={isWatchParty}
          isHost={isHost}
          myVote={myVote}
          votes={votes}
          countdown={choiceCountdown}
        />
      )}

      {/* Choice history sidebar (top-right) */}
      {choiceHistory.length > 0 && (
        <div
          className={`absolute right-3 top-3 z-30 max-w-[160px] space-y-1 transition-all duration-300 ${controlsVisible || activeCP ? "opacity-100" : "opacity-0"}`}
        >
          {choiceHistory.slice(-3).map((h) => (
            <div key={h.id} className="rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-right backdrop-blur-sm">
              <p className="text-[9px] uppercase tracking-widest text-amber-400/70">Đã chọn</p>
              <p className="text-xs font-bold text-white leading-tight">{h.choice}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls — always interactive when visible */}
      <div
        className={`absolute inset-x-0 bottom-0 z-[60] space-y-2 p-3 transition-all duration-300 sm:p-4 ${controlsVisible || activeCP ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
      >
        {/* Timeline */}
        <div
          className="group/timeline relative h-7 cursor-pointer py-2.5"
          onClick={handleTimeline}
          onMouseMove={handleTimelineHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          {hoverTime !== null && (
            <div
              className="pointer-events-none absolute bottom-full z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-amber-400/30 bg-black/90 px-2.5 py-1 text-[11px] font-bold text-amber-100 shadow-lg backdrop-blur-md"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
          <div className="relative h-1.5 rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
              style={{ width: `${progress}%` }}
            />
            {hoverTime !== null && (
              <div
                className="pointer-events-none absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                style={{ left: `${hoverPosition}%` }}
              />
            )}
          </div>
        </div>

        {/* Control row */}
        <div className="flex items-center gap-2 text-white sm:gap-3">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="shrink-0 rounded-lg bg-white/10 p-2 hover:bg-amber-400 hover:text-slate-950 transition-colors"
          >
            {paused ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            )}
          </button>

          {/* Time */}
          <span className="min-w-[5rem] shrink-0 text-xs font-semibold sm:text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Volume */}
          <button
            type="button"
            onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}
            className="shrink-0 rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors"
          >
            {muted || volume === 0 ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              if (videoRef.current) {
                videoRef.current.volume = Number(e.target.value);
                videoRef.current.muted = Number(e.target.value) === 0;
              }
            }}
            className="pmovies-range hidden w-20 sm:block lg:w-24"
          />

          {/* Interactive badge */}
          <div className="ml-2 hidden sm:flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Interactive</span>
          </div>

          {/* Fullscreen */}
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="shrink-0 rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors"
            >
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive film label (top-left) */}
      <div
        className={`absolute left-3 top-3 z-30 transition-all duration-300 ${controlsVisible || activeCP ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">
            Phim Tương Tác
          </span>
        </div>
      </div>
    </div>
  );
}
