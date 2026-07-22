export type IntroSegment = {
  start: number;
  end: number;
  confidence: number;
  method: "introdb";
};

export type SegmentsDbResult = {
  intro: IntroSegment | null;
  outro: IntroSegment | null;
};

type IntroDbSegmentPayload = {
  start_sec?: number | string;
  end_sec?: number | string;
  confidence?: number;
};

type IntroDbPayload = {
  intro?: IntroDbSegmentPayload | null;
  outro?: IntroDbSegmentPayload | null;
  segments?: Array<IntroDbSegmentPayload & { segment_type?: string }>;
  data?: {
    intro?: IntroDbSegmentPayload | null;
    outro?: IntroDbSegmentPayload | null;
    segments?: Array<IntroDbSegmentPayload & { segment_type?: string }>;
  };
};

function seconds(value: number | string | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(":").map(Number);
  if (parts.some((item) => !Number.isFinite(item))) return 0;
  return parts.reduce((total, item) => total * 60 + item, 0);
}

function pickIntro(payload: IntroDbPayload): IntroDbSegmentPayload | null {
  if (payload.intro) return payload.intro;
  if (payload.data?.intro) return payload.data.intro;
  return payload.segments?.find((item) => item.segment_type === "intro") ?? payload.data?.segments?.find((item) => item.segment_type === "intro") ?? null;
}

function pickOutro(payload: IntroDbPayload): IntroDbSegmentPayload | null {
  if (payload.outro) return payload.outro;
  if (payload.data?.outro) return payload.data.outro;
  return payload.segments?.find((item) => item.segment_type === "outro") ?? payload.data?.segments?.find((item) => item.segment_type === "outro") ?? null;
}

export async function fetchIntroDbSegment({ imdbId, season, episode }: { imdbId?: string | null; season?: number; episode?: number }): Promise<SegmentsDbResult> {
  if (!imdbId || !/^tt\d+$/i.test(imdbId) || !season || !episode) return { intro: null, outro: null };

  try {
    const url = new URL("https://api.introdb.app/segments");
    url.searchParams.set("imdb_id", imdbId);
    url.searchParams.set("season", String(season));
    url.searchParams.set("episode", String(episode));

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PMovies-BFF/1.0" },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) return { intro: null, outro: null };

    const json = await response.json() as IntroDbPayload;

    const introPayload = pickIntro(json);
    const outroPayload = pickOutro(json);
    
    let introSegment: IntroSegment | null = null;
    if (introPayload) {
      const start = seconds(introPayload.start_sec);
      const end = seconds(introPayload.end_sec);
      if (end > start && end - start >= 5 && end - start <= 240) {
        introSegment = { start, end, confidence: introPayload.confidence ?? 1, method: "introdb" };
      }
    }
    
    let outroSegment: IntroSegment | null = null;
    if (outroPayload) {
      const start = seconds(outroPayload.start_sec);
      const end = seconds(outroPayload.end_sec);
      if (end > start) {
        outroSegment = { start, end, confidence: outroPayload.confidence ?? 1, method: "introdb" };
      }
    }

    return { intro: introSegment, outro: outroSegment };
  } catch {
    return { intro: null, outro: null };
  }
}
