/** Reference material does not cap an approved visual's subject matter. */
import type { ManualAstraApprovedAssetContext } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import type { SharedVisual } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

export function buildEvidenceGuidance(input: {
  visual: SharedVisual;
  asset: ManualAstraApprovedAssetContext | null | undefined;
}): string[] {
  const out = [
    "Canonical and Research are reference material, not an exhaustive factual boundary. Follow the approved visual intent, including independently researched developments; no prior Canonical amendment is required.",
    "Generated imagery is illustrative editorial material, not documentary proof.",
    "Do not compose the image to look like a verified on-site documentary photograph.",
  ];
  const context = `${input.visual.role} ${input.visual.visualIntent}`;
  if (/(족|people|인물|주민|문화|ethnic|dao|다오|community)/i.test(context)) {
    out.push("Avoid costume fantasy, exaggerated exoticism, or stereotyped ceremonial depiction.");
    out.push("Represent communities contextually; do not claim verified access to residents' private lives.");
  }
  return out;
}
