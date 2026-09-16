import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import { AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH } from "@/lib/marketing/audienceResearch/paths";
import { parseAudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/validate";

/**
 * Load durable ACRB from an exported marketing package (no external research).
 */
export function tryReadAudienceContentResearchBriefFromPackage(
  packageRoot: string | null | undefined,
): AudienceContentResearchBrief | null {
  if (!packageRoot) return null;
  const path = join(packageRoot, AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    return parseAudienceContentResearchBrief(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}
