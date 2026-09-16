import { promises as fs } from "node:fs";
import path from "node:path";
import type { LiveShadowDailySnapshot } from "@/lib/marketing/agendaQualityV2/shadow/liveShadowArtifacts";
import {
  readLiveShadowCanonicalSnapshot,
} from "@/lib/marketing/agendaQualityV2/shadow/liveShadowArtifacts";
import { resolveAgendaQualityV2LiveShadowDir } from "@/lib/marketing/agendaQualityV2/shadow/config";
import {
  AGENDA_QUALITY_V2_VALIDATION_DATES,
  AGENDA_QUALITY_V2_VALIDATION_ID,
} from "@/lib/marketing/agendaQualityV2/shadow/validationManifest";

export type FiveDayObservationStatus =
  | "SCHEDULED"
  | "RECOVERED_MANUALLY"
  | "MISSING"
  | "CONFIG_DRIFT";

export type FiveDayLiveShadowRollup = {
  contract: "agenda-quality-v2-five-day-rollup";
  validationId: string;
  expectedDates: string[];
  observedDates: string[];
  missingDates: string[];
  configDriftDates: string[];
  manualRecoveryDates: string[];
  days: string[];
  dayStatuses: Array<{
    businessDateKst: string;
    status: FiveDayObservationStatus;
    runType: LiveShadowDailySnapshot["runType"] | null;
    sourcePath: string | null;
    validationConfigStatus: LiveShadowDailySnapshot["validation"]["validationConfigStatus"] | null;
    formalSampleStatus: "COMPARABLE" | "CONFIG_DRIFT" | "RECOVERED_MANUALLY" | "MISSING";
  }>;
  metrics: {
    avgSlateSize: number;
    avgV1SlateSize: number;
    avgV2SlateSize: number;
    zeroSlateDays: number;
    zeroV2Days: number;
    totalStrong: number;
    totalPublishable: number;
    totalReject: number;
    totalLlmCalls: number;
    totalCacheHits: number;
    totalTransformFailures: number;
    totalCarryover: number;
    totalNew: number;
    totalRepeatedTopicRejected: number;
    totalGenericNewsRejected: number;
    totalSensitiveClaimRejected: number;
    uniqueDecisionAxes: number;
    cacheHitRate: number;
    transformFailureRate: number;
    superficialRewriteFlagCount: number;
    unsupportedInferenceFlagCount: number;
  };
  humanReview: {
    preferV1: number;
    preferV2: number;
    mixed: number;
    neither: number;
    unset: number;
  };
  humanReviewPreferenceSlots: Array<{
    businessDateKst: string;
    preference: "PREFER_V1" | "PREFER_V2" | "MIXED" | "NEITHER" | null;
  }>;
};

function resolveHumanReview(
  snapshot: LiveShadowDailySnapshot,
): "PREFER_V1" | "PREFER_V2" | "MIXED" | "NEITHER" | null {
  return snapshot.humanReview ?? snapshot.humanReviewPreference ?? null;
}

function countExclusion(
  snapshots: LiveShadowDailySnapshot[],
  matcher: (reason: string | null | undefined) => boolean,
): number {
  let n = 0;
  for (const s of snapshots) {
    for (const c of s.allCandidates ?? s.rejectedOrExcluded ?? []) {
      if (matcher(c.selection?.exclusionReason ?? null)) n += 1;
    }
  }
  return n;
}

export function buildFiveDayLiveShadowRollup(
  snapshots: LiveShadowDailySnapshot[],
  options?: {
    validationId?: string;
    expectedDates?: string[];
    dayStatuses?: FiveDayLiveShadowRollup["dayStatuses"];
  },
): FiveDayLiveShadowRollup {
  const expectedDates = options?.expectedDates ?? [...AGENDA_QUALITY_V2_VALIDATION_DATES];
  const days = snapshots.map((s) => s.businessDateKst);
  const slateSizes = snapshots.map((s) => s.v2.slateCount);
  const v1Sizes = snapshots.map((s) => s.comparison.v1Count);
  const avgSlateSize =
    slateSizes.length === 0 ? 0 : slateSizes.reduce((a, b) => a + b, 0) / slateSizes.length;
  const avgV1SlateSize =
    v1Sizes.length === 0 ? 0 : v1Sizes.reduce((a, b) => a + b, 0) / v1Sizes.length;
  const totalLlmCalls = snapshots.reduce((a, s) => a + s.source.llmCallCount, 0);
  const totalCacheHits = snapshots.reduce((a, s) => a + s.source.transformCacheHits, 0);
  const totalTransformFailures = snapshots.reduce(
    (a, s) => a + s.source.transformFailures,
    0,
  );
  const transformAttempts = totalLlmCalls + totalCacheHits;

  const decisionAxes = new Set<string>();
  let superficialRewriteFlagCount = 0;
  let unsupportedInferenceFlagCount = 0;
  for (const s of snapshots) {
    for (const c of s.allCandidates ?? []) {
      const axis = c.provenance?.decisionAxisFingerprint;
      if (axis) decisionAxes.add(axis);
      const lim = c.transform?.limitations ?? [];
      for (const l of lim) {
        const lower = l.toLowerCase();
        if (lower.includes("superficial") || lower.includes("rewrite")) {
          superficialRewriteFlagCount += 1;
        }
        if (lower.includes("unsupported") || lower.includes("inference")) {
          unsupportedInferenceFlagCount += 1;
        }
      }
    }
  }

  const humanCounts = { preferV1: 0, preferV2: 0, mixed: 0, neither: 0, unset: 0 };
  for (const s of snapshots) {
    const pref = resolveHumanReview(s);
    if (pref === "PREFER_V1") humanCounts.preferV1 += 1;
    else if (pref === "PREFER_V2") humanCounts.preferV2 += 1;
    else if (pref === "MIXED") humanCounts.mixed += 1;
    else if (pref === "NEITHER") humanCounts.neither += 1;
    else humanCounts.unset += 1;
  }

  const dayStatuses =
    options?.dayStatuses ??
    snapshots.map((s) => {
      const drift = s.validation?.validationConfigStatus === "DRIFT";
      const status: FiveDayObservationStatus = drift
        ? "CONFIG_DRIFT"
        : s.runType === "SCHEDULED"
          ? "SCHEDULED"
          : "RECOVERED_MANUALLY";
      return {
        businessDateKst: s.businessDateKst,
        status,
        runType: s.runType ?? null,
        sourcePath: null,
        validationConfigStatus: s.validation?.validationConfigStatus ?? null,
        formalSampleStatus: drift
          ? ("CONFIG_DRIFT" as const)
          : status === "SCHEDULED"
            ? ("COMPARABLE" as const)
            : ("RECOVERED_MANUALLY" as const),
      };
    });

  const missingDates = dayStatuses
    .filter((d) => d.status === "MISSING")
    .map((d) => d.businessDateKst);
  // Also include expected dates not present in dayStatuses at all
  for (const d of expectedDates) {
    if (!dayStatuses.some((x) => x.businessDateKst === d) && !missingDates.includes(d)) {
      missingDates.push(d);
    }
  }
  const configDriftDates = dayStatuses
    .filter((d) => d.status === "CONFIG_DRIFT" || d.formalSampleStatus === "CONFIG_DRIFT")
    .map((d) => d.businessDateKst);
  const manualRecoveryDates = dayStatuses
    .filter((d) => d.status === "RECOVERED_MANUALLY")
    .map((d) => d.businessDateKst);
  const observedDates = dayStatuses
    .filter((d) => d.status !== "MISSING")
    .map((d) => d.businessDateKst);

  return {
    contract: "agenda-quality-v2-five-day-rollup",
    validationId: options?.validationId ?? AGENDA_QUALITY_V2_VALIDATION_ID,
    expectedDates,
    observedDates,
    missingDates,
    configDriftDates,
    manualRecoveryDates,
    days,
    dayStatuses,
    metrics: {
      avgSlateSize,
      avgV1SlateSize,
      avgV2SlateSize: avgSlateSize,
      zeroSlateDays: slateSizes.filter((n) => n === 0).length,
      zeroV2Days: slateSizes.filter((n) => n === 0).length,
      totalStrong: snapshots.reduce((a, s) => a + s.v2.strongCount, 0),
      totalPublishable: snapshots.reduce((a, s) => a + s.v2.publishableCount, 0),
      totalReject: snapshots.reduce((a, s) => a + s.v2.rejectCount, 0),
      totalLlmCalls,
      totalCacheHits,
      totalTransformFailures,
      totalCarryover: snapshots.reduce((a, s) => a + s.v2.carryoverCount, 0),
      totalNew: snapshots.reduce((a, s) => a + s.v2.newCount, 0),
      totalRepeatedTopicRejected: snapshots.reduce(
        (a, s) => a + s.comparison.repeatedTopicsDropped.length,
        0,
      ),
      totalGenericNewsRejected: snapshots.reduce(
        (a, s) => a + s.comparison.v1NewsLikeDropped.length,
        0,
      ),
      totalSensitiveClaimRejected: countExclusion(
        snapshots,
        (r) => r === "unsupported_sensitive_claim",
      ),
      uniqueDecisionAxes: decisionAxes.size,
      cacheHitRate: transformAttempts === 0 ? 0 : totalCacheHits / transformAttempts,
      transformFailureRate:
        transformAttempts === 0 ? 0 : totalTransformFailures / Math.max(1, totalLlmCalls),
      superficialRewriteFlagCount,
      unsupportedInferenceFlagCount,
    },
    humanReview: humanCounts,
    humanReviewPreferenceSlots: snapshots.map((s) => ({
      businessDateKst: s.businessDateKst,
      preference: resolveHumanReview(s),
    })),
  };
}

/**
 * Load evaluation inputs for planned dates.
 * Prefer canonical SCHEDULED artifacts. Manual-only days → RECOVERED_MANUALLY.
 * DRIFT scheduled days → CONFIG_DRIFT (not silently comparable).
 */
export async function loadFiveDayLiveShadowObservations(params: {
  dates: string[];
  cwd?: string;
  validationId?: string;
}): Promise<{
  snapshots: LiveShadowDailySnapshot[];
  rollup: FiveDayLiveShadowRollup;
}> {
  const cwd = params.cwd ?? process.cwd();
  const dir = resolveAgendaQualityV2LiveShadowDir(cwd);
  const snapshots: LiveShadowDailySnapshot[] = [];
  const dayStatuses: FiveDayLiveShadowRollup["dayStatuses"] = [];

  for (const date of params.dates) {
    const canonical = await readLiveShadowCanonicalSnapshot({ businessDateKst: date, cwd });
    if (canonical && canonical.runType === "SCHEDULED") {
      const drift = canonical.validation?.validationConfigStatus === "DRIFT";
      snapshots.push(canonical);
      dayStatuses.push({
        businessDateKst: date,
        status: drift ? "CONFIG_DRIFT" : "SCHEDULED",
        runType: "SCHEDULED",
        sourcePath: path.join(dir, `${date}.json`),
        validationConfigStatus: canonical.validation?.validationConfigStatus ?? null,
        formalSampleStatus: drift ? "CONFIG_DRIFT" : "COMPARABLE",
      });
      continue;
    }

    const rerunDir = path.join(dir, "reruns", date);
    let recovered: LiveShadowDailySnapshot | null = null;
    let recoveredPath: string | null = null;
    try {
      const files = (await fs.readdir(rerunDir))
        .filter((f) => f.endsWith(".json"))
        .sort();
      if (files.length > 0) {
        recoveredPath = path.join(rerunDir, files[files.length - 1]!);
        recovered = JSON.parse(await fs.readFile(recoveredPath, "utf8")) as LiveShadowDailySnapshot;
      }
    } catch {
      /* no reruns */
    }

    if (recovered) {
      snapshots.push(recovered);
      dayStatuses.push({
        businessDateKst: date,
        status: "RECOVERED_MANUALLY",
        runType: recovered.runType ?? "MANUAL_RERUN",
        sourcePath: recoveredPath,
        validationConfigStatus: recovered.validation?.validationConfigStatus ?? null,
        formalSampleStatus: "RECOVERED_MANUALLY",
      });
      continue;
    }

    if (canonical) {
      snapshots.push(canonical);
      dayStatuses.push({
        businessDateKst: date,
        status: "RECOVERED_MANUALLY",
        runType: canonical.runType ?? null,
        sourcePath: path.join(dir, `${date}.json`),
        validationConfigStatus: canonical.validation?.validationConfigStatus ?? null,
        formalSampleStatus: "RECOVERED_MANUALLY",
      });
      continue;
    }

    dayStatuses.push({
      businessDateKst: date,
      status: "MISSING",
      runType: null,
      sourcePath: null,
      validationConfigStatus: null,
      formalSampleStatus: "MISSING",
    });
  }

  const rollup = buildFiveDayLiveShadowRollup(snapshots, {
    validationId: params.validationId ?? AGENDA_QUALITY_V2_VALIDATION_ID,
    expectedDates: params.dates,
    dayStatuses,
  });
  return { snapshots, rollup };
}
