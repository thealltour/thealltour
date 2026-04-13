import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getLandingGenerationCandidates } from "@/lib/adminLandings/generationService";

function parseAlreadyGenerated(value: string | null): boolean | null {
  if (value == null || value === "") return null;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const taxonomyTypeRaw = searchParams.get("taxonomyType");
  const taxonomyType =
    taxonomyTypeRaw === "destination" ||
    taxonomyTypeRaw === "theme" ||
    taxonomyTypeRaw === "product_line"
      ? taxonomyTypeRaw
      : "all";
  const alreadyGenerated = parseAlreadyGenerated(searchParams.get("alreadyGenerated"));

  try {
    const result = await getLandingGenerationCandidates({
      taxonomyType,
      alreadyGenerated,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "후보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
