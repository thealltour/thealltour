import { NextRequest, NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/search/getSearchSuggestions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const keyword = q.trim();
  if (!keyword) {
    return NextResponse.json({ suggestions: [] });
  }
  try {
    const suggestions = await getSearchSuggestions(keyword);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
