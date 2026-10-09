import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { readExternalResearchSummary } from "@/lib/marketing/canonicalAsset/applyExternalResearchConflicts";
import { listExternalEditorialCandidates } from "../channelSources/externalCandidateStore";
import { stableFingerprint } from "./fingerprint";

/** Match the Research panel's newest Research artifact, never an Instagram import. */
export function readNarrationResearch(root: string, asset: CanonicalMarketingAsset) {
  const candidate = listExternalEditorialCandidates(root).find(item => item.result.research != null);
  if (!candidate) return null;
  const summary = readExternalResearchSummary(candidate.result, asset);
  const applied = asset.researchRevision;
  const fresh = candidate.assetId === asset.assetId && candidate.sourceRevision === asset.sourceRevision &&
    (candidate.canonicalVersion === asset.version ||
      (applied?.importId === candidate.importId && applied.fromVersion === candidate.canonicalVersion));
  return { candidate, summary, fresh, fingerprint: stableFingerprint({ importId: candidate.importId,
    candidateId: candidate.candidateId, assetId: candidate.assetId, canonicalVersion: candidate.canonicalVersion,
    sourceRevision: candidate.sourceRevision, research: candidate.result.research }) };
}
