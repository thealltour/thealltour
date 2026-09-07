import type { TrendSignalPayloadV1 } from "../types";
import { TREND_SIGNAL_PROVIDER_META_AI, TREND_SIGNAL_SCHEMA_VERSION } from "../types";

const BASE_TS = {
  published_at: "2026-09-06T01:00:00.000Z",
  captured_at: "2026-09-06T02:00:00.000Z",
  observed_at: "2026-09-06T03:00:00.000Z",
  provider_run_at: "2026-09-06T03:05:00.000Z",
  window: {
    start: "2026-09-03T00:00:00.000Z",
    end: "2026-09-06T03:00:00.000Z",
  },
};

function basePayload(
  overrides: Partial<TrendSignalPayloadV1> &
    Pick<TrendSignalPayloadV1, "observation_id" | "topic" | "summary" | "trend_type" | "trend_signal_status">,
): TrendSignalPayloadV1 {
  return {
    schema_version: TREND_SIGNAL_SCHEMA_VERSION,
    provider: TREND_SIGNAL_PROVIDER_META_AI,
    provider_run_id: "run_fixture_001",
    ...BASE_TS,
    vertical_tags: ["family"],
    destinations: [],
    provider_cluster_hint: null,
    cluster_label: null,
    confidence: { score: 0.6, basis: ["fixture"] },
    popularity: { score: 0.4, basis: ["fixture"] },
    market_relevance: {
      origin_market: "KR",
      travel_direction: "outbound",
      score: 0.7,
      basis: { observed: ["korean_language"], inferred: ["short_haul"] },
    },
    marketing_observations: {
      hook_signals: [],
      format_signals: [],
      audience_pain_points: [],
      audience_questions: [],
      persona_estimates: [],
      content_angles: [],
    },
    factual_claims: [],
    provenance: [
      {
        level: "L1",
        platform: "instagram",
        url: "https://example.com/post/1",
        captured_at: BASE_TS.captured_at,
      },
    ],
    raw_context: null,
    ...overrides,
    observed_metrics: overrides.observed_metrics ?? {
      observation_count: overrides.trend_signal_status === "single_observation" ? 1 : 2,
      platform_count: overrides.trend_signal_status === "cross_platform_pattern" ? 2 : 1,
      platforms: ["instagram"],
    },
  };
}

/** Positive: 부산 출발 가족 크루즈 — repeated_pattern / activity_trend */
export const FIXTURE_BUSAN_FAMILY_CRUISE: TrendSignalPayloadV1 = basePayload({
  observation_id: "meta_obs_busan_cruise_001",
  topic: "부산 출발 가족 크루즈",
  summary: "짧은 항해 가족 크루즈에 대한 반복 관심 신호",
  trend_type: "activity_trend",
  trend_signal_status: "repeated_pattern",
  vertical_tags: ["family", "short-haul", "cruise"],
  destinations: ["부산", "일본"],
  provider_cluster_hint: "cluster_busan_cruise",
  cluster_label: "family_cruise_busan",
  observed_metrics: { observation_count: 3, platform_count: 1, platforms: ["instagram"] },
  marketing_observations: {
    hook_signals: ["아이와 함께 하루 항해", "부산에서 바로 출발"],
    format_signals: ["short_reel", "carousel"],
    audience_pain_points: ["장거리 항공 부담", "아이 일정 맞추기"],
    audience_questions: ["몇 살부터 탑승 가능?", "멀미 대비는?"],
    persona_estimates: ["초등 자녀 가족", "부산/경남 거주"],
    content_angles: ["짧은 가족 해상 휴가", "항공 대체 체험"],
  },
  confidence: { score: 0.82, basis: ["repeated_posts"] },
  popularity: { score: 0.75, basis: ["engagement_proxy"] },
  market_relevance: {
    origin_market: "KR",
    travel_direction: "outbound",
    score: 0.88,
    basis: { observed: ["korean_captions", "busan_departure"], inferred: ["short_haul_family"] },
  },
});

/** Positive: 부모님 첫 대만 여행 — single_observation / traveler_behavior_trend */
export const FIXTURE_PARENTS_FIRST_TAIWAN: TrendSignalPayloadV1 = basePayload({
  observation_id: "meta_obs_taiwan_parents_001",
  topic: "부모님 첫 대만 여행",
  summary: "시니어 동반 첫 대만 여행 행동 신호",
  trend_type: "traveler_behavior_trend",
  trend_signal_status: "single_observation",
  vertical_tags: ["family", "senior"],
  destinations: ["대만", "타이베이"],
  observed_metrics: { observation_count: 1, platform_count: 1, platforms: ["youtube"] },
  marketing_observations: {
    hook_signals: ["부모님 모시고 첫 해외"],
    format_signals: ["vlog"],
    audience_pain_points: ["보행 동선", "식사 취향"],
    audience_questions: ["휠체어 가능한가?"],
    persona_estimates: ["성인 자녀 + 부모"],
    content_angles: ["효도 여행 입문 코스"],
  },
  confidence: { score: 0.55, basis: ["single_post"] },
  popularity: { score: 0.35, basis: ["views"] },
  market_relevance: {
    origin_market: "KR",
    travel_direction: "outbound",
    score: 0.72,
    basis: { observed: ["korean_narration"], inferred: ["family_outbound"] },
  },
});

/** Positive: 베트남 가족 단체 — weak destination_interest */
export const FIXTURE_VIETNAM_FAMILY_GROUP: TrendSignalPayloadV1 = basePayload({
  observation_id: "meta_obs_vietnam_family_001",
  topic: "베트남 가족 단체 여행",
  summary: "약한 목적지 관심 신호",
  trend_type: "destination_interest",
  trend_signal_status: "single_observation",
  vertical_tags: ["family", "group"],
  destinations: ["베트남", "다낭"],
  observed_metrics: { observation_count: 1, platform_count: 1, platforms: ["facebook"] },
  marketing_observations: {
    hook_signals: [],
    format_signals: [],
    audience_pain_points: ["단체 일정 조율"],
    audience_questions: [],
    persona_estimates: ["대가족"],
    content_angles: [],
  },
  confidence: { score: 0.35, basis: ["weak"] },
  popularity: { score: 0.2, basis: ["low"] },
  market_relevance: {
    origin_market: "KR",
    travel_direction: "outbound",
    score: 0.5,
    basis: { observed: ["kr_origin"], inferred: [] },
  },
});

export const POSITIVE_TREND_FIXTURES = [
  FIXTURE_BUSAN_FAMILY_CRUISE,
  FIXTURE_PARENTS_FIRST_TAIWAN,
  FIXTURE_VIETNAM_FAMILY_GROUP,
] as const;

export function clonePayload(p: TrendSignalPayloadV1): TrendSignalPayloadV1 {
  return JSON.parse(JSON.stringify(p)) as TrendSignalPayloadV1;
}
