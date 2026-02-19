import { supabase } from "@/lib/supabase";

export async function getAdminCounts() {
  const delayedThresholdIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [productsResult, pendingInquiriesResult, membersResult, reviewsResult, totalInquiriesResult, delayedResult] =
    await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_completed", false),
    supabase.from("members").select("*", { count: "exact", head: true }),
    supabase.from("reviews").select("*", { count: "exact", head: true }),
    supabase.from("inquiries").select("*", { count: "exact", head: true }),
    supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .eq("is_completed", false)
      .lt("created_at", delayedThresholdIso),
    ]);

  const pendingCount = pendingInquiriesResult.error ? 0 : (pendingInquiriesResult.count ?? 0);
  const totalInquiries = totalInquiriesResult.error ? 0 : (totalInquiriesResult.count ?? 0);
  const completedInquiries = Math.max(0, totalInquiries - pendingCount);
  const completionRate = totalInquiries === 0 ? 0 : Math.round((completedInquiries / totalInquiries) * 100);

  return {
    productCount: productsResult.error ? 0 : (productsResult.count ?? 0),
    inquiryCount: pendingCount,
    memberCount: membersResult.error ? 0 : (membersResult.count ?? 0),
    reviewCount: reviewsResult.error ? 0 : (reviewsResult.count ?? 0),
    totalInquiries,
    pendingInquiries: pendingCount,
    completedInquiries,
    delayedInquiries: delayedResult.error ? 0 : (delayedResult.count ?? 0),
    completionRate,
  };
}
