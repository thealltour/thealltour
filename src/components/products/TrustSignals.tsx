"use client";

import type { ProductTrust } from "@/types/product";

export type TrustSignalsProps = {
  trust?: ProductTrust | null;
  className?: string;
};

/**
 * Trust Signals: 데이터가 있을 때만 렌더. 더미/placeholder 금지.
 * - recentConsultCount 없으면 해당 라인 미렌더
 * - ratingAvg·reviewCount 둘 다 없으면 평점 블록 미렌더
 * - totalInquiries 없으면 누적 블록 미렌더
 * - trust 전체 없으면 섹션 미렌더
 */
export default function TrustSignals({ trust, className = "" }: TrustSignalsProps) {
  if (!trust || typeof trust !== "object") return null;

  const hasRecent =
    typeof trust.recentConsultCount === "number" && trust.recentConsultCount >= 0;
  const recentDays = typeof trust.recentDays === "number" ? trust.recentDays : null;
  const hasTotal = typeof trust.totalInquiries === "number" && trust.totalInquiries >= 0;
  const hasRating =
    (typeof trust.ratingAvg === "number" && trust.ratingAvg >= 0) ||
    (typeof trust.reviewCount === "number" && trust.reviewCount >= 0);
  const ratingAvg =
    typeof trust.ratingAvg === "number" && trust.ratingAvg >= 0 ? trust.ratingAvg : null;
  const reviewCount =
    typeof trust.reviewCount === "number" && trust.reviewCount >= 0 ? trust.reviewCount : null;

  const showRecentLine = hasRecent;
  const showTotalLine = hasTotal;
  const showRatingBlock = hasRating;

  if (!showRecentLine && !showTotalLine && !showRatingBlock) return null;

  const parts: string[] = [];
  if (showRecentLine) {
    const daysText = recentDays != null ? `최근 ${recentDays}일 ` : "";
    parts.push(`${daysText}상담 문의 ${trust.recentConsultCount}건`);
  }
  if (showTotalLine) {
    parts.push(`누적 문의 ${trust.totalInquiries}건`);
  }
  const ratingPart =
    showRatingBlock && (ratingAvg != null || reviewCount != null)
      ? [
        ratingAvg != null ? `평점 ${ratingAvg.toFixed(1)}` : null,
        reviewCount != null ? `후기 ${reviewCount}건` : null,
      ]
        .filter(Boolean)
        .join(" · ")
      : null;

  return (
    <div className={`text-xs text-slate-500 ${className}`.trim()} aria-label="신뢰 정보">
      {parts.length > 0 ? (
        <p className="leading-relaxed">{parts.join(" · ")}</p>
      ) : null}
      {ratingPart ? <p className="mt-0.5 leading-relaxed">{ratingPart}</p> : null}
    </div>
  );
}
