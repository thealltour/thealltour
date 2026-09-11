import type { MediaBrief } from "@/lib/marketing/assets/contracts";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";

/**
 * Explicit generation gate for ShortVideoBrief.
 * CG-2 may auto-wire through maybeGenerateShortformBriefAndResolve after candidate save
 * when short_video_concept is committed under the daily quota policy.
 * Still never auto-PICK or enqueue RenderJob.
 */
export function isShortVideoBriefGenerationApplicable(mediaBrief: MediaBrief): boolean {
  return (
    mediaBrief.formats.shortform.enabled === true &&
    mediaBrief.formats.shortform.narrationSegments.length >= 1
  );
}

/**
 * Soft hint from ProductionRequest selection metadata.
 * Does NOT authorize automatic generation by itself.
 */
export function productionRequestMentionsShortVideoConcept(
  request: Pick<MarketingProductionRequest, "selection"> | null | undefined,
): boolean {
  const formats = request?.selection?.recommendedFormats ?? [];
  return formats.some((format) => {
    const normalized = format.trim().toLowerCase();
    return (
      normalized === "short_video_concept" ||
      normalized === "shortform" ||
      normalized === "short_video" ||
      normalized.includes("short_video")
    );
  });
}
