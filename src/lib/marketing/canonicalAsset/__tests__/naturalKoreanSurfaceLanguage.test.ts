/**
 * Canonical natural-Korean surface language contract (A–H).
 * Read-only qualitative fixture uses Dao approved Canonical — no production regenerate.
 */

import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ASSET_SOURCE_WRITER_CONTRACT_PROMPT,
  buildAssetSourceWriterPrompt,
} from "@/lib/marketing/canonicalAsset/prompt";
import {
  buildCanonicalAssetChatGptExportPayload,
} from "@/lib/marketing/canonicalAsset/chatGptAssetTransfer";
import {
  CANONICAL_ABSTRACT_NOUNS_NEED_CONCRETE_TETHER,
  CANONICAL_LEGACY_HEDGE_SEED_SHOWING_CLUE,
  CANONICAL_NATURAL_KOREAN_SURFACE_CONTRACT_EN,
  CANONICAL_PARTIAL_SUPPORT_HEDGE_LINES_EN,
  CANONICAL_PLANNER_SHORTHAND_NOT_SURFACE,
  CANONICAL_PREFERRED_PARTIAL_HEDGES,
  CANONICAL_SURFACE_LANGUAGE_NOTES_KO,
} from "@/lib/marketing/canonicalAsset/surfaceLanguageContract";
import {
  ASSET_SOURCE_WRITER_ROLE,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import { buildCanonicalAssetWriterInput } from "@/lib/marketing/canonicalAsset/revisions";
import { CONTENT_PROPOSITION_CONTRACT } from "@/lib/marketing/content/proposition/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_RESEARCH_CONTRACT_VERSION,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";

const DAO_CANONICAL_PATH =
  "/mnt/HDD2TB/marketing-assets/2026/09/18/cmc_daily_marketing_production_2026_09_18_e0/context/canonical-marketing-asset.json";

function minimalStory(): StoryContentPoint {
  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: "sp_surface_lang",
    storyQuestion: "테스트 질문",
    storyClaim: "테스트 클레임",
    whyInteresting: "흥미",
    audienceTension: "긴장",
    curiosityGap: "갭",
    readerPayoff: "페이오프",
    mechanisms: ["curiosity_gap"],
    researchNeeded: ["근거"],
    researchQuestions: ["질문?"],
    genericRisk: "일반론",
    genericRiskMitigation: "구체화",
    channelPotential: {
      conversation: "medium",
      visualExplainability: "medium",
      searchDepth: "medium",
      shortformHookability: "medium",
    },
    nonGoals: [],
    agendaFitNotes: null,
    editorialArchetype: "discovery",
  };
}

function minimalEvidence(point: StoryContentPoint): EvidenceBackedStoryBrief {
  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: point.pointId,
    storyPointHash: createStoryPointHash(point),
    agendaLogicalIdentity: "logical_surface",
    researchExecutionStatus: "partial",
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundary: "공식 기록 범위",
    researchQuestionFindings: [],
    evidenceAssessment: [],
    contradictedClaims: [],
    unresolvedQuestions: [],
    usableFactIds: [],
    refutationNotes: null,
    limitations: ["현장 체험 미확인"],
    alternateFallbackUsed: false,
    researchSupportedFraming: [],
    observability: {
      plannedQuestionCount: 0,
      answeredQuestionCount: 0,
      unresolvedQuestionCount: 0,
      contradictingEvidenceCount: 0,
      externalQueriesAttempted: 0,
      externalQueriesSuccessful: 0,
      sourceClasses: [],
    },
  };
}

function minimalProposition(): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "여행 관심 독자",
    audienceProblem: "익숙한 이미지만 봄",
    audienceTension: "새 경험 vs 익숙함",
    whyNow: "기록 확인",
    contentPromise: "구체 건축/거주 기록 안내",
    readerGain: "비교 기준",
    specificTakeaways: ["공식 기록 범위"],
    proofRequirements: [
      { claimArea: "architecture", requiredProof: "official", severity: "should" },
    ],
    contentGapUsed: "generic destination intros",
    engagementMechanism: "curiosity_gap",
    desiredAudienceAction: "save",
    angle: "concrete local architecture vs familiar resort image",
    keyMessage: "공식 기록 범위에서 다른 주거·거주 모습을 소개한다",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: [],
  };
}

describe("Canonical natural Korean surface language contract", () => {
  it("A. natural Korean instruction exists on ASW prompt", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "NATURAL KOREAN SURFACE LANGUAGE",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "everyday spoken/written Korean",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      CANONICAL_NATURAL_KOREAN_SURFACE_CONTRACT_EN.slice(0, 40),
    );
  });

  it("B. abstract nouns are tether-required, not blacklisted", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("not a blacklist");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("ALLOWED");
    for (const noun of CANONICAL_ABSTRACT_NOUNS_NEED_CONCRETE_TETHER) {
      expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(noun);
    }
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toMatch(/must not replace concrete/i);
  });

  it("C. legacy hedge seed `~을 보여주는 단서다` removed as preferred example", () => {
    // Must not appear as a preferred hedge bullet (allowed only in explicit “do not prefer” warning).
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).not.toMatch(
      /^- ~을 보여주는 단서다$/m,
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      `Do NOT prefer the legacy stock phrase "${CANONICAL_LEGACY_HEDGE_SEED_SHOWING_CLUE}"`,
    );
    for (const hedge of [
      "현재 확인된 자료에서는",
      "공식 기록에서는 ~로 소개한다",
      "~에서 이런 특징을 볼 수 있다",
      "~으로 확인된다",
    ]) {
      expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(hedge);
      expect(CANONICAL_PREFERRED_PARTIAL_HEDGES as readonly string[]).toContain(hedge);
    }
  });

  it("D. concrete wording preference present", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("CONCRETE DETAIL FIRST");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "Prefer concrete people / place / object / action",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "이 지역에서 이어져 온 전통 주거 방식을 보여준다",
    );
    // Avoid seeding planner “rhythm” as preferred surface vocabulary
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).not.toContain("urban rhythm");
  });

  it("E. evidence hedge strength maintained", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("EVIDENCE DISCIPLINE");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("PARTIALLY_SUPPORTED");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("현재 확인된 자료에서는");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "실제 방문 경험은 추가 확인이 필요하다",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "Natural phrasing must NOT strengthen claims",
    );
  });

  it("F. forbidden claims / boundary discipline retained", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("forbiddenClaimsKo");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("supportedClaimBoundary");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("broaden supportedClaimBoundary");
  });

  it("G. Canonical writer and Astra/ChatGPT editor share surface-language parity", () => {
    for (const note of CANONICAL_SURFACE_LANGUAGE_NOTES_KO) {
      expect(note.length).toBeGreaterThan(10);
    }
    const payload = buildCanonicalAssetChatGptExportPayload({
      candidateId: "cmc_test",
      assetId: "cma_test",
      version: 1,
      sourceRevision: "rev",
      editable: {
        titleKo: "제목",
        openingHookKo: "훅",
        bodyKo: "본문",
        keyTakeawaysKo: ["하나"],
        decisionGuidanceKo: "안내",
      },
      contextReadOnly: {
        storyTitleKo: null,
        storyQuestionKo: null,
        audienceProblemKo: null,
        decisionAtStakeKo: null,
        readerPayoffKo: null,
        storySupportVerdict: "PARTIALLY_SUPPORTED",
        supportedClaimBoundaryKo: "범위",
        keyEvidenceKo: [],
        limitationsKo: [],
        forbiddenClaimsKo: [],
        contentPromiseKo: null,
        ctaIntentKo: null,
      },
    });
    for (const note of CANONICAL_SURFACE_LANGUAGE_NOTES_KO) {
      expect(payload.notesKo).toContain(note);
    }
    expect(payload.notesKo.some((n) => n.includes("보여주는 단서다"))).toBe(true);
    expect(payload.notesKo.some((n) => n.includes("금지하지 않습니다"))).toBe(true);
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("NATURAL KOREAN SURFACE LANGUAGE");
    for (const term of CANONICAL_PLANNER_SHORTHAND_NOT_SURFACE) {
      expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(term);
      expect(
        CANONICAL_SURFACE_LANGUAGE_NOTES_KO.some((n) => n.includes(term)),
      ).toBe(true);
    }
  });

  it("H. buildAssetSourceWriterPrompt still embeds locked input + role", () => {
    const point = minimalStory();
    const evidence = minimalEvidence(point);
    const writerInput = buildCanonicalAssetWriterInput({
      agendaId: "agenda_surface",
      storyPoint: point,
      storyPointHash: createStoryPointHash(point),
      evidenceBrief: evidence,
      proposition: minimalProposition(),
      topicIdentitySummary: "surface-test",
    });
    const prompt = buildAssetSourceWriterPrompt({ writerInput });
    expect(prompt).toContain(ASSET_SOURCE_WRITER_ROLE);
    expect(prompt).toContain("LOCKED_INPUT_JSON");
    expect(prompt).toContain("NATURAL KOREAN SURFACE LANGUAGE");
    expect(prompt).not.toMatch(/^- ~을 보여주는 단서다$/m);
  });
});

describe("Dao Canonical qualitative fixture (no regenerate)", () => {
  it("documents current Dao approved prose vs new surface contract expectations", () => {
    if (!existsSync(DAO_CANONICAL_PATH)) {
      // Hosts without marketing asset mount skip qualitative fixture.
      expect(true).toBe(true);
      return;
    }
    const dao = JSON.parse(readFileSync(DAO_CANONICAL_PATH, "utf8")) as CanonicalMarketingAsset;
    expect(dao.status).toBe("approved");
    const surface = [dao.bodyKo, dao.dekKo, dao.openingHookKo, dao.decisionGuidanceKo]
      .filter(Boolean)
      .join("\n");

    // Qualitative: current production still carries abstraction seeds the new contract targets.
    const seeded = ["문화적 맥락", "건축적 맥락", "문화적 면모", "보여주는 단서", "생활문화"].filter(
      (p) => surface.includes(p),
    );
    expect(seeded.length).toBeGreaterThan(0);

    // Contract must prefer concrete rewrite patterns over those stock hedges.
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "이 지역에서 이어져 온 전통 주거 방식을 보여준다",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).not.toMatch(
      /prefer bounded language[\s\S]{0,200}보여주는 단서다/,
    );

    // Zero-count is NOT required — only that guidance exists for future regenerations.
    expect(CANONICAL_ABSTRACT_NOUNS_NEED_CONCRETE_TETHER).toContain("맥락");
    expect(CANONICAL_ABSTRACT_NOUNS_NEED_CONCRETE_TETHER).toContain("단서");
  });
});
