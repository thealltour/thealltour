/**
 * Phase 5A — Promotional signal guard
 */
import { describe, expect, it } from "vitest";

import {
  evaluatePromotionalSignalGuard,
  textIsCertificationOrPromoClaimHeavy,
} from "@/lib/marketing/agendaQualityV2/promotionalGuard";
import { detectGenericAgendaRisk } from "@/lib/marketing/agendaQualityV2/genericRisk";
import {
  assembleMarketingAgendaCandidateV2,
  transformMarketingAgendaFromLlmOutput,
} from "@/lib/marketing/agendaQualityV2/transformer/transform";
import { scoreMarketingAgendaV2 } from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import { assessAgendaReuse } from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";
import { AGENDA_V2_SCORE_CALIBRATED } from "@/lib/marketing/agendaQualityV2/scoring/calibrationConfig";
import {
  AGENDA_QUALITY_V2_PROMPT_VERSION,
  AGENDA_QUALITY_V2_TRANSFORM_REVISION,
} from "@/lib/marketing/agendaQualityV2/shadow/config";
import {
  AGENDA_QUALITY_V2_VALIDATION_ID,
  fingerprintAgendaQualityV2ValidationConfig,
  snapshotAgendaQualityV2ValidationSensitiveConfig,
} from "@/lib/marketing/agendaQualityV2/shadow/validationManifest";
import { goodDiscoveryLlm, goodLlmEditorial } from "@/lib/marketing/agendaQualityV2/__tests__/testHelpers";
import { MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT } from "@/lib/marketing/agendaQualityV2/transformer/prompt";

const NOW = "2026-09-18T02:00:00.000Z";

function scoreOf(candidate: ReturnType<typeof assembleMarketingAgendaCandidateV2>, title: string) {
  return scoreMarketingAgendaV2({
    candidate,
    reuse: assessAgendaReuse({
      candidate: {
        agendaId: candidate.agendaId,
        sourceFingerprint: candidate.provenance.sourceFingerprint,
        topicFingerprint: candidate.provenance.topicFingerprint,
        decisionAxisFingerprint: candidate.provenance.decisionAxisFingerprint,
        storySeedFingerprint: null,
        signalSummaryKo: candidate.signalContext.signalSummaryKo,
        whyNowKo: candidate.editorial.whyNowKo,
      },
      history: [],
      nowIso: NOW,
    }),
    nowIso: NOW,
    originalTitle: title,
  });
}

describe("AGENDA_QUALITY_V2 Phase5A promotional guard", () => {
  it("certification alone cannot satisfy hiddenDetail", () => {
    expect(
      textIsCertificationOrPromoClaimHeavy(
        "UN Tourism이 선정한 Best Tourism Villages 공식 인증 마을",
      ),
    ).toBe(true);

    const promo = evaluatePromotionalSignalGuard({
      originalTitle: 'the sustainable trail: discover "best tourism villages" in vietnam',
      originalSummary: "UN Tourism Best Tourism Villages list",
      sourceTypes: ["tourism_board"],
      marketingStorySeedKo: "UN Tourism이 선정한 베트남 숨은 마을을 소개한다",
      whyInterestingKo: "공식 추천 마을이라 특별하다",
      curiosityHookKo: "최우수 관광마을은 매력적이다",
      hiddenDetailKo: "UN Tourism 공식 선정·인증을 받은 최우수 관광마을",
      familiarReferenceKo: "다낭·나트랑",
      alternativeAppealKo: "대안 여행지",
      explorationPayoffKo: "더 알아보고 싶다",
    });
    expect(promo.promotionalSource).toBe(true);
    expect(promo.certificationOnlyHiddenDetail).toBe(true);
    expect(promo.promotionalSpecificityPass).toBe(false);
    expect(promo.findings.some((f) => f.code === "certification_as_hidden_detail")).toBe(true);
  });

  it("generic tourism-board copy cannot become STRONG through curiosity wording", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: 'the sustainable trail: discover "best tourism villages" in vietnam',
        originalSummary: "UN Tourism best villages promotional list",
        sourceTypes: ["tourism_board"],
      },
      llm: goodDiscoveryLlm({
        editorialArchetype: "ALTERNATIVE",
        marketingStorySeedKo: "UN이 숨겨둔 베트남의 진짜 숨은 마을",
        whyInterestingKo: "공식 인증 마을이라 새롭고 특별하다",
        curiosityHookKo: "숨은 명소로 꼭 가봐야 할 마을",
        hiddenDetailKo: "UN Tourism 선정 최우수 관광마을 인증",
        whyKoreanTravelerCaresKo: "한국 여행자에게도 흥미로운 공식 추천",
        familiarReferenceKo: "다낭·나트랑 리조트",
        alternativeAppealKo: "대안 여행지",
        explorationPayoffKo: "더 찾아보고 싶다",
        contentImaginabilityKo: "헤드라인과 소개 섹션 구성",
        travelerProblemKo: "",
        decisionAtStakeKo: "",
        audienceTensionKo: "",
      }),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("invalid");
    expect(result.transformFailureReason).toMatch(
      /promotional_specificity_fail|certification_as_hidden_detail|sensational_unsupported/,
    );
  });

  it("unsupported sensational framing is flagged", () => {
    const findings = detectGenericAgendaRisk({
      originalTitle: "Best Tourism Villages",
      originalSummary: "list",
      sourceTypes: ["tourism_board"],
      travelerProblemKo: "",
      decisionAtStakeKo: "",
      audienceTensionKo: "",
      readerPayoffKo: "더 알아보고 싶다",
      marketingStorySeedKo: "UN이 숨겨둔 베트남의 진짜 숨은 마을",
      editorialArchetype: "DISCOVERY",
      whyInterestingKo: "아무도 모르는 비밀의 마을",
      curiosityHookKo: "한국인은 아직 모르는 곳",
      hiddenDetailKo: "공식 선정 마을",
      contentImaginabilityKo: "헤드라인 구성이 가능하다",
    });
    expect(findings.some((f) => f.code === "sensational_unsupported_claim")).toBe(true);
  });

  it("concrete tourism-board detail may pass", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "Vietnam tourism board feature on Lang Son villages",
        originalSummary: "northern border minority rammed-earth houses",
        sourceTypes: ["tourism_board"],
      },
      llm: goodDiscoveryLlm({
        editorialArchetype: "CULTURAL_CURIOSITY",
        marketingStorySeedKo:
          "다낭·나트랑 밖의 베트남 — 랑선 국경 산악에서 만나는 흙담집과 소수민족 생활문화",
        whyInterestingKo:
          "해안 리조트 이미지와 다른 북부 국경 소수민족의 토축 가옥·생활 장면을 볼 수 있다",
        curiosityHookKo: "이런 베트남도 있었네 — 랑선 흙담집",
        hiddenDetailKo:
          "랑선 북부 국경 지대 소수민족이 유지하는 흙담(토축) 가옥과 생활문화라는 구체 포인트",
        contentImaginabilityKo: "헤드라인·대비 훅·건축/생활 2~3섹션·사진 포인트",
      }),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    const score = scoreOf(result.candidate!, "Vietnam tourism board feature on Lang Son villages");
    expect(score.promotional.promotionalSource).toBe(true);
    expect(score.promotional.promotionalSpecificityPass).toBe(true);
    expect(["STRONG", "PUBLISHABLE"]).toContain(score.qualityTier);
  });

  it("Lang Son remains eligible", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "a journey into living heritage and ethnic traditions",
        originalSummary: "Lang Son minority traditions and earth-wall houses",
        sourceTypes: ["agenda_candidate"],
      },
      llm: goodDiscoveryLlm(),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    const score = scoreOf(
      result.candidate!,
      "a journey into living heritage and ethnic traditions",
    );
    expect(["STRONG", "PUBLISHABLE"]).toContain(score.qualityTier);
    expect(score.promotional.promotionalGenericRisk).toBe(false);
  });

  it("HCMC remains eligible with concrete cultural curiosity", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "vibrant metropolis: ho chi minh city’s modern pulse & nightlife culture",
        originalSummary: "day and night city rhythm, motorbikes, alley food",
        sourceTypes: ["agenda_candidate"],
      },
      llm: goodDiscoveryLlm({
        editorialArchetype: "CULTURAL_CURIOSITY",
        marketingStorySeedKo:
          "휴양지 베트남만 알았다면 놓치기 쉬운, 낮과 밤이 다른 호치민의 오토바이·골목 라이프스타일",
        whyInterestingKo:
          "리조트 프레임 밖의 낮 오토바이 행렬과 밤 골목 거리음식·나이트라이프 리듬",
        curiosityHookKo: "낮과 밤이 완전히 다른 사이공의 에너지",
        hiddenDetailKo:
          "정형 관광지 밖 오토바이 이동경로·골목 음식·호치민 밤문화라는 도시 레이어",
        whyKoreanTravelerCaresKo: "한국 여행자가 휴양지로만 소비하던 베트남의 도시형 재미",
        familiarReferenceKo: "다낭·나트랑 휴양 이미지",
        contentImaginabilityKo: "헤드라인·낮밤 대비 섹션·골목 스팟 시각 구성",
      }),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    const score = scoreOf(result.candidate!, result.candidate!.signalContext.signalSummaryKo);
    expect(["STRONG", "PUBLISHABLE"]).toContain(score.qualityTier);
  });

  it("thresholds unchanged", () => {
    expect(AGENDA_V2_SCORE_CALIBRATED.strongMin).toBe(0.72);
    expect(AGENDA_V2_SCORE_CALIBRATED.publishableMin).toBe(0.52);
    expect(AGENDA_V2_SCORE_CALIBRATED.marketingFloorForPublishable).toBe(0.46);
  });

  it("prompt + version bumped for 5A", () => {
    expect(MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT).toMatch(/PROMOTIONAL \/ TOURISM-BOARD/);
    expect(MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT).toMatch(/ANTI-SENSATIONAL/);
    expect(AGENDA_QUALITY_V2_PROMPT_VERSION).toBe("agenda-transform-prompt-v2.1");
    expect(AGENDA_QUALITY_V2_TRANSFORM_REVISION).toBe("agenda-transform-v2.1");
    expect(AGENDA_QUALITY_V2_VALIDATION_ID).toBe("aqv2-editorial-v2a-live-20260918-20260922");
    const fp = fingerprintAgendaQualityV2ValidationConfig(
      snapshotAgendaQualityV2ValidationSensitiveConfig({}),
    );
    expect(fp).toMatch(/^aqv2cfg_/);
    expect(fp).not.toBe("aqv2cfg_6217ec73cb333bccf848fda7");
  });

  it("practical DECISION agenda still works (Bangladesh-like)", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "bangladesh",
        originalSummary: "Official travel advice page updated with entry card notes",
        sourceTypes: ["fcdo"],
      },
      llm: goodLlmEditorial({
        editorialArchetype: "PRACTICAL",
        travelerProblemKo:
          "전자 입출국 카드·비자 안내 업데이트 앞에서 기존 입국 준비를 그대로 믿어도 되는지",
        decisionAtStakeKo: "출발 전 비자/입출국 카드 절차를 재확인할지",
        audienceTensionKo: "기존 절차 유지 vs 새 요건 재확인",
        readerPayoffKo: "입국 준비에서 직접 확인할 포인트를 판별한다",
        marketingStorySeedKo:
          "방글라데시 입국 안내가 업데이트됐다면, 전자 입출국 카드·비자 무엇을 다시 봐야 할까?",
        whyInterestingKo: "입국 실무 절차 변경 가능성을 미리 점검할 수 있다",
        curiosityHookKo: "출국 전 확인 포인트가 달라졌을 수 있다",
        hiddenDetailKo: "전자 입출국 카드·비자 신청 안내 업데이트라는 실무 포인트",
        whyKoreanTravelerCaresKo: "한국 출발 여행·출장자가 출발 전 체크해야 할 행정 이슈",
        explorationPayoffKo: "공식 페이지에서 확인할 항목을 더 좁힐 수 있다",
        contentImaginabilityKo: "체크리스트형 실무 가이드 구성",
        researchQuestionsKo: [
          "전자 입출국 카드가 현재 공식 요건인가?",
          "비자 신청 안내 변경 시점은?",
        ],
      }),
      nowIso: NOW,
    });
    // May reframe sensitive claims; should not be promotional-laundering reject
    if (result.transformStatus === "valid") {
      const score = scoreOf(result.candidate!, "bangladesh");
      expect(score.promotional.promotionalSource).toBe(false);
      expect(score.qualityTier).not.toBeUndefined();
    } else {
      expect(result.transformFailureReason).not.toMatch(/promotional_specificity_fail/);
    }
  });
});
