import { describe, expect, it } from "vitest";

import {
  extractAiRetryAfterSeconds,
  formatQuotaExceededMessage,
  isAiQuotaError,
  isTransientAiError,
  shouldFallbackToAlternateGoogleModel,
} from "@/lib/admin/ai/importAiErrors";

const QUOTA_ERROR = new Error(
  "Failed after 3 attempts. Last error: AI_APICallError: You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash Please retry in 48.39659275s.",
);

describe("importAiErrors", () => {
  it("detects Gemini free-tier quota errors", () => {
    expect(isAiQuotaError(QUOTA_ERROR)).toBe(true);
    expect(isTransientAiError(QUOTA_ERROR)).toBe(false);
    expect(shouldFallbackToAlternateGoogleModel(QUOTA_ERROR)).toBe(true);
    expect(extractAiRetryAfterSeconds(QUOTA_ERROR)).toBe(49);
  });

  it("treats high demand and rate limits as model-fallback triggers", () => {
    const highDemand = new Error(
      "This model is currently experiencing high demand. Spikes in demand are usually temporary.",
    );
    expect(shouldFallbackToAlternateGoogleModel(highDemand)).toBe(true);
    expect(isTransientAiError(highDemand)).toBe(false);
    expect(shouldFallbackToAlternateGoogleModel(new Error("429 Too Many Requests"))).toBe(true);
    expect(shouldFallbackToAlternateGoogleModel(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
  });

  it("does not treat generic network errors as quota", () => {
    expect(isAiQuotaError(new Error("fetch failed"))).toBe(false);
    expect(isTransientAiError(new Error("fetch failed"))).toBe(true);
    expect(shouldFallbackToAlternateGoogleModel(new Error("fetch failed"))).toBe(false);
  });

  it("tells operators the Google AI connection stays enabled", () => {
    const message = formatQuotaExceededMessage(QUOTA_ERROR);
    expect(message).toContain("쿼터");
    expect(message).toContain("약 49초");
    expect(message).toContain("연결은 그대로 유지");
  });
});
