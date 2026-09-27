/**
 * Shortform (channel-editor-shortform) surgical fix regressions A–H + non-Dao counters.
 */

import { describe, expect, it } from "vitest";

import { MARKETING_AGENT_CONTRACT_DEBT } from "@/lib/marketing/agentContracts/debt";
import {
  CHANNEL_EDITOR_CHANNEL_EXTENSIONS,
  CHANNEL_EDITOR_COMMON_IDENTITY,
  buildChannelEditorSoulMarkdown,
  resolveChannelEditorHermesProfile,
} from "@/lib/marketing/publishable/channelEditorIdentity";
import {
  buildChannelComposerPromptParts,
  checkShortformHookPayoff,
} from "@/lib/marketing/publishable/composerRuntime";
import { PUBLISHABLE_CHANNEL_CONTENT_CONTRACT } from "@/lib/marketing/publishable/contracts";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeShortformNarration } from "@/lib/marketing/publishable/shortform/composeShortformNarration";
import { composeShortformNarrationDeterministic } from "@/lib/marketing/publishable/shortform/deterministicShortform";
import {
  SHORTFORM_NARRATION_WRITING_CONTRACT,
  SHORTFORM_PRODUCTION_SEMANTIC_NOTES,
} from "@/lib/marketing/publishable/shortform/writingContract";

function soul(): string {
  return buildChannelEditorSoulMarkdown("shortform");
}

function contract(): string {
  return SHORTFORM_NARRATION_WRITING_CONTRACT;
}

function baseComposer(overrides: Partial<PublishableComposerInput> = {}): PublishableComposerInput {
  return {
    candidateId: "cand_sf_surgical",
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
    targetChannels: ["shortform"],
    approvedCanonicalAsset: {
      contract: "canonical-marketing-asset-v1",
      assetId: "asset_dao_sf",
      version: 1,
      status: "approved",
      titleKo: "다낭·푸꾸옥만 알았다면, 북부 국경지대의 베트남은 꽤 다르다",
      openingHookKo: "다낭의 해변과 호치민 도심은 익숙합니다.",
      bodyKo: "북부 국경지대 Dao족과 nhà trình tường 기록이 있습니다.",
      keyTakeawaysKo: ["공식 기록 범위의 지역 차이"],
      decisionGuidanceKo: "별개의 지역 이야기로 살펴볼 만합니다.",
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
        "distinguish northern regional characteristics from familiar destinations based on official records",
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

describe("shortform narration surgical fix", () => {
  it("production profile remains channel-editor-shortform", () => {
    expect(resolveChannelEditorHermesProfile("shortform")).toBe("channel-editor-shortform");
  });

  it("A. discovery/contrast — concrete close valid; no perspective/criterion lesson required", () => {
    const ext = CHANNEL_EDITOR_CHANNEL_EXTENSIONS.shortform;
    expect(ext).toMatch(/SHORTFORM DISCOVERY OVERRIDE/i);
    expect(ext).toMatch(/payoff = strongest supported concrete contrast/i);
    expect(ext).not.toMatch(/concise payoff\./);

    const c = contract();
    expect(c).toMatch(/natural close/i);
    expect(c).not.toMatch(/hook → 유용한 맥락 → 1–3개 포인트 → 짧은 takeaway\/CTA/);
    expect(c).toMatch(/does not need to become: perspective shift, insight, criterion/i);
    expect(c).toMatch(/Informational discovery may omit CTA/i);

    const det = composeShortformNarrationDeterministic(baseComposer());
    expect(det.body).not.toMatch(/비교해 보세요|폭넓은 시각|멋진 기준/);
    expect(det.segments.some((s) => s.purpose === "close")).toBe(true);
  });

  it("B. decision/practical — grounded criterion/next step remains allowed", () => {
    const c = contract();
    expect(c).toMatch(/DECISION \/ PRACTICAL-LIKE/i);
    expect(c).toMatch(/Grounded takeaway or next step is allowed/i);

    const det = composeShortformNarrationDeterministic(
      baseComposer({
        commercialIntent: "informational",
        storyLock: { ...baseComposer().storyLock!, editorialArchetype: "practical" },
        approvedCanonicalAsset: {
          ...baseComposer().approvedCanonicalAsset!,
          editorialArchetype: "practical",
        },
      }),
    );
    expect(det.body).toMatch(/참고만 해 두시면|비교해 보세요/);
  });

  it("C. commercial — supported CTA remains; no fake urgency/link/price", () => {
    const c = contract();
    expect(c).toMatch(/COMMERCIAL/i);
    expect(c).toMatch(/Do not invent links, urgency, price/i);
    expect(c).toMatch(/판매 CTA 금지/);

    const det = composeShortformNarrationDeterministic(
      baseComposer({ commercialIntent: "commercial" }),
    );
    expect(det.body).toMatch(/비교해 보세요/);
    expect(det.body).not.toMatch(/놓치지 마세요|지금 바로|마감 임박|https?:\/\//);
  });

  it("D. dramatic Canonical — genuinely dramatic supported hook remains allowed", () => {
    const c = contract();
    expect(c).toMatch(/may be sharp, surprising, and curiosity-driven/i);
    expect(c).toMatch(/must sharpen an approved contrast rather than invent/i);
    expect(extAllowsStrongHook());
  });

  it("E. geography — unsupported bucket not invented; supported region allowed", () => {
    const c = contract();
    expect(c).toMatch(/## Evidence-safe compression/);
    expect(c).toMatch(/broader geographic category/i);
    expect(c).toMatch(/If Canonical explicitly supports the category\/claim, it remains allowed/i);
    expect(c).toMatch(/No phrase blacklist/i);
    expect(c).not.toMatch(/금지:\s*남부/);

    const southern = composeShortformNarrationDeterministic(
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
          bodyKo: "베트남 남부 메콩 델타가 공식 자료에 소개됩니다.",
          editorialArchetype: "discovery",
        },
        storyLock: { ...baseComposer().storyLock!, editorialArchetype: "discovery" },
      }),
    );
    expect(southern.body).toMatch(/남부/);
  });

  it("F. spoken Korean — short clauses valid; no forced editorial takeaway", () => {
    const c = contract();
    expect(c).toMatch(/## Spoken Korean/);
    expect(c).toMatch(/Write for the ear, not for a report/i);
    expect(c).toMatch(/Prefer one idea per sentence/i);
    expect(c).toMatch(/Do not add a significance sentence/i);
    expect(c).toMatch(/Do NOT confuse spoken rhythm with surface phrases/i);
  });

  it("G. Narrative boundary — clean semantic payoff need not become abstract surface", () => {
    const c = contract();
    expect(c).toMatch(/## Narrative lexical boundary/);
    expect(c).toMatch(/not wording templates/i);
    expect(c).toMatch(/Do not convert a clean semantic payoff into a new abstract reader outcome/i);

    const parts = buildChannelComposerPromptParts({
      channel: "shortform",
      writingContract: [
        contract(),
        "Structure: archetype-aware — discovery/contrast ends on concrete contrast/difference/limitation; decision/practical may use grounded close; commercial may use supported CTA. Do not force abstract payoff, takeaway, or close/action for informational discovery.",
      ].join("\n"),
      composerInput: baseComposer(),
    });
    expect(parts.text).not.toMatch(/hook → payoff → concrete useful information → close\/action/i);
    expect(parts.text).toMatch(/archetype-aware/i);
    expect(parts.text).toMatch(/Do not force abstract payoff/i);
  });

  it("H. existing hook structural payoff validator remains intact", () => {
    expect(typeof checkShortformHookPayoff).toBe("function");
    const unpaid = checkShortformHookPayoff({
      segments: [
        { purpose: "hook", narrationText: "이 한 가지만 기억하세요." },
        { purpose: "close", narrationText: "끝." },
      ],
      body: "이 한 가지만 기억하세요.\n\n끝.",
    });
    expect(unpaid.ok).toBe(false);

    const ok = checkShortformHookPayoff({
      segments: [
        { purpose: "hook", narrationText: "다낭과 다른 북부 기록이 있어요." },
        {
          purpose: "body",
          narrationText: "공식 기록에 Dao족과 nhà trình tường이 나옵니다.",
        },
        { purpose: "close", narrationText: "현장 체험은 아직 단정하기 이릅니다." },
      ],
      body: "다낭과 다른 북부 기록이 있어요.\n\n공식 기록에 Dao족과 nhà trình tường이 나옵니다.\n\n현장 체험은 아직 단정하기 이릅니다.",
    });
    expect(ok.ok).toBe(true);

    expect(CHANNEL_EDITOR_COMMON_IDENTITY).toMatch(/APPROVED_CANONICAL_MARKETING_ASSET/);
    expect(soul()).toMatch(/SHORTFORM DISCOVERY OVERRIDE/);
    expect(PUBLISHABLE_CHANNEL_CONTENT_CONTRACT).toBe("publishable-channel-content-v1");

    const debt = MARKETING_AGENT_CONTRACT_DEBT.find((d) => d.id === "legacy-channel-editors");
    expect(debt?.reason).toMatch(/channel-editor-shortform/);
    expect(debt?.reason).toMatch(/discovery concrete observation close valid/i);
    expect(SHORTFORM_PRODUCTION_SEMANTIC_NOTES.join("\n")).toMatch(/channel-editor-shortform/);
  });

  it("compose path keeps schema and allows discovery without soft CTA", async () => {
    const content = await composeShortformNarration({
      composerInput: baseComposer(),
      allowDeterministicFallback: true,
    });
    expect(content.contract).toBe(PUBLISHABLE_CHANNEL_CONTENT_CONTRACT);
    expect(content.channel).toBe("shortform");
    expect(content.narrationSegments?.length).toBeGreaterThanOrEqual(2);
    expect(content.narrationSegments!.length).toBeLessThanOrEqual(6);
  });
});

function extAllowsStrongHook(): boolean {
  return /immediate but truthful hook/i.test(CHANNEL_EDITOR_CHANNEL_EXTENSIONS.shortform);
}
