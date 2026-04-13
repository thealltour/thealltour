import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { generateLandingsFromTaxonomy } from "@/lib/adminLandings/generationService";
import type { LandingGenerationRequestItem } from "@/types/adminLanding";

type GenerateRequestBody = {
  items?: LandingGenerationRequestItem[];
};

function isValidItem(item: LandingGenerationRequestItem): boolean {
  return Boolean(
    item &&
      typeof item.taxonomyId === "string" &&
      item.taxonomyId.trim() &&
      (item.taxonomyType === "destination" || item.taxonomyType === "theme"),
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "요청 본문(JSON)을 확인해주세요." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items.filter(isValidItem) : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "생성할 taxonomy 항목이 없습니다." }, { status: 400 });
  }

  try {
    const result = await generateLandingsFromTaxonomy(items);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "초안 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
