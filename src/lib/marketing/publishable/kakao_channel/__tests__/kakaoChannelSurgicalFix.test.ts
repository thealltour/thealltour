/**
 * Kakao Channel (channel-editor-kakao) surgical fix regressions A–G + non-Dao counters.
 * Instruction/contract tests — no phrase blacklist, no Dao-specific word bans.
 */

import { describe, expect, it } from "vitest";

import { MARKETING_AGENT_CONTRACT_DEBT } from "@/lib/marketing/agentContracts/debt";
import {
  CHANNEL_EDITOR_CHANNEL_EXTENSIONS,
  CHANNEL_EDITOR_COMMON_IDENTITY,
  buildChannelEditorSoulMarkdown,
  resolveChannelEditorHermesProfile,
} from "@/lib/marketing/publishable/channelEditorIdentity";
import { buildChannelComposerPromptParts } from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeKakaoChannelPublishableContent } from "@/lib/marketing/publishable/kakao_channel/composeKakaoChannelPublishableContent";
import { composeKakaoChannelPublishableDeterministic } from "@/lib/marketing/publishable/kakao_channel/deterministicKakao";
import {
  KAKAO_CHANNEL_PRODUCTION_SEMANTIC_NOTES,
  kakaoChannelWritingContract,
} from "@/lib/marketing/publishable/kakao_channel/writingContract";
import { PUBLISHABLE_CHANNEL_CONTENT_CONTRACT } from "@/lib/marketing/publishable/contracts";

function soul(): string {
  return buildChannelEditorSoulMarkdown("kakao_channel");
}

function contract(): string {
  return kakaoChannelWritingContract({ hasApprovedCanonicalAsset: true });
}

function baseComposer(overrides: Partial<PublishableComposerInput> = {}): PublishableComposerInput {
  return {
    candidateId: "cand_kakao_surgical",
    businessDateKst: "2026-09-18",
    topic: "베트남 북부 국경지대",
    audience: "여행 독자",
    commercialIntent: "informational",
    hookHint: null,
    keyMessage: "다낭·푸꾸옥과 다른 북부 기록",
    destinations: [],
    entities: [],
    usableFacts: [
      {
        statement: "북부 국경지대 Dao족과 nhà trình tường 공식 기록이 있다",
        confidence: "high",
        evidenceRefIds: [],
        usable: true,
      },
    ],
    avoidedStatements: [],
    unsupportedClaims: [],
    governanceDecision: "ALLOW",
    sourceRevision: "rev_test",
    evidenceRefIds: [],
    research: null,
    targetChannels: ["kakao_channel"],
    approvedCanonicalAsset: {
      contract: "canonical-marketing-asset-v1",
      assetId: "asset_dao_test",
      version: 1,
      status: "approved",
      titleKo: "다낭·푸꾸옥만 알았다면, 북부 국경지대의 베트남은 꽤 다르다",
      openingHookKo: "다낭의 해변과 호치민 도심은 익숙합니다.",
      bodyKo: "북부 국경지대 Dao족과 nhà trình tường 기록이 있습니다.",
      keyTakeawaysKo: ["공식 기록 범위의 지역 차이"],
      decisionGuidanceKo: "별개의 지역 이야기로 살펴볼 만합니다. 세부 체험은 추가 확인이 필요합니다.",
      optionalCtaIntentKo: "informational",
      supportedClaimBoundaryKo: "증거 범위 안에서만",
      limitationsKo: ["현장 체험 단정 불가"],
      forbiddenClaimsKo: [],
      editorialArchetype: "contrast",
      approvedVersion: 1,
    } as unknown as PublishableComposerInput["approvedCanonicalAsset"],
    editorialNarrativePlan: {
      contract: "editorial-narrative-plan-v1",
      narrativePromise: "establish contrast between familiar resort imagery and documented northern housing",
      audienceTakeaway:
        "distinguish northern regional characteristics from familiar resort destinations based on official records",
      beats: [
        { beatId: "b1", purpose: "hook", message: "familiar travel imagery" },
        { beatId: "b2", purpose: "payoff", message: "resolve on documented regional difference" },
      ],
      editorialArchetype: "contrast",
    } as PublishableComposerInput["editorialNarrativePlan"],
    compositionMode: "approved_asset_adapter",
    storyLock: {
      role: "STORY_LOCK_READ_ONLY",
      storyPointId: "sp1",
      storyPointHash: "h1",
      storyTitleKo: "북부 대비",
      storyQuestionKo: null,
      audienceProblemKo: null,
      decisionAtStakeKo: null,
      audienceTensionKo: null,
      readerPayoffKo: null,
      editorialArchetype: "contrast",
    },
    contentProposition: null,
    corePack: null,
    ...overrides,
  } as PublishableComposerInput;
}

describe("kakao channel surgical fix", () => {
  it("production profile remains channel-editor-kakao", () => {
    expect(resolveChannelEditorHermesProfile("kakao_channel")).toBe("channel-editor-kakao");
  });

  it("A. discovery/contrast + informational — no decision-aid requirement; CTA optional", () => {
    const ext = CHANNEL_EDITOR_CHANNEL_EXTENSIONS.kakao_channel;
    expect(ext).not.toMatch(/Purpose:\s*compact decision aid/i);
    expect(ext).toMatch(/compact, scannable Kakao Channel adaptation/i);
    expect(ext).toMatch(/KAKAO DISCOVERY OVERRIDE/i);
    expect(ext).toMatch(/supersedes any generic \"perspective expansion\"/i);
    expect(ext).toMatch(/do not invent a decision to make/i);
    expect(ext).toMatch(/Actionable next step is conditional/i);

    const c = contract();
    expect(c).toMatch(/CTA is optional/i);
    expect(c).toMatch(/CTA may be null/i);
    expect(c).toMatch(/observation, documented difference, evidence limitation, or unresolved curiosity/i);
    expect(c).not.toMatch(/^Shape guidance: Hook → key benefit\/context → 1–3 points → CTA/m);
    expect(c).not.toMatch(/action-oriented, NOT a blog/i);

    const det = composeKakaoChannelPublishableDeterministic(baseComposer());
    expect(det.body).not.toMatch(/체크만 해 두셔도|상담으로 이어가/);
  });

  it("A2. no invented comparison criterion / planning framework required", () => {
    const c = contract();
    expect(c).toMatch(/Do not manufacture:/i);
    expect(c).toMatch(/comparison criterion/i);
    expect(c).toMatch(/planning framework/i);
    expect(c).toMatch(/decisionGuidanceKo is factual\/editorial guidance/i);
    expect(c).toMatch(/do not escalate mild Canonical guidance/i);
  });

  it("B. decision/practical — grounded criteria/verify close still allowed", () => {
    const c = contract();
    expect(c).toMatch(/DECISION \/ PRACTICAL-LIKE/i);
    expect(c).toMatch(/grounded decision\/action close/i);
    expect(c).toMatch(/Decision\/practical content may still use grounded criteria/i);

    const det = composeKakaoChannelPublishableDeterministic(
      baseComposer({
        commercialIntent: "consideration",
        storyLock: {
          ...baseComposer().storyLock!,
          editorialArchetype: "practical",
        },
        approvedCanonicalAsset: {
          ...baseComposer().approvedCanonicalAsset!,
          editorialArchetype: "practical",
        },
      }),
    );
    expect(det.body).toMatch(/상품\/일정 확인|정보만 가져가셔도/);
  });

  it("C. commercial — supported clear action CTA preserved; no fake link/price/urgency", () => {
    const c = contract();
    expect(c).toMatch(/commercialIntent=commercial/i);
    expect(c).toMatch(/Do not invent links, urgency, price, availability, or offers/i);
    expect(c).toMatch(/놓치지 마세요/);

    const det = composeKakaoChannelPublishableDeterministic(
      baseComposer({ commercialIntent: "commercial" }),
    );
    expect(det.body).toMatch(/상담/);
    expect(det.body).not.toMatch(/놓치지 마세요|지금 바로|마감 임박/);
    expect(det.body).not.toMatch(/https?:\/\//);
  });

  it("D. geography — unsupported bucket not invented; Canonical-supported region allowed", () => {
    const c = contract();
    expect(c).toMatch(/## Evidence-safe compression/);
    expect(c).toMatch(/Do not introduce a new geographic category/i);
    expect(c).toMatch(/If Canonical explicitly supports such a category, it remains allowed/i);
    expect(c).toMatch(/This is not a ban on regional or decision language/i);
    // no forbidden-word / directional blacklist section (allow "No phrase blacklist" wording)
    expect(c).toMatch(/No phrase blacklist/i);
    expect(c).not.toMatch(/금지:\s*남부|banned words?:/i);
  });

  it("E. Natural Korean — concrete direct sentence valid; no forced abstract lesson", () => {
    const c = contract();
    expect(c).toMatch(/## Natural Korean/);
    expect(c).toMatch(/Prefer concrete nouns and verbs before abstract editorial interpretation/i);
    expect(c).toMatch(/Avoid long nominalized constructions/i);
    expect(c).toMatch(/Do not add a significance\/lesson sentence/i);
    expect(c).toMatch(/No phrase blacklist/i);
    expect(c).not.toMatch(/~하는 것은.*필수|must use.*하는 것은/i);
  });

  it("F. Narrative boundary — clean Narrative does not require new transformation payoff", () => {
    const c = contract();
    expect(c).toMatch(/## Narrative authority boundary/);
    expect(c).toMatch(/semantic sources, not wording templates/i);
    expect(c).toMatch(/Do not invent new reader-transformation outcomes/i);

    const parts = buildChannelComposerPromptParts({
      channel: "kakao_channel",
      writingContract: contract(),
      composerInput: baseComposer(),
    });
    expect(parts.text).toMatch(/editorialNarrativePlan/);
    expect(parts.text).toMatch(/semantic sources, not wording templates/i);
    expect(parts.text).not.toMatch(/concise Kakao decision aid \/ action/i);
    expect(parts.text).toMatch(/Archetype-aware/i);
  });

  it("G. existing limits/safety/schema unchanged", () => {
    expect(CHANNEL_EDITOR_COMMON_IDENTITY).toMatch(
      /APPROVED_CANONICAL_MARKETING_ASSET is the sole factual/,
    );
    expect(CHANNEL_EDITOR_COMMON_IDENTITY).toMatch(/editorialNarrativePlan is provided/);
    expect(soul()).toMatch(/Follow the caller user prompt/);
    expect(PUBLISHABLE_CHANNEL_CONTENT_CONTRACT).toBe("publishable-channel-content-v1");

    const debt = MARKETING_AGENT_CONTRACT_DEBT.find((d) => d.id === "legacy-channel-editors");
    expect(debt?.reason).toMatch(/channel-editor-kakao/);
    expect(debt?.reason).toMatch(/informational discovery may omit CTA/i);

    for (const note of KAKAO_CHANNEL_PRODUCTION_SEMANTIC_NOTES) {
      expect(note.length).toBeGreaterThan(20);
    }
    expect(KAKAO_CHANNEL_PRODUCTION_SEMANTIC_NOTES.join("\n")).toMatch(/channel-editor-kakao/);
  });

  it("compose inject no longer unconditionally forces decision-aid", async () => {
    const parts = buildChannelComposerPromptParts({
      channel: "kakao_channel",
      writingContract: [
        contract(),
        "Channel: compact scannable Kakao adaptation. Archetype-aware — decision aid/action only when grounded; discovery/contrast may omit CTA. No invented urgency/price/links.",
      ].join("\n"),
      composerInput: baseComposer(),
    });
    expect(parts.text).not.toMatch(/concise Kakao decision aid \/ action/i);
    expect(parts.channel).toBe("kakao_channel");

    const content = await composeKakaoChannelPublishableContent({
      composerInput: baseComposer(),
      allowDeterministicFallback: true,
    });
    expect(content.contract).toBe(PUBLISHABLE_CHANNEL_CONTENT_CONTRACT);
    expect(content.channel).toBe("kakao_channel");
    expect(content.body.length).toBeLessThanOrEqual(900);
  });

  it("non-Dao: Canonical-supported regional label remains allowed in contract", () => {
    // Behavior rule — not a Dao 남부 ban
    expect(contract()).toMatch(/If Canonical explicitly supports such a category, it remains allowed/);
    const southern = composeKakaoChannelPublishableDeterministic(
      baseComposer({
        keyMessage: "베트남 남부 메콩 델타의 수로 마을",
        usableFacts: [
          {
            statement: "Canonical supports 베트남 남부 as the documented region",
            confidence: "high",
            evidenceRefIds: [],
            usable: true,
          },
        ],
        approvedCanonicalAsset: {
          ...baseComposer().approvedCanonicalAsset!,
          titleKo: "베트남 남부 메콩에서 보는 수로 생활",
          bodyKo: "베트남 남부 메콩 델타의 수로와 시장이 공식 자료에 소개됩니다.",
          editorialArchetype: "discovery",
        },
        storyLock: {
          ...baseComposer().storyLock!,
          editorialArchetype: "discovery",
        },
      }),
    );
    // deterministic uses keyMessage/facts — must not strip supported 남부
    expect(southern.body).toMatch(/남부/);
  });
});
