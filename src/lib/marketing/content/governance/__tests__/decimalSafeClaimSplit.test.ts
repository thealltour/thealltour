vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import {
  extractGovernanceClaims,
  splitClaimSentences,
} from "@/lib/marketing/content/governance/extractClaims";
import { evaluateDeterministicClaimSignals } from "@/lib/marketing/content/governance/evaluateDeterministicClaimSignals";
import { normalizeGovernanceReviewResult } from "@/lib/marketing/content/governance/normalizeGovernanceReviewResult";
import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import type {
  ContentAssignment,
  ContentPlan,
} from "@/lib/marketing/content/types";
import type { StructuredGovernanceReviewRequest } from "@/lib/marketing/content/governance/types";

const NOW = new Date("2026-09-05T00:00:17.515Z");
const EVIDENCE_ID = "28b3c6c3-f7f6-49d0-93d0-14a14a448523";

/** Canonical Traveltimes excerpt from production 2026-09-05 CMC. */
const PRODUCTION_EXCERPT =
  "생성형 AI가 외국인 관광객의 여행정보 검색뿐 아니라 실제 방문지와 이동 경로에도 영향을 미치고 있다. 한국여행을 준비하면서 생성형 AI를 이용한 경험이 있는 외국인은 69.9%였고, AI가 추천한 관광지와 맛집을 실제 방문했다는 응답은 45.4%에 달했다. 추천받은 일정과 동선대로 실제 이동한 비율도 32.8%였다. AI가 여행계획을 짜는 보조도구에서 관광객의 실제 선택에 영향을 미치는 채널로 영역을 넓힌 셈이다.";

/** Exact production draft body (2026-09-05). */
const PRODUCTION_DRAFT_BODY = `🤖 AI가 이끄는 여행 트렌드의 변화!

한국관광 데이터 세미나에 따르면, 한국 여행을 준비하며 생성형 AI를 이용한 경험이 있는 외국인은 무려 69.9%에 달했다고 합니다.

단순한 정보 검색을 넘어, AI가 추천한 관광지와 맛집을 **실제 방문했다는 응답은 45.4%**, 추천받은 일정과 동선대로 **실제 이동한 비율도 32.8%**를 기록했습니다.

여행 계획을 짜는 보조도구를 넘어, 이제는 실제 여행자의 발걸음과 동선까지 결정하는 핵심 채널로 자리 잡은 생성형 AI!

앞으로의 여행 준비 방식, 여러분은 어떻게 생각하시나요? 의견을 남겨주세요! 👇`;

const PRODUCTION_FACTS_TO_USE = [
  "생성형 AI가 외국인 관광객의 여행정보 검색을 넘어 실제 방문지와 이동 경로까지 결정하는 주요 채널로 부상했다는 데이터 기반 인사이트를 다룬다.",
  "한국여행을 준비하면서 생성형 AI를 이용한 경험이 있는 외국인은 69.9%였다.",
  "AI가 추천한 관광지와 맛집을 실제 방문했다는 응답은 45.4%에 달했다.",
  "추천받은 일정과 동선대로 실제 이동한 비율도 32.8%였다.",
];

const FALSE_FRAGMENTS = ["69", "9%", "45", "4%", "32", "8%"];

function draft(body: string): ContentStrategistOutput {
  return {
    title: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
    body,
    channel: "threads",
    agenda: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
    sourceReferences: [],
    assignmentId: "ca_fixture",
  };
}

function productionEvidenceRef() {
  return {
    evidenceId: EVIDENCE_ID,
    sourceId: "a3033333-3333-4333-8333-333333333333",
    sourceName: "여행신문 Traveltimes",
    sourceType: "travel_industry",
    isOfficial: false,
    evidenceType: "direct_source",
    url: "https://www.traveltimes.co.kr/news/articleView.html?idxno=500297",
    reference: null,
    excerpt: PRODUCTION_EXCERPT,
    publishedAt: "2026-09-03T15:15:00.000Z",
    observedAt: "2026-09-04T15:40:40.273Z",
    credibilityHint: 0.722,
  };
}

function productionAssignment(): ContentAssignment {
  return {
    contract: "content-assignment-v1",
    assignmentId: "ca_fixture",
    selectedAgendaId: "sa_fixture",
    selectedAgendaTitle: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
    createdAt: NOW.toISOString(),
    objective: "inform_travelers",
    audience: "Korean travelers considering overseas travel",
    topic: "ai tourism",
    destinations: [],
    commercialIntent: "informational",
    matchedProductIds: [],
    requiredOutputs: ["threads_draft"],
    formatHints: [],
    facts: [
      {
        factId: "summary",
        statement:
          "생성형 AI가 외국인 관광객의 여행정보 검색을 넘어 실제 방문지와 이동 경로까지 결정하는 주요 채널로 부상했다는 데이터 기반 인사이트를 다룬다.",
        evidenceRefs: [EVIDENCE_ID],
        confidence: "medium",
      },
      {
        factId: EVIDENCE_ID,
        statement: PRODUCTION_EXCERPT,
        evidenceRefs: [EVIDENCE_ID],
        confidence: "medium",
      },
    ],
    evidenceRefs: [productionEvidenceRef()],
    constraints: [],
    riskNotes: [],
    deadline: null,
    provenance: {
      researchBriefId: "1fc721b4-6c58-4a6c-925e-edb1d05fb7b0",
      agendaCandidateId: "19d13b67-874e-43d1-81c8-24d9605f0976",
    },
  } as ContentAssignment;
}

function productionPlan(): ContentPlan {
  return {
    contract: "content-plan-v1",
    assignmentId: "ca_fixture",
    primaryAngle: PRODUCTION_FACTS_TO_USE[0]!,
    keyMessage: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
    hook: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
    outline: [],
    recommendedFormats: ["threads"],
    targetAudience: "Korean travelers considering overseas travel",
    ctaStrategy: "Informational CTA only — no hard sell.",
    productLinkageStrategy: "Informational content is valid without product linkage.",
    factsToUse: PRODUCTION_FACTS_TO_USE,
    factsToAvoid: [],
    evidenceRefs: [productionEvidenceRef()],
    requiredAssets: [],
    riskNotes: [],
    draftInstructions: [],
  } as ContentPlan;
}

describe("splitClaimSentences (decimal-safe)", () => {
  it("preserves percentage decimals", () => {
    const parts = splitClaimSentences(
      "방문율은 69.9%였고 실제 방문은 45.4%였다. 이동 비율은 32.8%였다.",
    );
    expect(parts.some((p) => p.includes("69.9%"))).toBe(true);
    expect(parts.some((p) => p.includes("45.4%"))).toBe(true);
    expect(parts.some((p) => p.includes("32.8%"))).toBe(true);
    expect(parts.join("|")).not.toMatch(/(^|\|)69(\||$)/);
    expect(parts.join("|")).not.toMatch(/(^|\|)9%(\||$)/);
  });

  it("1. Korean sentence ending after decimal", () => {
    expect(splitClaimSentences("방문율은 45.4%였습니다. 다음 문장입니다.")).toEqual([
      "방문율은 45.4%였습니다",
      "다음 문장입니다",
    ]);
  });

  it("2. multiple decimals in one sentence", () => {
    const parts = splitClaimSentences("비율은 69.9%, 45.4%, 32.8%로 집계됐다.");
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain("69.9%");
    expect(parts[0]).toContain("45.4%");
    expect(parts[0]).toContain("32.8%");
  });

  it("3. ordinary periods still split", () => {
    expect(splitClaimSentences("첫 문장입니다. 두 번째 문장입니다.")).toEqual([
      "첫 문장입니다",
      "두 번째 문장입니다",
    ]);
  });

  it("4. exclamation / question / newline boundaries still split", () => {
    expect(splitClaimSentences("첫 문장!\n둘째 문장?\n셋째")).toEqual([
      "첫 문장",
      "둘째 문장",
      "셋째",
    ]);
  });

  it("5. comma-formatted decimal", () => {
    const parts = splitClaimSentences("가격은 1,234.56원입니다. 다음.");
    expect(parts[0]).toContain("1,234.56");
    expect(parts).toHaveLength(2);
  });

  it("6. version/model-like numeric token", () => {
    const parts = splitClaimSentences("LTX 2.5 모델을 사용했다. 다음 문장.");
    expect(parts[0]).toContain("2.5");
    expect(parts).toHaveLength(2);
  });

  it("7. URLs are not catastrophically fragmented", () => {
    const url = "https://www.traveltimes.co.kr/news/articleView.html?idxno=500297";
    const parts = splitClaimSentences(`출처는 ${url} 입니다. 다음 문장입니다.`);
    expect(parts.some((p) => p.includes(url))).toBe(true);
    // Domain dots must not produce bare TLD / path fragments as sentences
    expect(parts.every((p) => !["co", "kr", "com", "html", "www"].includes(p.trim()))).toBe(
      true,
    );
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves bare decimals like 3.14", () => {
    expect(splitClaimSentences("원주율은 약 3.14이다. 끝.")[0]).toContain("3.14");
  });
});

describe("2026-09-05 production decimal claim fixture", () => {
  it("before/after: production draft keeps 69.9/45.4/32.8 whole and drops false fragments", () => {
    const sentences = splitClaimSentences(PRODUCTION_DRAFT_BODY);
    const joined = sentences.join("\n");

    expect(joined).toContain("69.9%");
    expect(joined).toContain("45.4%");
    expect(joined).toContain("32.8%");

    for (const fragment of FALSE_FRAGMENTS) {
      expect(sentences.some((s) => s.trim() === fragment)).toBe(false);
    }

    const claims = extractGovernanceClaims({
      draft: draft(PRODUCTION_DRAFT_BODY),
      contentPlan: productionPlan(),
    });
    const draftClaims = claims.filter((c) => c.sourcedFrom === "draft_scan");
    const draftTexts = draftClaims.map((c) => c.text);

    expect(draftTexts.some((t) => t.includes("69.9%"))).toBe(true);
    expect(draftTexts.some((t) => t.includes("45.4%"))).toBe(true);
    expect(draftTexts.some((t) => t.includes("32.8%"))).toBe(true);
    for (const fragment of FALSE_FRAGMENTS) {
      expect(draftTexts.some((t) => t.trim() === fragment)).toBe(false);
    }
  });

  it("evidence matching: intact percentage claims resolve to existing evidence", () => {
    // Aligned draft uses production facts/excerpt wording so existing matcher can bind.
    const alignedBody = [
      PRODUCTION_FACTS_TO_USE[1],
      PRODUCTION_FACTS_TO_USE[2],
      PRODUCTION_FACTS_TO_USE[3],
    ].join(" ");

    const claims = extractGovernanceClaims({
      draft: draft(alignedBody),
      contentPlan: productionPlan(),
    });
    const percentageClaims = claims.filter(
      (c) =>
        c.text.includes("69.9%") || c.text.includes("45.4%") || c.text.includes("32.8%"),
    );
    expect(percentageClaims.length).toBeGreaterThanOrEqual(3);
    // Plan-sourced copies carry evidence IDs; draft_scan copies rely on matcher.
    expect(
      percentageClaims.some(
        (c) => c.sourcedFrom === "content_plan" && c.evidenceRefs.includes(EVIDENCE_ID),
      ),
    ).toBe(true);
    expect(percentageClaims.every((c) => !FALSE_FRAGMENTS.includes(c.text.trim()))).toBe(true);

    const signals = evaluateDeterministicClaimSignals({
      draft: draft(alignedBody),
      assignment: productionAssignment(),
      contentPlan: productionPlan(),
      now: NOW,
    });

    const unsupportedTexts = signals.evidenceGaps;
    expect(unsupportedTexts.some((t) => t.includes("69.9%"))).toBe(false);
    expect(unsupportedTexts.some((t) => t.includes("45.4%"))).toBe(false);
    expect(unsupportedTexts.some((t) => t.includes("32.8%"))).toBe(false);
    for (const fragment of FALSE_FRAGMENTS) {
      expect(unsupportedTexts.some((t) => t.trim() === fragment)).toBe(false);
    }
    // Percentage facts are supported under existing matching semantics.
    expect(signals.unsupportedClaims.length).toBe(0);
    expect(signals.evidenceGaps.length).toBe(0);
  });

  it("production paraphrase draft: no decimal fragments in unsupported gaps", () => {
    const signals = evaluateDeterministicClaimSignals({
      draft: draft(PRODUCTION_DRAFT_BODY),
      assignment: productionAssignment(),
      contentPlan: productionPlan(),
      now: NOW,
    });
    for (const fragment of FALSE_FRAGMENTS) {
      expect(signals.evidenceGaps.some((t) => t.trim() === fragment)).toBe(false);
    }
    // Whole percentages may still appear in gaps only if paraphrase fails matcher —
    // but never as split "69"/"9%" fragments.
    const gapBlob = signals.evidenceGaps.join("\n");
    if (gapBlob.includes("69")) {
      expect(gapBlob).toContain("69.9%");
    }
  });
});

describe("decimal fix does not weaken governance floor", () => {
  function baseRequest(
    preflight: StructuredGovernanceReviewRequest["preflightSignals"],
  ): StructuredGovernanceReviewRequest {
    return {
      contract: "governance-review-request-v1",
      reviewId: "gr_fixture",
      assignmentId: "ca_fixture",
      selectedAgendaId: "sa_fixture",
      channel: "threads",
      productId: null,
      draft: draft("unsupported exact price is 999000원 today."),
      claims: [],
      evidenceRefs: [],
      priorRevision: 0,
      maxAutoRevisionRounds: 1,
      preflightSignals: preflight,
    };
  }

  it("8. existing unsupported non-decimal claim detection remains intact", () => {
    const signals = evaluateDeterministicClaimSignals({
      draft: draft("이번 패키지는 무조건 확정 출발이며 가격은 150000원입니다."),
      now: NOW,
    });
    expect(signals.unsupportedClaims.length).toBeGreaterThan(0);
    expect(signals.evidenceGaps.length).toBeGreaterThan(0);
  });

  it("unsupported claims still trigger REVIEW floor; riskScore unchanged", () => {
    const normalized = normalizeGovernanceReviewResult(
      {
        decision: "ALLOW",
        riskScore: 0,
        reasons: ["NO_RISK_SIGNAL"],
        revisionHints: [],
        humanApprovalRequired: false,
        semanticAvailable: true,
      },
      baseRequest({
        unsupportedClaims: ["claim_decimal_safe_still_strict"],
        factualRisks: [],
        evidenceGaps: [],
        commercialRisks: [],
        staleEvidenceIds: [],
        suggestedConcerns: [],
      }),
      NOW,
    );
    expect(normalized.structured.decision).toBe("REVIEW");
    expect(normalized.structured.riskScore).toBe(0);
    expect(normalized.structured.reasons).toContain("FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW");
  });

  it("evidence gaps still trigger REVIEW floor", () => {
    const normalized = normalizeGovernanceReviewResult(
      {
        decision: "ALLOW",
        riskScore: 0,
        reasons: [],
        revisionHints: [],
        humanApprovalRequired: false,
        semanticAvailable: true,
      },
      baseRequest({
        unsupportedClaims: [],
        factualRisks: [],
        evidenceGaps: ["Missing source for schedule claim"],
        commercialRisks: [],
        staleEvidenceIds: [],
        suggestedConcerns: [],
      }),
      NOW,
    );
    expect(normalized.structured.decision).toBe("REVIEW");
    expect(normalized.structured.riskScore).toBe(0);
    expect(normalized.structured.reasons[0]).toBe("FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW");
  });
});
