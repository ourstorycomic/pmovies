"use client";

import { Check, Maximize, Minimize, Pause, PictureInPicture2, Play, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BANDERSNATCH_VIDEO_URL, UNIQUE_CHOICE_POINTS, type ChoicePoint } from "./bandersnatch-data";
import { type PlayerPendingRequest } from "./video-player";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
export type BandersnatchVote = {
  choicePointId: string;
  choiceId: string;
  guestId: string;
  guestName: string;
};

type PlayerRequest = {
  type: "seek" | "pause" | "play";
  time?: number;
};

type WatchPartyVideo = HTMLVideoElement & {
  __pmoviesRemoteApplying?: boolean;
  __pmoviesHostState?: { time: number; paused: boolean };
};

type PictureInPictureDocument = Document & {
  pictureInPictureElement?: Element | null;
  pictureInPictureEnabled?: boolean;
  exitPictureInPicture?: () => Promise<void>;
};

type PictureInPictureVideo = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
};

type DocumentPictureInPictureController = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

type WindowWithDocumentPictureInPicture = Window & {
  documentPictureInPicture?: DocumentPictureInPictureController;
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
  onRequest?: (request: PlayerRequest) => string | void;
  onCancelRequest?: (requestId?: string) => void;
  pendingRequests?: PlayerPendingRequest[];
  onRespondRequest?: (requestId: string, accepted: boolean) => void;
  requestResolutionKey?: string;
  fullscreenOverlay?: ReactNode;
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
    <div className="absolute inset-x-0 bottom-16 z-[70] flex justify-center px-3 sm:px-4">
      {/* Gradient fog from bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/45 to-transparent" />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-white/10 bg-black/65 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-4">
        {/* Description */}
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[.2em] text-amber-400 drop-shadow-lg sm:mb-3 sm:text-xs">
          {cp.descriptionVi}
        </p>

        {/* Countdown bar */}
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/20 sm:mb-4">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Choice buttons */}
        <div className={`grid gap-2 sm:gap-3 ${cp.choices.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
          {cp.choices.map((c, i) => {
            const voteCount = votes[c.id] ?? 0;
            const voted = myVote === c.id;
            const votePct = total > 0 ? Math.round((voteCount / total) * 100) : 0;

            return (
              <button
                key={c.id}
                onClick={() => onChoose(c.id)}
                className={`
                  group relative overflow-hidden rounded-xl border-2 px-3 py-3 text-left transition-all duration-200 sm:px-4 sm:py-4
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
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 sm:text-xs">
                        {voteCount} phiếu{total > 0 ? ` (${votePct}%)` : ""}
                      </span>
                      {voted && (
                        <span className="text-[11px] font-bold text-amber-400 sm:text-xs">✓ Đã chọn</span>
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
  onRequest,
  onCancelRequest,
  pendingRequests,
  onRespondRequest,
  requestResolutionKey,
  fullscreenOverlay,
}: Props) {
  const locked = isWatchParty && !isHost;
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSlotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const documentPipWindowRef = useRef<Window | null>(null);
  const lastLockedStateRef = useRef({ time: 0, paused: true });
  const nativeGuardRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [pipChoiceContainer, setPipChoiceContainer] = useState<HTMLElement | null>(null);
  const [localRequest, setLocalRequest] = useState<(PlayerRequest & { id?: string }) | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [seekFlash, setSeekFlash] = useState<"back" | "forward" | null>(null);
  const hideRef = useRef<number | null>(null);
  const seekFlashTimerRef = useRef<number | null>(null);
  const resolvingRef = useRef(false);
  const activeCPRef = useRef<ChoicePoint | null>(null);
  const votesRef = useRef<Record<string, number>>({});
  // Interactive state
  const [activeCP, setActiveCP] = useState<ChoicePoint | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [choiceHistory, setChoiceHistory] = useState<{ id: string; choice: string }[]>([]);
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

  useEffect(() => {
    const pipDocument = document as PictureInPictureDocument;
    const docPip = window as WindowWithDocumentPictureInPicture;
    queueMicrotask(() => setPictureInPictureSupported(Boolean(pipDocument.pictureInPictureEnabled || docPip.documentPictureInPicture)));
  }, []);

  useEffect(() => {
    if (requestResolutionKey) queueMicrotask(() => setLocalRequest(null));
  }, [requestResolutionKey]);

  useEffect(() => {
    updateDocumentPictureInPictureUi();
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !locked) return;

    const lockedVideo = video as WatchPartyVideo;
    const isRemoteApplying = () => Boolean(lockedVideo.__pmoviesRemoteApplying);
    const hostState = () => lockedVideo.__pmoviesHostState ?? lastLockedStateRef.current;
    const rememberState = () => {
      if (!nativeGuardRef.current) {
        lastLockedStateRef.current = { time: video.currentTime, paused: video.paused };
      }
    };
    const restoreHostState = () => {
      nativeGuardRef.current = true;
      const last = hostState();
      if (Math.abs(video.currentTime - last.time) > 0.5) video.currentTime = last.time;
      if (last.paused) video.pause();
      else void video.play().catch(() => undefined);
      window.setTimeout(() => {
        nativeGuardRef.current = false;
      }, 250);
    };
    const requestNativeChange = (request: PlayerRequest) => {
      if (nativeGuardRef.current || isRemoteApplying()) {
        rememberState();
        return;
      }
      const requestId = onRequest?.(request);
      setLocalRequest({ ...request, id: typeof requestId === "string" ? requestId : undefined });
      restoreHostState();
    };

    const onPlay = () => {
      if (document.hidden) return;
      requestNativeChange({ type: "play", time: hostState().time });
    };
    const onPause = () => {
      if (document.hidden) return;
      requestNativeChange({ type: "pause", time: hostState().time });
    };
    const mountTime = Date.now();
    const onSeeking = () => {
      if (document.hidden || Date.now() - mountTime < 2000) return;
      requestNativeChange({ type: "seek", time: video.currentTime });
    };

    video.addEventListener("timeupdate", rememberState);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeking", onSeeking);
    return () => {
      video.removeEventListener("timeupdate", rememberState);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeking", onSeeking);
    };
  }, [locked, onRequest]);

  function requestOrRun(request: PlayerRequest, run: () => void) {
    if (locked) {
      const requestId = onRequest?.(request);
      setLocalRequest({ ...request, id: typeof requestId === "string" ? requestId : undefined });
      return;
    }
    run();
  }

  function cancelLocalRequest(event?: React.MouseEvent) {
    event?.stopPropagation();
    onCancelRequest?.(localRequest?.id);
    setLocalRequest(null);
  }

  function visibleRequest() {
    return (pendingRequests && pendingRequests.length > 0)
      ? pendingRequests[0]
      : (localRequest?.type === "seek" ? { ...localRequest, id: localRequest.id ?? "local", guestName: "You" } : null);
  }

  function updateDocumentPictureInPictureUi() {
    const pipWindow = documentPipWindowRef.current;
    if (!pipWindow) return;
    const progressValue = duration ? (currentTime / duration) * 100 : 0;
    const request = visibleRequest();
    const requestPercent = request?.type === "seek" && duration ? ((request.time ?? 0) / duration) * 100 : null;

    const progressEl = pipWindow.document.querySelector(".progress") as HTMLElement | null;
    const markerEl = pipWindow.document.querySelector(".marker") as HTMLElement | null;
    const bubbleEl = pipWindow.document.querySelector(".bubble") as HTMLElement | null;
    const requestCard = pipWindow.document.querySelector(".request-card") as HTMLElement | null;
    const requestText = pipWindow.document.querySelector(".request-text") as HTMLElement | null;
    const playButton = pipWindow.document.querySelector(".play") as HTMLButtonElement | null;
    const muteButton = pipWindow.document.querySelector(".mute") as HTMLButtonElement | null;
    const timeEl = pipWindow.document.querySelector(".time") as HTMLElement | null;
    const loader = pipWindow.document.querySelector(".loader") as HTMLElement | null;

    if (loader) loader.style.display = buffering ? "block" : "none";
    if (progressEl) progressEl.style.width = `${progressValue}%`;
    if (playButton) playButton.textContent = paused ? "▶" : "Ⅱ";
    if (muteButton) muteButton.textContent = muted || volume === 0 ? "🔇" : "🔊";
    if (timeEl) timeEl.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;

    if (markerEl && bubbleEl) {
      markerEl.style.display = requestPercent === null ? "none" : "block";
      if (requestPercent !== null) {
        markerEl.style.left = `${requestPercent}%`;
        bubbleEl.textContent = `${request?.guestName ?? "You"} requests ${formatTime(request?.time ?? 0)}`;
      }
    }
    if (requestCard && requestText) {
      const showCard = Boolean(locked && localRequest && localRequest.type !== "seek");
      requestCard.style.display = showCard ? "flex" : "none";
      requestText.textContent = showCard ? `You requested ${localRequest?.type}` : "";
    }
  }

  async function togglePictureInPicture() {
    const video = videoRef.current as PictureInPictureVideo | null;
    const pipDocument = document as PictureInPictureDocument;
    if (!video) return;

    try {
      if (documentPipWindowRef.current) {
        documentPipWindowRef.current.close();
        return;
      }
      const openedDocumentPip = await openDocumentPictureInPicture(video);
      if (openedDocumentPip) return;
      if (pipDocument.pictureInPictureElement) {
        await pipDocument.exitPictureInPicture?.();
        return;
      }
      if (!pipDocument.pictureInPictureEnabled) return;
      if (document.fullscreenElement) await document.exitFullscreen();
      await video.requestPictureInPicture?.();
    } catch {
      setIsPictureInPicture(Boolean(pipDocument.pictureInPictureElement));
    }
  }

  async function openDocumentPictureInPicture(video: HTMLVideoElement) {
    const api = (window as WindowWithDocumentPictureInPicture).documentPictureInPicture;
    if (!api) return false;
    if (document.fullscreenElement) await document.exitFullscreen();

    const pipWindow = await api.requestWindow({ width: 760, height: 430 });
    documentPipWindowRef.current = pipWindow;
    setIsPictureInPicture(true);

    pipWindow.document.body.innerHTML = `
      <style>
        html, body { margin: 0; height: 100%; overflow: hidden; background: #030712; font-family: ui-sans-serif, system-ui, sans-serif; color: white; }
        .shell { position: relative; height: 100vh; width: 100vw; background: black; }
        .video-slot, video { height: 100%; width: 100%; }
        video { object-fit: contain; background: black; }
        .shade { pointer-events: none; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.85), transparent 42%, rgba(0,0,0,.25)); }
        .controls { position: absolute; inset-inline: 0; bottom: 0; padding: 12px; display: grid; gap: 10px; transition: opacity .25s, transform .25s; z-index: 15; }
        .shell.idle { cursor: none; }
        .shell.idle .controls, .shell.idle .request-card { opacity: 0; transform: translateY(10px); pointer-events: none; }
        .timeline { height: 20px; cursor: pointer; display: flex; align-items: center; }
        .track { position: relative; height: 5px; flex: 1; border-radius: 999px; background: rgba(255,255,255,.22); }
        .progress { height: 100%; width: 0%; border-radius: inherit; background: #fbbf24; box-shadow: 0 0 18px rgba(251,191,36,.65); }
        .marker { display: none; position: absolute; top: 50%; height: 17px; width: 4px; transform: translateY(-50%); border-radius: 999px; background: #fcd34d; box-shadow: 0 0 16px rgba(252,211,77,.85); }
        .bubble { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); white-space: nowrap; border: 1px solid rgba(252,211,77,.28); background: rgba(0,0,0,.78); border-radius: 8px; padding: 7px 9px; font-size: 12px; color: #fef3c7; backdrop-filter: blur(14px); }
        .row { display: flex; align-items: center; gap: 10px; }
        button { border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.1); color: white; border-radius: 8px; height: 34px; min-width: 34px; font-weight: 800; cursor: pointer; }
        .time { min-width: 78px; font-size: 13px; font-weight: 700; }
        .request-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none; align-items: center; gap: 10px; border: 1px solid rgba(252,211,77,.28); background: rgba(0,0,0,.72); color: #fef3c7; border-radius: 10px; padding: 10px 12px; box-shadow: 0 18px 40px rgba(0,0,0,.4); backdrop-filter: blur(16px); z-index: 30; }
        .cancel { background: rgba(244,63,94,.78); }
        .loader { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none; color: #fbbf24; animation: spin 1s linear infinite; pointer-events: none; z-index: 10; }
        .choice-slot { position: absolute; inset: 0; z-index: 20; pointer-events: auto; }
        @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
      </style>
      <div class="shell">
        <div class="video-slot"></div>
        <div class="shade"></div>
        <div class="choice-slot"></div>
        <div class="loader"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
        <div class="request-card"><span class="request-text"></span><button class="cancel">×</button></div>
        <div class="controls">
          <div class="timeline"><div class="track"><div class="progress"></div><div class="marker"><div class="bubble"></div></div></div></div>
          <div class="row"><button class="play">▶</button><span class="time">0:00</span><button class="mute">🔊</button></div>
        </div>
      </div>
    `;

    const shell = pipWindow.document.querySelector(".shell") as HTMLElement;
    const slot = pipWindow.document.querySelector(".video-slot");
    slot?.append(video);
    video.className = "";

    const choiceSlot = pipWindow.document.querySelector(".choice-slot") as HTMLElement | null;
    if (choiceSlot) setPipChoiceContainer(choiceSlot);

    const overlaySlot = pipWindow.document.createElement("div");
    overlaySlot.className = "absolute right-4 top-4 z-50 h-[320px] w-[300px]";
    shell.append(overlaySlot);
    setPipContainer(overlaySlot);

    const onClose = () => {
      videoSlotRef.current?.append(video);
      video.className = "h-full w-full object-contain";
      documentPipWindowRef.current = null;
      setIsPictureInPicture(false);
      setPipContainer(null);
      setPipChoiceContainer(null);
    };

    let idleTimer: number | null = null;
    const showPipControls = () => {
      shell.classList.remove("idle");
      if (idleTimer) pipWindow.clearTimeout(idleTimer);
      idleTimer = pipWindow.setTimeout(() => shell.classList.add("idle"), 2600);
    };
    shell.addEventListener("mousemove", showPipControls);
    shell.addEventListener("click", (e) => {
      showPipControls();
      if (e.target === shell || e.target === slot || e.target === video) togglePlay();
    });
    showPipControls();

    (pipWindow.document.querySelector(".play") as HTMLButtonElement).onclick = () => togglePlay();
    (pipWindow.document.querySelector(".mute") as HTMLButtonElement).onclick = () => {
      video.muted = !video.muted;
    };
    (pipWindow.document.querySelector(".cancel") as HTMLButtonElement).onclick = () => cancelLocalRequest();
    (pipWindow.document.querySelector(".timeline") as HTMLElement).onclick = (event) => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      seekTo(((event.clientX - rect.left) / rect.width) * (video.duration || 0));
    };

    pipWindow.addEventListener("pagehide", onClose, { once: true });
    updateDocumentPictureInPictureUi();
    return true;
  }

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
    const onEnterPictureInPicture = () => setIsPictureInPicture(true);
    const onLeavePictureInPicture = () => setIsPictureInPicture(false);

    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("play", onPlay2);
    v.addEventListener("pause", sync);
    v.addEventListener("waiting", onWait);
    v.addEventListener("playing", onPlay2);
    v.addEventListener("canplay", onPlay2);
    v.addEventListener("seeked", checkChoices);
    v.addEventListener("enterpictureinpicture", onEnterPictureInPicture);
    v.addEventListener("leavepictureinpicture", onLeavePictureInPicture);
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
      v.removeEventListener("enterpictureinpicture", onEnterPictureInPicture);
      v.removeEventListener("leavepictureinpicture", onLeavePictureInPicture);
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

    // Solo mode resolves immediately; watch-party votes wait for the choice window to end.
    if (!isWatchParty && newVote) {
      resolveChoice(activeCP, newVote);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    requestOrRun({ type: v.paused ? "play" : "pause", time: v.currentTime }, () => {
      if (v.paused) void v.play().catch(() => undefined);
      else v.pause();
    });
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    requestOrRun({ type: "seek", time: seconds }, () => {
      video.currentTime = Math.max(0, Math.min(video.duration || 0, seconds));
    });
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

  const choiceOverlay = activeCP ? (
    <ChoiceOverlay
      cp={activeCP}
      onChoose={handleVote}
      isWatchParty={isWatchParty}
      isHost={isHost}
      myVote={myVote}
      votes={votes}
      countdown={choiceCountdown}
    />
  ) : null;

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
      <div ref={videoSlotRef} className="h-full w-full">
        <video
          ref={videoRef}
          src={BANDERSNATCH_VIDEO_URL}
          playsInline
          preload="auto"
          className="h-full w-full object-contain"
        />
      </div>

      {/* Click to play/pause — works during choices too */}
      <button
        type="button"
        onClick={togglePlay}
        className={`absolute inset-0 z-10 ${activeCP ? "pointer-events-none" : ""}`}
        aria-label={locked ? "Request playback change" : "Toggle playback"}
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

      <div className="absolute inset-0 z-30 flex pointer-events-none items-center justify-center flex-col gap-2">
        {(pendingRequests || []).filter((r) => r.type !== "seek").map((req) => (
          <div key={req.id} className="pointer-events-auto flex items-center gap-3 rounded-md border border-amber-300/25 bg-black/70 px-4 py-3 text-white shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="rounded-md bg-amber-300 p-2 text-slate-950">{req.type === "play" ? <Play size={18} /> : <Pause size={18} />}</div>
            <div>
              <p className="text-sm font-bold">{req.guestName}</p>
              <p className="text-xs text-slate-300">requests {req.type}</p>
            </div>
            <button onClick={() => onRespondRequest?.(req.id, true)} className="rounded-md bg-emerald-400 p-2 text-slate-950"><Check size={16} /></button>
            <button onClick={() => onRespondRequest?.(req.id, false)} className="rounded-md bg-rose-400 p-2 text-white"><X size={16} /></button>
          </div>
        ))}
      </div>
      {locked && localRequest && localRequest.type !== "seek" && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-amber-300/25 bg-black/70 px-4 py-3 text-amber-100 shadow-2xl backdrop-blur-xl">
            <span>Request sent: {localRequest.type}</span>
            <button onClick={cancelLocalRequest} className="rounded-md bg-white/10 p-1.5 text-white hover:bg-rose-400">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {fullscreenOverlay && (
        <>
          {isFullscreen && (
            <div className={`pointer-events-none absolute right-3 top-3 z-30 hidden w-[min(340px,32vw)] transition duration-300 md:block ${controlsVisible || activeCP ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"}`}>
              <div className="pointer-events-auto">{fullscreenOverlay}</div>
            </div>
          )}
          {pipContainer && createPortal(fullscreenOverlay, pipContainer)}
        </>
      )}

      {/* Interactive Choice Overlay */}
      {choiceOverlay && (
        pipChoiceContainer
          ? createPortal(<div className="pointer-events-auto relative h-full w-full">{choiceOverlay}</div>, pipChoiceContainer)
          : choiceOverlay
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
        className={`absolute inset-x-0 bottom-0 z-[60] space-y-2 p-3 transition-all duration-300 sm:p-4 ${!activeCP && (controlsVisible) ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
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
            {(pendingRequests || []).filter((r) => r.type === "seek").map((req) => {
              const reqProgress = duration ? ((req.time ?? 0) / duration) * 100 : 0;
              return (
                <div key={req.id} className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,.85)] group-hover/timeline:z-50" style={{ left: `${reqProgress}%` }}>
                  <div className="absolute bottom-5 left-1/2 hidden w-44 -translate-x-1/2 rounded-md border border-amber-300/25 bg-black/75 p-2 text-xs text-amber-50 shadow-xl backdrop-blur-xl hover:block group-hover/timeline:block sm:w-52">
                    <p className="font-bold">{req.guestName} requests {formatTime(req.time ?? 0)}</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={(event) => { event.stopPropagation(); onRespondRequest?.(req.id, true); }} className="rounded-md bg-emerald-400 p-1.5 text-slate-950"><Check size={14} /></button>
                      <button onClick={(event) => { event.stopPropagation(); onRespondRequest?.(req.id, false); }} className="rounded-md bg-rose-400 p-1.5 text-white"><X size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {localRequest?.type === "seek" && (
              <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,.85)]" style={{ left: `${duration ? ((localRequest.time ?? 0) / duration) * 100 : 0}%` }}>
                <div className="absolute bottom-5 left-1/2 w-44 -translate-x-1/2 rounded-md border border-amber-300/25 bg-black/75 p-2 text-xs text-amber-50 shadow-xl backdrop-blur-xl sm:w-52">
                  <p className="font-bold">You requested {formatTime(localRequest.time ?? 0)}</p>
                  <button onClick={cancelLocalRequest} className="mt-2 rounded-md bg-white/10 p-1.5 text-white hover:bg-rose-400">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
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

          {pictureInPictureSupported && (
            <button
              type="button"
              onClick={togglePictureInPicture}
              className="shrink-0 rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors"
              title={isPictureInPicture ? "Close mini player" : "Mini player"}
            >
              <PictureInPicture2 size={18} className={isPictureInPicture ? "text-amber-300" : undefined} />
            </button>
          )}

          {/* Fullscreen */}
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="shrink-0 rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
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
