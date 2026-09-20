/**
 * MQ-4 — production LLM composer wiring + fallback demotion.
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONTENT_PROPOSITION_CONTRACT } from "@/lib/marketing/content/proposition/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { exportMarketingCandidatePackage } from "@/lib/marketing/assets/exportMarketingCandidatePackage";
import { ensurePublishableContent } from "@/lib/marketing/publishable/ensurePublishableContent";
import { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";
import { composeThreadsPublishableContent } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { composeNaverBandPublishableContent } from "@/lib/marketing/publishable/naver_band/composeNaverBandPublishableContent";
import { composeShortformNarration } from "@/lib/marketing/publishable/shortform/composeShortformNarration";
import { buildPublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import {
  approvalBlockedReasonForChannel,
  channelCountsAsPublishableSuccess,
} from "@/lib/marketing/publishable/publishableSuccess";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import { checkShortformHookPayoff } from "@/lib/marketing/publishable/composerRuntime";

function asPromptText(prompt: unknown): string {
  if (typeof prompt === "string") return prompt;
  if (prompt && typeof prompt === "object" && "text" in prompt) {
    return String((prompt as { text: string }).text);
  }
  return String(prompt ?? "");
}

function proposition(overrides: Partial<ContentProposition> = {}): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "부산·경남에서 추석 가족여행을 알아보는 사람",
    audienceProblem: "상품 가격부터 보지만 가족 일정·출발·포함사항이 맞지 않을 수 있음",
    audienceTension: "빨리 고르고 싶음 vs 확인 없이 불안",
    whyNow: "추석 가족 패키지 프로모션이 소셜에서 관측됨",
    contentPromise: "가격보다 먼저 확인할 일정·출발·포함사항 기준을 정리한다",
    readerGain: "비교 전에 일정/직항/포함사항부터 확인하는 기준을 얻는다",
    specificTakeaways: [
      "가족 전원이 가능한 날짜부터 맞춘다",
      "부산 출발·직항 여부를 확인한다",
      "패키지 포함/불포함 항목을 비교한다",
    ],
    proofRequirements: [
      {
        claimArea: "직항 여부",
        requiredProof: "official airline confirmation",
        severity: "must",
      },
    ],
    contentGapUsed: "가격 훅은 많지만 확인 순서는 없음",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "가격보다 가족 일정 조율이 먼저다",
    keyMessage: "일정·출발·포함사항부터",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: ["직항은 공식 확인 전 단정 금지"],
    ...overrides,
  };
}

function candidate(prop?: ContentProposition | null): CompletedMarketingCandidate {
  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: "cmc_mq4_test",
    businessDateKst: "2026-09-13",
    logicalRunKey: "lr_mq4",
    selectedAgenda: {
      id: "ag1",
      title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
      summary: "나트랑 가족 패키지",
      destinations: ["나트랑"],
      topics: ["추석", "패키지"],
      entities: [],
      contentObjective: "inform_travelers",
      commercialIntent: "informational",
      timelinessNote: null,
      researchScoreAtSelection: 0.5,
      evidenceRefs: [],
    },
    contentAssignment: {
      assignmentId: "asg_mq4",
      objective: "inform",
      topic: "나트랑 추석 가족 패키지",
      audience: "가족 여행자",
      commercialIntent: "informational",
      facts: [
        {
          factId: "f1",
          statement: "추석 가족 패키지 프로모션이 공개 소셜에서 관측됨",
          evidenceRefs: ["f4e6f641-d2cd-4704-8d01-2fbc890a516b"],
          confidence: "medium",
        },
      ],
      formatHints: [{ format: "short_video_concept", score: 0.8 }],
      constraints: [],
      evidenceRefs: [
        {
          evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
          sourceId: "a1000000-0000-4000-8000-000000000001",
          sourceType: "social",
          sourceName: "Meta",
          isOfficial: false,
          evidenceType: "derived_signal",
          url: null,
          reference: "meta",
          excerpt: "나트랑 패키지",
          publishedAt: null,
          observedAt: "2026-09-13T00:00:00.000Z",
          credibilityHint: 0.35,
        },
      ],
    },
    contentPlan: {
      contract: "content-plan-v1",
      assignmentId: "asg_mq4",
      primaryAngle: "가격보다 가족 일정 조율이 먼저다",
      keyMessage: "일정·출발·포함사항부터",
      hook: "추석 가족여행, 상품부터 찾으면 일정부터 꼬일 수 있습니다",
      outline: ["왜 지금", "먼저 확인할 3가지"],
      ctaStrategy: "save checklist",
      targetAudience: "부산·경남 추석 가족여행 검토자",
      targetChannels: ["threads", "shortform", "naver_band"],
      factsToUse: [],
      factsToAvoid: [],
      evidenceRefs: [],
      recommendedFormats: [{ format: "short_video_concept", score: 0.8 }],
      proposition: prop === null ? null : prop ?? proposition(),
    },
    draft: {
      title: "draft",
      body: "Context\nKey verified facts\ninternal plan",
      channel: "threads",
      agenda: null,
      sourceReferences: [],
      contentPlan: null,
      assignmentId: "asg_mq4",
    },
    governanceDecision: {
      decision: "ALLOW",
      riskScore: 0.2,
      reasons: [],
      revisionHints: [],
      requiredRevisions: [],
      humanApprovalRequired: false,
      semanticAvailable: false,
      unsupportedClaims: [],
      verifiedEvidenceRefs: [],
    },
    status: "READY_FOR_HUMAN_REVIEW",
    revisionHistory: [],
    provenance: {
      routineId: "mq4",
      correlationId: "mq4",
      researchStatus: "complete",
      governanceReviewId: null,
    },
    observability: { stages: {}, timingsMs: {}, modelCalls: 0 },
  } as never;
}

function goodThreadsJson() {
  return JSON.stringify({
    title: null,
    body: "추석 가족여행, 가격부터 보면 일정부터 꼬일 수 있어요.\n\n먼저 가족 전원이 가능한 날짜를 맞추고, 부산 출발·직항 여부를 확인한 뒤, 패키지 포함/불포함 항목을 비교해 보세요.\n\n직항 여부는 예약 전 공식 확인이 필요합니다. 체크리스트로 저장해 두세요.",
  });
}

function goodBandJson() {
  return JSON.stringify({
    title: null,
    body: "추석에 나트랑 가족 패키지 보시는 분들, 가격보다 일정·출발·포함사항부터 맞춰보셨나요?\n\n1) 가족 날짜\n2) 부산 출발/직항 여부(공식 확인)\n3) 포함/불포함\n\n아이/부모님 동반이면 어떤 항목이 제일 걱정되세요?",
  });
}

function goodShortformJson() {
  return JSON.stringify({
    body: "추석 가족여행, 가격보다 먼저 확인할 3가지.\n\n가족 일정, 부산 출발 여부, 포함사항.\n\n직항은 예약 전 확인하세요.",
    segments: [
      { purpose: "hook", narrationText: "추석 가족여행, 가격보다 먼저 확인할 3가지.", visualIntent: "family packing" },
      { purpose: "body", narrationText: "가족 일정, 부산 출발 여부, 포함사항부터 맞춰보세요.", visualIntent: "checklist" },
      { purpose: "close", narrationText: "직항은 예약 전 공식 확인이 필요합니다.", visualIntent: "airport" },
    ],
  });
}

describe("MQ-4 publishable success gates", () => {
  it("fallback is not publishable or approvable", async () => {
    const input = buildPublishableComposerInput(candidate());
    const out = await composeThreadsPublishableContent({
      composerInput: input,
      invoke: null,
    });
    expect(out.status).toBe("fallback_generated");
    expect(out.publishableSuccess).toBe(false);
    expect(channelCountsAsPublishableSuccess(out)).toBe(false);
    expect(approvalBlockedReasonForChannel(out)).toMatch(/regeneration_required/);
  });

  it("LLM failure yields generation_failed and diagnostic fallback body", async () => {
    const input = buildPublishableComposerInput(candidate());
    const out = await composeThreadsPublishableContent({
      composerInput: input,
      invoke: async () => {
        throw new Error("ETIMEDOUT hermes timeout");
      },
    });
    expect(out.provenance.composer).toBe("deterministic_fallback");
    expect(["generation_failed", "validation_failed", "fallback_generated"]).toContain(out.status);
    expect(out.publishableSuccess).toBe(false);
    expect(out.provenance.failureCategory).toBe("timeout");
    expect(out.needsRegeneration).toBe(true);
  });

  it("invalid JSON repairs once then validation_failed", async () => {
    const input = buildPublishableComposerInput(candidate());
    let calls = 0;
    const out = await composeThreadsPublishableContent({
      composerInput: input,
      invoke: async () => {
        calls += 1;
        return "not-json Context Key verified facts";
      },
    });
    expect(calls).toBe(2);
    expect(out.publishableSuccess).toBe(false);
    expect(out.provenance.attemptCount).toBe(2);
  });

  it("successful LLM marks publishableSuccess and records proposition provenance", async () => {
    const input = buildPublishableComposerInput(candidate());
    const out = await composeThreadsPublishableContent({
      composerInput: input,
      invoke: async () => goodThreadsJson(),
      modelProfile: "channel-editor-threads",
    });
    expect(out.status).toBe("generated");
    expect(out.provenance.composer).toBe("llm");
    expect(out.publishableSuccess).toBe(true);
    expect(out.provenance.proposition?.contract).toBe(CONTENT_PROPOSITION_CONTRACT);
    expect(out.provenance.modelProfile).toBe("channel-editor-threads");
  });

  it("insufficient proposition skips polished generation", async () => {
    const input = buildPublishableComposerInput(
      candidate(proposition({ propositionStrength: "insufficient" })),
    );
    const invoke = vi.fn(async () => goodThreadsJson());
    const out = await composeThreadsPublishableContent({
      composerInput: input,
      invoke,
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(out.status).toBe("generation_failed");
    expect(out.provenance.failureCategory).toBe("insufficient_proposition");
    expect(out.publishableSuccess).toBe(false);
  });

  it("qualityRevision injects QUALITY_REVISION block into Content Strategist prompt", async () => {
    const input = {
      ...buildPublishableComposerInput(candidate()),
      qualityRevision: {
        hints: ["Replace scaffold headings with a concrete checklist"],
        reasons: ["Scaffold-like body"],
        priorBody: "[Context]\n[Key verified facts]",
      },
    };
    let seen = "";
    const out = await composeThreadsPublishableContent({
      composerInput: input,
      invoke: async (prompt) => {
        seen = asPromptText(prompt);
        return goodThreadsJson();
      },
      modelProfile: "content-strategist",
    });
    expect(seen).toContain("QUALITY_REVISION");
    expect(seen).toContain("Scaffold-like body");
    expect(seen).toContain("Replace scaffold headings");
    expect(seen).toContain("[Context]");
    expect(out.publishableSuccess).toBe(true);
  });
});

describe("MQ-4 export / persistence / idempotency", () => {
  it("export does not regenerate deterministic publishable as final", () => {
    const dir = mkdtempSync(join(tmpdir(), "mq4-export-"));
    try {
      const exported = exportMarketingCandidatePackage({
        candidate: candidate(),
        assetRoot: dir,
        forcePublishableRegenerate: true,
      });
      const pubPath = join(exported.packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
      const bundle = JSON.parse(readFileSync(pubPath, "utf8"));
      expect(bundle.threads.publishableSuccess).toBe(false);
      expect(bundle.threads.status).toMatch(/generation_failed|fallback/);
      const post = readFileSync(join(exported.packageRoot, "copy/post.txt"), "utf8");
      expect(post).toMatch(/DEGRADED|awaiting LLM/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("same sourceRevision reuses persisted LLM bundle with zero new invoke", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mq4-idem-"));
    mkdirSync(join(dir, "context"), { recursive: true });
    const cand = candidate();
    let calls = 0;
    const invoke = async (prompt: unknown) => {
      calls += 1;
      if (asPromptText(prompt).includes("숏폼") || asPromptText(prompt).includes("나레이션") || asPromptText(prompt).includes("segments")) {
        return goodShortformJson();
      }
      if (asPromptText(prompt).includes("Band") || asPromptText(prompt).includes("밴드")) {
        return goodBandJson();
      }
      return goodThreadsJson();
    };
    const first = await ensurePublishableContent({
      candidate: cand,
      packageRoot: dir,
      forceRegenerate: true,
      invoke,
      persist: true,
    });
    expect(first.threads.publishableSuccess).toBe(true);
    const afterFirst = calls;
    const second = await ensurePublishableContent({
      candidate: cand,
      packageRoot: dir,
      invoke,
    });
    expect(calls).toBe(afterFirst);
    expect(second.sourceRevision).toBe(first.sourceRevision);
    expect(second.threads.body).toBe(first.threads.body);
    rmSync(dir, { recursive: true, force: true });
  });

  it("channel-scoped regenerate invokes LLM only for the forced channel", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mq4-scope-llm-"));
    mkdirSync(join(dir, "context"), { recursive: true });
    const cand = candidate();
    let calls = 0;
    const invoke = async (prompt: unknown) => {
      calls += 1;
      if (asPromptText(prompt).includes("segments")) return goodShortformJson();
      if (asPromptText(prompt).includes("Band") || asPromptText(prompt).includes("밴드")) return goodBandJson();
      if (asPromptText(prompt).includes("blog") || asPromptText(prompt).includes("블로그")) {
        return JSON.stringify({
          title: "블로그 제목",
          body: "블로그 본문입니다. ".repeat(40),
        });
      }
      return goodThreadsJson();
    };
    await ensurePublishableContent({
      candidate: cand,
      packageRoot: dir,
      forceRegenerate: true,
      explicitTargetChannels: ["threads", "shortform", "naver_blog"],
      invoke,
      persist: true,
    });
    const afterSeed = calls;
    const scopedPrompts: string[] = [];
    const scoped = await ensurePublishableContent({
      candidate: cand,
      packageRoot: dir,
      forceRegenerateChannels: ["threads"],
      explicitTargetChannels: ["threads", "shortform", "naver_blog"],
      invoke: async (prompt) => {
        calls += 1;
        const text = asPromptText(prompt);
        scopedPrompts.push(text);
        expect(
          typeof prompt === "object" && prompt && "channel" in prompt
            ? (prompt as { channel: string }).channel
            : "threads",
        ).toBe("threads");
        return JSON.stringify({
          title: "재생성 스레드",
          body: JSON.parse(goodThreadsJson()).body,
        });
      },
      persist: true,
    });
    // composer may do initial + one repair; both must stay on the forced channel
    expect(calls - afterSeed).toBeGreaterThanOrEqual(1);
    expect(calls - afterSeed).toBeLessThanOrEqual(2);
    expect(scopedPrompts.every((p) => /CHANNEL: Threads|Threads\(스레드\)/i.test(p))).toBe(true);
    expect(scoped.threads.title).toBe("재생성 스레드");
    rmSync(dir, { recursive: true, force: true });
  });

  it("export with prebuilt LLM bundle writes non-degraded post", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mq4-export-llm-"));
    mkdirSync(join(dir, "pkg"), { recursive: true });
    const cand = candidate();
    const bundle = await ensurePublishableContent({
      candidate: cand,
      forceRegenerate: true,
      invoke: async (prompt) => {
        if (asPromptText(prompt).includes("segments")) return goodShortformJson();
        if (asPromptText(prompt).includes("Band") || asPromptText(prompt).includes("밴드") || asPromptText(prompt).includes("community")) {
          return goodBandJson();
        }
        return goodThreadsJson();
      },
    });
    const exported = exportMarketingCandidatePackage({
      candidate: cand,
      assetRoot: dir,
      publishableBundle: bundle,
    });
    const post = readFileSync(join(exported.packageRoot, "copy/post.txt"), "utf8");
    expect(post).not.toMatch(/DEGRADED/);
    expect(post).toMatch(/일정|포함/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("scoped regenerate LLM failure keeps prior body and does not persist diagnostic fallback", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mq4-regen-nofallback-"));
    mkdirSync(join(dir, "context"), { recursive: true });
    const cand = candidate();
    const prior = await ensurePublishableContent({
      candidate: cand,
      packageRoot: dir,
      forceRegenerate: true,
      invoke: async (prompt) => {
        const text = asPromptText(prompt);
        if (text.includes("segments") || text.includes("숏폼") || text.includes("나레이션")) {
          return goodShortformJson();
        }
        if (text.includes("Band") || text.includes("밴드") || text.includes("community")) {
          return goodBandJson();
        }
        return goodThreadsJson();
      },
      persist: true,
    });
    expect(prior.threads.provenance.composer).toBe("llm");
    const priorBody = prior.threads.body;

    const failed = await ensurePublishableContent({
      candidate: cand,
      packageRoot: dir,
      forceRegenerateChannels: ["threads"],
      allowDeterministicFallback: false,
      invoke: async () => {
        throw new Error("ETIMEDOUT hermes timeout after 360000ms");
      },
      persist: true,
    });

    expect(failed.threads.provenance.composer).not.toBe("llm");
    expect(failed.threads.publishableSuccess).toBe(false);
    expect(failed.threads.body).not.toMatch(/공개된 콘텐츠·후기에서는/);
    expect(failed.threads.body === "" || failed.threads.body.startsWith("[generation")).toBe(true);

    const persisted = JSON.parse(
      readFileSync(join(dir, PUBLISHABLE_CONTENT_RELATIVE_PATH), "utf8"),
    ) as { threads: { body: string; provenance: { composer: string } } };
    expect(persisted.threads.body).toBe(priorBody);
    expect(persisted.threads.provenance.composer).toBe("llm");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("MQ-4 channel differentiation + proposition consumption", () => {
  it("threads/band/shortform each receive proposition and stay channel-native", async () => {
    const input = buildPublishableComposerInput(candidate());
    expect(input.contentProposition?.contentPromise).toBeTruthy();
    const prompts: string[] = [];
    const invoke = async (prompt: unknown) => {
      prompts.push(asPromptText(prompt));
      if (asPromptText(prompt).includes("segments") || asPromptText(prompt).includes("숏폼")) return goodShortformJson();
      if (asPromptText(prompt).includes("Band") || asPromptText(prompt).includes("밴드") || asPromptText(prompt).includes("naver_band")) {
        return goodBandJson();
      }
      return goodThreadsJson();
    };
    const [threads, band, shortform] = await Promise.all([
      composeThreadsPublishableContent({ composerInput: input, invoke }),
      composeNaverBandPublishableContent({ composerInput: input, invoke }),
      composeShortformNarration({ composerInput: input, invoke }),
    ]);
    expect(prompts.every((p) => p.includes("CONTENT_PROPOSITION") || p.includes("contentProposition"))).toBe(
      true,
    );
    expect(threads.body).not.toBe(band.body);
    expect(shortform.narrationSegments?.length).toBeGreaterThan(1);
    expect(threads.publishableSuccess).toBe(true);
    expect(band.publishableSuccess).toBe(true);
    expect(shortform.publishableSuccess).toBe(true);
  });

  it("hook payoff guard rejects unpaid one-thing hook", () => {
    const result = checkShortformHookPayoff({
      segments: [
        { purpose: "hook", narrationText: "이 한 가지만 기억하세요" },
        { purpose: "close", narrationText: "끝" },
      ],
      body: "이 한 가지만 기억하세요",
    });
    expect(result.ok).toBe(false);
  });
});

describe("MQ-4 sync path production safety", () => {
  it("allowDeterministicGeneration=false does not create publishable success", () => {
    const bundle = ensurePublishableContentSync({
      candidate: candidate(),
      allowDeterministicGeneration: false,
    });
    expect(channelCountsAsPublishableSuccess(bundle.threads)).toBe(false);
    expect(bundle.threads.status).toBe("generation_failed");
  });

  it("persisted LLM artifact is reused by sync without regen", () => {
    const dir = mkdtempSync(join(tmpdir(), "mq4-sync-reuse-"));
    mkdirSync(join(dir, "context"), { recursive: true });
    const cand = candidate();
    const rev = buildPublishableComposerInput(cand).sourceRevision;
    const llmBundle = {
      contract: "publishable-channel-content-bundle-v1" as const,
      candidateId: cand.candidateId,
      businessDateKst: cand.businessDateKst,
      generatedAt: "2026-09-13T00:00:00.000Z",
      sourceRevision: rev,
      targetChannels: ["threads", "shortform"] as const,
      threads: {
        contract: "publishable-channel-content-v1" as const,
        channel: "threads" as const,
        format: "threads_text" as const,
        title: null,
        body: "LLM threads body with 일정 and 포함사항",
        status: "generated" as const,
        generatedAt: "2026-09-13T00:00:00.000Z",
        sourceCandidateId: cand.candidateId,
        sourceRevision: rev,
        provenance: {
          composer: "llm" as const,
          evidenceRefIds: [],
          commercialIntent: "informational",
          generationMode: "llm" as const,
        },
        validation: { ok: true, issues: [] },
        publishableSuccess: true,
        needsRegeneration: false,
      },
      shortform: {
        contract: "publishable-channel-content-v1" as const,
        channel: "shortform" as const,
        format: "short_video_narration" as const,
        title: null,
        body: "LLM shortform",
        status: "generated" as const,
        generatedAt: "2026-09-13T00:00:00.000Z",
        sourceCandidateId: cand.candidateId,
        sourceRevision: rev,
        provenance: {
          composer: "llm" as const,
          evidenceRefIds: [],
          commercialIntent: "informational",
        },
        validation: { ok: true, issues: [] },
        publishableSuccess: true,
        narrationSegments: [],
      },
    };
    persistPublishableContentBundle({
      packageRoot: dir,
      bundle: llmBundle as never,
      createdAt: "2026-09-13T00:00:00.000Z",
    });
    const reused = ensurePublishableContentSync({
      candidate: cand,
      packageRoot: dir,
      allowDeterministicGeneration: false,
      forceRegenerate: false,
    });
    expect(reused.threads.body).toMatch(/LLM threads/);
    expect(reused.threads.provenance.composer).toBe("llm");
    rmSync(dir, { recursive: true, force: true });
  });
});
