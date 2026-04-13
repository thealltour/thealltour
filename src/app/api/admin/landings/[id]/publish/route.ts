import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  AdminLandingPublishValidationError,
  AdminLandingServiceError,
  publishLanding,
} from "@/lib/adminLandings/service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  try {
    const item = await publishLanding(id);
    if (!item) {
      return NextResponse.json({ error: "Landing not found" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AdminLandingPublishValidationError) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", issues: error.issues },
        { status: 422 },
      );
    }
    if (error instanceof AdminLandingServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Publish 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
