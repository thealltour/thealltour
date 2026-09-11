/**
 * Narrow marketing publication side-effect gate (PUB-2).
 *
 * prepare/persist is allowed without live SNS calls.
 * Live adapter invocation requires an explicit allowlist — not a global flip of
 * PUBLICATION_FLOW_INACTIVE.
 */

import type { SocialChannel } from "@/lib/marketing/social/domain/providers";
import { PUBLICATION_FLOW_INACTIVE } from "@/lib/marketing/social/publication/governanceBoundary";

export type MarketingPublicationSideEffectAllowlist = {
  /** Default false — deny all live remote calls */
  enabled: boolean;
  /** When set, only this channel may execute */
  channel?: SocialChannel;
  /** When set, only this social_accounts.id may execute */
  socialAccountId?: string;
  /** When set, only this social_publications.id may execute */
  publicationId?: string;
};

export const DEFAULT_MARKETING_PUBLICATION_SIDE_EFFECTS: MarketingPublicationSideEffectAllowlist =
  Object.freeze({
    enabled: false,
  });

export type MarketingPublicationSideEffectContext = {
  channel: SocialChannel;
  socialAccountId: string;
  publicationId: string;
};

export function isMarketingPublicationSideEffectAllowed(
  policy: MarketingPublicationSideEffectAllowlist,
  context: MarketingPublicationSideEffectContext,
): boolean {
  if (!policy.enabled) return false;
  // PUBLICATION_FLOW_INACTIVE remains true globally; allowlist is the only narrow escape
  // checked by the orchestrator before assertCanInvokePublicationAdapter(..., sideEffectsExplicitlyAllowed).
  void PUBLICATION_FLOW_INACTIVE;
  if (policy.channel && policy.channel !== context.channel) return false;
  if (policy.socialAccountId && policy.socialAccountId !== context.socialAccountId) return false;
  if (policy.publicationId && policy.publicationId !== context.publicationId) return false;
  return true;
}

export function assertMarketingPublicationSideEffectAllowed(
  policy: MarketingPublicationSideEffectAllowlist,
  context: MarketingPublicationSideEffectContext,
): void {
  if (!isMarketingPublicationSideEffectAllowed(policy, context)) {
    throw new Error(
      `Marketing publication side effects denied ` +
        `(enabled=${policy.enabled}, channel=${context.channel}, ` +
        `account=${context.socialAccountId}, publication=${context.publicationId}). ` +
        `PUBLICATION_FLOW_INACTIVE=${PUBLICATION_FLOW_INACTIVE}.`,
    );
  }
}
