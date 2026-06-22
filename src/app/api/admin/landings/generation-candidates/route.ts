import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getLandingGenerationCandidates } from "@/lib/adminLandings/generationService";

function parseAlreadyGenerated(value: string | null): boolean | null {
  if (value == null || value === "") return null;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

import type { LandingGenerationFilterType } from "@/types/adminLanding";

function parseTaxonomyType(value: string | null): LandingGenerationFilterType {
  if (
    value === "destination" ||
    value === "theme" ||
    value === "product_line" ||
    value === "destination_golf"
  ) {
    return value;
  }
  return "all";
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const taxonomyType = parseTaxonomyType(searchParams.get("taxonomyType"));
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
