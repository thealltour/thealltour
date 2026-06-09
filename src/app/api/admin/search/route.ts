import { NextRequest, NextResponse } from "next/server";
import { requireAdminSessionWithRole } from "@/lib/apiAuth";
import {
  runAdminGlobalSearch,
  type AdminGlobalSearchResultType,
} from "@/lib/adminGlobalSearch";

const VALID_TYPES: AdminGlobalSearchResultType[] = ["inquiry", "member", "product"];

function parseTypes(raw: string | null): AdminGlobalSearchResultType[] {
  if (!raw?.trim()) return VALID_TYPES;
  const parsed = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is AdminGlobalSearchResultType => VALID_TYPES.includes(t as AdminGlobalSearchResultType));
  return parsed.length > 0 ? parsed : VALID_TYPES;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSessionWithRole();
  if (!auth.ok) return auth.res;

  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Number(searchParams.get("limit") ?? "5");
  const types = parseTypes(searchParams.get("types"));

  if (!q) {
    return NextResponse.json({ q: "", groups: [] });
  }

  const result = await runAdminGlobalSearch({
    q,
    types,
    limit: Number.isFinite(limit) ? limit : 5,
    session: auth.session,
  });

  return NextResponse.json(result);
}
