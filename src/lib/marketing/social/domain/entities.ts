/**
 * Domain objects: MarketingPost ≠ ExternalPublication ≠ PerformanceSnapshot.
 * Persistence schema is NOT created in STEP 3-1 — types only.
 */

import type { SocialChannel, SocialMediaType, SocialProvider } from "@/lib/marketing/social/domain/providers";

/**
 * Internal marketing content/post candidate (draft / governed body).
 * Not an SNS publication row. Do not map 1:1 onto `thread_marketing_posts`.
 */
export type MarketingPostRef = {
  /** Internal content id (e.g. ai_contents.id) when known */
  contentId?: string | null;
  productId?: string | null;
  channel: SocialChannel | string;
  title?: string | null;
  body: string;
  mediaTypes?: SocialMediaType[];
};

/**
 * One outbound placement on a provider channel.
 * One MarketingPost may yield many ExternalPublications.
 */
export type ExternalPublicationRef = {
  /** Future social_publications.id — unset until persistence exists */
  publicationId?: string | null;
  marketingPostContentId?: string | null;
  provider: SocialProvider;
  channel: SocialChannel;
  /** Provider-native post id after publish */
  externalPostId?: string | null;
  externalUrl?: string | null;
  /** Future social_accounts.id */
  socialAccountId?: string | null;
};

/**
 * Point-in-time metrics for an account or a publication.
 * Belongs to publication/account — not directly to MarketingPost.
 */
export type PerformanceSnapshotRef = {
  /** Future performance_snapshots.id */
  snapshotId?: string | null;
  provider: SocialProvider;
  channel: SocialChannel;
  scope: "account" | "publication";
  socialAccountId?: string | null;
  externalPublicationId?: string | null;
  measuredAt: string;
};

/** Documented future persistence concepts (no migration in 3-1). */
export const FUTURE_SOCIAL_PERSISTENCE_CONCEPTS = [
  "social_accounts",
  "social_publications",
  "performance_snapshots",
] as const;

export type FutureSocialPersistenceConcept = (typeof FUTURE_SOCIAL_PERSISTENCE_CONCEPTS)[number];

/**
 * Explicit non-goal: do not reuse `thread_marketing_posts` as the
 * external SNS publication store.
 */
export const THREAD_MARKETING_POSTS_NOT_EXTERNAL_PUBLICATION_MODEL =
  "thread_marketing_posts_is_internal_threads_history_only" as const;
