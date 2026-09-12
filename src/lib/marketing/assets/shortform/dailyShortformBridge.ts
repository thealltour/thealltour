/**
 * CG-2 — Daily shortform brief + source-resolution bridge.
 *
 * After CompletedMarketingCandidate is saved, optionally:
 *   MediaBrief → ShortVideoBrief → Source Resolver (persist)
 *
 * Does NOT: auto-PICK, enqueue RenderJob, render, approve, or publish.
 */

import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { buildMediaBriefFromCandidate } from "@/lib/marketing/assets/buildMediaBriefFromCandidate";
import { resolveMarketingAssetRoot, type MarketingAssetEnv } from "@/lib/marketing/assets/config";
import type { MediaBrief } from "@/lib/marketing/assets/contracts";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import { exportMarketingCandidatePackage } from "@/lib/marketing/assets/exportMarketingCandidatePackage";
import {
  assertSafeCandidateId,
  resolvePackageDirectory,
  splitBusinessDateParts,
} from "@/lib/marketing/assets/paths";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import { createMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository";
import { isShortVideoBriefGenerationApplicable } from "@/lib/marketing/assets/shortVideoBrief/gating";
import { buildShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";
import { persistShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/persist";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import { splitShortformNarrationSegments } from "@/lib/marketing/assets/shortform/narrationSegments";
import { createShortformResolverProviders } from "@/lib/marketing/assets/shortform/resolver/createProviders";
import { persistShortformSourceResolution } from "@/lib/marketing/assets/shortform/resolver/persist";
import { SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/resolver/paths";
import { resolveShortVideoSources } from "@/lib/marketing/assets/shortform/resolver/resolveBrief";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { ContentFormatKind } from "@/lib/marketing/content/types";
import { applyPublishableContentToMediaBrief } from "@/lib/marketing/publishable/applyToMediaBrief";
import { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";

export const DAILY_SHORTFORM_COMMITMENT_CONTRACT = "daily-shortform-commitment-v1" as const;
export const DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH = "context/shortform-commitment.json" as const;
/** Initial operating policy: one publishable shortform commitment per business date. */
export const MAX_DAILY_SHORTFORM_COMMITMENTS = 1 as const;

export type DailyShortformCommitment = {
  contract: typeof DAILY_SHORTFORM_COMMITMENT_CONTRACT;
  businessDateKst: string;
  candidateId: string;
  shortformIntended: true;
  committedAt: string;
  reason: string;
};

export type ShortformCommitmentDecision =
  | {
      commit: true;
      shortformIntended: true;
      reason: string;
      alreadyCommitted: boolean;
    }
  | {
      commit: false;
      shortformIntended: false;
      reason:
        | "not_shortform_eligible"
        | "missing_draft_body"
        | "daily_slot_taken"
        | "invalid_candidate";
      holderCandidateId?: string;
    };

export type DailyShortformBridgeResult = {
  outcome:
    | "committed"
    | "reused"
    | "skipped"
    | "brief_failed"
    | "resolver_failed";
  shortformIntended: boolean;
  reason: string;
  packageRoot?: string;
  mediaBriefPersisted?: boolean;
  shortVideoBriefPersisted?: boolean;
  sceneCount?: number;
  sourceResolutionPersisted?: boolean;
  holderCandidateId?: string;
  error?: string;
};

function candidateHasShortVideoConcept(candidate: CompletedMarketingCandidate): boolean {
  const formats = [
    ...(candidate.contentPlan?.recommendedFormats ?? []),
    ...(candidate.contentAssignment.formatHints ?? []),
  ];
  return formats.some((item) => item.format === ("short_video_concept" as ContentFormatKind));
}

function dayPackageRoots(assetRoot: string, businessDateKst: string): string[] {
  const { year, month, day } = splitBusinessDateParts(businessDateKst);
  const dayRoot = join(assetRoot, year, month, day);
  if (!existsSync(dayRoot)) return [];
  return readdirSync(dayRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dayRoot, entry.name));
}

function readCommitment(packageRoot: string): DailyShortformCommitment | null {
  const path = join(packageRoot, DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as DailyShortformCommitment;
    if (parsed?.contract !== DAILY_SHORTFORM_COMMITMENT_CONTRACT) return null;
    if (parsed.shortformIntended !== true) return null;
    if (!parsed.candidateId?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function packageHasShortVideoBrief(packageRoot: string): boolean {
  return existsSync(join(packageRoot, SHORT_VIDEO_BRIEF_RELATIVE_PATH));
}

/**
 * Find an existing shortform commitment for the business date (any candidate package).
 */
export function findDailyShortformCommitmentHolder(input: {
  businessDateKst: string;
  assetRoot?: string | null;
  env?: MarketingAssetEnv;
}): { candidateId: string; packageRoot: string } | null {
  const assetRoot = input.assetRoot?.trim() || resolveMarketingAssetRoot({ env: input.env });
  for (const packageRoot of dayPackageRoots(assetRoot, input.businessDateKst)) {
    const commitment = readCommitment(packageRoot);
    if (commitment) {
      return { candidateId: commitment.candidateId, packageRoot };
    }
    // Legacy/partial: ShortVideoBrief alone also occupies the daily slot.
    if (packageHasShortVideoBrief(packageRoot)) {
      const name = packageRoot.split(/[/\\]/).pop() ?? "";
      if (name) return { candidateId: name, packageRoot };
    }
  }
  return null;
}

/**
 * Deterministic eligibility + daily quota (max one commitment per businessDate).
 */
export function decideDailyShortformCommitment(input: {
  candidate: CompletedMarketingCandidate;
  assetRoot?: string | null;
  env?: MarketingAssetEnv;
}): ShortformCommitmentDecision {
  const candidate = input.candidate;
  try {
    assertSafeCandidateId(candidate.candidateId);
    splitBusinessDateParts(candidate.businessDateKst);
  } catch {
    return { commit: false, shortformIntended: false, reason: "invalid_candidate" };
  }

  if (!candidateHasShortVideoConcept(candidate)) {
    return { commit: false, shortformIntended: false, reason: "not_shortform_eligible" };
  }

  const draftBody = candidate.draft.body?.trim() || "";
  if (!draftBody) {
    return { commit: false, shortformIntended: false, reason: "missing_draft_body" };
  }

  const holder = findDailyShortformCommitmentHolder({
    businessDateKst: candidate.businessDateKst,
    assetRoot: input.assetRoot,
    env: input.env,
  });

  if (holder && holder.candidateId !== candidate.candidateId) {
    return {
      commit: false,
      shortformIntended: false,
      reason: "daily_slot_taken",
      holderCandidateId: holder.candidateId,
    };
  }

  return {
    commit: true,
    shortformIntended: true,
    alreadyCommitted: holder?.candidateId === candidate.candidateId,
    reason: holder?.candidateId === candidate.candidateId ? "already_committed" : "eligible_first_slot",
  };
}

function persistCommitment(input: {
  packageRoot: string;
  candidate: CompletedMarketingCandidate;
  reason: string;
  nowIso: string;
}): void {
  const payload: DailyShortformCommitment = {
    contract: DAILY_SHORTFORM_COMMITMENT_CONTRACT,
    businessDateKst: input.candidate.businessDateKst,
    candidateId: input.candidate.candidateId,
    shortformIntended: true,
    committedAt: input.nowIso,
    reason: input.reason,
  };
  atomicWriteFile(join(input.packageRoot, DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH), stableJsonBytes(payload));
}

function ensureShortformEnabledMediaBrief(
  candidate: CompletedMarketingCandidate,
  mediaBrief: MediaBrief,
): MediaBrief {
  if (isShortVideoBriefGenerationApplicable(mediaBrief)) {
    return mediaBrief;
  }
  const draftBody = candidate.draft.body?.trim() || "";
  if (!draftBody) return mediaBrief;
  const destinations = candidate.selectedAgenda.destinations ?? [];
  const entities = candidate.selectedAgenda.entities ?? [];
  return parseMediaBrief({
    ...mediaBrief,
    formats: {
      ...mediaBrief.formats,
      shortform: {
        ...mediaBrief.formats.shortform,
        enabled: true,
        orientation: "vertical" as const,
        narrationSegments:
          mediaBrief.formats.shortform.narrationSegments.length > 0
            ? mediaBrief.formats.shortform.narrationSegments
            : splitShortformNarrationSegments(draftBody, {
                destinations,
                entities,
                title: candidate.draft.title,
              }),
        cta:
          mediaBrief.formats.shortform.cta ??
          candidate.contentPlan?.ctaStrategy?.trim() ??
          null,
      },
    },
  });
}

/**
 * Best-effort CG-2 bridge. Must not throw to callers that need fail-safe production.
 */
export async function maybeGenerateShortformBriefAndResolve(input: {
  candidate: CompletedMarketingCandidate;
  assetRoot?: string | null;
  env?: MarketingAssetEnv;
  now?: Date;
  /** Injected catalog for tests; production resolves via factory. */
  catalog?: MarketingMediaSourceCatalogRepository;
}): Promise<DailyShortformBridgeResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const env = input.env ?? process.env;

  try {
    const decision = decideDailyShortformCommitment({
      candidate: input.candidate,
      assetRoot: input.assetRoot,
      env,
    });

    if (!decision.commit) {
      return {
        outcome: "skipped",
        shortformIntended: false,
        reason: decision.reason,
        holderCandidateId: decision.holderCandidateId,
      };
    }

    const exportResult = exportMarketingCandidatePackage({
      candidate: input.candidate,
      mediaBrief: ensureShortformEnabledMediaBrief(
        input.candidate,
        buildMediaBriefFromCandidate(input.candidate),
      ),
      assetRoot: input.assetRoot,
      env,
      now,
      overwriteArtifacts: true,
      forcePublishableRegenerate: false,
    });

    const packageRoot = exportResult.packageRoot;
    persistCommitment({
      packageRoot,
      candidate: input.candidate,
      reason: decision.reason,
      nowIso,
    });

    const publishable = ensurePublishableContentSync({
      candidate: input.candidate,
      packageRoot,
      now,
    });
    const mediaBrief = applyPublishableContentToMediaBrief(
      ensureShortformEnabledMediaBrief(
        input.candidate,
        buildMediaBriefFromCandidate(input.candidate),
      ),
      publishable,
    );

    if (!isShortVideoBriefGenerationApplicable(mediaBrief)) {
      return {
        outcome: "brief_failed",
        shortformIntended: true,
        reason: "shortform_brief_not_applicable",
        packageRoot,
        mediaBriefPersisted: true,
        error: "MediaBrief shortform not applicable (enabled + narration required)",
      };
    }

    const brief = buildShortVideoBrief({
      mediaBrief,
      destinations: input.candidate.selectedAgenda.destinations,
      entities: input.candidate.selectedAgenda.entities,
      hook: input.candidate.contentPlan?.hook ?? input.candidate.selectedAgenda.title,
    });
    const briefPersist = persistShortVideoBrief({
      packageRoot,
      brief,
      createdAt: nowIso,
    });

    let sourceResolutionPersisted = false;
    try {
      const catalog =
        input.catalog ??
        (await createMarketingMediaSourceCatalogRepository({
          env,
          backend: env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? undefined : "memory",
        }));
      const providers = createShortformResolverProviders({
        catalog,
        env,
        useFileCache: false,
        searchCache: null,
      });
      const plan = await resolveShortVideoSources({
        brief,
        providers,
        now,
      });
      persistShortformSourceResolution({
        packageRoot,
        plan,
        createdAt: nowIso,
      });
      sourceResolutionPersisted = existsSync(join(packageRoot, SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        outcome: "resolver_failed",
        shortformIntended: true,
        reason: "source_resolution_failed",
        packageRoot,
        mediaBriefPersisted: true,
        shortVideoBriefPersisted: true,
        sceneCount: brief.scenes.length,
        sourceResolutionPersisted: false,
        error: message.slice(0, 400),
      };
    }

    return {
      outcome: briefPersist.status === "reused" && decision.alreadyCommitted ? "reused" : "committed",
      shortformIntended: true,
      reason: decision.reason,
      packageRoot,
      mediaBriefPersisted: true,
      shortVideoBriefPersisted: true,
      sceneCount: brief.scenes.length,
      sourceResolutionPersisted,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      outcome: "brief_failed",
      shortformIntended: false,
      reason: "bridge_exception",
      error: message.slice(0, 400),
    };
  }
}

/** Resolve expected package root for a candidate (tests/ops). */
export function resolveCandidatePackageRoot(input: {
  candidate: Pick<CompletedMarketingCandidate, "candidateId" | "businessDateKst">;
  assetRoot?: string | null;
  env?: MarketingAssetEnv;
}): string {
  const assetRoot = input.assetRoot?.trim() || resolveMarketingAssetRoot({ env: input.env });
  return resolvePackageDirectory({
    assetRoot,
    businessDateKst: input.candidate.businessDateKst,
    candidateId: input.candidate.candidateId,
  });
}
