/**
 * Placeholder adapters for STEP 3-1 — always unsupported, never hit the network.
 * Real provider modules belong under providers/<vendor>/ in later steps.
 */

import type { PublicationAdapter, PublicationRequest, PublicationResult } from "@/lib/marketing/social/publication/types";
import type { PerformanceCollector, DateRange, AccountPerformance, PublicationPerformance } from "@/lib/marketing/social/performance/types";
import type { SocialChannel, SocialProvider } from "@/lib/marketing/social/domain/providers";
import { CHANNEL_PROVIDER } from "@/lib/marketing/social/domain/providers";

export function createUnsupportedPublicationAdapter(
  channel: SocialChannel,
): PublicationAdapter {
  const provider: SocialProvider = CHANNEL_PROVIDER[channel];
  return {
    kind: "publication_adapter",
    provider,
    channel,
    async publish(request: PublicationRequest): Promise<PublicationResult> {
      void request;
      return {
        status: "unsupported",
        provider,
        channel,
        sideEffectPerformed: false,
        error: {
          code: "PUBLICATION_UNSUPPORTED",
          message: `Official publication API for ${channel} is not implemented (STEP 3-1 contracts only).`,
          retryable: false,
        },
      };
    },
    async getStatus(): Promise<"unsupported"> {
      return "unsupported";
    },
  };
}

export function createUnsupportedPerformanceCollector(
  channel: SocialChannel,
): PerformanceCollector {
  const provider: SocialProvider = CHANNEL_PROVIDER[channel];
  return {
    kind: "performance_collector",
    provider,
    channel,
    async collectAccountPerformance(input: {
      socialAccountId?: string | null;
      period: DateRange;
    }): Promise<AccountPerformance> {
      return {
        provider,
        channel,
        socialAccountId: input.socialAccountId ?? null,
        period: input.period,
        metrics: [],
        dataAvailability: "unavailable",
      };
    },
    async collectPublicationPerformance(input: {
      externalPostId?: string | null;
      socialPublicationId?: string | null;
      period: DateRange;
    }): Promise<PublicationPerformance> {
      return {
        provider,
        channel,
        externalPostId: input.externalPostId ?? null,
        socialPublicationId: input.socialPublicationId ?? null,
        period: input.period,
        metrics: [],
        dataAvailability: "unavailable",
      };
    },
  };
}
