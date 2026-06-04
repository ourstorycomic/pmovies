import { decryptStreamToken, encryptStreamUrl } from "@/lib/server/stream-token";

const ALLOWED_HOSTS = new Set(["phimapi.com"]);
const ALLOWED_SUFFIXES = [".phimapi.com", ".kkphimplayer7.com", ".kkphimplayer.com", ".kkphimplayer8.com", ".kkphimplayer9.com"];

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

  const upstream = await fetch(target, {
    headers: {
      Referer: "https://player.phimapi.com/",
      Origin: "https://player.phimapi.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      Accept: target.pathname.endsWith(".m3u8") ? "application/vnd.apple.mpegurl,*/*" : "*/*",
    },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(`Stream unavailable from ${target.hostname}`, { status: upstream.status });
  }

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
