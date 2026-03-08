/**
 * PR25: 작성자 프로필 selector / helper.
 */
import type { ReviewAuthorProfile, ReviewAuthorSummary } from "@/types/reviewAuthorProfile";

export function getHighRiskAuthors(profiles: ReviewAuthorProfile[]): ReviewAuthorProfile[] {
  return profiles.filter((p) => p.authorRiskLevel === "high");
}

export function getAuthorProfileMap(
  profiles: ReviewAuthorProfile[],
): Map<string, ReviewAuthorProfile> {
  const map = new Map<string, ReviewAuthorProfile>();
  for (const p of profiles) map.set(p.authorKey, p);
  return map;
}

export function getProfileByAuthorKey(
  profiles: ReviewAuthorProfile[],
  authorKey: string,
): ReviewAuthorProfile | undefined {
  return profiles.find((p) => p.authorKey === authorKey);
}

export function getAuthorRelatedReviews<T extends { id: string }>(
  reviews: T[],
  authorKey: string,
  getAuthorKey: (r: T) => string,
): T[] {
  return reviews.filter((r) => getAuthorKey(r) === authorKey);
}

export function toAuthorSummary(profile: ReviewAuthorProfile): ReviewAuthorSummary {
  return {
    authorKey: profile.authorKey,
    totalReviews: profile.totalReviews,
    authorTrustScore: profile.authorTrustScore,
    authorRiskLevel: profile.authorRiskLevel,
  };
}
