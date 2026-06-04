import { proxyJson } from "@/lib/kkphim";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return proxyJson(`/phim/${encodeURIComponent(slug)}`);
}
