import { proxyJson } from "@/lib/kkphim";

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const searchParams = new URL(request.url).searchParams;
  const upstreamParams = new URLSearchParams();
  for (const key of ["page", "sort_field", "sort_type", "sort_lang", "category", "country", "year", "limit"]) {
    const value = searchParams.get(key);
    if (value) upstreamParams.set(key, value);
  }
  if (!upstreamParams.has("page")) upstreamParams.set("page", "1");
  return proxyJson(`/v1/api/danh-sach/${encodeURIComponent(type)}?${upstreamParams.toString()}`);
}
