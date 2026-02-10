import { supabase } from "@/lib/supabase";

export async function getAdminCounts() {
  const [productsResult, pendingInquiriesResult, membersResult, reviewsResult] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_completed", false),
    supabase.from("members").select("*", { count: "exact", head: true }),
    supabase.from("reviews").select("*", { count: "exact", head: true }),
  ]);

  return {
    productCount: productsResult.error ? 0 : (productsResult.count ?? 0),
    inquiryCount: pendingInquiriesResult.error ? 0 : (pendingInquiriesResult.count ?? 0),
    memberCount: membersResult.error ? 0 : (membersResult.count ?? 0),
    reviewCount: reviewsResult.error ? 0 : (reviewsResult.count ?? 0),
  };
}
