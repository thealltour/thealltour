import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { CardPresentationPlan } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import {
  CARD_PRESENTATION_PLAN_MEDIA_TYPE,
  CARD_PRESENTATION_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/assets/cardnews/presentation/contracts";

export function persistCardPresentationPlan(input: {
  packageRoot: string;
  plan: CardPresentationPlan;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: CARD_PRESENTATION_PLAN_RELATIVE_PATH,
      content: stableJsonBytes(input.plan),
      kind: "context",
      origin: "pipeline_export",
      mediaType: CARD_PRESENTATION_PLAN_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.plan.provenance.generatedAt,
  });
}

export function readCardPresentationPlanFromPackage(
  packageRoot: string,
): CardPresentationPlan | null {
  const absolute = join(packageRoot, CARD_PRESENTATION_PLAN_RELATIVE_PATH);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as CardPresentationPlan;
  } catch {
    return null;
  }
}
