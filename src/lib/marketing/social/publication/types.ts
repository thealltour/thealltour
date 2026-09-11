/**
 * Publication layer: AI Marketing → SNS (write path).
 * No performance-collection methods. No live API in STEP 3-1.
 */

import type { MarketingPostRef } from "@/lib/marketing/social/domain/entities";
import type { SocialChannel, SocialMediaType, SocialProvider } from "@/lib/marketing/social/domain/providers";

export const PUBLICATION_STATUSES = [
  "pending",
  "queued",
  "publishing",
  "published",
  "failed",
  "rejected_by_provider",
  "unsupported",
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export type PublicationRequest = {
  provider: SocialProvider;
  channel: SocialChannel;
  /** Must already be past Human Approval in the marketing orchestrator */
  marketingPost: MarketingPostRef;
  /** social_accounts.id — never a raw token */
  socialAccountId?: string | null;
  idempotencyKey?: string | null;
  mediaTypes?: SocialMediaType[];
  /** Optional public image URL for IMAGE posts (Threads first adapter) */
  imageUrl?: string | null;
  /** Opaque human approval evidence ref persisted on SocialPublication */
  humanApprovalRef?: string | null;
};

/** Adapter-only runtime — credentials must not appear on SocialPublication rows */
export type PublicationAdapterRuntime = {
  credential: import("@/lib/marketing/social/domain/credentials").ResolvedAdapterCredential;
};

export type PublicationError = {
  code: string;
  message: string;
  retryable: boolean;
  providerCode?: string | null;
};

export type PublicationResult = {
  status: PublicationStatus;
  provider: SocialProvider;
  channel: SocialChannel;
  externalPostId?: string | null;
  externalUrl?: string | null;
  error?: PublicationError | null;
  /** true only when a remote provider write actually occurred */
  sideEffectPerformed: boolean;
};

/**
 * Provider-neutral publication port.
 * Implementors must NOT add collector or metrics methods.
 */
export type PublicationAdapter = {
  readonly kind: "publication_adapter";
  readonly provider: SocialProvider;
  readonly channel: SocialChannel;
  publish(
    request: PublicationRequest,
    runtime?: PublicationAdapterRuntime,
  ): Promise<PublicationResult>;
  getStatus?(externalPostId: string): Promise<PublicationStatus>;
};

/** Runtime guard: publication ports must not expose collector surface. */
export function assertPublicationAdapterSurface(adapter: PublicationAdapter): void {
  if (adapter.kind !== "publication_adapter") {
    throw new Error("Invalid PublicationAdapter kind");
  }
  const record = adapter as PublicationAdapter & Record<string, unknown>;
  for (const forbidden of ["collectAccountPerformance", "collectPublicationPerformance", "collect"]) {
    if (typeof record[forbidden] === "function") {
      throw new Error(`PublicationAdapter must not expose ${forbidden}`);
    }
  }
}
