/**
 * Cron script: Daily Marketing Plan (task-only, no SNS publish).
 *
 * Reads latest Performance Brief artifact (safe fallback if missing),
 * then runs application-level runDepartmentPipeline via Hermes profiles.
 *
 *   npx tsx scripts/cron-daily-marketing-plan.ts
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { extractJsonObject } from "../src/lib/marketing/bot/organization/envelope";
import { runDepartmentPipeline } from "../src/lib/marketing/bot/organization/pipeline";
import type {
  ContentStrategistOutput,
  GovernanceReviewResult,
  PerformanceBrief,
} from "../src/lib/marketing/bot/organization/handoffs";
import type { PerformanceUnavailable } from "../src/lib/marketing/bot/organization/pipeline";
import {
  defaultPerformanceBriefAbsolutePath,
  formatDailyPerformanceBriefMarkdown,
  readLatestPerformanceBrief,
  type DailyPerformanceBriefArtifact,
} from "../src/lib/marketing/cron/performanceBriefArtifact";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";
const HERMES_TIMEOUT_MS = 180_000;

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

function invokeProfile(profile: string, prompt: string): string {
  const result = spawnSync("hermes", ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt], {
    encoding: "utf8",
    env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME ?? "/home/ysh/.hermes" },
    timeout: HERMES_TIMEOUT_MS,
  });
  if (result.status !== 0) {
    throw new Error(`${profile} exited ${result.status}: ${(result.stderr || result.stdout || "").slice(0, 400)}`);
  }
  return result.stdout ?? "";
}

function asDraft(raw: string): ContentStrategistOutput {
  const value = extractJsonObject(raw) as ContentStrategistOutput;
  if (!value.body) throw new Error("content-strategist returned no body");
  return {
    title: value.title ?? null,
    body: String(value.body),
    channel: value.channel || "threads",
    agenda: value.agenda ?? null,
    sourceReferences: Array.isArray(value.sourceReferences) ? value.sourceReferences.map(String) : [],
  };
}

function asGovernance(raw: string): GovernanceReviewResult {
  try {
    const value = extractJsonObject(raw) as Record<string, unknown>;
    const decision = String(value.decision ?? value.governanceDecision ?? "").toUpperCase();
    if (decision === "ALLOW" || decision === "REVIEW" || decision === "BLOCK") {
      return {
        decision,
        riskScore: Number(value.riskScore ?? 0),
        reasons: Array.isArray(value.reasons)
          ? value.reasons.map(String)
          : Array.isArray(value.reasonCodes)
            ? value.reasonCodes.map(String)
            : [],
        revisionHints: Array.isArray(value.revisionHints) ? value.revisionHints.map(String) : [],
        humanApprovalRequired: Boolean(value.humanApprovalRequired) || decision === "REVIEW",
        semanticAvailable: value.semanticAvailable !== false,
      };
    }
  } catch {
    // fall through
  }
  const decision = /\bBLOCK\b/i.test(raw) ? "BLOCK" : /\bREVIEW\b/i.test(raw) ? "REVIEW" : /\bALLOW\b/i.test(raw) ? "ALLOW" : "";
  if (decision !== "ALLOW" && decision !== "REVIEW" && decision !== "BLOCK") {
    throw new Error("governance-auditor returned no ALLOW/REVIEW/BLOCK");
  }
  return {
    decision,
    riskScore: 0,
    reasons: [],
    revisionHints: [],
    humanApprovalRequired: decision === "REVIEW",
    semanticAvailable: !/semanticAvailable["']?\s*[:=]\s*false/i.test(raw),
  };
}

function briefToPipelinePerformance(
  brief: DailyPerformanceBriefArtifact | null,
): PerformanceBrief | PerformanceUnavailable {
  if (!brief) {
    return { unavailable: true, reason: "latest_performance_brief_missing" };
  }
  if (brief.dataAvailability === "unavailable") {
    return { unavailable: true, reason: "performance_data_unavailable" };
  }
  const keyMetrics = brief.confirmedMetrics
    .filter((item) => item.value > 0)
    .map((item) => ({ metricType: item.metricType, value: item.value }));
  if (keyMetrics.length === 0) {
    return { unavailable: true, reason: "no_positive_confirmed_metrics" };
  }
  return {
    period: brief.period,
    productId: brief.productId,
    channel: brief.channel,
    keyMetrics,
    observedPatterns: [...brief.managerEvidence, ...brief.notableChanges],
    confidence: brief.dataAvailability === "available" ? "medium" : "low",
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const productId = argValue(argv, "--product-id") ?? process.env.MARKETING_CRON_PRODUCT_ID ?? DEFAULT_PRODUCT;
  const channel = argValue(argv, "--channel") ?? process.env.MARKETING_CRON_CHANNEL ?? "threads";
  const goal =
    argValue(argv, "--goal") ??
    process.env.MARKETING_CRON_GOAL ??
    "스페인/포르투갈 패키지 홍보 Threads 콘텐츠 (게시 금지)";

  const briefPath = defaultPerformanceBriefAbsolutePath(ROOT);
  const brief = readLatestPerformanceBrief(briefPath);
  const performanceNote =
    !brief || brief.dataAvailability === "unavailable"
      ? "성과 데이터가 부족하므로 상품/Context/Memory 근거 중심으로 계획"
      : `성과 brief dataAvailability=${brief.dataAvailability}`;

  console.log("# Daily Marketing Plan");
  console.log("");
  console.log(`- productId: ${productId}`);
  console.log(`- channel: ${channel}`);
  console.log(`- performance handoff: ${brief ? "artifact_read" : "missing_fallback"}`);
  console.log(`- note: ${performanceNote}`);
  console.log(`- sns_side_effect: 0`);
  console.log(`- publish: forbidden`);
  console.log("");

  if (brief) {
    console.log("## Attached Performance Brief");
    console.log("");
    console.log(formatDailyPerformanceBriefMarkdown(brief));
  } else {
    console.log("## Attached Performance Brief");
    console.log("");
    console.log("- latest brief unavailable — safe fallback");
    console.log("");
  }

  const pipelinePerformance = briefToPipelinePerformance(brief);

  const result = await runDepartmentPipeline(
    {
      productId,
      channel,
      goal,
      constraints: [
        "do not invent product facts",
        "do not publish",
        "do not create cron jobs",
        "do not modify production DB",
        performanceNote,
      ],
      memoryReferences: brief?.managerEvidence ?? [],
    },
    {
      requestPerformance: async () => pipelinePerformance,
      requestDraft: async (envelope) => {
        const raw = invokeProfile(
          "content-strategist",
          `JSON only. ContentDraftRequest를 근거로 Threads 초안. 없는 혜택/일정 만들지 마. 게시하지 마. Cron 만들지 마.\n${JSON.stringify(envelope.payload)}\nshape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[]}`,
        );
        return asDraft(raw);
      },
      requestGovernance: async (envelope) => {
        const raw = invokeProfile(
          "governance-auditor",
          `JSON only. 이 초안을 검사하고 ALLOW/REVIEW/BLOCK만. 게시하지 마. 자동 승인 금지.\n${JSON.stringify(envelope.payload)}\nshape: {"decision":"ALLOW","riskScore":0,"reasons":[],"revisionHints":[],"humanApprovalRequired":false,"semanticAvailable":true}`,
        );
        return asGovernance(raw);
      },
    },
  );

  if (result.publishActionIncluded) {
    throw new Error("publishActionIncluded must be false");
  }

  console.log("## Pipeline Result");
  console.log("");
  console.log(`- status: ${result.status}`);
  console.log(`- nextAction: ${result.nextAction}`);
  console.log(`- publishActionIncluded: ${result.publishActionIncluded}`);
  console.log(`- revisionRounds: ${result.revisionRounds}`);
  console.log(`- performance: ${result.performance && "unavailable" in result.performance ? "unavailable" : "ok"}`);
  console.log(`- governance: ${result.governance?.decision ?? "none"}`);
  console.log(`- semanticAvailable: ${result.governance?.semanticAvailable ?? "none"}`);
  console.log(`- riskScore: ${result.governance?.riskScore ?? "none"}`);
  console.log(`- failure: ${result.failure ? result.failure.code : "none"}`);
  console.log("");

  if (result.draft?.body) {
    console.log("## Draft Candidate");
    console.log("");
    if (result.draft.title) console.log(`title: ${result.draft.title}`);
    console.log(result.draft.body);
    console.log("");
  }

  if (result.governance) {
    console.log("## Governance");
    console.log("");
    console.log(JSON.stringify(result.governance, null, 2));
    console.log("");
  }

  if (result.approvalHandoff) {
    console.log("## Human Approval");
    console.log("");
    console.log(JSON.stringify(result.approvalHandoff, null, 2));
    console.log("");
  }

  console.log("## Final State Mapping");
  console.log("");
  console.log("- ALLOW → publish_ready (no publish)");
  console.log("- REVIEW → approval_pending (no publish)");
  console.log("- BLOCK → revision_required (no publish)");
  console.log("");
  console.log("Human Owner: review Hermes cron local output / Desktop job history. No SNS publish button in this STEP.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`daily marketing plan failed: ${message}`);
  process.exit(1);
});
