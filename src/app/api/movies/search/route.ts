import { proxyJson } from "@/lib/kkphim";

export async function GET(request: Request) {
  const keyword = new URL(request.url).searchParams.get("keyword") ?? "";
  return proxyJson(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}`);
}
