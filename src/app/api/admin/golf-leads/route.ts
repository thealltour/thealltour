import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  buildGolfLeadsSummary,
  normalizeGolfLeadRow,
  parseGolfLeadsDateRange,
  type GolfLeadsListResponse,
} from "@/lib/leads/golfLeadStats";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type {
  GolfLeadCountItem,
  GolfLeadDailyTrendItem,
  GolfLeadStatsRow,
  GolfLeadsListResponse,
  GolfLeadsSummary,
} from "@/lib/leads/golfLeadStats";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const range = url.searchParams.get("range");
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1), 500);
  const { startIso, endIso, rangeLabel } = parseGolfLeadsDateRange(range);

  let query = supabaseAdmin.from("golf_tour_leads").select("*").order("created_at", { ascending: false });

  if (startIso) {
    query = query.gte("created_at", startIso);
  }
  if (endIso) {
    query = query.lt("created_at", endIso);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/golf-leads] query failed", error.message);
    return NextResponse.json({ message: "골프 리드 데이터를 불러오지 못했습니다." }, { status: 500 });
  }

  const allRows = (data ?? []).map((row) => normalizeGolfLeadRow(row as Record<string, unknown>));
  const summary = buildGolfLeadsSummary(allRows);

  const payload: GolfLeadsListResponse = {
    leads: allRows.slice(0, limit),
    summary,
    period: {
      range: rangeLabel,
      startIso,
      endIso,
    },
  };

  return NextResponse.json(payload);
}
