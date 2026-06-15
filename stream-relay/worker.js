const ALLOWED_HOSTS = new Set(["phimapi.com"]);
const ALLOWED_SUFFIXES = [".phimapi.com", ".kkphimplayer.com", ".phim1280.tv"];
const KK_PLAYER_HOST = /^([a-z]\d+\.)?kkphimplayer\d+\.com$/i;

function isAllowed(url) {
  return ALLOWED_HOSTS.has(url.hostname) || ALLOWED_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix)) || KK_PLAYER_HOST.test(url.hostname);
}

function streamHeaders(target) {
  return {
    Referer: "https://player.phimapi.com/",
    Origin: "https://player.phimapi.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    Accept: target.pathname.endsWith(".m3u8") ? "application/vnd.apple.mpegurl,*/*" : "*/*",
  };
}

const worker = {
  async fetch(request, env) {
    if (env.STREAM_RELAY_SECRET && request.headers.get("X-Stream-Relay-Secret") !== env.STREAM_RELAY_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

    const targetParam = new URL(request.url).searchParams.get("url");
    if (!targetParam) return new Response("Missing url", { status: 400 });

    let target;
    try {
      target = new URL(targetParam);
    } catch {
      return new Response("Invalid url", { status: 400 });
    }

    if (!isAllowed(target)) return new Response("Forbidden host", { status: 403 });

    const upstream = await fetch(target, { headers: streamHeaders(target) });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Relay-Upstream-Status": String(upstream.status),
      },
    });
  },
};

export default worker;
