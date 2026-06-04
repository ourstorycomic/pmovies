import { NextResponse } from "next/server";
import { encryptStreamUrl } from "@/lib/server/stream-token";

const BASE_URL = "https://phimapi.com";
const IMAGE_FIELDS = new Set(["poster_url", "thumb_url", "image", "logo", "avatar_url"]);
const STREAM_FIELDS = new Set(["link_m3u8", "link_embed"]);

function internalImage(url: string, imageBase?: string) {
  if (!url) return url;
  const base = imageBase || BASE_URL;
  const absolute = url.startsWith("http") ? url : `${base.replace(/\/$/, "")}/${url.replace(/^\/+/, "")}`;
  return `/api/image?url=${encodeURIComponent(absolute)}`;
}

function internalStream(url: string) {
  if (!url || url === "null" || url === "undefined" || url.includes("url=null") || url.includes("url=undefined")) return "";
  return `/api/stream?token=${encryptStreamUrl(url)}`;
}

function cleanString(value: string) {
  return value
    .replaceAll("KKPhim", "PMovies")
    .replaceAll("kkphim", "pmovies")
    .replaceAll("phimapi.com", "media.pmovies.local")
    .replaceAll("https://phimapi.com", "");
}

export function sanitizePayload(input: unknown, key = "", imageBase?: string): unknown {
  if (Array.isArray(input)) return input.map((item) => sanitizePayload(item, key, imageBase));
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const nextImageBase =
      typeof record.domain_image === "string"
        ? record.domain_image
        : typeof record.APP_DOMAIN_CDN_IMAGE === "string"
          ? record.APP_DOMAIN_CDN_IMAGE
          : typeof record.domain_cdn_image === "string"
            ? record.domain_cdn_image
            : imageBase;

    return Object.fromEntries(
      Object.entries(record)
        .filter(([entryKey]) => !["APP_DOMAIN_CDN_IMAGE", "domain_image", "domain_cdn_image"].includes(entryKey))
        .map(([entryKey, value]) => [entryKey, sanitizePayload(value, entryKey, nextImageBase)]),
    );
  }
  if (typeof input === "string") {
    if (IMAGE_FIELDS.has(key)) return internalImage(input, imageBase);
    if (STREAM_FIELDS.has(key)) return internalStream(input);
    return cleanString(input);
  }
  return input;
}

export async function fetchKkJson(path: string, init?: RequestInit) {
  const upstream = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "User-Agent": "PMovies-BFF/1.0", Accept: "application/json" },
    next: init?.next ?? { revalidate: 300 },
  });

  if (!upstream.ok) return null;
  return sanitizePayload(await upstream.json());
}

export async function proxyJson(path: string, init?: RequestInit) {
  const payload = await fetchKkJson(path, init);
  if (!payload) return NextResponse.json({ error: "Movie source unavailable" }, { status: 502 });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=180, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
