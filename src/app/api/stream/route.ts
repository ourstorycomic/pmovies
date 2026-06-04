import { decryptStreamToken, encryptStreamUrl } from "@/lib/server/stream-token";

const ALLOWED_HOSTS = new Set(["phimapi.com"]);
const ALLOWED_SUFFIXES = [".phimapi.com", ".kkphimplayer7.com"];

function isAllowed(url: URL) {
  return ALLOWED_HOSTS.has(url.hostname) || ALLOWED_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawToken = params.get("token");
  const rawUrl = params.get("url");
  if ((!rawToken && !rawUrl) || rawUrl === "null" || rawUrl === "undefined") {
    return new Response("Missing stream URL", { status: 400 });
  }

  let target: URL;
  try {
    const resolved = rawToken ? decryptStreamToken(rawToken) : decodeURIComponent(rawUrl!);
    target = new URL(resolved);
  } catch {
    return new Response("Invalid stream URL", { status: 400 });
  }
  if (!isAllowed(target)) return new Response("Forbidden stream host", { status: 403 });

  const upstream = await fetch(target, { headers: { Referer: "https://phimapi.com/" } });
  if (!upstream.ok || !upstream.body) return new Response("Stream unavailable", { status: upstream.status });

  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("mpegurl") || target.pathname.endsWith(".m3u8")) {
    const playlist = await upstream.text();
    const rewritten = playlist
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;
        const resolved = new URL(trimmed, target).toString();
        return `/api/stream?token=${encryptStreamUrl(resolved)}`;
      })
      .join("\n");

    return new Response(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
