/**
 * Resolve which publishable channels to generate.
 * Never silently expand beyond strategy / explicit selection.
 */

import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import {
  PUBLISHABLE_BASELINE_CHANNELS,
  PUBLISHABLE_OPTIONAL_CHANNELS,
  isPublishableChannel,
  type PublishableChannel,
} from "@/lib/marketing/publishable/contracts";

function uniqueChannels(channels: PublishableChannel[]): PublishableChannel[] {
  const seen = new Set<PublishableChannel>();
  const out: PublishableChannel[] = [];
  for (const ch of channels) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}

/**
 * Soft recommendation for Content Strategist — not auto-applied by composers.
 * Examples (policy guidance, not hard maps):
 * - conversation → threads + shortform
 * - deep planning/search → naver_blog + shortform
 * - community/family → naver_band + threads
 * - offer/consultation → kakao_channel + naver_band
 */
export function recommendTargetChannelsFromAcrb(input: {
  acrb?: AudienceContentResearchBrief | null;
  commercialIntent?: string | null;
  contentObjective?: string | null;
}): PublishableChannel[] {
  const recommended: PublishableChannel[] = ["threads", "shortform"];
  const acrb = input.acrb;
  const fit = acrb?.contentAngles.find((a) => a.angleId === acrb.recommendedAngleId)?.channelFit
    ?? acrb?.contentAngles[0]?.channelFit
    ?? null;
  const intent = (input.commercialIntent ?? "").toLowerCase();
  const objective = `${input.contentObjective ?? ""} ${acrb?.searchIntent.primaryIntent ?? ""}`.toLowerCase();
  const searchy =
    /informational|planning|comparison|problem|search|가이드|준비|동선/.test(objective) ||
    (acrb?.searchIntent.questions.length ?? 0) >= 2;
  const community =
    /family|community|band|가족|커뮤니티/.test(objective) ||
    (acrb?.audience.anxieties.length ?? 0) >= 2;
  const commercial = intent === "commercial" || intent === "mixed" || intent === "transactional";

  if (fit) {
    if ((fit.naver_blog ?? 0) >= 0.55 && searchy) recommended.push("naver_blog");
    if ((fit.naver_band ?? 0) >= 0.5 && community) recommended.push("naver_band");
    if ((fit.kakao_channel ?? 0) >= 0.5 && commercial) recommended.push("kakao_channel");
  } else {
    if (searchy) recommended.push("naver_blog");
    if (community) recommended.push("naver_band");
    if (commercial) recommended.push("kakao_channel");
  }

  return uniqueChannels(recommended);
}

/**
 * Final selected channels for generation.
 * Priority: explicit override → contentPlan.targetChannels → baseline only.
 */
export function resolveTargetPublishableChannels(input: {
  explicit?: PublishableChannel[] | null;
  contentPlanTargetChannels?: string[] | null;
}): PublishableChannel[] {
  const fromExplicit = (input.explicit ?? []).filter(isPublishableChannel);
  if (fromExplicit.length > 0) {
    return uniqueChannels([
      ...PUBLISHABLE_BASELINE_CHANNELS,
      ...fromExplicit.filter((c) =>
        (PUBLISHABLE_OPTIONAL_CHANNELS as readonly string[]).includes(c) ||
        (PUBLISHABLE_BASELINE_CHANNELS as readonly string[]).includes(c),
      ),
    ]);
  }

  const fromPlan = (input.contentPlanTargetChannels ?? []).filter(isPublishableChannel);
  if (fromPlan.length > 0) {
    // Honor plan, but always keep baseline threads+shortform when plan lists any channel.
    const hasBaseline = fromPlan.some((c) =>
      (PUBLISHABLE_BASELINE_CHANNELS as readonly string[]).includes(c),
    );
    return uniqueChannels(
      hasBaseline ? fromPlan : [...PUBLISHABLE_BASELINE_CHANNELS, ...fromPlan],
    );
  }

  return [...PUBLISHABLE_BASELINE_CHANNELS];
}
