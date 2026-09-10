import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { MarketingAssetContractError } from "@/lib/marketing/assets/errors";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import type { ShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import {
  SHORT_VIDEO_BRIEF_MEDIA_TYPE,
  SHORT_VIDEO_BRIEF_RELATIVE_PATH,
} from "@/lib/marketing/assets/shortVideoBrief/paths";
import { parseShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/validate";
import {
  assertPackageArtifactWritable,
  describePlannedArtifact,
  writePackageArtifact,
  type PlannedPackageArtifact,
} from "@/lib/marketing/assets/writeArtifact";

const SHORT_VIDEO_BRIEF_ORIGIN = "short_video_brief" as const;

/**
 * Plan ShortVideoBrief as a Candidate Package artifact.
 * Explicit caller only — not connected to production export/queue.
 */
export function planShortVideoBriefArtifact(brief: ShortVideoBrief): PlannedPackageArtifact {
  const parsed = parseShortVideoBrief(brief);
  if (jsonContainsForbiddenBotLeak(parsed)) {
    throw new MarketingAssetContractError("ShortVideoBrief contains a forbidden field");
  }
  return {
    relativePath: SHORT_VIDEO_BRIEF_RELATIVE_PATH,
    content: stableJsonBytes(parsed),
    kind: "context",
    origin: SHORT_VIDEO_BRIEF_ORIGIN,
    mediaType: SHORT_VIDEO_BRIEF_MEDIA_TYPE,
  };
}

export function persistShortVideoBrief(input: {
  packageRoot: string;
  brief: ShortVideoBrief;
  createdAt: string;
}): {
  status: "created" | "reused";
  artifact: ReturnType<typeof describePlannedArtifact>;
  relativePath: typeof SHORT_VIDEO_BRIEF_RELATIVE_PATH;
} {
  const planned = planShortVideoBriefArtifact(input.brief);
  assertPackageArtifactWritable({ packageRoot: input.packageRoot, planned });
  const written = writePackageArtifact({
    packageRoot: input.packageRoot,
    planned,
    createdAt: input.createdAt,
  });
  return {
    status: written.status,
    artifact: written.artifact,
    relativePath: SHORT_VIDEO_BRIEF_RELATIVE_PATH,
  };
}
