import { EXTERNAL_EDITORIAL_MODEL_PROFILE } from "@/lib/marketing/publishable/channelSources/contracts";
import { readExternalEditorialCandidateByRef } from "@/lib/marketing/publishable/channelSources/externalCandidateStore";
import { materializeExternalNarrativePlan } from "@/lib/marketing/publishable/channelSources/externalNarrative";
import { readPublishableBundle } from "@/lib/marketing/publishable/channelSources/packageIo";
import { readChannelSourceSelection } from "@/lib/marketing/publishable/channelSources/selection";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  readEditorialNarrativePlanFromPackage,
  readInstagramCarouselPlanFromPackage,
} from "@/lib/marketing/publishable/instagramEditorial/persist";

/**
 * Narrative handed to the Visual Role Architect alongside the Instagram carousel sidecar.
 * External carousels reference external beat IDs, so they get the candidate narrative;
 * Hermes carousels keep the shared editorial-narrative-plan.json.
 */
export function resolveInstagramNarrativeForVisualPlanning(
  packageRoot: string,
): EditorialNarrativePlan | null {
  const carousel = readInstagramCarouselPlanFromPackage(packageRoot);
  if (carousel?.provenance?.modelProfile !== EXTERNAL_EDITORIAL_MODEL_PROFILE) {
    return readEditorialNarrativePlanFromPackage(packageRoot);
  }
  const slotRef = readPublishableBundle(packageRoot)?.instagram?.provenance.externalCandidateRef ?? null;
  const record = readChannelSourceSelection(packageRoot)?.channels.instagram;
  const recordRef = record?.selectedSource === "external_editorial" ? record.candidateRef : null;
  for (const ref of [slotRef, recordRef]) {
    if (!ref) continue;
    const candidate = readExternalEditorialCandidateByRef(packageRoot, ref);
    if (!candidate || candidate.externalNarrativeFingerprint !== carousel.sourceNarrativeFingerprint) continue;
    try {
      return materializeExternalNarrativePlan({
        narrative: candidate.result.narrative,
        asset: { assetId: candidate.assetId, version: candidate.canonicalVersion },
        externalNarrativeFingerprint: candidate.externalNarrativeFingerprint,
        generatedAt: candidate.importedAt,
      });
    } catch {
      return null;
    }
  }
  return null;
}
