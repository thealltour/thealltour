import type { ManualPublicationRecord } from "@/lib/marketing/review/types";
import type { CollectionEligibilityStatus } from "@/lib/marketing/performance/types";

const SUPPORTED_PLATFORMS = new Set([
  "threads",
  "instagram",
  "facebook",
  "youtube",
  "naver_blog",
  "naver_band",
  "kakao_channel",
  "tiktok",
]);

function normalizePlatform(platform?: string | null): string | null {
  const value = platform?.trim().toLowerCase();
  if (!value) return null;
  return value.replace(/\s+/g, "_");
}

function looksLikeUrl(value?: string | null): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeExternalPostId(value?: string | null): boolean {
  const id = value?.trim();
  if (!id) return false;
  if (id.length < 3 || id.length > 256) return false;
  return !looksLikeUrl(id);
}

export function evaluateManualPublicationEligibility(
  manualPublication: ManualPublicationRecord | null | undefined,
): { status: CollectionEligibilityStatus; platform: string | null; reason?: string } {
  if (!manualPublication) {
    return { status: "insufficient_reference", platform: null, reason: "no_manual_publication_record" };
  }

  const platform = normalizePlatform(manualPublication.platform);
  if (!platform) {
    return { status: "insufficient_reference", platform: null, reason: "platform_missing" };
  }

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return { status: "unsupported_provider", platform, reason: "platform_not_in_matrix" };
  }

  const hasPostId = looksLikeExternalPostId(manualPublication.externalPostId);
  const hasUrl = looksLikeUrl(manualPublication.externalUrl);

  if (!hasPostId && !hasUrl) {
    return {
      status: "insufficient_reference",
      platform,
      reason: "requires_external_post_id_or_canonical_url",
    };
  }

  if (manualPublication.publishedAt?.trim()) {
    return { status: "eligible", platform };
  }

  return {
    status: "insufficient_reference",
    platform,
    reason: "published_at_missing",
  };
}

export function buildManualPerformanceReference(input: {
  candidateId: string;
  reviewId: string;
  manualPublication: ManualPublicationRecord;
  humanEditedAfterGovernance: boolean;
  createdAt: string;
}): import("@/lib/marketing/performance/types").ManualPerformanceReference | null {
  const eligibility = evaluateManualPublicationEligibility(input.manualPublication);
  if (eligibility.status !== "eligible" || !eligibility.platform) return null;

  return {
    contract: "manual-performance-reference-v1",
    candidateId: input.candidateId,
    reviewId: input.reviewId,
    platform: eligibility.platform,
    externalPostId: input.manualPublication.externalPostId?.trim() || null,
    externalUrl: input.manualPublication.externalUrl?.trim() || null,
    publishedAt: input.manualPublication.publishedAt?.trim() || null,
    humanEditedAfterGovernance: input.humanEditedAfterGovernance,
    source: "manual_publication",
    createdAt: input.createdAt,
  };
}
