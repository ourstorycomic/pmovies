const ALLOWED_HOSTS = new Set(["phimapi.com", "img.phimapi.com", "phimimg.com"]);

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) return new Response("Missing image URL", { status: 400 });

  const decoded = decodeURIComponent(rawUrl);
  const target = new URL(decoded);
  if (!ALLOWED_HOSTS.has(target.hostname)) return new Response("Forbidden image host", { status: 403 });

  const upstream = await fetch(decoded, { next: { revalidate: 86400 } });
  if (!upstream.ok || !upstream.body) return new Response("Image unavailable", { status: upstream.status });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
