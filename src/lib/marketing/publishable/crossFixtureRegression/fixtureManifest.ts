/**
 * Production-backed cross-fixture manifest + future unpopulated slots.
 * Fixtures are behavior policies over approved Canonical packages — not banned-word lists.
 */

import type {
  CrossFixtureManifestEntry,
  ProductionBackedFixture,
  UnpopulatedFixtureSlot,
} from "@/lib/marketing/publishable/crossFixtureRegression/types";

const ALL_CHANNELS = [
  "narrative",
  "threads",
  "instagramCarousel",
  "instagramCardCopy",
  "instagramCaption",
  "blogStructure",
  "blogCopy",
  "band",
  "kakao",
  "shortform",
] as const;

export const DAO_FIXTURE: ProductionBackedFixture = {
  fixtureId: "dao-northern-border-contrast",
  backing: "production_backed",
  packageRoot:
    "/mnt/HDD2TB/marketing-assets/2026/09/18/cmc_daily_marketing_production_2026_09_18_e0",
  assetId: "cma_d9801d9571573948ef7d725c",
  titleKo: "다낭·푸꾸옥만 알았다면, 북부 국경지대의 베트남은 꽤 다르다",
  canonicalStatusRequired: "approved",
  editorialArchetype: "contrast",
  commercialIntent: "informational",
  role: "discovery_contrast",
  supportedFacts: [
    "북부 국경지대 Dao족과 nhà trình tường 공식 기록",
    "다낭·푸꾸옥·호치민 익숙 이미지와의 대비",
    "증거 범위 안의 지역적 차이",
  ],
  limitations: [
    "현장 체험·구체 마을·동선 단정 불가",
    "claim_narrowed_to_supported_boundary",
  ],
  expectedBehaviors: {
    doesNotInventReaderTransformation: true,
    informationalCtaOptional: true,
    geographicScopePreserved: true,
    evidenceLimitationsSurviveCompression: true,
    strongSupportedHookPossible: true,
    naturalKoreanNotTranslationese: true,
    plannerLanguageDoesNotLeakToSurface: true,
  },
  prohibitedRegressions: {
    forcedDecisionCriterionOnDiscovery: true,
    forcedPerspectiveAwarenessLesson: true,
    unsupportedOnSiteExperience: true,
    unsupportedGeographicRegrouping: true,
  },
  channelsToTest: [...ALL_CHANNELS],
  baselineNotes: {
    narrative: "PASS",
    threads: "PASS",
    instagramCarousel: "PASS",
    instagramCardCopy: "PASS",
    instagramCaption: "PASS_WITH_MINOR",
    blogStructure: "PASS",
    blogCopy: "PASS",
    band: "PASS_WITH_MINOR",
    kakao: "PASS_WITH_MINOR",
    shortform: "PASS_WITH_MINOR",
  },
  diagnosticMarkers: ["시선", "관점", "기준", "남부 휴양지", "폭넓은 시각", "멋진 기준"],
};

export const PHU_QUOC_DECISION_FIXTURE: ProductionBackedFixture = {
  fixtureId: "phuquoc-hotel-booking-vs-wait",
  backing: "production_backed",
  packageRoot:
    "/mnt/HDD2TB/marketing-assets/2026/09/16/cmc_daily_marketing_production_2026_09_16_3c",
  assetId: "cma_cc7b0404c74dc59a5eced776",
  titleKo: "호텔 늘어나는 푸꾸옥, 지금 잡을까 더 기다릴까",
  canonicalStatusRequired: "approved",
  editorialArchetype: null,
  commercialIntent: "informational",
  role: "decision_comparison",
  supportedFacts: [
    "객실 공급·리조트 경쟁 증가 관찰 신호",
    "미래 가격/프로모션 예측 불가",
    "일정 확정 vs 여유에 따른 예약/대기 비교",
    "취소·변경 조건 확인 중요",
  ],
  limitations: ["social_or_community_evidence_only", "claim_narrowed_to_supported_boundary"],
  expectedBehaviors: {
    preservesSupportedDecisionCriteria: true,
    decisionTopicNotMistakenForCta: true,
    unauthorizedImperativeCtaStillBlocked: true,
    evidenceLimitationsSurviveCompression: true,
    naturalKoreanNotTranslationese: true,
    informationalCtaOptional: true,
  },
  prohibitedRegressions: {
    decisionUtilitySuppressedAsCta: true,
  },
  channelsToTest: [...ALL_CHANNELS],
  baselineNotes: {
    narrative: "PASS",
    threads: "PASS",
    instagramCarousel: "PASS",
    instagramCardCopy: "PASS",
    instagramCaption: "PASS",
    blogStructure: "PASS",
    blogCopy: "PASS",
    band: "PASS",
    kakao: "PASS_WITH_MINOR",
    shortform: "PASS",
  },
  diagnosticMarkers: ["지금 예약", "기준", "비교", "취소"],
};

export const FUTURE_FIXTURE_SLOTS: UnpopulatedFixtureSlot[] = [
  {
    fixtureId: "slot-practical-informational",
    backing: "unpopulated_slot",
    role: "practical_informational",
    reason: "No approved Canonical package with practical/check-point core is registered yet.",
    requiredForCoverage: [
      "limitation/check structure survival",
      "practical takeaway without abstract lesson",
    ],
  },
  {
    fixtureId: "slot-commercial-conversion",
    backing: "unpopulated_slot",
    role: "commercial_conversion",
    reason: "No approved Canonical with commercialIntent≠informational in current inventory.",
    requiredForCoverage: [
      "supported action CTA survival",
      "no conversion suppression",
      "no fake urgency/price",
    ],
  },
  {
    fixtureId: "slot-supported-region-geo",
    backing: "unpopulated_slot",
    role: "supported_region_geo",
    reason:
      "Draft Con Dao package mentions 남부 but is not approved — cannot register as production-backed.",
    requiredForCoverage: [
      "Canonical-supported regional label allowed",
      "unsupported geographic regrouping blocked",
    ],
  },
  {
    fixtureId: "slot-strong-dramatic-hook",
    backing: "unpopulated_slot",
    role: "strong_dramatic_hook",
    reason: "Optional; needs Canonical that genuinely supports dramatic framing.",
    requiredForCoverage: ["strong supported hook remains possible without invented hype"],
  },
];

export const CROSS_FIXTURE_MANIFEST: readonly CrossFixtureManifestEntry[] = [
  DAO_FIXTURE,
  PHU_QUOC_DECISION_FIXTURE,
  ...FUTURE_FIXTURE_SLOTS,
];

export function listProductionBackedFixtures(): ProductionBackedFixture[] {
  return CROSS_FIXTURE_MANIFEST.filter(
    (e): e is ProductionBackedFixture => e.backing === "production_backed",
  );
}

export function listUnpopulatedSlots(): UnpopulatedFixtureSlot[] {
  return CROSS_FIXTURE_MANIFEST.filter(
    (e): e is UnpopulatedFixtureSlot => e.backing === "unpopulated_slot",
  );
}

export function getFixtureById(fixtureId: string): CrossFixtureManifestEntry | undefined {
  return CROSS_FIXTURE_MANIFEST.find((e) => e.fixtureId === fixtureId);
}
