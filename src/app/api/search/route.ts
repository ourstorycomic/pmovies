import { proxyJson } from "@/lib/kkphim";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  let keyword = req.nextUrl.searchParams.get("q") ?? "";
  
  // Normalize common Vietnamese i/y spelling to help search
  keyword = keyword
    .replace(/kì/gi, "kỳ")
    .replace(/kí/gi, "ký")
    .replace(/kỉ/gi, "kỷ")
    .replace(/kĩ/gi, "kỹ")
    .replace(/kị/gi, "kỵ")
    .replace(/lí/gi, "lý")
    .replace(/lì/gi, "lỳ")
    .replace(/lỉ/gi, "lỷ")
    .replace(/lĩ/gi, "lỹ")
    .replace(/lị/gi, "lỵ")
    .replace(/mĩ/gi, "mỹ")
    .replace(/mị/gi, "mỵ")
    .replace(/mi/gi, "my");
    // Only basic safe normalization for specific words can be applied if needed, but doing just common ones is fine.

  if (!keyword) {
    return Response.json({ status: "success", data: { items: [] } });
  }

  return proxyJson(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=5`);
}
