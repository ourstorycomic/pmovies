import { proxyJson } from "@/lib/kkphim";

export async function GET(request: Request) {
  const page = new URL(request.url).searchParams.get("page") ?? "1";
  return proxyJson(`/danh-sach/phim-moi-cap-nhat-v3?page=${encodeURIComponent(page)}`);
}
