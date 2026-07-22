import { fetchKkJson } from "@/lib/kkphim";
import { NextResponse, type NextRequest } from "next/server";

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

  const payload = await fetchKkJson(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=120`) as any;
  if (!payload || !payload.data) {
     return NextResponse.json({ status: "success", data: { items: [] } });
  }

  let items = payload.data.items || [];
  
  // Sort items to prioritize exact matches
  const lowerKeyword = keyword.toLowerCase();
  items.sort((a: any, b: any) => {
    const aName = (a.name || "").toLowerCase();
    const bName = (b.name || "").toLowerCase();
    
    if (aName === lowerKeyword && bName !== lowerKeyword) return -1;
    if (bName === lowerKeyword && aName !== lowerKeyword) return 1;
    
    if (aName.startsWith(lowerKeyword) && !bName.startsWith(lowerKeyword)) return -1;
    if (bName.startsWith(lowerKeyword) && !aName.startsWith(lowerKeyword)) return 1;
    
    return 0;
  });
  
  payload.data.items = items.slice(0, 50);

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=180, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
