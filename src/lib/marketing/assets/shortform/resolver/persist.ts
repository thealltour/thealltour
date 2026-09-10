import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { MarketingAssetContractError } from "@/lib/marketing/assets/errors";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import {
  SHORTFORM_SOURCE_RESOLUTION_CONTRACT,
  type ShortformSourceResolutionPlan,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
import {
  SHORTFORM_SOURCE_RESOLUTION_MEDIA_TYPE,
  SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH,
} from "@/lib/marketing/assets/shortform/resolver/paths";
import {
  assertPackageArtifactWritable,
  writePackageArtifact,
  type PlannedPackageArtifact,
} from "@/lib/marketing/assets/writeArtifact";

const ORIGIN = "shortform_source_resolution" as const;

export function planShortformSourceResolutionArtifact(
  plan: ShortformSourceResolutionPlan,
): PlannedPackageArtifact {
  if (plan.contract !== SHORTFORM_SOURCE_RESOLUTION_CONTRACT) {
    throw new MarketingAssetContractError("invalid shortform source resolution contract");
  }
  if (jsonContainsForbiddenBotLeak(plan)) {
    throw new MarketingAssetContractError("resolution plan contains a forbidden field");
  }
  return {
    relativePath: SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH,
    content: stableJsonBytes(plan),
    kind: "context",
    origin: ORIGIN,
    mediaType: SHORTFORM_SOURCE_RESOLUTION_MEDIA_TYPE,
  };
}

export function persistShortformSourceResolution(input: {
  packageRoot: string;
  plan: ShortformSourceResolutionPlan;
  createdAt: string;
}): { status: "created" | "reused"; relativePath: string; sha256: string } {
  const planned = planShortformSourceResolutionArtifact(input.plan);
  assertPackageArtifactWritable({ packageRoot: input.packageRoot, planned });
  const written = writePackageArtifact({
    packageRoot: input.packageRoot,
    planned,
    createdAt: input.createdAt,
  });
  return {
    status: written.status,
    relativePath: planned.relativePath,
    sha256: written.artifact.sha256,
  };
}
