/**
 * Marketing department live handoff (Hermes v0.20.4).
 *
 * Application-level orchestration: this process calls each named profile with
 * `hermes -p <id> --yolo --ignore-rules -z`. There is no native profile RPC.
 *
 * DB write 없음. publish 없음. Cron 없음.
 *
 *   npx tsx scripts/test-marketing-department-handoff.ts
 */
import { spawnSync } from "node:child_process";
import { extractJsonObject } from "../src/lib/marketing/bot/organization/envelope";
import { runDepartmentPipeline } from "../src/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult, PerformanceBrief } from "../src/lib/marketing/bot/organization/handoffs";
import type { PerformanceUnavailable } from "../src/lib/marketing/bot/organization/pipeline";

const PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

function invokeProfile(profile: string, prompt: string): string {
  const result = spawnSync("hermes", ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt], {
    encoding: "utf8",
    env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME ?? "/home/ysh/.hermes" },
    timeout: 180_000,
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
    // fall through to text scan
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

function asPerformance(raw: string): PerformanceBrief | PerformanceUnavailable {
  const value = extractJsonObject(raw) as Record<string, unknown>;
  const metrics = Array.isArray(value.metrics) ? value.metrics : [];
  const numeric = metrics.filter((item) => item && typeof item === "object" && typeof (item as { value?: unknown }).value === "number");
  if (numeric.length === 0) {
    return { unavailable: true, reason: "no confirmed metrics" };
  }
  return {
    period: (value.period as PerformanceBrief["period"]) ?? { start: "", end: "" },
    productId: PRODUCT,
    channel: "threads",
    keyMetrics: numeric as PerformanceBrief["keyMetrics"],
    observedPatterns: Array.isArray(value.observations) ? value.observations.map(String) : [],
    confidence: (value.confidence as PerformanceBrief["confidence"]) ?? "low",
  };
}

async function main() {
  const result = await runDepartmentPipeline(
    {
      productId: PRODUCT,
      channel: "threads",
      goal: "스페인/포르투갈 패키지 홍보 Threads 콘텐츠",
    },
    {
      requestPerformance: async () => {
        const raw = invokeProfile(
          "performance-analyst",
          `JSON only. productId ${PRODUCT}. 최근 30일 확인 가능한 마케팅 성과만. 없는 metric은 만들지 마. 게시하지 마. shape: {"period":{"start":"","end":""},"metrics":[],"observations":[],"confidence":"low"}`,
        );
        return asPerformance(raw);
      },
      requestDraft: async (envelope) => {
        const raw = invokeProfile(
          "content-strategist",
          `JSON only. ContentDraftRequest를 근거로 Threads 초안. 없는 혜택/일정 만들지 마. 게시하지 마.\n${JSON.stringify(envelope.payload)}\nshape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[]}`,
        );
        return asDraft(raw);
      },
      requestGovernance: async (envelope) => {
        const raw = invokeProfile(
          "governance-auditor",
          `JSON only. 이 초안을 검사하고 ALLOW/REVIEW/BLOCK만. 게시하지 마.\n${JSON.stringify(envelope.payload)}\nshape: {"decision":"ALLOW","riskScore":0,"reasons":[],"revisionHints":[],"humanApprovalRequired":false,"semanticAvailable":true}`,
        );
        return asGovernance(raw);
      },
    },
  );

  if (result.publishActionIncluded) throw new Error("publish action must not be included");
  console.log(`status: ${result.status}`);
  console.log(`nextAction: ${result.nextAction}`);
  console.log(`publishActionIncluded: ${result.publishActionIncluded}`);
  console.log(`contentHandoff: ${result.draft ? "ok" : "none"}`);
  console.log(`governanceDecision: ${result.governance?.decision ?? "none"}`);
  console.log(`semanticAvailable: ${result.governance?.semanticAvailable ?? "none"}`);
  console.log(`riskScore: ${result.governance?.riskScore ?? "none"}`);
  console.log(`performance: ${result.performance && "unavailable" in result.performance ? "unavailable" : "ok"}`);
  console.log(`revisionRounds: ${result.revisionRounds}`);
  console.log(`identityEnforcement: ${result.agentIdentityEnforcement}`);
  console.log(`failure: ${result.failure ? `${result.failure.code}` : "none"}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`department handoff failed: ${message}`);
  process.exit(1);
});
