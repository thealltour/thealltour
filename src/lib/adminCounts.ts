import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";

/** 집계 기준: consultation_status / booking_status. pending = 미상담종료 또는 미예약. */

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

  const [
    productsResult,
    pendingInquiriesResult,
    membersResult,
    reviewsResult,
    totalInquiriesResult,
    completedInquiriesResult,
    reservedInquiriesResult,
    delayedResult,
    todayTotalResult,
    yesterdayTotalResult,
    todayPendingResult,
    yesterdayPendingResult,
    todayDelayedResult,
    yesterdayDelayedResult,
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .or("consultation_status.neq.closed,booking_status.eq.none"),
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("inquiries").select("id", { count: "exact", head: true }),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("booking_status", "completed"),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("booking_status", "reserved"),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .neq("consultation_status", "closed")
      .lt("created_at", delayedThresholdIso),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .or("consultation_status.neq.closed,booking_status.eq.none")
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .or("consultation_status.neq.closed,booking_status.eq.none")
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .neq("consultation_status", "closed")
      .lt("created_at", delayedThresholdIso)
      .gte("created_at", startOfToday.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .neq("consultation_status", "closed")
      .lt("created_at", delayedThresholdIso)
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
  ]);

  const pendingCount = pendingInquiriesResult.error ? 0 : (pendingInquiriesResult.count ?? 0);
  const totalInquiries = totalInquiriesResult.error ? 0 : (totalInquiriesResult.count ?? 0);
  const completedInquiries = completedInquiriesResult.error ? 0 : (completedInquiriesResult.count ?? 0);
  const reservedInquiries = reservedInquiriesResult.error ? 0 : (reservedInquiriesResult.count ?? 0);
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
