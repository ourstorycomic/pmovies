import { NextResponse } from "next/server";
import { cleanSubtitleMojibake } from "@/lib/subtitles";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

function srtToVtt(srt: string): string {
  const cleaned = cleanSubtitleMojibake(srt);
  const normalized = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const withDots = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${withDots}`;
}

async function resolveImdbId(title: string, year?: string | number | null, isSeries?: boolean): Promise<string | null> {
  try {
    const cleanTitle = title
      .replace(/\([^)]*\)/g, "")
      .replace(/phần \d+/i, "")
      .replace(/season \d+/i, "")
      .trim();

    const searchCandidates = [cleanTitle];
    if (cleanTitle.includes(":")) {
      const part = cleanTitle.split(":")[0].trim();
      if (part.length >= 3) searchCandidates.push(part);
    }
    if (cleanTitle.includes("-")) {
      const part = cleanTitle.split("-")[0].trim();
      if (part.length >= 3 && !searchCandidates.includes(part)) searchCandidates.push(part);
    }

    const types = isSeries ? ["series", "movie"] : ["movie", "series"];
    for (const q of searchCandidates) {
      for (const type of types) {
        const endpoint = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(q)}.json`;
        const res = await fetch(endpoint, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125" },
          next: { revalidate: 86400 },
        });
        if (res.ok) {
          const data = await res.json() as { metas?: Array<{ id: string; name: string; year?: string | number }> };
          if (data.metas && data.metas.length > 0) {
            if (year) {
              const match = data.metas.find((m) => String(m.year) === String(year));
              if (match) return match.id;
            }
            return data.metas[0].id;
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subUrl = searchParams.get("subUrl");

  // If subUrl is passed, fetch and stream the subtitle file as WebVTT
  if (subUrl) {
    try {
      const parsed = new URL(subUrl);
      if (!parsed.hostname.includes("strem.io") && !parsed.hostname.includes("opensubtitles")) {
        return new Response("Invalid subtitle source", { status: 400 });
      }

      const res = await fetch(subUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125",
        },
      });

      if (!res.ok) {
        return new Response("Failed to fetch subtitle", { status: res.status });
      }

      const text = await res.text();
      const vtt = srtToVtt(text);

      return new Response(vtt, {
        headers: {
          "Content-Type": "text/vtt; charset=utf-8",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    } catch {
      return new Response("Failed to process subtitle", { status: 500 });
    }
  }

  // Otherwise, list available subtitles
  let rawImdbId = searchParams.get("imdbId");
  if (rawImdbId === "null" || rawImdbId === "undefined" || !rawImdbId?.trim()) {
    rawImdbId = null;
  }

  const title = searchParams.get("title");
  const year = searchParams.get("year");
  const seasonParam = searchParams.get("season");
  const episodeParam = searchParams.get("episode");
  const isSeriesExplicit = searchParams.get("isSeries") === "true";

  let imdbId = rawImdbId;
  if (!imdbId && title) {
    imdbId = await resolveImdbId(title, year, isSeriesExplicit);
  }

  if (!imdbId) {
    return NextResponse.json({ subtitles: [] });
  }

  const cleanImdb = imdbId.startsWith("tt") ? imdbId : `tt${imdbId}`;
  const season = seasonParam ? Number(seasonParam) : 1;
  const episode = episodeParam ? Number(episodeParam) : 1;

  type RawSub = {
    id: string;
    lang: string;
    url: string;
    subtitleFileName?: string;
    movieReleaseName?: string;
  };

  async function fetchSubtitlesFromEndpoint(url: string): Promise<RawSub[]> {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125" },
        next: { revalidate: 3600 },
      });
      if (!res.ok) return [];
      const json = await res.json() as { subtitles?: RawSub[] };
      return json.subtitles || [];
    } catch {
      return [];
    }
  }

  const movieEndpoint = `https://opensubtitles-v3.strem.io/subtitles/movie/${cleanImdb}.json`;
  const seriesEndpoint = `https://opensubtitles-v3.strem.io/subtitles/series/${cleanImdb}:${season}:${episode}.json`;

  let rawList: RawSub[] = [];

  if (isSeriesExplicit) {
    // If explicitly marked as series, try series first, fallback to movie
    rawList = await fetchSubtitlesFromEndpoint(seriesEndpoint);
    if (rawList.length === 0) {
      rawList = await fetchSubtitlesFromEndpoint(movieEndpoint);
    }
  } else {
    // Default to movie first, fallback to series
    rawList = await fetchSubtitlesFromEndpoint(movieEndpoint);
    if (rawList.length === 0) {
      rawList = await fetchSubtitlesFromEndpoint(seriesEndpoint);
    }
  }

  const allowedLanguages: Record<string, { label: string; code: string; priority: number }> = {
    vie: { label: "Tiếng Việt", code: "vi", priority: 1 },
    eng: { label: "English", code: "en", priority: 2 },
    spa: { label: "Español", code: "es", priority: 3 },
    kor: { label: "한국어", code: "ko", priority: 4 },
    jpn: { label: "日本語", code: "ja", priority: 5 },
    chi: { label: "中文", code: "zh", priority: 6 },
    zho: { label: "中文", code: "zh", priority: 6 },
    fre: { label: "Français", code: "fr", priority: 7 },
    fra: { label: "Français", code: "fr", priority: 7 },
    ger: { label: "Deutsch", code: "de", priority: 8 },
    deu: { label: "Deutsch", code: "de", priority: 8 },
  };

  function detectRelease(fileName: string, releaseName: string): { score: number; releaseTag: string } {
    const combined = `${fileName} ${releaseName}`.toLowerCase();
    let tag = "Bản Thường";
    let score = 20;

    if (combined.includes("web-dl") || combined.includes("webdl") || combined.includes("web.dl")) {
      score = 100;
      tag = "WEB-DL (Chuẩn)";
    } else if (combined.includes("bluray") || combined.includes("bdrip") || combined.includes("brrip")) {
      score = 95;
      tag = "BluRay";
    } else if (combined.includes("webrip") || combined.includes("web-rip")) {
      score = 90;
      tag = "WEBRip";
    } else if (combined.includes("amzn") || combined.includes("nf") || combined.includes("dsnp") || combined.includes("atvp")) {
      score = 85;
      tag = "Digital";
    } else if (combined.includes("hdtv") || combined.includes("hdrip")) {
      score = 70;
      tag = "HDTV";
    } else if (combined.includes("telesync") || combined.includes(".ts.") || combined.includes("hdts") || combined.includes(" hdts")) {
      score = -50;
      tag = "Bản Rạp (TELESYNC)";
    } else if (combined.includes("cam") || combined.includes("hdcam")) {
      score = -60;
      tag = "Bản Rạp (CAM)";
    }

    if (combined.includes("(sdh)") || combined.includes(".sdh.") || combined.includes("sdh.srt")) {
      tag += " (SDH)";
    }

    return { score, releaseTag: tag };
  }

  const formatted = rawList
    .filter((sub) => sub.lang && allowedLanguages[sub.lang])
    .map((sub) => {
      const langInfo = allowedLanguages[sub.lang];
      const fn = sub.subtitleFileName || sub.movieReleaseName || `${langInfo.label} Subtitle`;
      const rn = sub.movieReleaseName || "";
      const quality = detectRelease(fn, rn);

      return {
        id: sub.id,
        lang: langInfo.label,
        code: langInfo.code,
        priority: langInfo.priority,
        score: quality.score,
        releaseTag: quality.releaseTag,
        fileName: fn,
        displayName: `${langInfo.label} [${quality.releaseTag}]`,
        url: `/api/subtitles?subUrl=${encodeURIComponent(sub.url)}`,
      };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.score - a.score;
    });

  // Keep top 6 best releases per language so user can choose alternative cuts if timing differs
  const seenLang = new Map<string, number>();
  const trimmed = formatted.filter((sub) => {
    const count = seenLang.get(sub.code) || 0;
    if (count < 6) {
      seenLang.set(sub.code, count + 1);
      return true;
    }
    return false;
  });

  return NextResponse.json({ subtitles: trimmed, imdbId: cleanImdb });
}
