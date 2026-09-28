/**
 * PR3 — ChatGPT/Astra canonical handoff aligned with the Canonical Writer semantics
 * from PR1/PR2: archetype is visible read-only, discovery Stories never get a
 * synthesized decisionAtStake, and edit notes carry the Writer's editorial rules.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT,
  buildCanonicalAssetChatGptExportPayload,
  parseCanonicalAssetChatGptImport,
  type CanonicalAssetChatGptContextReadOnly,
} from "@/lib/marketing/canonicalAsset/chatGptAssetTransfer";
import { resolveCanonicalHandoffStoryContext } from "@/lib/marketing/canonicalAsset/chatGptHandoffContext";
import {
  CANONICAL_EDITORIAL_SEMANTICS_NOTES_KO,
  CANONICAL_SURFACE_LANGUAGE_NOTES_KO,
} from "@/lib/marketing/canonicalAsset/surfaceLanguageContract";
import { STORY_CONTENT_POINT_CONTRACT, type StoryContentPoint } from "@/lib/marketing/storyPoint/contracts";

const STORY_TENSION = "등급을 올리면 편할 것 같지만 이동이 어려우면 하루가 망가진다";
const PROP_TENSION = "등급 vs 위치";
const DECISION_AT_STAKE = "부모님 동반 숙소를 등급으로 고를지 위치로 고를지";
const STAKES = ["부모님 이동 피로", "숙박 비용"];
const WEAK_DECISION = "다음 방콕 일정에 이 골목을 넣을지";

const EDITABLE_KEYS = [
  "bodyKo",
  "decisionGuidanceKo",
  "keyTakeawaysKo",
  "openingHookKo",
  "titleKo",
].sort();

function story(overrides: Partial<StoryContentPoint> = {}): StoryContentPoint {
  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: "sp_pr3",
    storyQuestion: "방콕 골목 사당 앞 꽃목걸이는 왜 늘 노란색일까?",
    storyClaim: null,
    whyInteresting: "매일 지나치는 장면에 이유가 있다",
    audienceTension: STORY_TENSION,
    curiosityGap: "흔한 색에 규칙이 있다",
    readerPayoff: "다음에 보면 알아볼 수 있는 구분",
    mechanisms: ["curiosity_gap"],
    researchNeeded: [],
    researchQuestions: [],
    genericRisk: "관광 상식 나열",
    genericRiskMitigation: null,
    channelPotential: {
      conversation: "medium",
      visualExplainability: "high",
      searchDepth: "low",
      shortformHookability: "high",
    },
    nonGoals: [],
    agendaFitNotes: null,
    ...overrides,
  };
}

const DISCOVERY_ARCHETYPES = [
  "discovery",
  "hidden_detail",
  "contrast",
  "alternative",
  "cultural_curiosity",
  "experience_fit",
] as const;

function exportInput(contextReadOnly: CanonicalAssetChatGptContextReadOnly) {
  return {
    candidateId: "cmc_pr3",
    assetId: "cma_pr3",
    version: 2,
    sourceRevision: "rev_pr3",
    editable: {
      titleKo: "노란 꽃목걸이의 이유",
      openingHookKo: "골목 사당 앞 꽃목걸이는 거의 늘 노란색입니다.",
      bodyKo: "본문 첫 단락입니다.\n\n본문 둘째 단락입니다.",
      keyTakeawaysKo: ["노란색은 요일 색과 관련이 있다"],
      decisionGuidanceKo: "다음에 골목을 지날 때 색을 한 번 살펴보면 장면이 다르게 보입니다.",
    },
    contextReadOnly,
  };
}

function baseContext(
  overrides: Partial<CanonicalAssetChatGptContextReadOnly> = {},
): CanonicalAssetChatGptContextReadOnly {
  return {
    storyTitleKo: "노란 꽃목걸이",
    storyQuestionKo: "방콕 골목 사당 앞 꽃목걸이는 왜 늘 노란색일까?",
    audienceProblemKo: null,
    decisionAtStakeKo: null,
    readerPayoffKo: "다음에 보면 알아볼 수 있는 구분",
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundaryKo: "일부 사당에서 관측된 경향",
    keyEvidenceKo: ["현장 관측"],
    limitationsKo: ["전 지역 조사는 아님"],
    forbiddenClaimsKo: ["모든 사당이 노란색만 쓴다"],
    contentPromiseKo: null,
    ctaIntentKo: null,
    ...overrides,
  };
}

function importRaw(raw: unknown) {
  return parseCanonicalAssetChatGptImport({
    raw: JSON.stringify(raw),
    expectedCandidateId: "cmc_pr3",
    expectedAssetId: "cma_pr3",
    expectedVersion: 2,
    expectedSourceRevision: "rev_pr3",
  });
}

describe("PR3 handoff Story context resolver (server)", () => {
  it.each(DISCOVERY_ARCHETYPES)(
    "%s: archetype visible, decisionAtStake null, tension only under audienceTensionKo",
    (archetype) => {
      const ctx = resolveCanonicalHandoffStoryContext({
        story: story({
          editorialArchetype: archetype,
          decisionAtStake: WEAK_DECISION,
          stakes: ["일정 여유"],
        }),
        proposition: { audienceTension: PROP_TENSION },
        asset: { editorialArchetype: archetype },
      });
      expect(ctx.editorialArchetype).toBe(archetype);
      expect(ctx.decisionAtStakeKo).toBeNull();
      expect(ctx.stakesKo).toEqual([]);
      expect(ctx.audienceTensionKo).toBe(PROP_TENSION);
    },
  );

  it("decision archetype preserves the genuine structured decision context", () => {
    const ctx = resolveCanonicalHandoffStoryContext({
      story: story({
        editorialArchetype: "worth_it_or_not",
        decisionAtStake: DECISION_AT_STAKE,
        stakes: [...STAKES],
      }),
      proposition: { audienceTension: PROP_TENSION },
      asset: { editorialArchetype: "worth_it_or_not" },
    });
    expect(ctx.editorialArchetype).toBe("worth_it_or_not");
    expect(ctx.decisionAtStakeKo).toBe(DECISION_AT_STAKE);
    expect(ctx.stakesKo).toEqual(STAKES);
    expect(ctx.audienceTensionKo).toBe(PROP_TENSION);
  });

  it("decision archetype without structured decision fields does not fall back to audienceTension", () => {
    const ctx = resolveCanonicalHandoffStoryContext({
      story: story({ editorialArchetype: "worth_it_or_not" }),
      proposition: { audienceTension: PROP_TENSION },
      asset: null,
    });
    expect(ctx.decisionAtStakeKo).toBeNull();
    expect(ctx.audienceTensionKo).toBe(PROP_TENSION);
  });

  it("uses the Writer archetype source: story direct value, then agendaFitNotes token, then asset lock", () => {
    expect(
      resolveCanonicalHandoffStoryContext({
        story: story({ editorialArchetype: "hidden_detail" }),
        proposition: null,
        asset: { editorialArchetype: "discovery" },
      }).editorialArchetype,
    ).toBe("hidden_detail");
    expect(
      resolveCanonicalHandoffStoryContext({
        story: story({ agendaFitNotes: "archetype:contrast" }),
        proposition: null,
        asset: null,
      }).editorialArchetype,
    ).toBe("contrast");
    expect(
      resolveCanonicalHandoffStoryContext({
        story: null,
        proposition: null,
        asset: { editorialArchetype: "discovery" },
      }).editorialArchetype,
    ).toBe("discovery");
  });

  it("legacy Story without archetype: no archetype, no synthesized decision, story tension fallback", () => {
    const ctx = resolveCanonicalHandoffStoryContext({
      story: story(),
      proposition: null,
      asset: { editorialArchetype: null },
    });
    expect(ctx).toEqual({
      editorialArchetype: null,
      audienceTensionKo: STORY_TENSION,
      decisionAtStakeKo: null,
      stakesKo: [],
    });
  });
});

describe("PR3 ChatGPT export payload shape", () => {
  it("discovery export: archetype present, decisionAtStakeKo null, tension not relabeled", () => {
    const ctx = resolveCanonicalHandoffStoryContext({
      story: story({ editorialArchetype: "discovery", decisionAtStake: WEAK_DECISION }),
      proposition: { audienceTension: PROP_TENSION },
      asset: { editorialArchetype: "discovery" },
    });
    const payload = buildCanonicalAssetChatGptExportPayload(exportInput(baseContext(ctx)));
    expect(payload.contextReadOnly.editorialArchetype).toBe("discovery");
    expect(payload.contextReadOnly.decisionAtStakeKo).toBeNull();
    expect(payload.contextReadOnly.stakesKo).toEqual([]);
    expect(payload.contextReadOnly.audienceTensionKo).toBe(PROP_TENSION);
    expect(Object.keys(payload.editable).sort()).toEqual(EDITABLE_KEYS);
  });

  it("decision export: genuine decision context preserved", () => {
    const ctx = resolveCanonicalHandoffStoryContext({
      story: story({
        editorialArchetype: "hidden_cost",
        decisionAtStake: DECISION_AT_STAKE,
        stakes: [...STAKES],
      }),
      proposition: { audienceTension: PROP_TENSION },
      asset: { editorialArchetype: "hidden_cost" },
    });
    const payload = buildCanonicalAssetChatGptExportPayload(exportInput(baseContext(ctx)));
    expect(payload.contextReadOnly.editorialArchetype).toBe("hidden_cost");
    expect(payload.contextReadOnly.decisionAtStakeKo).toBe(DECISION_AT_STAKE);
    expect(payload.contextReadOnly.stakesKo).toEqual(STAKES);
    expect(Object.keys(payload.editable).sort()).toEqual(EDITABLE_KEYS);
  });

  it("legacy callers without new fields still export with null/empty defaults", () => {
    const payload = buildCanonicalAssetChatGptExportPayload(exportInput(baseContext()));
    expect(payload.contract).toBe(CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT);
    expect(payload.contextReadOnly.editorialArchetype).toBeNull();
    expect(payload.contextReadOnly.audienceTensionKo).toBeNull();
    expect(payload.contextReadOnly.stakesKo).toEqual([]);
    expect(Object.keys(payload.editable).sort()).toEqual(EDITABLE_KEYS);
  });
});

describe("PR3 import keeps read-only context immutable", () => {
  it("ignores edits to archetype / decision context / limitations / identity; applies only five fields", () => {
    const payload = buildCanonicalAssetChatGptExportPayload(
      exportInput(baseContext({ editorialArchetype: "discovery" })),
    );
    const rogue = {
      ...payload,
      editorialArchetype: "worth_it_or_not",
      decisionAtStakeKo: "예약할지 말지",
      editable: {
        ...payload.editable,
        titleKo: "다듬은 제목",
        editorialArchetype: "worth_it_or_not",
        decisionAtStakeKo: "예약할지 말지",
        limitationsKo: [],
        supportedClaimBoundaryKo: "모든 사당",
      },
      contextReadOnly: {
        ...payload.contextReadOnly,
        editorialArchetype: "worth_it_or_not",
        decisionAtStakeKo: "예약할지 말지",
        stakesKo: ["예약 마감"],
        limitationsKo: [],
        forbiddenClaimsKo: [],
        keyEvidenceKo: ["지어낸 근거"],
      },
    };
    const parsed = importRaw(rogue);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.edits.titleKo).toBe("다듬은 제목");
    expect(Object.keys(parsed.edits).sort()).toEqual(EDITABLE_KEYS);
  });

  it("rejects a changed sourceRevision even when only read-only context was touched", () => {
    const payload = buildCanonicalAssetChatGptExportPayload(exportInput(baseContext()));
    const parsed = importRaw({ ...payload, sourceRevision: "rev_other" });
    expect(parsed.ok).toBe(false);
  });

  it("pre-PR3 clipboard JSON without the new read-only fields still imports", () => {
    const payload = buildCanonicalAssetChatGptExportPayload(exportInput(baseContext()));
    const legacyContext: Record<string, unknown> = { ...payload.contextReadOnly };
    delete legacyContext.editorialArchetype;
    delete legacyContext.audienceTensionKo;
    delete legacyContext.stakesKo;
    const parsed = importRaw({ ...payload, contextReadOnly: legacyContext });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.edits).sort()).toEqual(EDITABLE_KEYS);
  });
});

describe("PR3 ChatGPT/Astra edit notes match the Writer editorial rules", () => {
  const notes = buildCanonicalAssetChatGptExportPayload(exportInput(baseContext())).notesKo;
  const joined = notes.join("\n");

  it("includes every surface-language and editorial-semantics note", () => {
    for (const note of [...CANONICAL_SURFACE_LANGUAGE_NOTES_KO, ...CANONICAL_EDITORIAL_SEMANTICS_NOTES_KO]) {
      expect(notes).toContain(note);
    }
  });

  it("limitation placement: qualifier near the claim, no auto-repeat, central-finding exception", () => {
    expect(joined).toContain("limitationsKo");
    expect(joined).toContain("주장을 한정");
    expect(joined).toContain("자동으로 반복하지 마세요");
    for (const field of ["titleKo", "openingHookKo", "keyTakeawaysKo", "decisionGuidanceKo"]) {
      expect(CANONICAL_EDITORIAL_SEMANTICS_NOTES_KO[1]).toContain(field);
    }
    expect(joined).toContain("핵심 발견");
  });

  it("keyTakeawaysKo guidance is archetype-aware", () => {
    const note = notes.find((n) => n.startsWith("keyTakeawaysKo"));
    expect(note).toBeDefined();
    expect(note).toContain("editorialArchetype");
    for (const archetype of DISCOVERY_ARCHETYPES) expect(note).toContain(archetype);
    expect(note).toContain("decision/practical");
  });

  it("decisionGuidanceKo has a discovery boundary against invented actions", () => {
    const note = notes.find((n) => n.startsWith("decisionGuidanceKo"));
    expect(note).toBeDefined();
    expect(note).toContain("discovery");
    for (const action of ["예약", "구매", "방문", "비교", "추천", "확인"]) {
      expect(note).toContain(action);
    }
  });

  it("CTA boundary: no channel CTAs, channel CTA downstream, commercial only with explicit intent", () => {
    for (const cta of ["팔로우", "저장", "댓글", "구독", "이웃 추가", "채널 추가", "업데이트 약속"]) {
      expect(joined).toContain(cta);
    }
    expect(joined).toContain("채널 편집 단계");
    expect(joined).toContain("상업 의도");
  });

  it("no longer instructs Astra to preserve a decisionAtStake that may be absent", () => {
    expect(notes).not.toContain("Story의 핵심 질문과 decisionAtStake를 바꾸지 마세요.");
    expect(joined).toContain("decisionAtStakeKo가 null이면");
  });
});

describe("PR3 client bundle boundary", () => {
  it("chatGptAssetTransfer (client-imported) does not import node-only revisions", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/marketing/canonicalAsset/chatGptAssetTransfer.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/canonicalAsset\/revisions|chatGptHandoffContext|node:/);
  });
});
