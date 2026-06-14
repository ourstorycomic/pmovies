"use client";

import Hls from "hls.js";
import { Check, Maximize, Minimize, Pause, PictureInPicture2, Play, Volume2, VolumeX, X } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

type PlayerRequest = {
  type: "seek" | "pause" | "play";
  time?: number;
};

export type PlayerPendingRequest = PlayerRequest & {
  id: string;
  guestName: string;
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

type PictureInPictureDocument = Document & {
  pictureInPictureElement?: Element | null;
  pictureInPictureEnabled?: boolean;
  exitPictureInPicture?: () => Promise<void>;
};

type PictureInPictureVideo = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function VideoPlayer({
  src,
  poster,
  externalRef,
  locked = false,
  onRequest,
  pendingRequest,
  onRespondRequest,
  resumeKey,
  introStart = 0,
  introEnd = 0,
  requestResolutionKey,
  fullscreenOverlay,
}: {
  src?: string;
  poster?: string;
  externalRef?: RefObject<HTMLVideoElement | null>;
  locked?: boolean;
  onRequest?: (request: PlayerRequest) => void;
  pendingRequest?: PlayerPendingRequest | null;
  onRespondRequest?: (accepted: boolean) => void;
  resumeKey?: string;
  introStart?: number;
  introEnd?: number;
  requestResolutionKey?: string;
  fullscreenOverlay?: ReactNode;
}) {
  const ownRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalRef ?? ownRef;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
  const [level, setLevel] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [localRequest, setLocalRequest] = useState<PlayerRequest | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const [streamError, setStreamError] = useState("");
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    setStreamError("");

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        startLevel: 0,
        capLevelToPlayerSize: true,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        backBufferLength: 15,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls!.levels.map((item, index) => ({ height: item.height, index })).filter((item) => item.height));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamError(data.type === Hls.ErrorTypes.NETWORK_ERROR ? "This stream is blocked or temporarily unavailable." : "This stream could not be decoded.");
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
        }
      });
    } else {
      video.src = src;
    }

    const sync = () => {
      setPaused(video.paused);
      setCurrentTime(video.currentTime || 0);
      setDuration(video.duration || 0);
      setVolume(video.volume);
      setMuted(video.muted);
      setReady(true);
    };

    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("timeupdate", sync);
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("volumechange", sync);
    video.addEventListener("durationchange", sync);
    const onEnterPictureInPicture = () => setIsPictureInPicture(true);
    const onLeavePictureInPicture = () => setIsPictureInPicture(false);

    video.addEventListener("enterpictureinpicture", onEnterPictureInPicture);
    video.addEventListener("leavepictureinpicture", onLeavePictureInPicture);

    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
      video.removeEventListener("volumechange", sync);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("enterpictureinpicture", onEnterPictureInPicture);
      video.removeEventListener("leavepictureinpicture", onLeavePictureInPicture);
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [src, videoRef]);

  useEffect(() => {
    const pipDocument = document as PictureInPictureDocument;
    queueMicrotask(() => setPictureInPictureSupported(Boolean(pipDocument.pictureInPictureEnabled)));
  }, []);

  useEffect(() => {
    if (!resumeKey) return;
    const raw = localStorage.getItem(`pmovies_resume:${resumeKey}`);
    if (!raw) return;
    const saved = JSON.parse(raw) as { time?: number; duration?: number; updated_at?: number };
    if (saved.time && saved.time > 20 && (!saved.duration || saved.time < saved.duration - 30)) {
      queueMicrotask(() => setResumeTime(saved.time!));
    }
  }, [resumeKey]);

  useEffect(() => {
    if (!resumeKey) return;
    const video = videoRef.current;
    if (!video) return;
    const resumeStorageKey = `pmovies_resume:${resumeKey}`;
    const indexKey = "pmovies_resume_index";

    const touchResumeIndex = () => {
      const raw = localStorage.getItem(indexKey);
      const items = raw ? JSON.parse(raw) as string[] : [];
      const next = [resumeStorageKey, ...items.filter((item) => item !== resumeStorageKey)].slice(0, 3);
      for (const stale of items.slice(3)) localStorage.removeItem(stale);
      localStorage.setItem(indexKey, JSON.stringify(next));
    };

    const clearResume = () => {
      localStorage.removeItem(resumeStorageKey);
      const raw = localStorage.getItem(indexKey);
      const items = raw ? JSON.parse(raw) as string[] : [];
      localStorage.setItem(indexKey, JSON.stringify(items.filter((item) => item !== resumeStorageKey)));
    };

    const timer = window.setInterval(() => {
      if (video.duration && video.currentTime > video.duration - 20) {
        clearResume();
        return;
      }
      if (video.currentTime > 5) {
        localStorage.setItem(resumeStorageKey, JSON.stringify({
          time: video.currentTime,
          duration: video.duration || 0,
          updated_at: Date.now(),
        }));
        touchResumeIndex();
      }
    }, 5000);

    video.addEventListener("ended", clearResume);
    return () => {
      window.clearInterval(timer);
      video.removeEventListener("ended", clearResume);
    };
  }, [resumeKey, videoRef]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (requestResolutionKey) queueMicrotask(() => setLocalRequest(null));
  }, [requestResolutionKey]);

  if (!src) {
    return <div className="flex aspect-video items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300 backdrop-blur-xl">No HLS stream available.</div>;
  }

  function requestOrRun(request: PlayerRequest, run: () => void) {
    if (locked) {
      setLocalRequest(request);
      onRequest?.(request);
      return;
    }
    run();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    requestOrRun({ type: video.paused ? "play" : "pause", time: video.currentTime }, () => {
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
    });
  }

  function seekTo(time: number) {
    const video = videoRef.current;
    if (!video) return;
    requestOrRun({ type: "seek", time }, () => {
      video.currentTime = time;
    });
  }

  function handleTimeline(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo(((event.clientX - rect.left) / rect.width) * (duration || 0));
  }

  function changeVolume(next: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = next;
    video.muted = next === 0;
  }

  function changeLevel(next: number) {
    setLevel(next);
    if (hlsRef.current) hlsRef.current.currentLevel = next;
  }

  function changeSpeed(next: number) {
    const video = videoRef.current;
    if (!video || locked) return;
    video.playbackRate = next;
    setSpeed(next);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await screen.orientation?.unlock?.();
        await document.exitFullscreen();
        return;
      }
      await containerRef.current?.requestFullscreen?.();
      await (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape").catch(() => undefined);
    } catch {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
  }

  async function togglePictureInPicture() {
    const video = videoRef.current as PictureInPictureVideo | null;
    const pipDocument = document as PictureInPictureDocument;
    if (!video || !pipDocument.pictureInPictureEnabled) return;

    try {
      if (pipDocument.pictureInPictureElement) {
        await pipDocument.exitPictureInPicture?.();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      await video.requestPictureInPicture?.();
    } catch {
      setIsPictureInPicture(Boolean(pipDocument.pictureInPictureElement));
    }
  }

  function showControlsTemporarily() {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2600);
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const visibleRequest = pendingRequest ?? (localRequest?.type === "seek" ? { ...localRequest, id: "local", guestName: "Request sent" } : null);
  const requestProgress = visibleRequest?.type === "seek" && duration ? ((visibleRequest.time ?? 0) / duration) * 100 : null;
  const showSkipIntro = introEnd > introStart && currentTime >= Math.max(0, introStart - 1) && currentTime < introEnd - 4;

  return (
    <div
      ref={containerRef}
      onMouseMove={showControlsTemporarily}
      onMouseEnter={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
      className={`pmovies-player group relative aspect-video overflow-hidden rounded-md bg-black shadow-2xl shadow-black/60 ${controlsVisible ? "cursor-auto" : "cursor-none"}`}
    >
      <video ref={videoRef} poster={poster} playsInline className="h-full w-full object-contain" />
      <button type="button" onClick={togglePlay} className="absolute inset-0 z-10" aria-label={locked ? "Request playback change" : "Toggle playback"} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15 opacity-100 transition" />
      {streamError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4 text-center backdrop-blur-sm">
          <div className="max-w-md rounded-md border border-rose-400/25 bg-black/75 px-4 py-3 text-sm text-rose-100 shadow-2xl">
            {streamError}
          </div>
        </div>
      )}
      {resumeTime !== null && !locked && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="rounded-md border border-white/10 bg-black/80 p-4 text-white shadow-2xl">
            <p className="font-bold">Resume from {formatTime(resumeTime)}?</p>
            <div className="mt-3 flex gap-2">
              <button className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950" onClick={() => { seekTo(resumeTime); setResumeTime(null); }}>Resume</button>
              <button className="rounded-md bg-white/10 px-3 py-2 text-sm" onClick={() => setResumeTime(null)}>Start over</button>
            </div>
          </div>
        </div>
      )}
      {pendingRequest && pendingRequest.type !== "seek" && (
        <div className="absolute inset-0 z-30 flex pointer-events-none items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-amber-300/25 bg-black/70 px-4 py-3 text-white shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="rounded-md bg-amber-300 p-2 text-slate-950">{pendingRequest.type === "play" ? <Play size={18} /> : <Pause size={18} />}</div>
            <div>
              <p className="text-sm font-bold">{pendingRequest.guestName}</p>
              <p className="text-xs text-slate-300">requests {pendingRequest.type}</p>
            </div>
            <button onClick={() => onRespondRequest?.(true)} className="rounded-md bg-emerald-400 p-2 text-slate-950"><Check size={16} /></button>
            <button onClick={() => onRespondRequest?.(false)} className="rounded-md bg-rose-400 p-2 text-white"><X size={16} /></button>
          </div>
        </div>
      )}
      {locked && localRequest && localRequest.type !== "seek" && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="rounded-md border border-amber-300/25 bg-black/70 px-4 py-3 text-amber-100 shadow-2xl backdrop-blur-xl">
            Request sent: {localRequest.type}
          </div>
        </div>
      )}
      {showSkipIntro && (
        <button
          type="button"
          onClick={() => seekTo(introEnd)}
          className="absolute bottom-20 right-3 z-30 rounded-md border border-cyan-300/30 bg-black/70 px-3 py-2 text-xs font-bold text-cyan-100 shadow-xl backdrop-blur-xl hover:bg-cyan-300 hover:text-slate-950 sm:bottom-24 sm:right-4 sm:px-4 sm:text-sm"
        >
          Skip intro
        </button>
      )}
      {fullscreenOverlay && isFullscreen && (
        <div className={`pointer-events-none absolute right-3 top-3 z-30 hidden w-[min(340px,32vw)] transition duration-300 md:block ${controlsVisible ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"}`}>
          <div className="pointer-events-auto">{fullscreenOverlay}</div>
        </div>
      )}
      <div className={`absolute inset-x-0 bottom-0 z-20 space-y-2 p-2 transition duration-300 sm:space-y-3 sm:p-4 ${controlsVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
        <div onClick={handleTimeline} className="h-7 cursor-pointer py-3 sm:h-6 sm:py-2">
          <div className="relative h-1.5 rounded-full bg-white/20">
            <div className="h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,.65)]" style={{ width: `${progress}%` }} />
            {requestProgress !== null && (
              <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,.85)]" style={{ left: `${requestProgress}%` }}>
                <div className="absolute bottom-5 left-1/2 w-44 -translate-x-1/2 rounded-md border border-amber-300/25 bg-black/75 p-2 text-xs text-amber-50 shadow-xl backdrop-blur-xl sm:w-52">
                  <p className="font-bold">{visibleRequest?.guestName} {pendingRequest ? "requests" : ""} {formatTime(visibleRequest?.time ?? 0)}</p>
                  {pendingRequest && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={(event) => { event.stopPropagation(); onRespondRequest?.(true); }} className="rounded-md bg-emerald-400 p-1.5 text-slate-950"><Check size={14} /></button>
                      <button onClick={(event) => { event.stopPropagation(); onRespondRequest?.(false); }} className="rounded-md bg-rose-400 p-1.5 text-white"><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-white sm:gap-3">
          <button type="button" onClick={togglePlay} className="shrink-0 rounded-md bg-white/10 p-2 hover:bg-cyan-300 hover:text-slate-950">
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <span className="min-w-[4.5rem] shrink-0 text-xs font-semibold sm:min-w-24 sm:text-sm">{formatTime(currentTime)} <span className="hidden sm:inline">/ {formatTime(duration)}</span></span>
          <button type="button" onClick={() => { const video = videoRef.current; if (video) video.muted = !video.muted; }} className="shrink-0 rounded-md bg-white/10 p-2 hover:bg-white/20">
            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} className="pmovies-range hidden w-20 sm:block lg:w-24" />
          {!locked && (
            <select value={speed} onChange={(event) => changeSpeed(Number(event.target.value))} className="hidden rounded-md border border-white/10 bg-black/60 px-2 py-1 text-xs sm:block sm:text-sm">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((item) => <option key={item} value={item}>{item}x</option>)}
            </select>
          )}
          <select value={level} onChange={(event) => changeLevel(Number(event.target.value))} className="min-w-0 max-w-20 rounded-md border border-white/10 bg-black/60 px-1 py-1 text-xs sm:max-w-none sm:px-2 sm:text-sm">
            <option value={-1}>Auto</option>
            {levels.map((item) => <option key={item.index} value={item.index}>{item.height}p</option>)}
          </select>
          {pictureInPictureSupported && (
            <button type="button" onClick={togglePictureInPicture} className="shrink-0 rounded-md bg-white/10 p-2 hover:bg-white/20" title={isPictureInPicture ? "Close mini player" : "Mini player"}>
              <PictureInPicture2 size={18} className={isPictureInPicture ? "text-cyan-200" : undefined} />
            </button>
          )}
          <button type="button" onClick={toggleFullscreen} className="ml-auto shrink-0 rounded-md bg-white/10 p-2 hover:bg-white/20">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
        {!ready && <p className="text-xs text-slate-300">Loading stream...</p>}
      </div>
    </div>
  );
}
