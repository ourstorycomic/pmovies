"use client";

import Hls from "hls.js";
import { Check, Flag, Loader2, Maximize, Minimize, Pause, PictureInPicture2, Play, Settings2, Volume2, VolumeX, X, LightbulbOff, Lightbulb, Subtitles, Zap, RotateCcw, RotateCw, ShieldAlert, Move } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cleanSubtitleMojibake } from "@/lib/subtitles";

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
  resumeMetadata,
  introStart = 0,
  introEnd = 0,
  outroStart = 0,
  requestResolutionKey,
  fullscreenOverlay,
  nextEpisodeUrl,
  imdbId,
  movieTitle,
  year,
  isSeries,
  season,
  episode,
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
  resumeMetadata?: any;
  introStart?: number;
  introEnd?: number;
  outroStart?: number;
  requestResolutionKey?: string;
  fullscreenOverlay?: ReactNode;
  nextEpisodeUrl?: string;
  imdbId?: string;
  movieTitle?: string;
  year?: string | number;
  isSeries?: boolean;
  season?: number;
  episode?: number;
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
  
  const [isAutoSkipEnabled, setIsAutoSkipEnabled] = useState(true);
  const [skipToast, setSkipToast] = useState<string | null>(null);
  const skipToastTimerRef = useRef<number | null>(null);

  const [availableSubs, setAvailableSubs] = useState<Array<{ id: string; lang: string; code: string; fileName: string; displayName?: string; releaseTag?: string; url: string }>>([]);
  const [selectedSubUrl, setSelectedSubUrl] = useState<string>("");
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [maskHardsub, setMaskHardsub] = useState(false);
  const [subPosition, setSubPosition] = useState<"bottom" | "overlay" | "top">("bottom");
  const [subXPercent, setSubXPercent] = useState<number>(50);
  const [subBottomPercent, setSubBottomPercent] = useState<number>(8);
  const [subFontSize, setSubFontSize] = useState<number>(18);
  const [subOffset, setSubOffset] = useState(0);
  const [subToast, setSubToast] = useState<string | null>(null);
  const subToastTimerRef = useRef<number | null>(null);

  const updateSubOffset = (newOffset: number) => {
    const clamped = Math.max(-40, Math.min(60, Number(newOffset) || 0));
    setSubOffset(clamped);
    if (resumeKey) {
      try {
        if (clamped === 0) {
          localStorage.removeItem(`pmovies_sub_offset:${resumeKey}`);
        } else {
          localStorage.setItem(`pmovies_sub_offset:${resumeKey}`, String(clamped));
        }
      } catch {}
    }
    const formatted = clamped > 0 ? `+${clamped.toFixed(1)}s` : `${clamped.toFixed(1)}s`;
    setSubToast(`Đồng bộ phụ đề: ${formatted}`);
    if (subToastTimerRef.current) window.clearTimeout(subToastTimerRef.current);
    subToastTimerRef.current = window.setTimeout(() => setSubToast(null), 1800);
  };

  const [cues, setCues] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [activeCueText, setActiveCueText] = useState<string>("");
  const [isDraggingSub, setIsDraggingSub] = useState(false);
  const [showSyncPicker, setShowSyncPicker] = useState(false);

  const [maskAdBanner, setMaskAdBanner] = useState(false);
  const [adBannerPos, setAdBannerPos] = useState<"top" | "bottom">("top");
  const [adBannerHeight, setAdBannerHeight] = useState<number>(55);
  const [adBannerBlur, setAdBannerBlur] = useState<"black" | "blur">("black");

  const subWrapperRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSubRef = useRef(false);
  const startDragXRef = useRef(0);
  const startDragYRef = useRef(0);
  const startXPercentRef = useRef(50);
  const startBottomPercentRef = useRef(8);
  const currentXPercentRef = useRef(50);
  const currentBottomPercentRef = useRef(8);
  const rafSubDragRef = useRef<number | null>(null);

  const handleSubPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingSubRef.current = true;
    setIsDraggingSub(true);
    startDragXRef.current = e.clientX;
    startDragYRef.current = e.clientY;
    startXPercentRef.current = subXPercent;
    startBottomPercentRef.current = subBottomPercent;
    currentXPercentRef.current = subXPercent;
    currentBottomPercentRef.current = subBottomPercent;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSubPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSubRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.clientWidth || 800;
    const containerHeight = container.clientHeight || 500;

    const deltaX = e.clientX - startDragXRef.current;
    const deltaXPercent = (deltaX / containerWidth) * 100;
    const nextX = Math.max(10, Math.min(90, Math.round((startXPercentRef.current + deltaXPercent) * 10) / 10));

    const deltaY = startDragYRef.current - e.clientY;
    const deltaYPercent = (deltaY / containerHeight) * 100;
    const nextY = Math.max(2, Math.min(88, Math.round((startBottomPercentRef.current + deltaYPercent) * 10) / 10));

    currentXPercentRef.current = nextX;
    currentBottomPercentRef.current = nextY;

    // Direct hardware-accelerated movement via RAF - zero React re-render lags!
    if (rafSubDragRef.current === null) {
      rafSubDragRef.current = requestAnimationFrame(() => {
        if (subWrapperRef.current) {
          subWrapperRef.current.style.left = `${currentXPercentRef.current}%`;
          subWrapperRef.current.style.bottom = `${currentBottomPercentRef.current}%`;
        }
        rafSubDragRef.current = null;
      });
    }
  };

  const handleSubPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSubRef.current) {
      isDraggingSubRef.current = false;
      setIsDraggingSub(false);
      if (rafSubDragRef.current) {
        cancelAnimationFrame(rafSubDragRef.current);
        rafSubDragRef.current = null;
      }
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      const finalX = currentXPercentRef.current;
      const finalY = currentBottomPercentRef.current;
      setSubXPercent(finalX);
      setSubBottomPercent(finalY);
      localStorage.setItem("pmovies_sub_x_percent", String(finalX));
      localStorage.setItem("pmovies_sub_bottom_percent", String(finalY));
    }
  };

  useEffect(() => {
    try {
      const savedAutoSkip = localStorage.getItem("pmovies_auto_skip_ads");
      if (savedAutoSkip !== null) {
        setIsAutoSkipEnabled(savedAutoSkip === "true");
      }
      const savedMask = localStorage.getItem("pmovies_mask_hardsub");
      if (savedMask !== null) {
        setMaskHardsub(savedMask === "true");
      }
      const savedPos = localStorage.getItem("pmovies_sub_position");
      if (savedPos === "bottom" || savedPos === "overlay" || savedPos === "top") {
        setSubPosition(savedPos);
      }
      const savedX = localStorage.getItem("pmovies_sub_x_percent");
      if (savedX !== null) {
        const val = Number(savedX);
        if (!isNaN(val) && val >= 5 && val <= 95) setSubXPercent(val);
      }
      const savedBottom = localStorage.getItem("pmovies_sub_bottom_percent");
      if (savedBottom !== null) {
        const val = Number(savedBottom);
        if (!isNaN(val) && val >= 2 && val <= 88) setSubBottomPercent(val);
      }
      const savedSize = localStorage.getItem("pmovies_sub_font_size");
      if (savedSize !== null) {
        const val = Number(savedSize);
        if (!isNaN(val) && val >= 12 && val <= 48) setSubFontSize(val);
      }
      const savedAdMask = localStorage.getItem("pmovies_mask_ad_banner");
      if (savedAdMask !== null) setMaskAdBanner(savedAdMask === "true");
      const savedAdPos = localStorage.getItem("pmovies_ad_banner_pos");
      if (savedAdPos === "top" || savedAdPos === "bottom") setAdBannerPos(savedAdPos);
      const savedAdHeight = localStorage.getItem("pmovies_ad_banner_height");
      if (savedAdHeight !== null) {
        const val = Number(savedAdHeight);
        if (!isNaN(val) && val >= 30 && val <= 140) setAdBannerHeight(val);
      }
      const savedAdBlur = localStorage.getItem("pmovies_ad_banner_blur");
      if (savedAdBlur === "black" || savedAdBlur === "blur") setAdBannerBlur(savedAdBlur);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (!resumeKey) return;
    try {
      const savedOffset = localStorage.getItem(`pmovies_sub_offset:${resumeKey}`);
      if (savedOffset !== null) {
        const val = Number(savedOffset);
        // If saved offset is unreasonably extreme (e.g. < -40s or > 90s, likely accidental misclick), reset to 0
        if (!isNaN(val) && val >= -40 && val <= 90) {
          setSubOffset(val);
        } else {
          setSubOffset(0);
          localStorage.removeItem(`pmovies_sub_offset:${resumeKey}`);
        }
      } else {
        setSubOffset(0);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [resumeKey]);

  const [detectedAds, setDetectedAds] = useState<{ start: number, end: number }[]>([]);
  const [theaterMode, setTheaterMode] = useState(false);

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
      
      const updateDetectedAds = () => {
        if (!hls) return;
        const details = hls.levels?.[hls.currentLevel]?.details;
        if (!details) return;
        const fragments = details.fragments;
        if (!fragments || fragments.length === 0) return;
        
        let blocks = [];
        let currentBlock = { start: fragments[0].start, duration: 0 };
        let lastCC = fragments[0].cc;
        
        for (const frag of fragments) {
          if (frag.cc !== lastCC) {
            currentBlock.duration = frag.start - currentBlock.start;
            blocks.push({ start: currentBlock.start, end: frag.start, duration: currentBlock.duration });
            currentBlock = { start: frag.start, duration: 0 };
            lastCC = frag.cc;
          }
        }
        const lastFrag = fragments[fragments.length - 1];
        currentBlock.duration = (lastFrag.start + (lastFrag.duration || 0)) - currentBlock.start;
        blocks.push({ start: currentBlock.start, end: currentBlock.start + currentBlock.duration, duration: currentBlock.duration });
        
        // Commercial ads inserted into HLS streams are standard clips (15s, 30s, 45s, 60s)
        // Micro-splices under 14s are intro cuts/chapter splices, not commercial ads.
        const ads = blocks.filter(b => b.duration >= 14 && b.duration <= 90);
        setDetectedAds(ads.map(a => ({ start: a.start, end: a.end })));
      };

      hls.on(Hls.Events.LEVEL_LOADED, updateDetectedAds);
      hls.on(Hls.Events.FRAG_CHANGED, updateDetectedAds);

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
          meta: resumeMetadata,
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
    if (!imdbId && !movieTitle) return;
    let isCancelled = false;
    const params = new URLSearchParams();
    if (imdbId && imdbId !== "null" && imdbId !== "undefined") params.set("imdbId", imdbId);
    if (movieTitle) params.set("title", movieTitle);
    if (year) params.set("year", String(year));
    if (isSeries) params.set("isSeries", "true");
    if (season) params.set("season", String(season));
    if (episode) params.set("episode", String(episode));

    fetch(`/api/subtitles?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.subtitles) {
          setAvailableSubs(data.subtitles);
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [imdbId, movieTitle, year, isSeries, season, episode]);

  useEffect(() => {
    if (!selectedSubUrl) {
      setCues([]);
      setActiveCueText("");
      return;
    }

    fetch(selectedSubUrl)
      .then((res) => res.text())
      .then((vttText) => {
        const parsedCues: Array<{ start: number; end: number; text: string }> = [];
        const cueRegex = /(\d{2}:\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[\.,]\d{3})[^\r\n]*\r?\n([\s\S]*?)(?=\r?\n\r?\n|$)/g;

        function parseSec(timeStr: string) {
          const [hms, ms] = timeStr.replace(",", ".").split(".");
          const [h, m, s] = hms.split(":").map(Number);
          return h * 3600 + m * 60 + s + Number(ms || 0) / 1000;
        }

        let match;
        while ((match = cueRegex.exec(vttText)) !== null) {
          const start = parseSec(match[1]);
          const end = parseSec(match[2]);
          const rawText = match[3]
            .replace(/<[^>]+>/g, "")
            .trim();
          if (rawText) {
            parsedCues.push({ start, end, text: cleanSubtitleMojibake(rawText) });
          }
        }
        setCues(parsedCues);
      })
      .catch(() => setCues([]));
  }, [selectedSubUrl]);

  useEffect(() => {
    if (cues.length === 0) {
      setActiveCueText("");
      return;
    }
    // If user is currently watching inside an ad block, don't show movie dialogue
    const inAd = detectedAds.some((ad) => currentTime >= ad.start && currentTime < ad.end);
    if (inAd) {
      setActiveCueText("");
      return;
    }

    // Auto-compensate for ad blocks that played before currentTime
    const autoAdOffset = detectedAds
      .filter((ad) => currentTime >= ad.end)
      .reduce((acc, ad) => acc + (ad.end - ad.start), 0);

    const adjustedTime = currentTime - autoAdOffset - subOffset;
    const current = cues.find((c) => adjustedTime >= c.start && adjustedTime <= c.end);
    setActiveCueText(current ? current.text : "");
  }, [currentTime, cues, subOffset, detectedAds]);

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

  function handleTimelineTouch(event: React.TouchEvent<HTMLDivElement>) {
    if (!event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    seekTo(percent * (duration || 0));
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

  async function toggleTheaterMode() {
    setTheaterMode(t => !t);
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
    const _currentAd = detectedAds.find(ad => currentTime >= ad.start && currentTime < ad.end);
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

  const handleKeyDownRef = useRef({ togglePlay, showControlsTemporarily, seekTo, seekFlashTimerRef, setSeekFlash, duration, currentTime, videoRef, selectedSubUrl, subOffset, updateSubOffset });
  handleKeyDownRef.current = { togglePlay, showControlsTemporarily, seekTo, seekFlashTimerRef, setSeekFlash, duration, currentTime, videoRef, selectedSubUrl, subOffset, updateSubOffset };

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
      if (
        handleKeyDownRef.current.selectedSubUrl &&
        (e.code === "BracketLeft" || e.code === "BracketRight" || e.code === "Backslash")
      ) {
        e.preventDefault();
        const { subOffset: curOffset, updateSubOffset: updateOffset } = handleKeyDownRef.current;
        if (e.code === "BracketLeft") {
          const step = e.shiftKey ? 2.0 : 0.5;
          updateOffset(Number((curOffset - step).toFixed(1)));
        } else if (e.code === "BracketRight") {
          const step = e.shiftKey ? 2.0 : 0.5;
          updateOffset(Number((curOffset + step).toFixed(1)));
        } else if (e.code === "Backslash") {
          updateOffset(0);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const shownRequest = visibleRequest();
  const requestProgress = shownRequest?.type === "seek" && duration ? ((shownRequest.time ?? 0) / duration) * 100 : null;
  const showSkipIntro = introEnd > introStart && currentTime >= Math.max(0, introStart - 1) && currentTime < introEnd - 4;
  
  // Show Next Episode if current time is past outroStart (if available), OR in the last 90 seconds.
  const isOutro = outroStart && outroStart > 0 ? currentTime >= Math.max(0, outroStart - 1) : duration > 300 && currentTime >= duration - 90;
  const showNextEpisode = !!nextEpisodeUrl && isOutro;
  
  // Use detected ads if available
  const activeAds = detectedAds;
  
  const currentAd = activeAds.find(ad => currentTime >= ad.start && currentTime < ad.end);
  const isSkipVisible = !!currentAd || (currentTime >= introStart && currentTime < introEnd);

  useEffect(() => {
    if (!isAutoSkipEnabled || !currentAd || locked) return;
    // Auto seek only if we are still inside the ad
    const video = videoRef.current;
    if (video && video.currentTime >= currentAd.start && video.currentTime < currentAd.end) {
      seekTo(currentAd.end + 0.3);
      setSkipToast(`⚡ Đã tự động bỏ qua quảng cáo (${Math.max(1, Math.round(currentAd.end - currentAd.start))}s)`);
      if (skipToastTimerRef.current) window.clearTimeout(skipToastTimerRef.current);
      skipToastTimerRef.current = window.setTimeout(() => setSkipToast(null), 3000);
    }
  }, [currentAd, isAutoSkipEnabled, locked]);

  return (
    <>
      {theaterMode && (
        <div 
          className="fixed inset-0 z-40 bg-black/95 transition-opacity" 
          onClick={() => setTheaterMode(false)}
        />
      )}
      <div
        ref={containerRef}
        onMouseMove={showControlsTemporarily}
        onMouseEnter={showControlsTemporarily}
        onTouchStart={showControlsTemporarily}
        className={`pmovies-player group relative aspect-video overflow-hidden rounded-md bg-black shadow-2xl shadow-black/60 ${theaterMode ? "z-50" : ""} ${controlsVisible ? "cursor-auto" : "cursor-none"}`}
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
        {showNextEpisode && nextEpisodeUrl && (
          <Link
            href={nextEpisodeUrl}
            className="flex items-center justify-center rounded-md border border-emerald-300/30 bg-black/70 px-3 py-2 text-xs font-bold text-emerald-100 shadow-xl backdrop-blur-xl hover:bg-emerald-400 hover:text-slate-950 sm:px-4 sm:text-sm"
          >
            Chuyển tập tiếp theo
          </Link>
        )}
        {currentAd && !isAutoSkipEnabled && (
          <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-right-5">
            <button
              type="button"
              onClick={() => seekTo(currentAd.end)}
              className="rounded-md border border-amber-300/30 bg-black/70 px-3 py-2 text-xs font-bold text-amber-100 shadow-xl backdrop-blur-xl hover:bg-amber-400 hover:text-slate-950 sm:px-4 sm:text-sm"
            >
              Bỏ qua QC (+{(currentAd.end - currentAd.start).toFixed(0)}s)
            </button>
          </div>
        )}
      </div>

      {skipToast && (
        <div className="pointer-events-none absolute left-3 top-3 z-40 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-black/85 px-3 py-2 text-xs font-bold text-amber-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 sm:left-4 sm:top-4 sm:px-4 sm:py-2.5 sm:text-sm">
          <Zap size={16} className="text-amber-400 fill-amber-400 animate-pulse shrink-0" />
          <span>{skipToast}</span>
        </div>
      )}

      {subToast && (
        <div className={`pointer-events-none absolute z-40 flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-black/85 px-3 py-2 text-xs font-bold text-cyan-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 sm:px-4 sm:py-2.5 sm:text-sm ${skipToast ? "left-3 top-14 sm:left-4 sm:top-16" : "left-3 top-3 sm:left-4 sm:top-4"}`}>
          <Subtitles size={16} className="text-cyan-400 shrink-0" />
          <span>{subToast}</span>
        </div>
      )}

      {maskAdBanner && (
        <div
          style={{ height: `${adBannerHeight}px` }}
          className={`pointer-events-none absolute inset-x-0 z-15 transition-all duration-200 ${
            adBannerPos === "top" ? "top-0" : "bottom-0"
          } ${
            adBannerBlur === "blur"
              ? "backdrop-blur-xl bg-black/65 border-y border-white/10"
              : "bg-black/95 border-y border-white/15"
          }`}
        >
          <div className="flex h-full items-center justify-center">
            <span className="text-[10px] font-bold tracking-widest text-slate-500/50 uppercase select-none">
              Dải che quảng cáo (Ad Shield Active)
            </span>
          </div>
        </div>
      )}

      {(activeCueText || (isSubMenuOpen && selectedSubUrl)) && (
        <div
          ref={subWrapperRef}
          style={{
            left: `${subXPercent}%`,
            bottom: `${subBottomPercent}%`,
            transform: "translateX(-50%)",
          }}
          className={`pointer-events-none absolute z-25 flex justify-center w-max max-w-[94%] sm:max-w-4xl ${
            isDraggingSub ? "transition-none pointer-events-auto" : "transition-[left,bottom] duration-150 ease-out"
          }`}
        >
          <div
            onPointerDown={handleSubPointerDown}
            onPointerMove={handleSubPointerMove}
            onPointerUp={handleSubPointerUp}
            onPointerCancel={handleSubPointerUp}
            style={{ fontSize: `${subFontSize}px`, lineHeight: 1.35 }}
            className={`group/sub relative pointer-events-auto text-center font-medium tracking-wide select-none cursor-move touch-none active:scale-[1.02] ${
              isDraggingSub ? "ring-2 ring-cyan-400 bg-black/95 shadow-[0_0_30px_rgba(34,211,238,0.6)]" : ""
            } ${
              maskHardsub
                ? "rounded-lg bg-black/95 px-4 py-1.5 sm:px-5 sm:py-2 text-yellow-300 shadow-2xl ring-1 ring-white/10"
                : "rounded-md px-3 py-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_4px_rgb(0_0_0_/_90%),_0_2px_8px_rgb(0_0_0_/_80%)] hover:bg-black/50 hover:ring-1 hover:ring-cyan-400/50"
            }`}
            title="Nhấn giữ chuột hoặc ngón tay để kéo tự do (lên/xuống/trái/phải)"
          >
            {activeCueText ? (
              activeCueText.split("\n").map((line, idx) => (
                <p key={idx}>{line}</p>
              ))
            ) : (
              <div className="flex flex-col items-center gap-1 py-0.5">
                <span className="rounded bg-cyan-400 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950 uppercase tracking-wider shadow">
                  Khung xem trước kéo thả
                </span>
                <p className="text-xs sm:text-sm text-yellow-300 font-semibold">
                  (Bấm Phát video - Phụ đề sẽ tự động hiện khi có lời thoại)
                </p>
              </div>
            )}
            <div
              className={`pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 transition rounded-full bg-cyan-400 px-2 py-0.5 text-[9px] font-bold text-slate-950 shadow flex items-center gap-1 whitespace-nowrap ${
                isDraggingSub ? "opacity-100 scale-105" : "opacity-0 group-hover/sub:opacity-100"
              }`}
            >
              <Move size={10} /> X: {Math.round(subXPercent)}% | Y: {Math.round(subBottomPercent)}%
            </div>
          </div>
        </div>
      )}

      {controlsVisible && (
        <div className="pointer-events-none absolute inset-0 z-25 flex items-center justify-center gap-6 sm:hidden">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); seekTo(Math.max(0, currentTime - 10)); }}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md active:scale-90 transition"
            aria-label="Tua lại 10 giây"
          >
            <RotateCcw size={20} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.6)] active:scale-90 transition"
            aria-label={paused ? "Phát video" : "Tạm dừng"}
          >
            {paused ? <Play size={26} className="ml-0.5 fill-slate-950" /> : <Pause size={26} className="fill-slate-950" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); seekTo(Math.min(duration || 0, currentTime + 10)); }}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md active:scale-90 transition"
            aria-label="Tua tới 10 giây"
          >
            <RotateCw size={20} />
          </button>
        </div>
      )}

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
           onTouchStart={handleTimelineTouch}
           onTouchMove={handleTimelineTouch}
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
            {activeAds.map((ad, i) => (
              <div key={`ad-${i}`} className="absolute bottom-0 top-0 bg-yellow-400/50 pointer-events-none" style={{ left: `${(ad.start / duration) * 100}%`, width: `${((ad.end - ad.start) / duration) * 100}%` }} />
            ))}
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
          <input 
            type="range" 
            min={0} 
            max={1} 
            step={0.02} 
            value={muted ? 0 : volume} 
            onChange={(event) => changeVolume(Number(event.target.value))} 
            style={{
              ["--slider-bg" as any]: `linear-gradient(to right, #67e8f9 0%, #67e8f9 ${muted ? 0 : Math.round(volume * 100)}%, rgba(255, 255, 255, 0.2) ${muted ? 0 : Math.round(volume * 100)}%, rgba(255, 255, 255, 0.2) 100%)`
            }}
            className="pmovies-range hidden w-20 sm:block lg:w-24" 
            aria-label="Âm lượng"
          />
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
            <button type="button" onClick={togglePictureInPicture} className="hidden sm:block shrink-0 rounded-md bg-white/10 p-2 hover:bg-white/20" title={isPictureInPicture ? "Close mini player" : "Mini player"}>
              <PictureInPicture2 size={18} className={isPictureInPicture ? "text-cyan-200" : undefined} />
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            <button 
              type="button" 
              onClick={() => {
                setIsAutoSkipEnabled((prev) => {
                  const next = !prev;
                  localStorage.setItem("pmovies_auto_skip_ads", String(next));
                  return next;
                });
              }} 
              className={`shrink-0 rounded-md p-2 transition ${isAutoSkipEnabled ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}
              title={isAutoSkipEnabled ? "Tự động tua quảng cáo: Đang BẬT" : "Tự động tua quảng cáo: Đang TẮT"}
            >
              <Zap size={18} className={isAutoSkipEnabled ? "fill-amber-300" : ""} />
            </button>

            {selectedSubUrl && (() => {
              const currentAutoAd = detectedAds
                .filter((ad) => currentTime >= ad.end)
                .reduce((acc, ad) => acc + (ad.end - ad.start), 0);
              
              if (subOffset !== 0) {
                return (
                  <button
                    type="button"
                    onClick={() => updateSubOffset(0)}
                    className="shrink-0 rounded-md px-2 py-1.5 text-[11px] font-bold border transition flex items-center gap-1 bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-sm hover:bg-amber-400/30 active:scale-95"
                    title="Bấm để ĐẶT LẠI VỀ 0s và BẬT TỰ ĐỘNG SYNC"
                  >
                    <RotateCcw size={12} />
                    <span>Đặt lại 0s ({subOffset > 0 ? `+${subOffset}s` : `${subOffset}s`})</span>
                  </button>
                );
              }

              if (currentAutoAd > 0) {
                return (
                  <span
                    className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 flex items-center gap-1 shadow-sm"
                    title={`Hệ thống đang tự động bù ${Math.round(currentAutoAd)}s quảng cáo cho phụ đề`}
                  >
                    <Zap size={11} className="fill-emerald-400 text-emerald-400" />
                    <span>Auto Sync ({Math.round(currentAutoAd)}s)</span>
                  </span>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => updateSubOffset(30)}
                  className="shrink-0 rounded-md px-2 py-1.5 text-[11px] font-bold border transition flex items-center gap-1 bg-white/10 text-slate-300 border-white/10 hover:bg-white/20 hover:text-white active:scale-95"
                  title="Bấm 1-click để bù 30s quảng cáo chèn phim"
                >
                  <Zap size={12} className="fill-amber-300 text-amber-300" />
                  <span>+30s QC</span>
                </button>
              );
            })()}

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSubMenuOpen((v) => !v)}
                className={`shrink-0 rounded-md p-2 transition ${selectedSubUrl ? "bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-400/40" : "bg-white/10 text-white hover:bg-white/20"}`}
                title="Cài đặt phụ đề (Subtitles)"
              >
                <Subtitles size={18} />
              </button>

              {isSubMenuOpen && (
                <div 
                  className="absolute bottom-full mb-3 right-0 z-50 w-64 sm:w-72 max-w-[calc(100vw-32px)] max-h-[320px] overflow-y-auto rounded-xl border border-white/15 bg-slate-950/95 p-3.5 text-white shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 text-xs space-y-2.5 custom-scrollbar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                      <Subtitles size={14} className="text-cyan-400" /> Cài đặt phụ đề
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setIsSubMenuOpen(false)}
                      className="rounded p-1 hover:bg-white/10 text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div>
                    <select 
                      value={selectedSubUrl} 
                      onChange={(e) => setSelectedSubUrl(e.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/80 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    >
                      <option value="">Tắt phụ đề (Off)</option>
                      {Object.entries(
                        availableSubs.reduce<Record<string, typeof availableSubs>>((acc, sub) => {
                          (acc[sub.lang] = acc[sub.lang] || []).push(sub);
                          return acc;
                        }, {})
                      ).map(([langName, subs]) => (
                        <optgroup key={langName} label={langName} className="bg-slate-900 text-cyan-300 font-bold">
                          {subs.map((sub) => (
                            <option key={sub.id} value={sub.url} className="text-white bg-slate-950 font-normal">
                              {sub.displayName || `${sub.lang} - ${sub.fileName}`}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {selectedSubUrl && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Cỡ chữ</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(12, subFontSize - 2);
                              setSubFontSize(next);
                              localStorage.setItem("pmovies_sub_font_size", String(next));
                            }}
                            className="h-6 w-6 rounded bg-white/10 font-bold hover:bg-white/20 flex items-center justify-center text-slate-200 text-sm"
                            title="Thu nhỏ"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-mono font-bold text-cyan-300">{subFontSize}px</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(44, subFontSize + 2);
                              setSubFontSize(next);
                              localStorage.setItem("pmovies_sub_font_size", String(next));
                            }}
                            className="h-6 w-6 rounded bg-white/10 font-bold hover:bg-white/20 flex items-center justify-center text-slate-200 text-sm"
                            title="Phóng to"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg bg-white/5 p-2.5 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-medium">Lệch giờ (Sync)</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.5"
                              value={subOffset}
                              onChange={(e) => updateSubOffset(Number(e.target.value) || 0)}
                              className="w-16 rounded bg-black/80 border border-cyan-400/40 text-center font-mono text-cyan-300 font-bold px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
                              title="Nhập số giây trực tiếp (ví dụ: 30 hoặc -15)"
                            />
                            <span className="text-slate-400 text-[10px]">giây</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => updateSubOffset(0)}
                          className="w-full py-1.5 text-[11px] font-bold rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/35 flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm"
                          title="Bấm để kích hoạt tính năng tự động dò và bù giờ quảng cáo thông minh"
                        >
                          <Zap size={13} className="fill-emerald-400 text-emerald-400 animate-pulse" />
                          <span>Bật Tự Động Nhận Biết (Auto-Sync)</span>
                        </button>

                        <div className="space-y-1">
                          <div className="grid grid-cols-5 gap-1 text-[11px] font-semibold">
                            <button
                              type="button"
                              onClick={() => updateSubOffset(Number((subOffset - 2).toFixed(1)))}
                              className="rounded bg-white/10 py-1 hover:bg-white/20 text-slate-300 active:scale-95 transition"
                            >
                              -2s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSubOffset(Number((subOffset - 0.5).toFixed(1)))}
                              className="rounded bg-white/10 py-1 hover:bg-white/20 text-slate-300 active:scale-95 transition"
                            >
                              -0.5s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSubOffset(0)}
                              className="rounded bg-cyan-500/20 py-1 hover:bg-cyan-500/30 text-cyan-300 font-bold active:scale-95 transition"
                            >
                              0s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSubOffset(Number((subOffset + 0.5).toFixed(1)))}
                              className="rounded bg-white/10 py-1 hover:bg-white/20 text-slate-300 active:scale-95 transition"
                            >
                              +0.5s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSubOffset(Number((subOffset + 2).toFixed(1)))}
                              className="rounded bg-white/10 py-1 hover:bg-white/20 text-slate-300 active:scale-95 transition"
                            >
                              +2s
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-1 text-[10px] font-bold text-amber-300/90">
                            <button
                              type="button"
                              onClick={() => updateSubOffset(Number((subOffset - 30).toFixed(1)))}
                              className="rounded bg-amber-400/10 py-0.5 hover:bg-amber-400/20 active:scale-95 transition"
                              title="Tua lùi 30 giây (quảng cáo đầu phim)"
                            >
                              -30s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSubOffset(Number((subOffset - 10).toFixed(1)))}
                              className="rounded bg-amber-400/10 py-0.5 hover:bg-amber-400/20 active:scale-95 transition"
                            >
                              -10s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSubOffset(Number((subOffset + 10).toFixed(1)))}
                              className="rounded bg-amber-400/10 py-0.5 hover:bg-amber-400/20 active:scale-95 transition"
                            >
                              +10s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSubOffset(Number((subOffset + 30).toFixed(1)))}
                              className="rounded bg-amber-400/10 py-0.5 hover:bg-amber-400/20 active:scale-95 transition"
                              title="Tua tới 30 giây (quảng cáo đầu phim)"
                            >
                              +30s
                            </button>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setShowSyncPicker((v) => !v)}
                            className="w-full rounded-md bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 py-1.5 px-2 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/30 flex items-center justify-center gap-1.5 transition active:scale-98"
                          >
                            🎯 Tự động khớp theo câu bạn vừa nghe
                          </button>

                          {showSyncPicker && (
                            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto rounded-lg border border-white/15 bg-black/95 p-2 shadow-inner custom-scrollbar">
                              <p className="text-[10px] text-amber-200 font-semibold pb-1 border-b border-white/10">
                                Bấm vào câu thoại nhân vật vừa nói trên phim:
                              </p>
                              {(() => {
                                const autoAd = detectedAds
                                  .filter((ad) => currentTime >= ad.end)
                                  .reduce((acc, ad) => acc + (ad.end - ad.start), 0);
                                const curSubTime = currentTime - autoAd - subOffset;
                                const nearby = cues
                                  .filter((c) => Math.abs(c.start - curSubTime) <= 30)
                                  .slice(0, 8);
                                if (nearby.length === 0) {
                                  return (
                                    <p className="text-[10px] text-slate-500 italic p-1">
                                      Không tìm thấy câu thoại gần giây này ({formatTime(currentTime)})
                                    </p>
                                  );
                                }
                                return nearby.map((c, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      const autoOffset = Number((currentTime - autoAd - c.start).toFixed(1));
                                      updateSubOffset(autoOffset);
                                      setShowSyncPicker(false);
                                    }}
                                    className="w-full text-left rounded p-1.5 hover:bg-cyan-500/25 text-[11px] text-slate-200 hover:text-cyan-200 border border-transparent hover:border-cyan-400/30 transition flex flex-col gap-0.5"
                                  >
                                    <span className="text-[9px] text-cyan-400 font-mono font-bold">[{formatTime(c.start)}]</span>
                                    <span className="line-clamp-2 leading-tight">{c.text}</span>
                                  </button>
                                ));
                              })()}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                          <span>Phím: <kbd className="rounded bg-white/10 px-1 font-mono text-cyan-300">[</kbd> lùi / <kbd className="rounded bg-white/10 px-1 font-mono text-cyan-300">]</kbd> tiến</span>
                          <span>(Shift + phím để nhảy 2s)</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Che sub cũ</span>
                        <button
                          type="button"
                          onClick={() => {
                            setMaskHardsub((prev) => {
                              const next = !prev;
                              localStorage.setItem("pmovies_mask_hardsub", String(next));
                              return next;
                            });
                          }}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                            maskHardsub ? "bg-amber-400 text-slate-950" : "bg-white/10 text-slate-300"
                          }`}
                        >
                          {maskHardsub ? "BẬT" : "TẮT"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Vị trí</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSubXPercent(50);
                            setSubBottomPercent(8);
                            localStorage.setItem("pmovies_sub_x_percent", "50");
                            localStorage.setItem("pmovies_sub_bottom_percent", "8");
                          }}
                          className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-white/20 hover:text-white"
                        >
                          Đặt lại giữa
                        </button>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-slate-300 flex items-center gap-1">
                      <ShieldAlert size={13} className={maskAdBanner ? "text-amber-400" : "text-slate-400"} /> Che banner QC
                    </span>
                    <div className="flex items-center gap-1.5">
                      {maskAdBanner && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = adBannerPos === "top" ? "bottom" : "top";
                            setAdBannerPos(next);
                            localStorage.setItem("pmovies_ad_banner_pos", next);
                          }}
                          className="text-[10px] text-cyan-300 bg-white/10 px-1.5 py-0.5 rounded font-semibold hover:bg-white/20"
                        >
                          {adBannerPos === "top" ? "Mép trên" : "Mép dưới"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMaskAdBanner((prev) => {
                            const next = !prev;
                            localStorage.setItem("pmovies_mask_ad_banner", String(next));
                            return next;
                          });
                        }}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                          maskAdBanner ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20" : "bg-white/10 text-slate-300 hover:bg-white/20"
                        }`}
                      >
                        {maskAdBanner ? "BẬT" : "TẮT"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={toggleTheaterMode} className="hidden sm:block shrink-0 rounded-md bg-white/10 p-2 hover:bg-white/20" title={theaterMode ? "Bật đèn" : "Tắt đèn"}>
              {theaterMode ? <Lightbulb size={18} className="text-amber-200" /> : <LightbulbOff size={18} />}
            </button>
            <button type="button" onClick={toggleFullscreen} className="shrink-0 rounded-md bg-white/10 p-2 hover:bg-white/20">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
