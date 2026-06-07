import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  InquiryAssigneeStatRow,
  InquiryDashboardKpis,
  InquiryDashboardPayload,
  InquiryDashboardPeriod,
  InquiryDashboardSummary,
  InquiryFunnel,
  InquiryRiskLists,
  InquirySourceRow,
  InquiryStatusBreakdown,
  InquiryTrendPoint,
} from "@/components/admin/inquiries/dashboard/inquiryDashboard.types";

const TREND_ROW_LIMIT = 15_000;
const ASSIGNEE_ROW_LIMIT = 12_000;
const SOURCE_ROW_LIMIT = 12_000;
const RISK_LIMIT = 10;

function kstStartOfTodayIso(): string {
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${d}T00:00:00+09:00`).toISOString();
}

function periodStartIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function enumerateUtcDaysInclusive(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startIso.slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${endIso.slice(0, 10)}T00:00:00.000Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function mapRowToSummary(r: Record<string, unknown>): InquiryDashboardSummary {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    consultation_status: typeof r.consultation_status === "string" ? r.consultation_status : null,
    assignee_name: typeof r.assignee_name === "string" ? r.assignee_name : null,
    follow_up_at: typeof r.follow_up_at === "string" ? r.follow_up_at : null,
  };
}

export async function buildInquiryDashboardPayload(period: InquiryDashboardPeriod): Promise<InquiryDashboardPayload> {
  const days = period === "30d" ? 30 : 7;
  const periodStart = periodStartIso(days);
  const nowIso = new Date().toISOString();
  const kstToday = kstStartOfTodayIso();

  const [
    todayNewRes,
    inProgressRes,
    reservedRes,
    hotRes,
    overdueFuRes,
    unassignedRes,
    trendRes,
    sourceRes,
    funnelInquiryRes,
    funnelContactedRes,
    funnelProposalRes,
    funnelReservedRes,
    assigneeRes,
    riskOverdueRes,
    riskUnassignedRes,
    riskStaleRes,
    sbNew,
    sbContacted,
    sbHold,
    sbClosed,
  ] = await Promise.all([
    supabaseAdmin.from("inquiries").select("*", { count: "exact", head: true }).gte("created_at", kstToday),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .in("consultation_status", ["new", "contacted", "on_hold"]),
    supabaseAdmin.from("inquiries").select("*", { count: "exact", head: true }).eq("booking_status", "reserved"),
    supabaseAdmin.from("inquiries").select("*", { count: "exact", head: true }).eq("lead_priority", "high"),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .not("follow_up_at", "is", null)
      .lt("follow_up_at", nowIso)
      .or("response_stage.is.null,response_stage.neq.closed"),
    supabaseAdmin.from("inquiries").select("*", { count: "exact", head: true }).is("assignee_name", null),
    supabaseAdmin.from("inquiries").select("created_at").gte("created_at", periodStart).limit(TREND_ROW_LIMIT),
    supabaseAdmin
      .from("inquiries")
      .select("acquisition_source_label, acquisition_channel")
      .gte("created_at", periodStart)
      .limit(SOURCE_ROW_LIMIT),
    supabaseAdmin.from("inquiries").select("*", { count: "exact", head: true }).gte("created_at", periodStart),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", periodStart)
      .in("consultation_status", ["contacted", "on_hold", "closed"]),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", periodStart)
      .in("response_stage", ["proposal_sent", "follow_up", "closed"]),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", periodStart)
      .eq("booking_status", "reserved"),
    supabaseAdmin
      .from("inquiries")
      .select("assignee_name, consultation_status, follow_up_at")
      .not("assignee_name", "is", null)
      .limit(ASSIGNEE_ROW_LIMIT),
    supabaseAdmin
      .from("inquiries")
      .select("id, name, created_at, consultation_status, assignee_name, follow_up_at")
      .not("follow_up_at", "is", null)
      .lt("follow_up_at", nowIso)
      .order("follow_up_at", { ascending: false })
      .limit(RISK_LIMIT),
    supabaseAdmin
      .from("inquiries")
      .select("id, name, created_at, consultation_status, assignee_name, follow_up_at")
      .is("assignee_name", null)
      .order("created_at", { ascending: false })
      .limit(RISK_LIMIT),
    supabaseAdmin
      .from("inquiries")
      .select("id, name, created_at, consultation_status, assignee_name, follow_up_at")
      .eq("consultation_status", "new")
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: true })
      .limit(RISK_LIMIT),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", periodStart)
      .eq("consultation_status", "new"),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", periodStart)
      .eq("consultation_status", "contacted"),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", periodStart)
      .eq("consultation_status", "on_hold"),
    supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", periodStart)
      .eq("consultation_status", "closed"),
  ]);

  const kpis: InquiryDashboardKpis = {
    todayNewCount: todayNewRes.count ?? 0,
    inProgressCount: inProgressRes.count ?? 0,
    reservedCount: reservedRes.count ?? 0,
    hotLeadCount: hotRes.count ?? 0,
    followUpOverdueCount: overdueFuRes.count ?? 0,
    unassignedCount: unassignedRes.count ?? 0,
  };

  const counts: Record<string, number> = {};
  for (const row of trendRes.data ?? []) {
    const raw = row as { created_at?: string };
    if (!raw.created_at) continue;
    const key = raw.created_at.slice(0, 10);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const dayKeys = enumerateUtcDaysInclusive(periodStart, nowIso);
  const trend: InquiryTrendPoint[] = dayKeys.map((date) => ({ date, count: counts[date] ?? 0 }));

  const statusBreakdown: InquiryStatusBreakdown = {
    new: sbNew.count ?? 0,
    contacted: sbContacted.count ?? 0,
    on_hold: sbHold.count ?? 0,
    closed: sbClosed.count ?? 0,
  };

  const sourceMap: Record<string, number> = {};
  for (const row of sourceRes.data ?? []) {
    const r = row as { acquisition_source_label?: string | null; acquisition_channel?: string | null };
    const label = (r.acquisition_source_label ?? "").trim();
    const ch = (r.acquisition_channel ?? "").trim();
    const key = label || ch || "direct";
    sourceMap[key] = (sourceMap[key] ?? 0) + 1;
  }
  const sourceBreakdown: InquirySourceRow[] = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const funnel: InquiryFunnel = {
    inquiry: funnelInquiryRes.count ?? 0,
    contacted: funnelContactedRes.count ?? 0,
    proposal: funnelProposalRes.count ?? 0,
    reserved: funnelReservedRes.count ?? 0,
  };

  const byAssignee: Record<
    string,
    { total: number; inProgress: number; overdue: number }
  > = {};
  for (const row of assigneeRes.data ?? []) {
    const r = row as {
      assignee_name?: string | null;
      consultation_status?: string | null;
      follow_up_at?: string | null;
    };
    const name = (r.assignee_name ?? "").trim();
    if (!name) continue;
    if (!byAssignee[name]) byAssignee[name] = { total: 0, inProgress: 0, overdue: 0 };
    byAssignee[name].total += 1;
    const st = r.consultation_status ?? "";
    if (st === "new" || st === "contacted" || st === "on_hold") byAssignee[name].inProgress += 1;
    const fu = r.follow_up_at;
    if (fu && new Date(fu) < new Date(nowIso)) byAssignee[name].overdue += 1;
  }
  const assigneeStats: InquiryAssigneeStatRow[] = Object.entries(byAssignee)
    .map(([name, v]) => ({ name, total: v.total, inProgress: v.inProgress, overdue: v.overdue }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  const riskLists: InquiryRiskLists = {
    overdue: (riskOverdueRes.data ?? []).map((r) => mapRowToSummary(r as Record<string, unknown>)),
    unassigned: (riskUnassignedRes.data ?? []).map((r) => mapRowToSummary(r as Record<string, unknown>)),
    staleNew: (riskStaleRes.data ?? []).map((r) => mapRowToSummary(r as Record<string, unknown>)),
  };

  return {
    period,
    kpis,
    trend,
    statusBreakdown,
    sourceBreakdown,
    funnel,
    assigneeStats,
    riskLists,
  };
}
