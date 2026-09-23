/**
 * CG-3 — Idempotent CG-2 bridge reconciliation for early-return / existing-candidate paths.
 * Never enqueues RenderJob; never auto-PICK.
 */

import "server-only";

import {
  maybeGenerateShortformBriefAndResolve,
  type DailyShortformBridgeResult,
} from "@/lib/marketing/assets/shortform/dailyShortformBridge";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { MarketingAssetEnv } from "@/lib/marketing/assets/config";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";

export async function reconcileDailyShortformBridgeForCandidate(input: {
  candidate: CompletedMarketingCandidate;
  assetRoot?: string | null;
  env?: MarketingAssetEnv;
  now?: Date;
  /** MQ-4 — optional pre-generated LLM publishable bundle (tests / callers). */
  publishableBundle?: PublishableContentBundle | null;
}): Promise<DailyShortformBridgeResult> {
  try {
    return await maybeGenerateShortformBriefAndResolve({
      candidate: input.candidate,
      assetRoot: input.assetRoot,
      env: input.env,
      now: input.now,
      publishableBundle: input.publishableBundle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      outcome: "brief_failed",
      shortformIntended: false,
      reason: "reconcile_exception",
      error: message.slice(0, 400),
    };
  }
}
