export type IntroSegment = {
  start: number;
  end: number;
  confidence: number;
  method: "introdb";
};

type IntroDbSegmentPayload = {
  start_sec?: number | string;
  end_sec?: number | string;
  confidence?: number;
};

type IntroDbPayload = {
  intro?: IntroDbSegmentPayload | null;
  segments?: Array<IntroDbSegmentPayload & { segment_type?: string }>;
  data?: {
    intro?: IntroDbSegmentPayload | null;
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

export async function fetchIntroDbSegment({ imdbId, season, episode }: { imdbId?: string | null; season?: number; episode?: number }) {
  if (!imdbId || !/^tt\d+$/i.test(imdbId) || !season || !episode) return null;

  try {
    const url = new URL("https://api.introdb.app/segments");
    url.searchParams.set("imdb_id", imdbId);
    url.searchParams.set("season", String(season));
    url.searchParams.set("episode", String(episode));

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PMovies-BFF/1.0" },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) return null;

    const intro = pickIntro(await response.json() as IntroDbPayload);
    if (!intro) return null;

    const start = seconds(intro.start_sec);
    const end = seconds(intro.end_sec);
    if (end <= start || end - start < 5 || end - start > 240) return null;

    return { start, end, confidence: intro.confidence ?? 1, method: "introdb" } satisfies IntroSegment;
  } catch {
    return null;
  }
}
