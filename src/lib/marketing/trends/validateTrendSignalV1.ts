import {
  TREND_SIGNAL_PROVIDER_META_AI,
  TREND_SIGNAL_SCHEMA_VERSION,
  TREND_SIGNAL_STATUSES,
  TREND_TYPES,
  type TrendSignalBatchV1,
  type TrendSignalPayloadV1,
  type TrendType,
  type TrendSignalStatus,
} from "./types";

export type TrendValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type TrendValidationResult =
  | { ok: true; value: TrendSignalPayloadV1 }
  | { ok: false; issues: TrendValidationIssue[] };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !v.trim()) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function asStringArray(v: unknown, path: string, issues: TrendValidationIssue[]): string[] {
  if (!Array.isArray(v)) {
    issues.push({ path, code: "expected_string_array", message: `${path} must be string[]` });
    return [];
  }
  const out: string[] = [];
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "string") {
      issues.push({
        path: `${path}[${i}]`,
        code: "expected_string",
        message: `${path}[${i}] must be string`,
      });
    } else {
      out.push(v[i] as string);
    }
  }
  return out;
}

function parseInstant(v: string): number {
  return Date.parse(v);
}

function validateProvenance(
  items: unknown,
  issues: TrendValidationIssue[],
): TrendSignalPayloadV1["provenance"] {
  if (!Array.isArray(items) || items.length === 0) {
    issues.push({
      path: "provenance",
      code: "provenance_required",
      message: "provenance must be a non-empty array",
    });
    return [];
  }
  const out: TrendSignalPayloadV1["provenance"] = [];
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    const base = `provenance[${i}]`;
    if (!isObject(p)) {
      issues.push({ path: base, code: "expected_object", message: `${base} must be object` });
      continue;
    }
    const level = p.level;
    if (level !== "L1" && level !== "L2" && level !== "L3") {
      issues.push({ path: `${base}.level`, code: "invalid_level", message: "level must be L1|L2|L3" });
      continue;
    }
    if (!isIsoDate(p.captured_at)) {
      issues.push({
        path: `${base}.captured_at`,
        code: "invalid_datetime",
        message: "captured_at must be ISO datetime",
      });
    }
    if (level === "L3") {
      if (p.url != null && String(p.url).trim() !== "") {
        issues.push({
          path: `${base}.url`,
          code: "l3_url_forbidden",
          message: "L3 provenance must not include url",
        });
      }
      out.push({
        level: "L3",
        platform: typeof p.platform === "string" ? p.platform : null,
        account_or_page: typeof p.account_or_page === "string" ? p.account_or_page : null,
        captured_at: String(p.captured_at ?? ""),
        note: typeof p.note === "string" ? p.note : null,
      });
      continue;
    }
    if (typeof p.platform !== "string" || !p.platform.trim()) {
      issues.push({
        path: `${base}.platform`,
        code: "platform_required",
        message: "L1/L2 platform required",
      });
    }
    const url = p.url == null || p.url === "" ? null : String(p.url);
    if (url != null) {
      try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          issues.push({ path: `${base}.url`, code: "malformed_url", message: "url must be http(s)" });
        }
        if (url.includes("](")) {
          issues.push({
            path: `${base}.url`,
            code: "markdown_url_not_canonical",
            message: "canonical URL must be raw URI",
          });
        }
      } catch {
        issues.push({ path: `${base}.url`, code: "malformed_url", message: "url is malformed" });
      }
    }
    if (level === "L1") {
      out.push({
        level: "L1",
        platform: String(p.platform ?? ""),
        account_or_page: typeof p.account_or_page === "string" ? p.account_or_page : null,
        url,
        post_id: typeof p.post_id === "string" ? p.post_id : null,
        captured_at: String(p.captured_at ?? ""),
      });
    } else {
      out.push({
        level: "L2",
        platform: String(p.platform ?? ""),
        account_or_page: typeof p.account_or_page === "string" ? p.account_or_page : null,
        url,
        post_id: typeof p.post_id === "string" ? p.post_id : null,
        captured_at: String(p.captured_at ?? ""),
        note: typeof p.note === "string" ? p.note : null,
      });
    }
  }
  return out;
}

/**
 * Validate a single TrendSignalPayload v1 object (already JSON-parsed, paste-normalized).
 */
export function validateTrendSignalPayloadV1(input: unknown): TrendValidationResult {
  const issues: TrendValidationIssue[] = [];
  if (!isObject(input)) {
    return {
      ok: false,
      issues: [{ path: "", code: "expected_object", message: "payload must be object" }],
    };
  }

  if (input.schema_version !== TREND_SIGNAL_SCHEMA_VERSION) {
    issues.push({
      path: "schema_version",
      code: "schema_version_mismatch",
      message: `schema_version must be ${TREND_SIGNAL_SCHEMA_VERSION}`,
    });
  }
  if (input.provider !== TREND_SIGNAL_PROVIDER_META_AI) {
    issues.push({
      path: "provider",
      code: "provider_mismatch",
      message: `provider must be ${TREND_SIGNAL_PROVIDER_META_AI}`,
    });
  }

  const requiredStrings = [
    "observation_id",
    "provider_run_id",
    "provider_run_at",
    "observed_at",
    "captured_at",
    "topic",
    "summary",
  ] as const;
  for (const key of requiredStrings) {
    if (typeof input[key] !== "string" || !(input[key] as string).trim()) {
      issues.push({ path: key, code: "required_string", message: `${key} required` });
    }
  }

  const publishedAt =
    input.published_at == null || input.published_at === ""
      ? null
      : String(input.published_at);
  if (publishedAt != null && !isIsoDate(publishedAt)) {
    issues.push({
      path: "published_at",
      code: "invalid_datetime",
      message: "published_at must be ISO datetime",
    });
  }
  for (const key of ["provider_run_at", "observed_at", "captured_at"] as const) {
    if (typeof input[key] === "string" && !isIsoDate(input[key])) {
      issues.push({ path: key, code: "invalid_datetime", message: `${key} must be ISO datetime` });
    }
  }

  if (!isObject(input.window)) {
    issues.push({ path: "window", code: "expected_object", message: "window required" });
  } else {
    if (!isIsoDate(input.window.start) || !isIsoDate(input.window.end)) {
      issues.push({
        path: "window",
        code: "invalid_window",
        message: "window.start/end must be ISO datetime",
      });
    } else if (parseInstant(String(input.window.start)) > parseInstant(String(input.window.end))) {
      issues.push({
        path: "window",
        code: "window_order",
        message: "window.start must be <= window.end",
      });
    }
  }

  const trendType = input.trend_type;
  if (typeof trendType !== "string" || !(TREND_TYPES as readonly string[]).includes(trendType)) {
    issues.push({
      path: "trend_type",
      code: "unknown_trend_type",
      message: "unknown trend_type",
    });
  }

  const status = input.trend_signal_status;
  if (
    typeof status !== "string" ||
    !(TREND_SIGNAL_STATUSES as readonly string[]).includes(status)
  ) {
    issues.push({
      path: "trend_signal_status",
      code: "invalid_signal_status",
      message: "invalid trend_signal_status",
    });
  }

  const verticalTags = asStringArray(input.vertical_tags ?? [], "vertical_tags", issues);

  if (!isObject(input.market_relevance)) {
    issues.push({
      path: "market_relevance",
      code: "expected_object",
      message: "market_relevance required",
    });
  } else {
    const mr = input.market_relevance;
    if (mr.origin_market !== "KR") {
      issues.push({
        path: "market_relevance.origin_market",
        code: "origin_market_must_be_kr",
        message: "origin_market must be KR",
      });
    }
    if (mr.travel_direction !== "outbound") {
      issues.push({
        path: "market_relevance.travel_direction",
        code: "travel_direction_must_be_outbound",
        message: "travel_direction must be outbound (domestic-only rejected)",
      });
    }
    if (typeof mr.score !== "number" || !Number.isFinite(mr.score)) {
      issues.push({
        path: "market_relevance.score",
        code: "invalid_score",
        message: "score must be finite number",
      });
    }
    if (!isObject(mr.basis)) {
      issues.push({
        path: "market_relevance.basis",
        code: "expected_object",
        message: "basis required",
      });
    } else {
      asStringArray(mr.basis.observed ?? [], "market_relevance.basis.observed", issues);
      asStringArray(mr.basis.inferred ?? [], "market_relevance.basis.inferred", issues);
    }
  }

  if (!isObject(input.observed_metrics)) {
    issues.push({
      path: "observed_metrics",
      code: "expected_object",
      message: "observed_metrics required",
    });
  } else {
    const om = input.observed_metrics;
    const observationCount =
      typeof om.observation_count === "number" ? om.observation_count : NaN;
    const platformCount = typeof om.platform_count === "number" ? om.platform_count : NaN;
    if (!Number.isInteger(observationCount) || observationCount < 1) {
      issues.push({
        path: "observed_metrics.observation_count",
        code: "invalid_observation_count",
        message: "observation_count must be integer >= 1",
      });
    }
    if (!Number.isInteger(platformCount) || platformCount < 1) {
      issues.push({
        path: "observed_metrics.platform_count",
        code: "invalid_platform_count",
        message: "platform_count must be integer >= 1",
      });
    }
    if (status === "single_observation" && observationCount !== 1) {
      issues.push({
        path: "observed_metrics.observation_count",
        code: "single_observation_count",
        message: "single_observation requires observation_count == 1",
      });
    }
    if (status === "repeated_pattern" && !(observationCount >= 2)) {
      issues.push({
        path: "observed_metrics.observation_count",
        code: "repeated_pattern_count",
        message: "repeated_pattern requires observation_count >= 2",
      });
    }
    if (status === "cross_platform_pattern") {
      if (!(observationCount >= 2)) {
        issues.push({
          path: "observed_metrics.observation_count",
          code: "cross_platform_observation_count",
          message: "cross_platform_pattern requires observation_count >= 2",
        });
      }
      if (!(platformCount >= 2)) {
        issues.push({
          path: "observed_metrics.platform_count",
          code: "cross_platform_platform_count",
          message: "cross_platform_pattern requires platform_count >= 2",
        });
      }
    }
  }

  if (!isObject(input.confidence) || typeof input.confidence.score !== "number") {
    issues.push({ path: "confidence", code: "invalid_confidence", message: "confidence.score required" });
  }
  if (!isObject(input.popularity) || typeof input.popularity.score !== "number") {
    issues.push({ path: "popularity", code: "invalid_popularity", message: "popularity.score required" });
  }

  if (!isObject(input.marketing_observations)) {
    issues.push({
      path: "marketing_observations",
      code: "expected_object",
      message: "marketing_observations required",
    });
  } else {
    const mo = input.marketing_observations;
    for (const key of [
      "hook_signals",
      "format_signals",
      "audience_pain_points",
      "audience_questions",
      "persona_estimates",
      "content_angles",
    ] as const) {
      asStringArray(mo[key] ?? [], `marketing_observations.${key}`, issues);
    }
  }

  if (trendType === "competitor_promotion_signal" && isObject(input.market_relevance)) {
    const basis = isObject(input.market_relevance.basis)
      ? input.market_relevance.basis
      : null;
    const observed = Array.isArray(basis?.observed)
      ? (basis.observed as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    const confBasis = isObject(input.confidence) && Array.isArray(input.confidence.basis)
      ? (input.confidence.basis as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    const sellerEvidence = [...observed, ...confBasis].some((s) =>
      /seller|competitor|promotion|promo|판매|경쟁|프로모/i.test(s),
    );
    if (!sellerEvidence) {
      issues.push({
        path: "trend_type",
        code: "competitor_evidence_missing",
        message:
          "competitor_promotion_signal requires seller/competitor evidence in observed or confidence basis",
      });
    }
  }

  if (!Array.isArray(input.factual_claims)) {
    issues.push({
      path: "factual_claims",
      code: "expected_array",
      message: "factual_claims must be array",
    });
  } else {
    for (let i = 0; i < input.factual_claims.length; i++) {
      const c = input.factual_claims[i];
      const path = `factual_claims[${i}]`;
      if (!isObject(c) || typeof c.claim !== "string") {
        issues.push({ path, code: "invalid_claim", message: "claim object required" });
        continue;
      }
      if (c.verification_status !== "unverified") {
        issues.push({
          path: `${path}.verification_status`,
          code: "factual_must_be_unverified",
          message: "Meta-stage factual_claims must be unverified",
        });
      }
    }
  }

  const provenance = validateProvenance(input.provenance, issues);

  // Temporal: published_at <= captured_at <= observed_at
  if (
    typeof input.captured_at === "string" &&
    isIsoDate(input.captured_at) &&
    typeof input.observed_at === "string" &&
    isIsoDate(input.observed_at)
  ) {
    const captured = parseInstant(input.captured_at);
    const observed = parseInstant(input.observed_at);
    if (captured > observed) {
      issues.push({
        path: "captured_at",
        code: "temporal_order",
        message: "captured_at must be <= observed_at",
      });
    }
    if (publishedAt != null && isIsoDate(publishedAt)) {
      const published = parseInstant(publishedAt);
      if (published > captured) {
        issues.push({
          path: "published_at",
          code: "temporal_order",
          message: "published_at must be <= captured_at",
        });
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const mo = input.marketing_observations as Record<string, unknown>;
  const mr = input.market_relevance as Record<string, unknown>;
  const mrBasis = mr.basis as Record<string, unknown>;
  const om = input.observed_metrics as Record<string, unknown>;
  const conf = input.confidence as Record<string, unknown>;
  const pop = input.popularity as Record<string, unknown>;

  const value: TrendSignalPayloadV1 = {
    schema_version: TREND_SIGNAL_SCHEMA_VERSION,
    provider: TREND_SIGNAL_PROVIDER_META_AI,
    observation_id: String(input.observation_id),
    provider_run_id: String(input.provider_run_id),
    provider_run_at: String(input.provider_run_at),
    observed_at: String(input.observed_at),
    published_at: publishedAt,
    captured_at: String(input.captured_at),
    window: {
      start: String((input.window as Record<string, unknown>).start),
      end: String((input.window as Record<string, unknown>).end),
    },
    trend_type: trendType as TrendType,
    trend_signal_status: status as TrendSignalStatus,
    topic: String(input.topic),
    summary: String(input.summary),
    vertical_tags: verticalTags,
    destinations: Array.isArray(input.destinations)
      ? (input.destinations as unknown[]).filter((d): d is string => typeof d === "string")
      : undefined,
    provider_cluster_hint:
      input.provider_cluster_hint == null || input.provider_cluster_hint === ""
        ? null
        : String(input.provider_cluster_hint),
    cluster_label:
      input.cluster_label == null || input.cluster_label === ""
        ? null
        : String(input.cluster_label),
    confidence: {
      score: Number(conf.score),
      basis: asStringArray(conf.basis ?? [], "confidence.basis", []),
    },
    popularity: {
      score: Number(pop.score),
      basis: asStringArray(pop.basis ?? [], "popularity.basis", []),
    },
    market_relevance: {
      origin_market: "KR",
      travel_direction: "outbound",
      score: Number(mr.score),
      basis: {
        observed: asStringArray(mrBasis.observed ?? [], "market_relevance.basis.observed", []),
        inferred: asStringArray(mrBasis.inferred ?? [], "market_relevance.basis.inferred", []),
      },
    },
    observed_metrics: {
      observation_count: Number(om.observation_count),
      platform_count: Number(om.platform_count),
      platforms: Array.isArray(om.platforms)
        ? (om.platforms as unknown[]).filter((p): p is string => typeof p === "string")
        : undefined,
      engagement_proxy:
        om.engagement_proxy == null ? null : Number(om.engagement_proxy),
    },
    marketing_observations: {
      hook_signals: asStringArray(mo.hook_signals ?? [], "x", []),
      format_signals: asStringArray(mo.format_signals ?? [], "x", []),
      audience_pain_points: asStringArray(mo.audience_pain_points ?? [], "x", []),
      audience_questions: asStringArray(mo.audience_questions ?? [], "x", []),
      persona_estimates: asStringArray(mo.persona_estimates ?? [], "x", []),
      content_angles: asStringArray(mo.content_angles ?? [], "x", []),
    },
    factual_claims: (input.factual_claims as Array<Record<string, unknown>>).map((c) => ({
      claim: String(c.claim),
      verification_status: "unverified" as const,
      notes: typeof c.notes === "string" ? c.notes : null,
    })),
    provenance,
    raw_context: isObject(input.raw_context)
      ? {
          excerpt:
            typeof input.raw_context.excerpt === "string" ? input.raw_context.excerpt : null,
          notes: typeof input.raw_context.notes === "string" ? input.raw_context.notes : null,
          opaque: isObject(input.raw_context.opaque) ? input.raw_context.opaque : null,
        }
      : null,
  };

  return { ok: true, value };
}

export type TrendBatchItemResult =
  | { index: number; status: "valid"; value: TrendSignalPayloadV1 }
  | { index: number; status: "rejected"; issues: TrendValidationIssue[] };

export function validateTrendSignalBatchV1(input: unknown): {
  providerOk: boolean;
  providerIssues: TrendValidationIssue[];
  items: TrendBatchItemResult[];
} {
  const providerIssues: TrendValidationIssue[] = [];
  if (!isObject(input)) {
    return {
      providerOk: false,
      providerIssues: [{ path: "", code: "expected_object", message: "batch must be object" }],
      items: [],
    };
  }
  if (input.provider !== TREND_SIGNAL_PROVIDER_META_AI) {
    providerIssues.push({
      path: "provider",
      code: "provider_mismatch",
      message: `provider must be ${TREND_SIGNAL_PROVIDER_META_AI}`,
    });
  }
  if (!Array.isArray(input.items)) {
    providerIssues.push({
      path: "items",
      code: "expected_array",
      message: "items must be array",
    });
    return { providerOk: false, providerIssues, items: [] };
  }

  const items: TrendBatchItemResult[] = input.items.map((item, index) => {
    const result = validateTrendSignalPayloadV1(item);
    if (result.ok) {
      return { index, status: "valid" as const, value: result.value };
    }
    return { index, status: "rejected" as const, issues: result.issues };
  });

  return {
    providerOk: providerIssues.length === 0,
    providerIssues,
    items,
  };
}

export type { TrendSignalBatchV1 };
