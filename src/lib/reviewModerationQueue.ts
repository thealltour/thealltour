/**
 * PR24: Moderation Queue 우선순위 정렬.
 */
import { fromDbStatus } from "@/types/reviewModeration";

export type ReviewModerationQueueItem = {
  reviewId: string;
  productId: string;
  status: "under_review" | "flagged" | "hidden";
  reportCount: number;
  trustScore?: number;
  anomalyRiskScore?: number;
  priorityScore: number;
  priorityLevel: "high" | "medium" | "low";
  reasons: string[];
  createdAt: string;
  latestReportedAt?: string;
};

const REPORT_WEIGHT = 15;
const TRUST_WEIGHT = 2;
const ANOMALY_WEIGHT = 8;
const STATUS_WEIGHT: Record<string, number> = {
  hidden: 30,
  flagged: 20,
  under_review: 10,
};

function toQueueStatus(s: string): "under_review" | "flagged" | "hidden" {
  const status = fromDbStatus(s);
  if (status === "hidden") return "hidden";
  if (status === "flagged") return "flagged";
  return "under_review";
}

export function buildReviewModerationQueue(
  reviews: Array<{
    id: string;
    product_id: string | null;
    status: string;
    report_count: number;
    created_at: string | null;
    trustScore?: number;
    anomalyRiskScore?: number;
    latestReportedAt?: string;
    /** PR25: 작성자 위험도. high면 우선순위 가산 */
    authorRiskLevel?: "low" | "medium" | "high";
  }>,
): ReviewModerationQueueItem[] {
  const items: ReviewModerationQueueItem[] = [];
  const AUTHOR_RISK_WEIGHT = 10;
  for (const r of reviews) {
    const status = toQueueStatus(r.status);
    const reportCount = r.report_count ?? 0;
    const trustScore = r.trustScore ?? 50;
    const anomalyRiskScore = r.anomalyRiskScore ?? 0;
    const reasons: string[] = [];
    if (reportCount >= 5) reasons.push("신고 수가 임계치를 초과했습니다.");
    else if (reportCount >= 3) reasons.push("신고 다수 접수");
    else if (reportCount > 0) reasons.push("신고 접수");
    if (trustScore < 20) reasons.push("신뢰도 점수가 매우 낮습니다.");
    else if (trustScore < 40) reasons.push("신뢰도 점수 낮음");
    if (anomalyRiskScore >= 5) reasons.push("스팸/중복 패턴 위험이 감지되었습니다.");
    if (r.authorRiskLevel === "high") reasons.push("작성자 신뢰도가 낮아 운영 검토 우선순위를 높였습니다.");
    const priorityScore =
      reportCount * REPORT_WEIGHT +
      (100 - Math.min(100, trustScore)) * (TRUST_WEIGHT / 10) +
      anomalyRiskScore * ANOMALY_WEIGHT +
      (STATUS_WEIGHT[status] ?? 0) +
      (r.latestReportedAt ? 5 : 0) +
      (r.authorRiskLevel === "high" ? AUTHOR_RISK_WEIGHT : r.authorRiskLevel === "medium" ? 5 : 0);
    const priorityLevel: "high" | "medium" | "low" =
      priorityScore >= 80 ? "high" : priorityScore >= 50 ? "medium" : "low";
    items.push({
      reviewId: r.id,
      productId: r.product_id ?? "",
      status,
      reportCount,
      trustScore: r.trustScore,
      anomalyRiskScore: r.anomalyRiskScore,
      priorityScore: Math.round(priorityScore),
      priorityLevel,
      reasons,
      createdAt: r.created_at ?? "",
      latestReportedAt: r.latestReportedAt,
    });
  }
  return sortModerationQueueItems(items);
}

export function sortModerationQueueItems(
  items: ReviewModerationQueueItem[],
): ReviewModerationQueueItem[] {
  return [...items].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    const aReport = a.latestReportedAt ?? a.createdAt;
    const bReport = b.latestReportedAt ?? b.createdAt;
    const c = bReport.localeCompare(aReport);
    if (c !== 0) return c;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
