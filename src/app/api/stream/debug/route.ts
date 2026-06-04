import { decryptStreamToken } from "@/lib/server/stream-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "sin1";

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
    const upstream = await fetch(target, {
      headers: {
        Referer: "https://player.phimapi.com/",
        Origin: "https://player.phimapi.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        Accept: target.pathname.endsWith(".m3u8") ? "application/vnd.apple.mpegurl,*/*" : "*/*",
      },
    });

    return Response.json({
      host: target.hostname,
      path: maskPath(target.pathname),
      upstream_status: upstream.status,
      upstream_type: upstream.headers.get("content-type"),
    });
  } catch (error) {
    return Response.json({
      host: target.hostname,
      path: maskPath(target.pathname),
      error: error instanceof Error ? error.message : "Fetch failed",
    }, { status: 502 });
  }
}
