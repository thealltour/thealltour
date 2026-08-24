import { clamp01 } from "@/lib/marketing/scoring/clamp";
import type { ContextCandidate, ScoringRequest } from "@/lib/marketing/scoring/types";

function productStatusScore(status: string | null): number {
  switch ((status ?? "").toUpperCase()) {
    case "AVAILABLE":
      return 0.08;
    case "LIMITED":
    case "CONSULT_REQUIRED":
      return 0.02;
    case "SOLD_OUT":
      return -0.18;
    default:
      return 0;
  }
}

export function scoreBusinessImportance(
  candidate: ContextCandidate,
  request: ScoringRequest,
  now: Date = new Date(),
): number {
  switch (candidate.kind) {
    case "product": {
      const active = candidate.data.isActive ? 0.9 : 0.2;
      const campaignBoost =
        request.campaignId && candidate.data.campaigns.some((campaign) => campaign.id === request.campaignId)
          ? 0.08
          : 0;
      return clamp01(active + productStatusScore(candidate.data.status) + campaignBoost);
    }
    case "customerInsights": {
      const conversions = candidate.data.conversionSummary.reserved + candidate.data.conversionSummary.completed;
      if (conversions > 0) return 0.88;
      if (candidate.data.inquiryCount <= 0) return 0.4;
      return clamp01(0.55 + Math.min(candidate.data.inquiryCount, 20) / 80);
    }
    case "bookingInsights": {
      if (candidate.data.completedCount > 0) return 0.9;
      if (candidate.data.reservedCount > 0) return 0.82;
      if (candidate.data.bookingCount <= 0) return 0.38;
      return 0.65;
    }
    case "reviewInsights": {
      if (candidate.data.reviewCount <= 0) return 0.4;
      const rating = candidate.data.averageRating;
      return clamp01(0.68 + (rating != null ? Math.min(rating, 5) / 25 : 0));
    }
    case "contentHistory": {
      const status = String(candidate.data.metadata?.status ?? "").toLowerCase();
      if (status === "obsolete" || status === "archived" || status === "rejected") return 0.22;
      if (status === "draft") return 0.45;
      if (candidate.data.publishedAt) return 0.78;
      return 0.58;
    }
    case "publications": {
      const status = candidate.data.status.toLowerCase();
      if (status === "published") return 0.86;
      if (status === "scheduled") return 0.62;
      if (status === "failed" || status === "error" || status === "deleted") return 0.28;
      return 0.5;
    }
    case "performance": {
      const completed = candidate.data.conversionSummary?.completed ?? 0;
      if (completed > 0) return 0.9;
      if (candidate.data.metrics.length > 0 || candidate.data.publicationCount > 0) return 0.72;
      return 0.42;
    }
    case "memory": {
      if (candidate.data.expiresAt) {
        const expires = new Date(candidate.data.expiresAt);
        if (!Number.isNaN(expires.getTime()) && expires.getTime() < now.getTime()) return 0.15;
      }
      const importance = candidate.data.importance;
      if (importance != null && Number.isFinite(importance)) {
        const normalized = importance > 1 && importance <= 10 ? importance / 10 : importance;
        return clamp01(0.45 + clamp01(normalized) * 0.4);
      }
      return 0.5;
    }
    case "agendaHistory": {
      if (candidate.data.usageCount > 0) return 0.7;
      return 0.48;
    }
  }
}
