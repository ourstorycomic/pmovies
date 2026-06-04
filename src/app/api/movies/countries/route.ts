import { proxyJson } from "@/lib/kkphim";

export async function GET() {
  return proxyJson("/quoc-gia");
}
