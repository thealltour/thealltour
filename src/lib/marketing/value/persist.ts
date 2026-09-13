import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { PublishableChannel, PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  MARKETING_VALUE_BUNDLE_CONTRACT,
  type MarketingValueAssessment,
  type MarketingValueBundle,
} from "@/lib/marketing/value/contracts";
import { parseMarketingValueBundle } from "@/lib/marketing/value/parse";
import { MARKETING_VALUE_MEDIA_TYPE, MARKETING_VALUE_RELATIVE_PATH } from "@/lib/marketing/value/paths";

export function buildMarketingValueBundle(input: {
  candidateId: string;
  sourceRevision: string;
  channels: Partial<Record<PublishableChannel, MarketingValueAssessment>>;
  now?: Date;
}): MarketingValueBundle {
  return {
    contract: MARKETING_VALUE_BUNDLE_CONTRACT,
    candidateId: input.candidateId,
    sourceRevision: input.sourceRevision,
    generatedAt: (input.now ?? new Date()).toISOString(),
    channels: input.channels,
  };
}

export function persistMarketingValueBundle(input: {
  packageRoot: string;
  bundle: MarketingValueBundle;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: MARKETING_VALUE_RELATIVE_PATH,
      content: stableJsonBytes(input.bundle),
      kind: "context",
      origin: "pipeline_export",
      mediaType: MARKETING_VALUE_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.bundle.generatedAt,
  });
}

export function tryReadMarketingValueBundle(
  packageRoot: string | null | undefined,
): MarketingValueBundle | null {
  if (!packageRoot) return null;
  const path = join(packageRoot, MARKETING_VALUE_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    return parseMarketingValueBundle(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

export function attachAssessmentsToPublishableBundle(
  publishable: PublishableContentBundle,
  assessments: Partial<Record<PublishableChannel, MarketingValueAssessment>>,
): PublishableContentBundle {
  const next = { ...publishable };
  for (const channel of Object.keys(assessments) as PublishableChannel[]) {
    const assessment = assessments[channel];
    const slot = next[channel as keyof PublishableContentBundle];
    if (!assessment || !slot || typeof slot !== "object" || !("body" in slot)) continue;
    (next as Record<string, unknown>)[channel] = {
      ...slot,
      marketingValue: assessment,
    };
  }
  return next;
}

export function markMarketingValueStale(
  assessment: MarketingValueAssessment | null | undefined,
): MarketingValueAssessment | null {
  if (!assessment) return null;
  return { ...assessment, stale: true };
}
