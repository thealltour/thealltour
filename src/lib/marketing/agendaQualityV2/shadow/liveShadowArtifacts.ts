import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveAgendaQualityV2LiveShadowDir } from "@/lib/marketing/agendaQualityV2/shadow/config";
import type { LiveShadowCandidateObservation } from "@/lib/marketing/agendaQualityV2/shadow/candidateObservation";
import type { ValidationConfigStatus } from "@/lib/marketing/agendaQualityV2/shadow/validationManifest";

export type LiveShadowRunType = "SCHEDULED" | "MANUAL_RERUN";

export type LiveShadowDailySnapshot = {
  contract: "agenda-quality-v2-live-shadow-snapshot";
  qualityVersion: "v2";
  shadow: true;
  businessDateKst: string;
  generatedAt: string;
  runId: string;
  runType: LiveShadowRunType;
  status: "ok" | "failed" | "blocked" | "disabled";
  blockerReason: string | null;
  failureReason: string | null;
  durationMs: number;
  validation: {
    validationId: string;
    validationConfigFingerprint: string;
    validationConfigStatus: ValidationConfigStatus;
    configDriftFields: string[];
    runType: LiveShadowRunType;
    businessDate: string;
    createdAt: string;
    codeRevision: string | null;
  };
  source: {
    rawCandidateCount: number;
    transformedCount: number;
    transformCacheHits: number;
    transformFailures: number;
    llmCallCount: number;
    maxTransforms: number;
  };
  v2: {
    strongCount: number;
    publishableCount: number;
    weakCount: number;
    rejectCount: number;
    slateCount: number;
    newCount: number;
    carryoverCount: number;
  };
  /** Full evaluated V2 candidate pool (selected + excluded + transform failures). */
  allCandidates: LiveShadowCandidateObservation[];
  /** Selected slate rows (subset of allCandidates with selectedIntoSlate). */
  slate: LiveShadowCandidateObservation[];
  rejectedOrExcluded: LiveShadowCandidateObservation[];
  /** @deprecated Prefer rejectedOrExcluded — kept for backward-compatible readers. */
  rejected: Array<Record<string, unknown>>;
  comparison: {
    v1Count: number;
    v2Count: number;
    v1NewsLikeDropped: string[];
    repeatedTopicsDropped: string[];
    carryoverResurfaced: string[];
  };
  observability: {
    roleKey: string;
    routeSource: string | null;
    selectedProviderId: string | null;
    selectedModelId: string | null;
    configuredRoute: string[];
    availableRoute: string[];
    reservoirBackend: string;
    productionLiveShadowReady: boolean;
  };
  /** Manual editorial slot — never auto-populated. */
  humanReview: "PREFER_V1" | "PREFER_V2" | "MIXED" | "NEITHER" | null;
  /** @deprecated Use humanReview — kept for Phase 4C readers. */
  humanReviewPreference: "PREFER_V1" | "PREFER_V2" | "MIXED" | "NEITHER" | null;
};

export type WriteLiveShadowArtifactsResult = {
  jsonPath: string;
  mdPath: string;
  wroteCanonical: boolean;
  wroteRerun: boolean;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readLiveShadowCanonicalSnapshot(params: {
  businessDateKst: string;
  cwd?: string;
}): Promise<LiveShadowDailySnapshot | null> {
  const dir = resolveAgendaQualityV2LiveShadowDir(params.cwd ?? process.cwd());
  const jsonPath = path.join(dir, `${params.businessDateKst}.json`);
  if (!(await pathExists(jsonPath))) return null;
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    return JSON.parse(raw) as LiveShadowDailySnapshot;
  } catch {
    return null;
  }
}

/**
 * Canonical SCHEDULED path: live-shadow/YYYY-MM-DD.{json,md}
 * Manual / non-first same-date runs: live-shadow/reruns/YYYY-MM-DD/<timestamp>.{json,md}
 */
export async function writeLiveShadowArtifacts(params: {
  snapshot: LiveShadowDailySnapshot;
  cwd?: string;
}): Promise<WriteLiveShadowArtifactsResult> {
  const dir = resolveAgendaQualityV2LiveShadowDir(params.cwd ?? process.cwd());
  await fs.mkdir(dir, { recursive: true });
  const date = params.snapshot.businessDateKst;
  const canonicalJson = path.join(dir, `${date}.json`);
  const canonicalMd = path.join(dir, `${date}.md`);
  const existing = await readLiveShadowCanonicalSnapshot({
    businessDateKst: date,
    cwd: params.cwd,
  });
  const canonicalIsScheduled =
    existing?.runType === "SCHEDULED" ||
    (existing != null && (existing as { runType?: string }).runType == null);

  const writeAsCanonical =
    params.snapshot.runType === "SCHEDULED" && !canonicalIsScheduled;

  if (writeAsCanonical) {
    await fs.writeFile(canonicalJson, JSON.stringify(params.snapshot, null, 2), "utf8");
    await fs.writeFile(canonicalMd, formatLiveShadowMarkdown(params.snapshot), "utf8");
    return {
      jsonPath: canonicalJson,
      mdPath: canonicalMd,
      wroteCanonical: true,
      wroteRerun: false,
    };
  }

  const stamp = params.snapshot.generatedAt.replace(/[:.]/g, "-");
  const rerunDir = path.join(dir, "reruns", date);
  await fs.mkdir(rerunDir, { recursive: true });
  const jsonPath = path.join(rerunDir, `${stamp}.json`);
  const mdPath = path.join(rerunDir, `${stamp}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(params.snapshot, null, 2), "utf8");
  await fs.writeFile(mdPath, formatLiveShadowMarkdown(params.snapshot), "utf8");
  return {
    jsonPath,
    mdPath,
    wroteCanonical: false,
    wroteRerun: true,
  };
}

export function formatLiveShadowMarkdown(snapshot: LiveShadowDailySnapshot): string {
  const lines = [
    `# V2 Live Shadow — ${snapshot.businessDateKst}`,
    "",
    `status: ${snapshot.status}`,
    `runType: ${snapshot.runType} | runId: ${snapshot.runId}`,
    `shadow: true | qualityVersion: v2`,
    `V1 authority preserved (observational only)`,
    snapshot.blockerReason ? `blocker: ${snapshot.blockerReason}` : "",
    snapshot.failureReason ? `failure: ${snapshot.failureReason}` : "",
    "",
    `## Summary`,
    `- V1 count=${snapshot.comparison.v1Count} V2 count=${snapshot.comparison.v2Count}`,
    `- NEW=${snapshot.v2.newCount} CARRYOVER=${snapshot.v2.carryoverCount}`,
    `- STRONG=${snapshot.v2.strongCount} PUBLISHABLE=${snapshot.v2.publishableCount} REJECT=${snapshot.v2.rejectCount}`,
    `- LLM calls=${snapshot.source.llmCallCount} cache hits=${snapshot.source.transformCacheHits} failures=${snapshot.source.transformFailures}`,
    "",
    `## V2 Slate`,
  ];
  for (const row of snapshot.slate) {
    const t = row.transform;
    lines.push(
      `### ${row.selection.finalRank ?? "?"}. [${row.scoring?.qualityTier ?? "?"}/${row.reservoir?.origin ?? "?"}] score=${Number(row.scoring?.totalScore ?? 0).toFixed(3)}`,
    );
    lines.push(`- Story seed: ${t?.marketingStorySeedKo ?? "—"}`);
    lines.push(`- Traveler problem: ${t?.travelerProblemKo ?? "—"}`);
    lines.push(`- Decision at stake: ${t?.decisionAtStakeKo ?? "—"}`);
    lines.push(`- Tension: ${t?.audienceTensionKo ?? "—"}`);
    lines.push(`- Payoff: ${t?.readerPayoffKo ?? "—"}`);
    lines.push(`- Source title: ${row.source.sourceTitle ?? "—"}`);
    lines.push(
      `- quality: ${row.scoring?.qualityTier ?? "—"} / total=${row.scoring?.totalScore ?? "—"}`,
    );
    lines.push(`- NEW/CARRYOVER: ${row.reservoir?.origin ?? "—"}`);
    lines.push(`- Inclusion reason: ${row.selection.inclusionReason ?? "—"}`);
    lines.push("");
  }

  lines.push("## Excluded / Rejected");
  for (const row of snapshot.rejectedOrExcluded.slice(0, 40)) {
    lines.push(
      `- ${row.source.sourceTitle ?? row.agendaId ?? "?"} | seed=${row.transform?.marketingStorySeedKo?.slice(0, 60) ?? "—"} | tier=${row.scoring?.qualityTier ?? "—"} | reason=${row.selection.exclusionReason ?? row.provenance.transformFailureReason ?? "—"}`,
    );
  }
  if (snapshot.rejectedOrExcluded.length === 0) {
    lines.push("- (none)");
  }

  lines.push("", "## Validation Metadata");
  lines.push(`- validationId: ${snapshot.validation.validationId}`);
  lines.push(`- fingerprint: ${snapshot.validation.validationConfigFingerprint}`);
  lines.push(`- configStatus: ${snapshot.validation.validationConfigStatus}`);
  if (snapshot.validation.configDriftFields.length) {
    lines.push(`- driftFields: ${snapshot.validation.configDriftFields.join(", ")}`);
  }
  lines.push(`- codeRevision: ${snapshot.validation.codeRevision ?? "—"}`);
  lines.push(`- humanReview: ${snapshot.humanReview ?? "(unset)"}`);
  return lines.filter((l) => l !== undefined).join("\n");
}
