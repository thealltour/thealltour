import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";
import { addDaysToIsoDate } from "@/lib/planner/planSchemas";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerDraftInput } from "@/types/planner";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const generateObject = vi.hoisted(() => vi.fn());
const withGoogleModelFallback = vi.hoisted(() =>
  vi.fn(async (_label: string, run: (model: { modelId: string }) => Promise<unknown>) =>
    run({ modelId: "gemini-test-primary" }),
  ),
);
const resolveImportAiProvider = vi.hoisted(() => vi.fn(() => "google"));

vi.mock("ai", async () => {
  class MockNoObjectGeneratedError extends Error {
    static isInstance(error: unknown): boolean {
      return error instanceof MockNoObjectGeneratedError;
    }
    text?: string;
    usage?: unknown;
    finishReason?: string;
    cause?: unknown;
    constructor(
      messageOrOptions:
        | string
        | {
            message?: string;
            cause?: unknown;
            text?: string;
            usage?: unknown;
            finishReason?: string;
            response?: unknown;
          } = "No object generated.",
    ) {
      const opts =
        typeof messageOrOptions === "string"
          ? { message: messageOrOptions }
          : messageOrOptions;
      super(opts.message ?? "No object generated.");
      this.name = "AI_NoObjectGeneratedError";
      this.cause = opts.cause;
      this.text = opts.text;
      this.usage = opts.usage;
      this.finishReason = opts.finishReason;
    }
  }
  return {
    generateObject,
    NoObjectGeneratedError: MockNoObjectGeneratedError,
  };
});

vi.mock("@/lib/admin/ai/importAiModel", () => ({
  withGoogleModelFallback,
  resolveImportAiProvider,
  resolveImportLanguageModelForId: vi.fn(),
  requireImportAiKey: vi.fn(),
}));

vi.mock("@/lib/admin/ai/importAiErrors", () => ({
  isAiQuotaError: (error: unknown) =>
    error instanceof Error && /quota exceeded/i.test(error.message),
  formatQuotaExceededMessage: () =>
    "Google Gemini 무료 플랜 사용량(쿼터)을 모두 소진했습니다. 잠시 후 다시 시도하세요.",
  isTransientAiError: () => false,
  shouldFallbackToAlternateGoogleModel: () => false,
}));

import {
  generatePlannerPlan,
  MAX_PLANNER_SEMANTIC_ATTEMPTS,
  PlannerGenerateError,
  getPlannerPrimaryModelId,
  getPlannerSemanticFallbackModelId,
} from "@/lib/planner/generatePlan";
import {
  DEFAULT_PLANNER_PRIMARY_MODEL,
  DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL,
} from "@/lib/planner/modelConfig";

function sampleDraft(): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("오사카", "서울"),
    dates: {
      mode: "fixed",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      durationDays: 3,
    },
    travelers: { adults: 2, children: 0 },
    companionType: "couple",
    interests: ["food", "sightseeing"],
    pace: "balanced",
    budget: { style: null, amount: null, scope: "per_person", currency: "KRW" },
    additionalRequest: "",
  };
}

function validPlan(): PlannerPlan {
  return {
    title: "오사카 2박 3일",
    summary: "난바 중심의 여유로운 일정입니다.",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      nights: 2,
      days: 3,
      travelersSummary: "성인 2명",
      styleSummary: "맛집과 관광",
    },
    days: [0, 1, 2].map((i) => ({
      day: i + 1,
      date: addDaysToIsoDate("2026-10-01", i),
      title: `${i + 1}일차`,
      summary: "하루 요약",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction" as const,
          name: "명소",
          area: "난바",
          description: "둘러보기",
          estimatedDurationMinutes: 90,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: ["운영시간 확인"],
    })),
    preparation: {
      travelTips: ["혼잡 시간 피하기"],
      packingHints: ["편한 신발"],
    },
  };
}

function schemaInvalidPlan(): PlannerPlan {
  const plan = validPlan();
  // Invalid item type breaks zod on re-parse — use cast for generateObject object
  (plan.days[0]!.items[0] as { type: string }).type = "hotel";
  return plan;
}

function invariantBrokenPlan(): PlannerPlan {
  const plan = validPlan();
  plan.days = plan.days.slice(0, 2);
  plan.tripOverview.days = 2;
  plan.tripOverview.nights = 1;
  plan.tripOverview.endDate = "2026-10-02";
  return plan;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PLANNER_PRIMARY_MODEL;
  delete process.env.PLANNER_SEMANTIC_FALLBACK_MODEL;
  withGoogleModelFallback.mockImplementation(
    async (
      _label: string,
      run: (model: { modelId: string }) => Promise<unknown>,
      options?: { primaryModelId?: string | null },
    ) => {
      const modelId = options?.primaryModelId?.trim() || DEFAULT_PLANNER_PRIMARY_MODEL;
      return run({ modelId });
    },
  );
  resolveImportAiProvider.mockReturnValue("google");
});

describe("generatePlannerPlan semantic retry", () => {
  it("succeeds on first attempt", async () => {
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    const result = await generatePlannerPlan(sampleDraft());
    expect(result.plan.days).toHaveLength(3);
    expect(result.meta.semanticAttempts).toBe(1);
    expect(result.meta.modelId).toBe(DEFAULT_PLANNER_PRIMARY_MODEL);
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(generateObject.mock.calls[0]![0].maxRetries).toBe(0);
    expect(withGoogleModelFallback.mock.calls[0]![2]).toEqual({
      primaryModelId: DEFAULT_PLANNER_PRIMARY_MODEL,
    });
  });

  it("retries once after schema_invalid then succeeds", async () => {
    generateObject
      .mockResolvedValueOnce({ object: schemaInvalidPlan() })
      .mockResolvedValueOnce({ object: validPlan() });

    const events: Array<{ type: string; nextModelId?: string | null; modelId?: string | null }> =
      [];
    const result = await generatePlannerPlan(sampleDraft(), {
      onDiagnostic: (e) =>
        events.push({
          type: e.type,
          nextModelId: e.type === "semantic_retry" ? e.nextModelId : undefined,
          modelId: e.modelId,
        }),
    });

    expect(result.meta.semanticAttempts).toBe(2);
    expect(result.meta.modelId).toBe(DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL);
    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(events.map((e) => e.type)).toEqual(["semantic_retry", "attempt_success"]);
    expect(events[0]!.nextModelId).toBe(DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL);
    expect(withGoogleModelFallback.mock.calls[0]![2]).toEqual({
      primaryModelId: DEFAULT_PLANNER_PRIMARY_MODEL,
    });
    expect(withGoogleModelFallback.mock.calls[1]![2]).toEqual({
      primaryModelId: DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL,
    });
    const secondPrompt = generateObject.mock.calls[1]![0].prompt as string;
    expect(secondPrompt).toContain("이전 생성 결과가 출력 스키마");
    expect(secondPrompt).toContain("time은 HH:mm 또는 null");
    expect(secondPrompt).not.toContain("hotel");
  });

  it("retries once after invariant_failed then succeeds", async () => {
    generateObject
      .mockResolvedValueOnce({ object: invariantBrokenPlan() })
      .mockResolvedValueOnce({ object: validPlan() });

    const result = await generatePlannerPlan(sampleDraft());
    expect(result.meta.semanticAttempts).toBe(2);
    expect(result.meta.modelId).toBe(DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL);
    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(withGoogleModelFallback.mock.calls[1]![2]).toEqual({
      primaryModelId: DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL,
    });
  });

  it("fails with schema_invalid after two schema failures", async () => {
    generateObject
      .mockResolvedValueOnce({ object: schemaInvalidPlan() })
      .mockResolvedValueOnce({ object: schemaInvalidPlan() });

    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "schema_invalid",
      code: "schema_invalid",
    });
    expect(generateObject).toHaveBeenCalledTimes(MAX_PLANNER_SEMANTIC_ATTEMPTS);
  });

  it("fails with invariant_failed after two invariant failures", async () => {
    generateObject
      .mockResolvedValueOnce({ object: invariantBrokenPlan() })
      .mockResolvedValueOnce({ object: invariantBrokenPlan() });

    try {
      await generatePlannerPlan(sampleDraft());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PlannerGenerateError);
      const err = error as PlannerGenerateError;
      expect(err.failureCategory).toBe("invariant_failed");
      expect(err.diagnostics.invariantCode).toBe("day_count_mismatch");
      expect(err.diagnostics.attempt).toBe(2);
    }
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it("does not semantic-retry on timeout", async () => {
    generateObject.mockRejectedValueOnce(
      new PlannerGenerateError("timeout", "AI generation timed out", "provider_failed"),
    );

    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      code: "timeout",
      failureCategory: "provider_failed",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("does not semantic-retry on generic provider failure", async () => {
    generateObject.mockRejectedValueOnce(new Error("upstream 500"));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "provider_failed",
      code: "provider",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("does not semantic-retry on missing key", async () => {
    generateObject.mockRejectedValueOnce(new Error("API key is missing"));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      code: "missing_key",
      failureCategory: "provider_failed",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("does not semantic-retry on quota failure", async () => {
    generateObject.mockRejectedValueOnce(new Error("You exceeded your current quota"));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      code: "provider",
      failureCategory: "provider_failed",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("keeps semantic attempt count at 1 when provider helper already exhausted", async () => {
    // withGoogleModelFallback throws final provider error (after its own retries)
    withGoogleModelFallback.mockRejectedValueOnce(new Error("provider exhausted"));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "provider_failed",
    });
    expect(generateObject).not.toHaveBeenCalled();
    expect(withGoogleModelFallback).toHaveBeenCalledTimes(1);
    expect(withGoogleModelFallback.mock.calls[0]![2]).toEqual({
      primaryModelId: DEFAULT_PLANNER_PRIMARY_MODEL,
    });
  });

  it("records schema issue paths without full messages", async () => {
    const broken = validPlan();
    (broken.days[0]!.items[0] as { time: string | null }).time = "25:99";
    generateObject
      .mockResolvedValueOnce({ object: broken })
      .mockResolvedValueOnce({ object: broken });

    try {
      await generatePlannerPlan(sampleDraft());
    } catch (error) {
      const err = error as PlannerGenerateError;
      expect(err.failureCategory).toBe("schema_invalid");
      expect(err.diagnostics.schemaIssuePaths?.length).toBeGreaterThan(0);
      expect(err.diagnostics.schemaIssuePaths?.[0]).toEqual(
        expect.objectContaining({
          path: expect.any(String),
          code: expect.any(String),
        }),
      );
      expect(JSON.stringify(err.diagnostics)).not.toContain("prompt");
      expect(JSON.stringify(err.diagnostics)).not.toContain("anonymousKey");
    }
  });
});

describe("normalize / ZodError diagnostics", () => {
  it("maps ZodError paths safely", async () => {
    const schema = z.object({ a: z.string() });
    const parsed = schema.safeParse({ a: 1 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    // schema_invalid is semantic-retryable → two rejections for final failure
    generateObject.mockRejectedValue(parsed.error);
    try {
      await generatePlannerPlan(sampleDraft());
      expect.fail("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PlannerGenerateError);
      const err = error as PlannerGenerateError;
      expect(err.failureCategory).toBe("schema_invalid");
      expect(err.diagnostics.schemaIssuePaths?.[0]?.path).toBe("a");
      expect(err.message).toBe("Plan schema validation failed");
      expect(err.message).not.toContain("Expected");
      expect(generateObject).toHaveBeenCalledTimes(2);
    }
  });

  it("treats thrown ZodError as schema_invalid without retry beyond max", async () => {
    generateObject.mockRejectedValue(new ZodError([]));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "schema_invalid",
    });
    expect(generateObject).toHaveBeenCalledTimes(2);
  });
});

describe("planner semantic model selection", () => {
  it("uses default primary and semantic fallback when env missing", () => {
    expect(getPlannerPrimaryModelId()).toBe(DEFAULT_PLANNER_PRIMARY_MODEL);
    expect(getPlannerSemanticFallbackModelId()).toBe(
      DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL,
    );
  });

  it("uses env overrides for primary and semantic fallback", async () => {
    process.env.PLANNER_PRIMARY_MODEL = "gemini-custom-primary";
    process.env.PLANNER_SEMANTIC_FALLBACK_MODEL = "gemini-custom-fallback";
    expect(getPlannerPrimaryModelId()).toBe("gemini-custom-primary");
    expect(getPlannerSemanticFallbackModelId()).toBe("gemini-custom-fallback");

    generateObject
      .mockResolvedValueOnce({ object: schemaInvalidPlan() })
      .mockResolvedValueOnce({ object: validPlan() });

    const result = await generatePlannerPlan(sampleDraft());
    expect(result.meta.semanticAttempts).toBe(2);
    expect(withGoogleModelFallback.mock.calls[0]![2]).toEqual({
      primaryModelId: "gemini-custom-primary",
    });
    expect(withGoogleModelFallback.mock.calls[1]![2]).toEqual({
      primaryModelId: "gemini-custom-fallback",
    });
    expect(result.meta.modelId).toBe("gemini-custom-fallback");
  });

  it("does not call semantic fallback model on provider failure", async () => {
    generateObject.mockRejectedValueOnce(new Error("upstream 500"));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "provider_failed",
    });
    expect(withGoogleModelFallback).toHaveBeenCalledTimes(1);
    expect(withGoogleModelFallback.mock.calls[0]![2]).toEqual({
      primaryModelId: DEFAULT_PLANNER_PRIMARY_MODEL,
    });
  });

  it("does not call semantic fallback model on timeout", async () => {
    generateObject.mockRejectedValueOnce(
      new PlannerGenerateError("timeout", "AI generation timed out", "provider_failed"),
    );
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      code: "timeout",
    });
    expect(withGoogleModelFallback).toHaveBeenCalledTimes(1);
  });

  it("does not call semantic fallback model on quota", async () => {
    generateObject.mockRejectedValueOnce(new Error("You exceeded your current quota"));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "provider_failed",
    });
    expect(withGoogleModelFallback).toHaveBeenCalledTimes(1);
  });

  it("final double schema fail uses fallback model on attempt 2", async () => {
    generateObject
      .mockResolvedValueOnce({ object: schemaInvalidPlan() })
      .mockResolvedValueOnce({ object: schemaInvalidPlan() });

    try {
      await generatePlannerPlan(sampleDraft());
      expect.fail("should throw");
    } catch (error) {
      const err = error as PlannerGenerateError;
      expect(err.failureCategory).toBe("schema_invalid");
      expect(err.diagnostics.attempt).toBe(2);
      expect(err.diagnostics.modelId).toBe(DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL);
    }
    expect(withGoogleModelFallback.mock.calls[1]![2]).toEqual({
      primaryModelId: DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL,
    });
  });

  it("attaches root-cause diagnostics for NoObjectGenerated + nested Zod", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const { TypeValidationError } = await import("@ai-sdk/provider");
    const zod = new ZodError([
      {
        code: "invalid_string",
        path: ["days", 0, "items", 2, "time"],
        message: "SECRET",
        validation: "regex",
      } as never,
    ]);
    const nested = new NoObjectGeneratedError({
      cause: new TypeValidationError({ value: { leak: true }, cause: zod }),
      text: "RAW_TEXT",
      response: { id: "r", timestamp: new Date(), modelId: "m" },
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 } as never,
      finishReason: "stop",
    });
    generateObject.mockRejectedValue(nested);

    try {
      await generatePlannerPlan(sampleDraft());
      expect.fail("should throw");
    } catch (error) {
      const err = error as PlannerGenerateError;
      expect(err.failureCategory).toBe("schema_invalid");
      expect(err.diagnostics.sdkFailureType).toBe("type_validation");
      expect(err.diagnostics.causeChain?.[0]).toMatch(/NoObjectGenerated/);
      expect(err.diagnostics.schemaIssuePaths?.[0]).toEqual({
        path: "days.0.items.2.time",
        code: "invalid_string",
      });
      expect(err.diagnostics.finishReason).toBe("stop");
      expect(JSON.stringify(err.diagnostics)).not.toContain("RAW_TEXT");
      expect(JSON.stringify(err.diagnostics)).not.toContain("SECRET");
    }
  });
});
