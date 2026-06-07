import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unstable_cache } from "next/cache";

/**
 * 집계 기준: consultation_status / booking_status.
 * - pendingInquiries: 상담 응답 큐 — consultation_status in (new, contacted). 보류·종료 제외.
 * - delayedInquiries: new/contacted 중 접수 24시간 초과.
 * - onHoldInquiries: consultation_status === on_hold (DB 보관·큐 제외).
 * - reservedInquiries: booking_status === "reserved"
 * - completionRate: completedInquiries / totalInquiries × 100
 */

function percentChange(current: number, previous: number): number {
  if (previous <= 0) {
    if (current <= 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 100);
}

async function fetchAdminCountsRaw() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const delayedThresholdIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const activeConsultation = () =>
    supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }).in("consultation_status", ["new", "contacted"]);

  const [
    productsResult,
    pendingInquiriesResult,
    membersResult,
    reviewsResult,
    totalInquiriesResult,
    completedInquiriesResult,
    reservedInquiriesResult,
    onHoldInquiriesResult,
    delayedResult,
    todayTotalResult,
    yesterdayTotalResult,
    todayPendingResult,
    yesterdayPendingResult,
    todayDelayedResult,
    yesterdayDelayedResult,
  ] = await Promise.all([
    supabaseAdmin.from("products").select("id", { count: "exact", head: true }),
    activeConsultation(),
    supabaseAdmin.from("members").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("reviews").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }).eq("booking_status", "completed"),
    supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }).eq("booking_status", "reserved"),
    supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }).eq("consultation_status", "on_hold"),
    supabaseAdmin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .in("consultation_status", ["new", "contacted"])
      .lt("created_at", delayedThresholdIso),
    supabaseAdmin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),
    supabaseAdmin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
    supabaseAdmin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .in("consultation_status", ["new", "contacted"])
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),
    supabaseAdmin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .in("consultation_status", ["new", "contacted"])
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
    supabaseAdmin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .in("consultation_status", ["new", "contacted"])
      .lt("created_at", delayedThresholdIso)
      .gte("created_at", startOfToday.toISOString()),
    supabaseAdmin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .in("consultation_status", ["new", "contacted"])
      .lt("created_at", delayedThresholdIso)
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
  ]);

  const pendingCount = pendingInquiriesResult.error ? 0 : (pendingInquiriesResult.count ?? 0);
  const totalInquiries = totalInquiriesResult.error ? 0 : (totalInquiriesResult.count ?? 0);
  const completedInquiries = completedInquiriesResult.error ? 0 : (completedInquiriesResult.count ?? 0);
  const reservedInquiries = reservedInquiriesResult.error ? 0 : (reservedInquiriesResult.count ?? 0);
  const onHoldInquiries = onHoldInquiriesResult.error ? 0 : (onHoldInquiriesResult.count ?? 0);
  const completionRate =
    totalInquiries === 0 ? 0 : Math.round((completedInquiries / totalInquiries) * 100);

  const todayTotal = todayTotalResult.error ? 0 : (todayTotalResult.count ?? 0);
  const yesterdayTotal = yesterdayTotalResult.error ? 0 : (yesterdayTotalResult.count ?? 0);
  const todayPending = todayPendingResult.error ? 0 : (todayPendingResult.count ?? 0);
  const yesterdayPending = yesterdayPendingResult.error ? 0 : (yesterdayPendingResult.count ?? 0);
  const todayDelayed = todayDelayedResult.error ? 0 : (todayDelayedResult.count ?? 0);
  const yesterdayDelayed = yesterdayDelayedResult.error ? 0 : (yesterdayDelayedResult.count ?? 0);

  return {
    productCount: productsResult.error ? 0 : (productsResult.count ?? 0),
    inquiryCount: pendingCount,
    memberCount: membersResult.error ? 0 : (membersResult.count ?? 0),
    reviewCount: reviewsResult.error ? 0 : (reviewsResult.count ?? 0),
    totalInquiries,
    pendingInquiries: pendingCount,
    completedInquiries,
    reservedInquiries,
    onHoldInquiries,
    delayedInquiries: delayedResult.error ? 0 : (delayedResult.count ?? 0),
    completionRate,
    totalInquiriesDeltaPercent: percentChange(todayTotal, yesterdayTotal),
    pendingInquiriesDeltaPercent: percentChange(todayPending, yesterdayPending),
    completedInquiriesDeltaPercent: percentChange(
      todayTotal - todayPending,
      yesterdayTotal - yesterdayPending,
    ),
    delayedInquiriesDeltaPercent: percentChange(todayDelayed, yesterdayDelayed),
  };
}

/** 60초 캐시 — 관리자 대시보드 KPI용 */
export async function getAdminCounts() {
  return unstable_cache(
    fetchAdminCountsRaw,
    ["admin-counts"],
    { revalidate: 60, tags: ["admin-counts"] },
  )();
}
