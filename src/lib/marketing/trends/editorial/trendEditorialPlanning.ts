/**
 * Trend-informed editorial planning for Marketing Manager.
 * Meta confidence/popularity/market_relevance.score are NEVER used as Agenda score multipliers.
 * vertical_tags → channel direct mapping is forbidden.
 */

import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";
import {
  resolveMarketingTrendEditorialMode,
  type MarketingTrendEditorialMode,
} from "@/lib/marketing/trends/editorial/trendEditorialModeConfig";

export type TrendEditorialPlanningFields = {
  contentAngle: string | null;
  hookSignals: string[];
  formatSignals: string[];
  audiencePainPoints: string[];
  personaHints: string[];
  recommendedChannel: string | null;
  recommendedFormat: string | null;
  editorialRationale: string | null;
};

export type TrendEditorialDiagnostics = {
  mode: MarketingTrendEditorialMode;
  availableTrendCount: number;
  adaptedTrendCount: number;
  editorialSignalCount: number;
  hypotheticalAppliedCount: number;
  appliedCount: number;
  degradeReason: string | null;
};

export type TrendEditorialPlanResult = {
  mode: MarketingTrendEditorialMode;
  plansByBriefId: Map<string, TrendEditorialPlanningFields>;
  diagnostics: TrendEditorialDiagnostics;
};

function countEditorialSignals(ed: ResearchBriefEditorialIntelligence | null | undefined): number {
  if (!ed) return 0;
  return (
    ed.hookSignals.length +
    ed.formatSignals.length +
    ed.audiencePainPoints.length +
    ed.audienceQuestions.length +
    ed.personaHints.length +
    ed.contentAngles.length
  );
}

/**
 * Decide recommended channel/format from trend+editorial+topic+vertical+research —
 * never vertical_tags alone.
 */
export function decideRecommendedChannelFormat(input: {
  editorial: ResearchBriefEditorialIntelligence | null | undefined;
  topics: string[];
  destinations: string[];
  verticalTags?: string[];
}): { channel: string | null; format: string | null; rationale: string } {
  const formats = input.editorial?.formatSignals ?? [];
  const angles = input.editorial?.contentAngles ?? [];
  const hooks = input.editorial?.hookSignals ?? [];
  const topics = input.topics.map((t) => t.toLowerCase());
  const dest = input.destinations.join(" ");

  let channel: string | null = null;
  let format: string | null = null;
  const reasons: string[] = [];

  const formatBlob = formats.join(" ").toLowerCase();
  if (/reel|short|shorts|tiktok/.test(formatBlob)) {
    channel = "instagram";
    format = "short_reel";
    reasons.push("format_signals_short_video");
  } else if (/carousel|카드/.test(formatBlob)) {
    channel = "instagram";
    format = "carousel";
    reasons.push("format_signals_carousel");
  } else if (/vlog|youtube|롱폼/.test(formatBlob)) {
    channel = "youtube";
    format = "vlog";
    reasons.push("format_signals_vlog");
  } else if (/thread|스레드/.test(formatBlob) || topics.some((t) => /audience_question|pain/.test(t))) {
    channel = "threads";
    format = "threads_text";
    reasons.push("conversational_or_qna_fit");
  } else if (hooks.length > 0 || angles.length > 0) {
    channel = "threads";
    format = "threads_text";
    reasons.push("editorial_hooks_default_threads");
  }

  if (!channel && (dest || topics.length > 0)) {
    channel = "threads";
    format = "threads_text";
    reasons.push("topic_destination_fallback_threads");
  }

  // Explicitly ignore vertical_tags as sole channel driver (may appear in rationale only).
  if ((input.verticalTags?.length ?? 0) > 0) {
    reasons.push("vertical_tags_context_only_not_channel_map");
  }

  return {
    channel,
    format,
    rationale: reasons.join("; ") || "no_editorial_signal",
  };
}

export function buildTrendEditorialPlanForBrief(
  brief: ResearchBrief,
): TrendEditorialPlanningFields | null {
  if (!brief.trendContext && !brief.editorialIntelligence) {
    return null;
  }
  const editorial = brief.editorialIntelligence ?? null;
  const decision = decideRecommendedChannelFormat({
    editorial,
    topics: brief.topics,
    destinations: brief.destinations,
    verticalTags: brief.trendContext?.verticalTags,
  });
  return {
    contentAngle: editorial?.contentAngles[0] ?? null,
    hookSignals: editorial?.hookSignals ?? [],
    formatSignals: editorial?.formatSignals ?? [],
    audiencePainPoints: editorial?.audiencePainPoints ?? [],
    personaHints: editorial?.personaHints ?? [],
    recommendedChannel: decision.channel,
    recommendedFormat: decision.format,
    editorialRationale: [
      decision.rationale,
      editorial?.contentAngles[0] ? `angle:${editorial.contentAngles[0]}` : null,
      brief.trendContext ? `trend:${brief.trendContext.trendType}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
  };
}

export function buildTrendEditorialPlans(input: {
  briefs: ResearchBrief[];
  adaptedTrendCount?: number;
  availableTrendCount?: number;
  mode?: MarketingTrendEditorialMode;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  degradeReason?: string | null;
}): TrendEditorialPlanResult {
  const mode = input.mode ?? resolveMarketingTrendEditorialMode(input.env);
  const plansByBriefId = new Map<string, TrendEditorialPlanningFields>();
  let editorialSignalCount = 0;

  if (mode === "off") {
    return {
      mode,
      plansByBriefId,
      diagnostics: {
        mode,
        availableTrendCount: input.availableTrendCount ?? 0,
        adaptedTrendCount: input.adaptedTrendCount ?? 0,
        editorialSignalCount: 0,
        hypotheticalAppliedCount: 0,
        appliedCount: 0,
        degradeReason: input.degradeReason ?? null,
      },
    };
  }

  for (const brief of input.briefs) {
    const plan = buildTrendEditorialPlanForBrief(brief);
    if (!plan) continue;
    editorialSignalCount += countEditorialSignals(brief.editorialIntelligence);
    plansByBriefId.set(brief.id, plan);
  }

  const hypotheticalAppliedCount = plansByBriefId.size;
  const appliedCount = mode === "live" ? plansByBriefId.size : 0;

  return {
    mode,
    plansByBriefId,
    diagnostics: {
      mode,
      availableTrendCount: input.availableTrendCount ?? 0,
      adaptedTrendCount: input.adaptedTrendCount ?? plansByBriefId.size,
      editorialSignalCount,
      hypotheticalAppliedCount,
      appliedCount,
      degradeReason: input.degradeReason ?? null,
    },
  };
}

/** Apply live editorial overlays onto compact MM candidates (production path). */
export function applyTrendEditorialToCompactCandidates(
  candidates: CompactManagerAgendaCandidate[],
  plansByBriefId: Map<string, TrendEditorialPlanningFields>,
  mode: MarketingTrendEditorialMode,
): CompactManagerAgendaCandidate[] {
  if (mode !== "live" || plansByBriefId.size === 0) {
    return candidates;
  }
  return candidates.map((c) => {
    const plan = plansByBriefId.get(c.researchBriefId);
    if (!plan) return c;
    const extraReasons = [
      plan.contentAngle ? `contentAngle:${plan.contentAngle}` : null,
      plan.editorialRationale ? `editorial:${plan.editorialRationale}` : null,
      plan.recommendedChannel ? `recChannel:${plan.recommendedChannel}` : null,
      plan.recommendedFormat ? `recFormat:${plan.recommendedFormat}` : null,
      plan.hookSignals[0] ? `hook:${plan.hookSignals[0]}` : null,
    ].filter((x): x is string => Boolean(x));
    return {
      ...c,
      scoreReasons: [...(c.scoreReasons ?? []), ...extraReasons].slice(0, 16),
    };
  });
}
