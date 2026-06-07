import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminReviewReportRow = {
  id: string;
  review_id: string;
  member_id: string;
  reason: string;
  created_at: string;
  status: string;
  review_title: string | null;
  review_status: string | null;
};

/** 관리자용: 신고 목록 (최신순) */
export async function getAdminReviewReports(limit = 200): Promise<AdminReviewReportRow[]> {
  const { data, error } = await supabaseAdmin
    .from("review_reports")
    .select("id, review_id, member_id, reason, created_at, status, reviews(title, status)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data ?? []).map((row: Record<string, unknown>) => {
    const review = row.reviews as Record<string, unknown> | null;
    return {
      id: String(row.id),
      review_id: String(row.review_id),
      member_id: String(row.member_id),
      reason: String(row.reason ?? ""),
      created_at: String(row.created_at ?? ""),
      status: String(row.status ?? "pending"),
      review_title: review && typeof review.title === "string" ? review.title : null,
      review_status: review && typeof review.status === "string" ? review.status : null,
    };
  });
}
