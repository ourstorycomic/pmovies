import { decryptStreamToken } from "@/lib/server/stream-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "sin1";
const RELAY_URL = process.env.STREAM_RELAY_URL;

function streamHeaders(target: URL) {
  return {
    Referer: "https://player.phimapi.com/",
    Origin: "https://player.phimapi.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    Accept: target.pathname.endsWith(".m3u8") ? "application/vnd.apple.mpegurl,*/*" : "*/*",
  };
}

async function fetchViaRelay(target: URL) {
  if (!RELAY_URL) return null;
  const relay = new URL(RELAY_URL);
  relay.searchParams.set("url", target.toString());
  return fetch(relay, { headers: streamHeaders(target) });
}

function maskPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 2) return pathname;
  return `/${parts[0]}/.../${parts.at(-1)}`;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(decryptStreamToken(token));
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    let upstream = await fetch(target, { headers: streamHeaders(target) });
    let via = "vercel";
    if ([403, 404].includes(upstream.status)) {
      const relay = await fetchViaRelay(target);
      if (relay) {
        upstream = relay;
        via = "relay";
      }
    }

    return Response.json({
      host: target.hostname,
      path: maskPath(target.pathname),
      via,
      upstream_status: upstream.status,
      upstream_type: upstream.headers.get("content-type"),
      relay_configured: Boolean(RELAY_URL),
    });
  } catch (error) {
    return Response.json({
      host: target.hostname,
      path: maskPath(target.pathname),
      error: error instanceof Error ? error.message : "Fetch failed",
    }, { status: 502 });
  }
}
