import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { InstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import {
  INSTAGRAM_VISUAL_ROLE_PLAN_MEDIA_TYPE,
  INSTAGRAM_VISUAL_ROLE_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/instagramVisualRole/paths";

export function persistInstagramVisualRolePlan(input: {
  packageRoot: string;
  plan: InstagramVisualRolePlan;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: INSTAGRAM_VISUAL_ROLE_PLAN_RELATIVE_PATH,
      content: stableJsonBytes(input.plan),
      kind: "context",
      origin: "pipeline_export",
      mediaType: INSTAGRAM_VISUAL_ROLE_PLAN_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.plan.provenance.generatedAt,
  });
}

export function readInstagramVisualRolePlanFromPackage(
  packageRoot: string,
): InstagramVisualRolePlan | null {
  const absolute = join(packageRoot, INSTAGRAM_VISUAL_ROLE_PLAN_RELATIVE_PATH);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as InstagramVisualRolePlan;
  } catch {
    return null;
  }
}
