"use client";

import Hls from "hls.js";
import { Check, Flag, Loader2, Maximize, Minimize, Pause, PictureInPicture2, Play, Settings2, Volume2, VolumeX, X } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

type DocumentPictureInPictureController = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

type WindowWithDocumentPictureInPicture = Window & {
  documentPictureInPicture?: DocumentPictureInPictureController;
};

type WatchPartyVideo = HTMLVideoElement & {
  __pmoviesRemoteApplying?: boolean;
  __pmoviesHostState?: { time: number; paused: boolean };
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
  onCancelRequest,
  pendingRequests,
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
  onRequest?: (request: PlayerRequest) => string | void;
  onCancelRequest?: (requestId?: string) => void;
  pendingRequests?: PlayerPendingRequest[];
  onRespondRequest?: (requestId: string, accepted: boolean) => void;
  resumeKey?: string;
  introStart?: number;
  introEnd?: number;
  requestResolutionKey?: string;
  fullscreenOverlay?: ReactNode;
}) {
  const ownRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalRef ?? ownRef;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoSlotRef = useRef<HTMLDivElement | null>(null);
  const documentPipWindowRef = useRef<Window | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const thumbVideoRef = useRef<HTMLVideoElement | null>(null);
  const thumbHlsRef = useRef<Hls | null>(null);
  const hoverSeekTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
  const [level, setLevel] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [localRequest, setLocalRequest] = useState<(PlayerRequest & { id?: string }) | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [streamError, setStreamError] = useState("");
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [seekFlash, setSeekFlash] = useState<"back" | "forward" | null>(null);
  const seekFlashTimerRef = useRef<number | null>(null);
  
  const [isAutoSkipEnabled, setIsAutoSkipEnabled] = useState(false);
  const [adStartTimeMin, setAdStartTimeMin] = useState(15);

  const hideTimerRef = useRef<number | null>(null);
  const lastLockedStateRef = useRef({ time: 0, paused: true });
  const nativeGuardRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    setStreamError("");

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxBufferLength: 120,
        maxMaxBufferLength: 1200,
        backBufferLength: 90,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls!.levels.map((item, index) => ({ height: item.height, index })).filter((item) => item.height));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("HLS Network Error, attempting to recover...");
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("HLS Media Error, attempting to recover...");
              hls?.recoverMediaError();
              break;
            default:
              setStreamError("This stream could not be decoded.");
              hls?.destroy();
              break;
          }
        } else if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
           console.warn("HLS Buffer Stalled, waiting for network...");
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
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); sync(); };

    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("timeupdate", sync);
    video.addEventListener("play", onPlaying);
    video.addEventListener("pause", sync);
    video.addEventListener("volumechange", sync);
    video.addEventListener("durationchange", sync);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onPlaying);
    const onEnterPictureInPicture = () => setIsPictureInPicture(true);
    const onLeavePictureInPicture = () => setIsPictureInPicture(false);

    video.addEventListener("enterpictureinpicture", onEnterPictureInPicture);
    video.addEventListener("leavepictureinpicture", onLeavePictureInPicture);

    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("play", onPlaying);
      video.removeEventListener("pause", sync);
      video.removeEventListener("volumechange", sync);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onPlaying);
      video.removeEventListener("enterpictureinpicture", onEnterPictureInPicture);
      video.removeEventListener("leavepictureinpicture", onLeavePictureInPicture);
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [src, videoRef]);

  useEffect(() => {
    const pipDocument = document as PictureInPictureDocument;
    const docPip = window as WindowWithDocumentPictureInPicture;
    queueMicrotask(() => setPictureInPictureSupported(Boolean(pipDocument.pictureInPictureEnabled || docPip.documentPictureInPicture)));
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
      if (last.paused) {
        video.pause();
      } else {
        void video.play().catch(() => undefined);
      }
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
  }, [locked, onRequest, videoRef]);

  if (!src) {
    return <div className="flex aspect-video items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300 backdrop-blur-xl">No HLS stream available.</div>;
  }

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
    return (pendingRequests && pendingRequests.length > 0) ? pendingRequests[0] : (localRequest?.type === "seek" ? { ...localRequest, id: localRequest.id ?? "local", guestName: "You" } : null);
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

  function handleTimelineHover(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    setHoverPosition(percent * 100);
    setHoverTime(percent * (duration || 0));
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
        .controls { position: absolute; inset-inline: 0; bottom: 0; padding: 12px; display: grid; gap: 10px; transition: opacity .25s, transform .25s; }
        .shell.idle { cursor: none; }
        .shell.idle .controls, .shell.idle .request-card { opacity: 0; transform: translateY(10px); pointer-events: none; }
        .timeline { height: 20px; cursor: pointer; display: flex; align-items: center; }
        .track { position: relative; height: 5px; flex: 1; border-radius: 999px; background: rgba(255,255,255,.22); }
        .progress { height: 100%; width: 0%; border-radius: inherit; background: #67e8f9; box-shadow: 0 0 18px rgba(103,232,249,.65); }
        .marker { display: none; position: absolute; top: 50%; height: 17px; width: 4px; transform: translateY(-50%); border-radius: 999px; background: #fcd34d; box-shadow: 0 0 16px rgba(252,211,77,.85); }
        .bubble { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); white-space: nowrap; border: 1px solid rgba(252,211,77,.28); background: rgba(0,0,0,.78); border-radius: 8px; padding: 7px 9px; font-size: 12px; color: #fef3c7; backdrop-filter: blur(14px); }
        .row { display: flex; align-items: center; gap: 10px; }
        button { border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.1); color: white; border-radius: 8px; height: 34px; min-width: 34px; font-weight: 800; cursor: pointer; }
        select { height: 34px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.62); color: white; }
        .time { min-width: 78px; font-size: 13px; font-weight: 700; }
        .request-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none; align-items: center; gap: 10px; border: 1px solid rgba(252,211,77,.28); background: rgba(0,0,0,.72); color: #fef3c7; border-radius: 10px; padding: 10px 12px; box-shadow: 0 18px 40px rgba(0,0,0,.4); backdrop-filter: blur(16px); }
        .cancel { background: rgba(244,63,94,.78); }
        .loader { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none; color: #67e8f9; animation: spin 1s linear infinite; pointer-events: none; z-index: 10; }
        @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        .skip-btn { position: absolute; bottom: 70px; right: 16px; background: rgba(0,0,0,0.78); border: 1px solid rgba(252,211,77,0.28); color: #fef3c7; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: bold; cursor: pointer; display: none; backdrop-filter: blur(8px); transition: background 0.2s; z-index: 50; }
        .skip-btn:hover { background: rgba(0,0,0,0.9); border-color: rgba(252,211,77,0.5); }
      </style>
      <div class="shell">
        <div class="video-slot"></div>
        <div class="shade"></div>
        <button class="skip-btn skip-ad">Bỏ qua quảng cáo</button>
        <button class="skip-btn skip-intro">Skip intro</button>
        <div class="loader"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
        <div class="request-card"><span class="request-text"></span><button class="cancel">×</button></div>
        <div class="controls">
          <div class="timeline"><div class="track"><div class="progress"></div><div class="marker"><div class="bubble"></div></div></div></div>
          <div class="row"><button class="play">▶</button><span class="time">0:00</span><button class="mute">🔊</button><select class="quality"><option value="-1">Auto</option></select></div>
        </div>
      </div>
    `;

    const shell = pipWindow.document.querySelector(".shell") as HTMLElement;
    const slot = pipWindow.document.querySelector(".video-slot");
    slot?.append(video);
    video.className = "";

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
    };

    let idleTimer: number | null = null;
    const showControls = () => {
      shell.classList.remove("idle");
      if (idleTimer) pipWindow.clearTimeout(idleTimer);
      idleTimer = pipWindow.setTimeout(() => shell.classList.add("idle"), 2600);
    };
    shell.addEventListener("mousemove", showControls);
    shell.addEventListener("click", (e) => {
      showControls();
      if (e.target === shell || e.target === slot || e.target === video) {
        togglePlay();
      }
    });
    showControls();

    (pipWindow.document.querySelector(".play") as HTMLButtonElement).onclick = () => togglePlay();
    (pipWindow.document.querySelector(".mute") as HTMLButtonElement).onclick = () => { video.muted = !video.muted; };
    (pipWindow.document.querySelector(".cancel") as HTMLButtonElement).onclick = () => cancelLocalRequest();
    (pipWindow.document.querySelector(".timeline") as HTMLElement).onclick = (event) => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      seekTo(((event.clientX - rect.left) / rect.width) * (video.duration || 0));
    };
    const quality = pipWindow.document.querySelector(".quality") as HTMLSelectElement;
    quality.onchange = () => changeLevel(Number(quality.value));

    pipWindow.addEventListener("pagehide", onClose, { once: true });
    updateDocumentPictureInPictureUi();
    return true;
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
    const quality = pipWindow.document.querySelector(".quality") as HTMLSelectElement | null;
    const loader = pipWindow.document.querySelector(".loader") as HTMLElement | null;
    const skipAdBtn = pipWindow.document.querySelector(".skip-ad") as HTMLButtonElement | null;
    const skipIntroBtn = pipWindow.document.querySelector(".skip-intro") as HTMLButtonElement | null;

    const _showSkipIntro = introEnd > introStart && currentTime >= Math.max(0, introStart - 1) && currentTime < introEnd - 4;
    const adStartSec = adStartTimeMin * 60;
    const _currentAd = (currentTime >= adStartSec && currentTime < adStartSec + 30) ? { start: adStartSec, end: adStartSec + 30 } : undefined;
    const _isAdWindow = currentTime >= 840 && currentTime <= 1080;

    if (skipAdBtn) {
      skipAdBtn.style.display = _isAdWindow || _currentAd ? "block" : "none";
      if (!skipAdBtn.onclick) skipAdBtn.onclick = () => seekTo(currentTime + 30);
      if (skipAdBtn.textContent === "Bỏ qua quảng cáo") skipAdBtn.textContent = "Bỏ qua QC (+30s)";
    }
    
    if (skipIntroBtn) {
      skipIntroBtn.style.display = _showSkipIntro && !_currentAd ? "block" : "none";
      if (!skipIntroBtn.onclick) skipIntroBtn.onclick = () => seekTo(introEnd);
    }

    if (loader) loader.style.display = (!ready || buffering) && !streamError ? "block" : "none";
    if (progressEl) progressEl.style.width = `${progressValue}%`;
    if (playButton) playButton.textContent = paused ? "▶" : "Ⅱ";
    if (muteButton) muteButton.textContent = muted || volume === 0 ? "🔇" : "🔊";
    if (timeEl) timeEl.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    if (quality && quality.options.length !== levels.length + 1) {
      quality.innerHTML = `<option value="-1">Auto</option>${levels.map((item) => `<option value="${item.index}">${item.height}p</option>`).join("")}`;
      quality.value = String(level);
    }

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

  function showControlsTemporarily() {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      const active = document.activeElement;
      const isInputFocused = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable);
      // Check if focus is inside player or pip window
      const inPlayer = containerRef.current?.contains(active);
      const inPip = pipContainer?.ownerDocument?.body.contains(active);
      
      if (isInputFocused && (inPlayer || inPip)) {
        showControlsTemporarily(); // Re-trigger the timer instead of hiding
        return;
      }
      setControlsVisible(false);
    }, 2600);
  }

  const handleKeyDownRef = useRef({ togglePlay, showControlsTemporarily, seekTo, seekFlashTimerRef, setSeekFlash, duration, currentTime, videoRef });
  handleKeyDownRef.current = { togglePlay, showControlsTemporarily, seekTo, seekFlashTimerRef, setSeekFlash, duration, currentTime, videoRef };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.code === "Space") {
        if (document.activeElement?.tagName === "BUTTON") {
          (document.activeElement as HTMLElement).blur();
        }
        e.preventDefault();
        handleKeyDownRef.current.togglePlay();
        handleKeyDownRef.current.showControlsTemporarily();
      }
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault();
        const { videoRef: vRef, seekTo: seek, seekFlashTimerRef: flashTimer, setSeekFlash: flash } = handleKeyDownRef.current;
        const video = vRef.current;
        if (!video) return;
        const delta = e.code === "ArrowLeft" ? -10 : 10;
        const next = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
        seek(next);
        handleKeyDownRef.current.showControlsTemporarily();
        flash(e.code === "ArrowLeft" ? "back" : "forward");
        if (flashTimer.current) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => flash(null), 700);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const shownRequest = visibleRequest();
  const requestProgress = shownRequest?.type === "seek" && duration ? ((shownRequest.time ?? 0) / duration) * 100 : null;
  const showSkipIntro = introEnd > introStart && currentTime >= Math.max(0, introStart - 1) && currentTime < introEnd - 4;
  
  const adStartSec = adStartTimeMin * 60;
  const currentAd = (currentTime >= adStartSec && currentTime < adStartSec + 30) ? { start: adStartSec, end: adStartSec + 30 } : undefined;
  const isAdWindow = currentTime >= 840 && currentTime <= 1080;

  useEffect(() => {
    if (!isAutoSkipEnabled || !currentAd || locked) return;
    // Auto seek only if we are still inside the ad
    const video = videoRef.current;
    if (video && video.currentTime >= currentAd.start && video.currentTime < currentAd.end) {
      seekTo(currentAd.end + 0.5);
    }
  }, [currentAd, isAutoSkipEnabled, locked]);

  return (
    <div
      ref={containerRef}
      onMouseMove={showControlsTemporarily}
      onMouseEnter={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
      className={`pmovies-player group relative aspect-video overflow-hidden rounded-md bg-black shadow-2xl shadow-black/60 ${controlsVisible ? "cursor-auto" : "cursor-none"}`}
    >
      <div ref={videoSlotRef} className="absolute inset-0 z-0 flex items-center justify-center">
        <video ref={videoRef} poster={poster} playsInline className="h-full w-full object-contain" />
      </div>
      <button type="button" onClick={togglePlay} className="absolute inset-0 z-10" aria-label={locked ? "Request playback change" : "Toggle playback"} />
      {seekFlash !== null && (
        <div className="pointer-events-none absolute inset-0 z-25 flex items-center justify-center">
          <div className={`flex items-center gap-2 rounded-xl bg-black/60 px-5 py-3 text-white backdrop-blur-sm transition-opacity animate-in fade-in zoom-in-90 duration-150`}>
            <span className="text-2xl font-black">{seekFlash === "back" ? "← 10s" : "10s →"}</span>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15 opacity-100 transition" />
      {(!ready || buffering) && !streamError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-cyan-300 drop-shadow-[0_0_12px_rgba(103,232,249,0.8)]">
          <Loader2 className="h-12 w-12 animate-spin" />
        </div>
      )}
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
      <div className="absolute inset-0 z-30 flex pointer-events-none items-center justify-center flex-col gap-2">
        {(pendingRequests || []).filter(r => r.type !== "seek").map((req) => (
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
      <div className="absolute bottom-20 right-3 z-30 flex flex-col gap-2 sm:bottom-24 sm:right-4">
        {showSkipIntro && (
          <button
            type="button"
            onClick={() => seekTo(introEnd)}
            className="rounded-md border border-cyan-300/30 bg-black/70 px-3 py-2 text-xs font-bold text-cyan-100 shadow-xl backdrop-blur-xl hover:bg-cyan-300 hover:text-slate-950 sm:px-4 sm:text-sm"
          >
            Skip intro
          </button>
        )}
        {(currentAd || isAdWindow) && (
          <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-right-5">
            <button
              type="button"
              onClick={() => seekTo(currentTime + 30)}
              className="rounded-md border border-amber-300/30 bg-black/70 px-3 py-2 text-xs font-bold text-amber-100 shadow-xl backdrop-blur-xl hover:bg-amber-400 hover:text-slate-950 sm:px-4 sm:text-sm"
            >
              Bỏ qua QC (+30s)
            </button>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-white shadow-xl backdrop-blur-xl sm:px-3 sm:text-xs">
              <span className="text-slate-300">Tự động ở phút:</span>
              <select value={adStartTimeMin} onChange={(e) => setAdStartTimeMin(Number(e.target.value))} className="bg-transparent font-bold outline-none">
                <option value={15}>15</option>
                <option value={16}>16</option>
                <option value={17}>17</option>
              </select>
            </div>
          </div>
        )}
      </div>
      {fullscreenOverlay && (
        <>
          {isFullscreen && (
            <div className={`pointer-events-none absolute right-3 top-3 z-30 hidden w-[min(340px,32vw)] transition duration-300 md:block ${controlsVisible ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"}`}>
              <div className="pointer-events-auto">{fullscreenOverlay}</div>
            </div>
          )}
          {pipContainer && createPortal(fullscreenOverlay, pipContainer)}
        </>
      )}
      <div className={`absolute inset-x-0 bottom-0 z-20 space-y-2 p-2 transition duration-300 sm:space-y-3 sm:p-4 ${controlsVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
        <div 
           onClick={handleTimeline} 
           onMouseMove={handleTimelineHover}
           onMouseLeave={() => setHoverTime(null)}
           className="group/timeline relative h-7 cursor-pointer py-3 sm:h-6 sm:py-2"
        >
          <div className="relative h-1.5 rounded-full bg-white/20">
            {hoverTime !== null && (
              <div 
                 className="pointer-events-none absolute bottom-4 z-50 -translate-x-1/2 whitespace-nowrap rounded border border-white/10 bg-black/80 px-2 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md"
                 style={{ left: `${hoverPosition}%` }}
              >
                 {formatTime(hoverTime)}
              </div>
            )}
            <div className="h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,.65)]" style={{ width: `${progress}%` }} />
            {(pendingRequests || []).filter(r => r.type === "seek").map((req) => {
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
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button 
              type="button" 
              onClick={() => setIsAutoSkipEnabled(!isAutoSkipEnabled)} 
              className={`shrink-0 rounded-md p-2 transition ${isAutoSkipEnabled ? "bg-rose-500/80 text-white" : "bg-white/10 hover:bg-white/20"}`}
              title={isAutoSkipEnabled ? "Tắt tự động tua quảng cáo" : "Bật tự động tua quảng cáo"}
            >
              <Settings2 size={18} />
            </button>
            <button type="button" onClick={toggleFullscreen} className="shrink-0 rounded-md bg-white/10 p-2 hover:bg-white/20">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
