import { clonePayload, FIXTURE_BUSAN_FAMILY_CRUISE } from "./positiveFixtures";
import type { TrendSignalPayloadV1 } from "../types";

export type NegativeFixture = {
  id: string;
  description: string;
  expectedCode: string;
  build: () => unknown;
};

export const NEGATIVE_TREND_FIXTURES: NegativeFixture[] = [
  {
    id: "l3_with_url",
    description: "L3 provenance must not include url",
    expectedCode: "l3_url_forbidden",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      p.provenance = [
        {
          level: "L3",
          platform: "aggregate",
          captured_at: p.captured_at,
          url: "https://example.com/forbidden",
        } as TrendSignalPayloadV1["provenance"][number] & { url: string },
      ];
      return p;
    },
  },
  {
    id: "published_after_captured",
    description: "published_at > captured_at",
    expectedCode: "temporal_order",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      p.published_at = "2026-09-06T04:00:00.000Z";
      p.captured_at = "2026-09-06T02:00:00.000Z";
      return p;
    },
  },
  {
    id: "single_observation_count_gt1",
    description: "single_observation with count > 1",
    expectedCode: "single_observation_count",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      p.trend_signal_status = "single_observation";
      p.observed_metrics = { observation_count: 3, platform_count: 1 };
      return p;
    },
  },
  {
    id: "repeated_pattern_count_1",
    description: "repeated_pattern with count 1",
    expectedCode: "repeated_pattern_count",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      p.trend_signal_status = "repeated_pattern";
      p.observed_metrics = { observation_count: 1, platform_count: 1 };
      return p;
    },
  },
  {
    id: "verified_factual_claim",
    description: "verified factual claim rejected at Meta stage",
    expectedCode: "factual_must_be_unverified",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      p.factual_claims = [
        { claim: "가격이 30% 하락", verification_status: "verified" as "unverified" },
      ];
      return {
        ...p,
        factual_claims: [{ claim: "가격이 30% 하락", verification_status: "verified" }],
      };
    },
  },
  {
    id: "unknown_trend_type",
    description: "unknown trend_type",
    expectedCode: "unknown_trend_type",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      return { ...p, trend_type: "not_a_real_type" };
    },
  },
  {
    id: "domestic_only_market",
    description: "domestic-only / non-outbound market_relevance",
    expectedCode: "travel_direction_must_be_outbound",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      return {
        ...p,
        market_relevance: {
          ...p.market_relevance,
          travel_direction: "domestic",
        },
      };
    },
  },
  {
    id: "malformed_url",
    description: "malformed provenance URL",
    expectedCode: "malformed_url",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      p.provenance = [
        {
          level: "L1",
          platform: "instagram",
          url: "not a url",
          captured_at: p.captured_at,
        },
      ];
      return p;
    },
  },
  {
    id: "old_source_as_72h_trend",
    description: "window end far before observed (stale masquerading)",
    expectedCode: "window_order",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      p.window = {
        start: "2026-09-06T00:00:00.000Z",
        end: "2026-08-01T00:00:00.000Z",
      };
      return p;
    },
  },
  {
    id: "competitor_without_seller_evidence",
    description: "competitor_promotion_signal without seller evidence in basis",
    expectedCode: "competitor_evidence_missing",
    build: () => {
      const p = clonePayload(FIXTURE_BUSAN_FAMILY_CRUISE);
      p.trend_type = "competitor_promotion_signal";
      p.confidence = { score: 0.9, basis: ["vibes_only"] };
      p.market_relevance = {
        ...p.market_relevance,
        basis: { observed: [], inferred: ["maybe_competitor"] },
      };
      return p;
    },
  },
];
