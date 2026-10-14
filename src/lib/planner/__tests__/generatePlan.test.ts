import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";
import { APICallError } from "@ai-sdk/provider";
import { addDaysToIsoDate, plannerPlanSchema } from "@/lib/planner/planSchemas";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerDraftInput } from "@/types/planner";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const generateObject = vi.hoisted(() => vi.fn());
type MockProviderFactory = (settings: { apiKey?: string }) => (modelId: string) => {
  provider: string;
  modelId: string;
};

const createOpenAI = vi.hoisted(() =>
  vi.fn<MockProviderFactory>(() => (modelId: string) => ({
    provider: "openai.responses",
    modelId,
  })),
);
const createGoogleGenerativeAI = vi.hoisted(() =>
  vi.fn<MockProviderFactory>(() => (modelId: string) => ({
    provider: "google.generative-ai",
    modelId,
  })),
);

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

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI,
  openai: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI,
}));

import {
  generateEditedPlannerPlan,
  generatePlannerPlan,
  MAX_PLANNER_SEMANTIC_ATTEMPTS,
  PLANNER_ATTEMPT_TIMEOUT_MS,
  PLANNER_GENERATE_TOTAL_BUDGET_MS,
  PlannerGenerateError,
  getPlannerPrimaryModelId,
  getPlannerSemanticFallbackModelId,
  type PlannerGenerateDiagnosticEvent,
} from "@/lib/planner/generatePlan";
import {
  DEFAULT_PLANNER_GOOGLE_PRIMARY_MODEL,
  DEFAULT_PLANNER_PRIMARY_MODEL,
  DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL,
} from "@/lib/planner/modelConfig";

const PLANNER_TEST_KEY = "planner-test-key";

const AI_ENV_KEYS = [
  "PLANNER_AI_PROVIDER",
  "PLANNER_OPENAI_API_KEY",
  "PLANNER_PRIMARY_MODEL",
  "PLANNER_SEMANTIC_FALLBACK_MODEL",
  "PLANNER_OPENAI_REASONING_EFFORT",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "IMPORT_AI_PROVIDER",
  "IMPORT_AI_MODEL",
  "BAND_IMPORT_MODEL",
  "IMPORT_AI_FALLBACK_MODEL",
] as const;

const ORIGINAL_ENV = { ...process.env };

type GenerateObjectCall = {
  model: { provider: string; modelId: string };
  schema: unknown;
  system: string;
  prompt: string;
  maxRetries: number;
  providerOptions?: { openai?: Record<string, unknown> };
};

function generateCall(index: number): GenerateObjectCall {
  return generateObject.mock.calls[index]![0] as GenerateObjectCall;
}

function requestedModelIds(): string[] {
  return generateObject.mock.calls.map((call) => (call[0] as GenerateObjectCall).model.modelId);
}

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

function makeItems(count: number): PlannerPlan["days"][number]["items"] {
  return Array.from({ length: count }, (_, i) => ({
    order: i + 1,
    time: `${String(10 + i).padStart(2, "0")}:00`,
    type: i % 2 === 0 ? ("attraction" as const) : ("food" as const),
    name: `일정 ${i + 1}`,
    area: "난바",
    description: "둘러보기",
    estimatedDurationMinutes: 60,
    travelToNext: null,
    bookingRecommended: false,
  }));
}

function validPlan(): PlannerPlan {
  // 3-day balanced: arrival 2 / full 4 / departure 2 (meets hard mins)
  const counts = [2, 4, 2];
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
    days: counts.map((count, i) => ({
      day: i + 1,
      date: addDaysToIsoDate("2026-10-01", i),
      title: `${i + 1}일차`,
      summary: "하루 요약",
      items: makeItems(count),
      tips: ["운영시간 확인"],
    })),
    preparation: {
      travelTips: ["혼잡 시간 피하기"],
      packingHints: ["편한 신발"],
    },
  };
}

function sparseBalancedPlan(): PlannerPlan {
  // schema-valid but quality-fail: full day has only 2 items
  const counts = [2, 2, 2];
  const plan = validPlan();
  plan.days = counts.map((count, i) => ({
    day: i + 1,
    date: addDaysToIsoDate("2026-10-01", i),
    title: `${i + 1}일차`,
    summary: "하루 요약",
    items: makeItems(count),
    tips: ["운영시간 확인"],
  }));
  return plan;
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
  generateObject.mockReset();
  for (const key of AI_ENV_KEYS) delete process.env[key];
  process.env.PLANNER_AI_PROVIDER = "openai";
  process.env.PLANNER_OPENAI_API_KEY = PLANNER_TEST_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("generatePlannerPlan semantic retry", () => {
  it("succeeds on first attempt with the Planner OpenAI Sol model", async () => {
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    const result = await generatePlannerPlan(sampleDraft());
    expect(result.plan.days).toHaveLength(3);
    expect(result.meta).toEqual({
      semanticAttempts: 1,
      provider: "openai",
      modelId: "gpt-6.1-sol",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
    const call = generateCall(0);
    expect(call.maxRetries).toBe(0);
    expect(call.schema).toBe(plannerPlanSchema);
    expect(call.model).toEqual({ provider: "openai.responses", modelId: "gpt-6.1-sol" });
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: PLANNER_TEST_KEY });
    expect(createGoogleGenerativeAI).not.toHaveBeenCalled();
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
    expect(requestedModelIds()).toEqual(["gpt-6.1-sol", "gpt-6.1-sol"]);
    expect(generateCall(1).schema).toBe(plannerPlanSchema);
    expect(generateCall(1).maxRetries).toBe(0);
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
    expect(generateCall(1).model.modelId).toBe("gpt-6.1-sol");
  });

  it("retries once after quality_failed density then succeeds with fallback model", async () => {
    generateObject
      .mockResolvedValueOnce({ object: sparseBalancedPlan() })
      .mockResolvedValueOnce({ object: validPlan() });

    const events: Array<{ type: string; failureCategory?: string; qualityIssue?: unknown }> = [];
    const result = await generatePlannerPlan(sampleDraft(), {
      onDiagnostic: (e) => {
        if (e.type === "semantic_retry") {
          events.push({
            type: e.type,
            failureCategory: e.failureCategory,
            qualityIssue: e.qualityIssue,
          });
        } else {
          events.push({ type: e.type });
        }
      },
    });

    expect(result.meta.semanticAttempts).toBe(2);
    expect(result.meta.modelId).toBe(DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL);
    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(requestedModelIds()).toEqual(["gpt-6.1-sol", "gpt-6.1-sol"]);
    expect(generateCall(1).providerOptions?.openai?.reasoningEffort).toBe("medium");
    expect(events[0]).toMatchObject({
      type: "semantic_retry",
      failureCategory: "quality_failed",
      qualityIssue: expect.objectContaining({
        code: "day_item_density_too_low",
        day: 2,
        actual: 2,
        expectedMinimum: 3,
        pace: "balanced",
      }),
    });
    const secondPrompt = generateObject.mock.calls[1]![0].prompt as string;
    expect(secondPrompt).toContain("일정 밀도");
    expect(secondPrompt).toContain("itinerary item");
    expect(secondPrompt).not.toContain("RAW");
    expect(secondPrompt).not.toContain(JSON.stringify(sparseBalancedPlan()));
  });

  it("fails with quality_failed after two sparse plans and does not succeed", async () => {
    generateObject
      .mockResolvedValueOnce({ object: sparseBalancedPlan() })
      .mockResolvedValueOnce({ object: sparseBalancedPlan() });

    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "quality_failed",
      code: "quality_failed",
    });
    expect(generateObject).toHaveBeenCalledTimes(2);
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
      code: "rate_limited",
      failureCategory: "provider_failed",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("fails fast with missing_key when Planner key is missing (no global OPENAI_API_KEY fallback)", async () => {
    delete process.env.PLANNER_OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "global-test-key";
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      code: "missing_key",
      failureCategory: "provider_failed",
      diagnostics: expect.objectContaining({ provider: "openai", stage: "provider_call" }),
    });
    expect(generateObject).not.toHaveBeenCalled();
    expect(createOpenAI).not.toHaveBeenCalled();
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
  it("defaults both semantic attempts to gpt-6.1-sol when env missing", () => {
    expect(DEFAULT_PLANNER_PRIMARY_MODEL).toBe("gpt-6.1-sol");
    expect(DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL).toBe("gpt-6.1-sol");
    expect(getPlannerPrimaryModelId()).toBe(DEFAULT_PLANNER_PRIMARY_MODEL);
    expect(getPlannerSemanticFallbackModelId()).toBe(
      DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL,
    );
  });

  it("passes env override model IDs to the actual OpenAI model creation", async () => {
    process.env.PLANNER_PRIMARY_MODEL = "gpt-custom-primary";
    process.env.PLANNER_SEMANTIC_FALLBACK_MODEL = "gpt-custom-fallback";
    expect(getPlannerPrimaryModelId()).toBe("gpt-custom-primary");
    expect(getPlannerSemanticFallbackModelId()).toBe("gpt-custom-fallback");

    generateObject
      .mockResolvedValueOnce({ object: schemaInvalidPlan() })
      .mockResolvedValueOnce({ object: validPlan() });

    const result = await generatePlannerPlan(sampleDraft());
    expect(result.meta.semanticAttempts).toBe(2);
    expect(requestedModelIds()).toEqual(["gpt-custom-primary", "gpt-custom-fallback"]);
    expect(createOpenAI).toHaveBeenCalledTimes(2);
    expect(createOpenAI.mock.calls.every((call) => call[0].apiKey === PLANNER_TEST_KEY)).toBe(
      true,
    );
    expect(result.meta.modelId).toBe("gpt-custom-fallback");
  });

  it("ignores IMPORT_AI_* model env for Planner OpenAI calls", async () => {
    process.env.IMPORT_AI_PROVIDER = "google";
    process.env.IMPORT_AI_MODEL = "gpt-4o-mini";
    process.env.BAND_IMPORT_MODEL = "gpt-4o-mini";
    process.env.GEMINI_API_KEY = "gem-test-key";
    generateObject.mockResolvedValueOnce({ object: validPlan() });

    const result = await generatePlannerPlan(sampleDraft());
    expect(result.meta.provider).toBe("openai");
    expect(requestedModelIds()).toEqual(["gpt-6.1-sol"]);
    expect(createGoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it("does not call semantic fallback model on provider failure", async () => {
    generateObject.mockRejectedValueOnce(new Error("upstream 500"));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "provider_failed",
    });
    expect(requestedModelIds()).toEqual([DEFAULT_PLANNER_PRIMARY_MODEL]);
  });

  it("does not call semantic fallback model on timeout", async () => {
    generateObject.mockRejectedValueOnce(
      new PlannerGenerateError("timeout", "AI generation timed out", "provider_failed"),
    );
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      code: "timeout",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("does not call semantic fallback model on quota", async () => {
    generateObject.mockRejectedValueOnce(new Error("You exceeded your current quota"));
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      failureCategory: "provider_failed",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
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
    expect(generateCall(1).model.modelId).toBe(DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL);
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

describe("Planner OpenAI reasoning options", () => {
  it("sends reasoning effort medium with forceReasoning and non-strict JSON schema by default", async () => {
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    await generatePlannerPlan(sampleDraft());
    expect(generateCall(0).providerOptions).toEqual({
      openai: {
        reasoningEffort: "medium",
        forceReasoning: true,
        reasoningSummary: null,
        strictJsonSchema: false,
      },
    });
  });

  it("honors a supported PLANNER_OPENAI_REASONING_EFFORT", async () => {
    process.env.PLANNER_OPENAI_REASONING_EFFORT = "HIGH";
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    await generatePlannerPlan(sampleDraft());
    expect(generateCall(0).providerOptions?.openai?.reasoningEffort).toBe("high");
  });

  it("falls back to medium for an invalid reasoning effort", async () => {
    process.env.PLANNER_OPENAI_REASONING_EFFORT = "turbo";
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    await generatePlannerPlan(sampleDraft());
    expect(generateCall(0).providerOptions?.openai?.reasoningEffort).toBe("medium");
  });
});

describe("Planner provider selection", () => {
  it("uses OpenAI when PLANNER_AI_PROVIDER is unset even if Google keys exist", async () => {
    delete process.env.PLANNER_AI_PROVIDER;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-test-key";
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    const result = await generatePlannerPlan(sampleDraft());
    expect(result.meta.provider).toBe("openai");
    expect(createGoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it("supports env-only Google rollback without OpenAI provider options", async () => {
    process.env.PLANNER_AI_PROVIDER = "google";
    process.env.GEMINI_API_KEY = "gem-test-key";
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    const result = await generatePlannerPlan(sampleDraft());
    expect(result.meta).toEqual({
      semanticAttempts: 1,
      provider: "google",
      modelId: DEFAULT_PLANNER_GOOGLE_PRIMARY_MODEL,
    });
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: "gem-test-key" });
    expect(createOpenAI).not.toHaveBeenCalled();
    expect(generateCall(0).providerOptions).toBeUndefined();
    expect(generateCall(0).schema).toBe(plannerPlanSchema);
  });

  it("rejects an unknown PLANNER_AI_PROVIDER as invalid_config without calling a model", async () => {
    process.env.PLANNER_AI_PROVIDER = "anthropic";
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      code: "invalid_config",
      failureCategory: "provider_failed",
    });
    expect(generateObject).not.toHaveBeenCalled();
  });
});

function apiCallError(statusCode: number, message: string): APICallError {
  return new APICallError({
    message,
    url: "https://api.openai.com/v1/responses",
    requestBodyValues: { input: "PROMPT_SECRET" },
    statusCode,
    responseBody: "RAW_RESPONSE_BODY",
  });
}

describe("Planner provider error classification", () => {
  it.each([
    [429, "rate_limited"],
    [401, "auth"],
    [403, "auth"],
  ] as const)("maps HTTP %i to %s without semantic retry", async (status, code) => {
    generateObject.mockRejectedValueOnce(apiCallError(status, "provider rejected"));
    try {
      await generatePlannerPlan(sampleDraft());
      expect.fail("should throw");
    } catch (error) {
      const err = error as PlannerGenerateError;
      expect(err.code).toBe(code);
      expect(err.failureCategory).toBe("provider_failed");
      expect(err.diagnostics.providerStatusCode).toBe(status);
      expect(JSON.stringify(err.diagnostics)).not.toContain("PROMPT_SECRET");
      expect(JSON.stringify(err.diagnostics)).not.toContain("RAW_RESPONSE_BODY");
    }
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("treats a 400 schema rejection as provider_failed, not schema_invalid", async () => {
    generateObject.mockRejectedValueOnce(
      apiCallError(400, "Invalid schema for response_format: validation failed"),
    );
    await expect(generatePlannerPlan(sampleDraft())).rejects.toMatchObject({
      code: "provider",
      failureCategory: "provider_failed",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 503 once on the same model with safe logging only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateObject
      .mockRejectedValueOnce(apiCallError(503, "Service Unavailable"))
      .mockResolvedValueOnce({ object: validPlan() });

    const result = await generatePlannerPlan(sampleDraft());
    expect(result.meta.semanticAttempts).toBe(1);
    expect(requestedModelIds()).toEqual(["gpt-6.1-sol", "gpt-6.1-sol"]);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls[0]);
    expect(logged).toContain("503");
    expect(logged).not.toContain("PROMPT_SECRET");
    expect(logged).not.toContain("RAW_RESPONSE_BODY");
    expect(logged).not.toContain(PLANNER_TEST_KEY);
    warn.mockRestore();
  });
});

describe("Planner success observability", () => {
  it("reports safe usage and finishReason on attempt_success", async () => {
    generateObject.mockResolvedValueOnce({
      object: validPlan(),
      usage: {
        inputTokens: 1200,
        outputTokens: 800,
        totalTokens: 2000,
        outputTokenDetails: { textTokens: 500, reasoningTokens: 300 },
        raw: { note: "RAW_USAGE" },
      },
      finishReason: "stop",
    });
    const events: PlannerGenerateDiagnosticEvent[] = [];
    await generatePlannerPlan(sampleDraft(), { onDiagnostic: (e) => events.push(e) });

    const success = events.find((e) => e.type === "attempt_success");
    expect(success).toMatchObject({
      provider: "openai",
      modelId: "gpt-6.1-sol",
      finishReason: "stop",
      usage: { inputTokens: 1200, outputTokens: 800, totalTokens: 2000, reasoningTokens: 300 },
    });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("RAW_USAGE");
    expect(serialized).not.toContain(validPlan().title);
  });
});

describe("generateEditedPlannerPlan provider", () => {
  it("uses the Planner OpenAI primary model, not import AI settings", async () => {
    process.env.IMPORT_AI_MODEL = "gpt-4o-mini";
    process.env.OPENAI_API_KEY = "global-test-key";
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    const events: PlannerGenerateDiagnosticEvent[] = [];

    const plan = await generateEditedPlannerPlan(
      { draft: sampleDraft(), currentPlan: validPlan(), instruction: "맛집을 더 넣어줘" },
      { onDiagnostic: (e) => events.push(e) },
    );

    expect(plan.days).toHaveLength(3);
    expect(requestedModelIds()).toEqual(["gpt-6.1-sol"]);
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: PLANNER_TEST_KEY });
    expect(generateCall(0).providerOptions?.openai?.reasoningEffort).toBe("medium");
    expect(generateCall(0).providerOptions?.openai?.strictJsonSchema).toBe(false);
    expect(generateCall(0).schema).toBe(plannerPlanSchema);
    expect(generateCall(0).maxRetries).toBe(0);
    expect(events).toEqual([
      expect.objectContaining({ type: "attempt_success", provider: "openai", modelId: "gpt-6.1-sol" }),
    ]);
  });

  it("fails with missing_key when only the global OpenAI key exists", async () => {
    delete process.env.PLANNER_OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "global-test-key";
    await expect(
      generateEditedPlannerPlan({
        draft: sampleDraft(),
        currentPlan: validPlan(),
        instruction: "맛집을 더 넣어줘",
      }),
    ).rejects.toMatchObject({ code: "missing_key", failureCategory: "provider_failed" });
    expect(generateObject).not.toHaveBeenCalled();
  });
});

describe("Planner generation time budget", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function abortSignalOf(index: number): AbortSignal {
    return (generateObject.mock.calls[index]![0] as { abortSignal: AbortSignal }).abortSignal;
  }

  function resolveAfter(ms: number, object: unknown) {
    generateObject.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ object }), ms)),
    );
  }

  function hangUntilAborted() {
    generateObject.mockImplementationOnce(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((_, reject) => {
          abortSignal.addEventListener("abort", () =>
            reject(new DOMException("This operation was aborted", "AbortError")),
          );
        }),
    );
  }

  function track<T>(promise: Promise<T>) {
    const state = { settled: false };
    const result = promise.then(
      (value) => {
        state.settled = true;
        return value;
      },
      (error: unknown) => {
        state.settled = true;
        return error;
      },
    );
    return { state, result };
  }

  it("passes an unaborted abort signal to the provider call", async () => {
    generateObject.mockResolvedValueOnce({ object: validPlan() });
    await generatePlannerPlan(sampleDraft());
    expect(abortSignalOf(0)).toBeInstanceOf(AbortSignal);
    expect(abortSignalOf(0).aborted).toBe(false);
  });

  it("lets a call longer than the previous 90s limit succeed", async () => {
    vi.useFakeTimers();
    resolveAfter(100_000, validPlan());
    const { result } = track(generatePlannerPlan(sampleDraft()));
    await vi.advanceTimersByTimeAsync(100_000);
    await expect(result).resolves.toMatchObject({ meta: { semanticAttempts: 1 } });
  });

  it("aborts the provider request at the attempt timeout without semantic retry", async () => {
    vi.useFakeTimers();
    hangUntilAborted();
    const { state, result } = track(generatePlannerPlan(sampleDraft()));

    await vi.advanceTimersByTimeAsync(PLANNER_ATTEMPT_TIMEOUT_MS - 1);
    expect(state.settled).toBe(false);
    expect(abortSignalOf(0).aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({ code: "timeout", failureCategory: "provider_failed" });
    expect(abortSignalOf(0).aborted).toBe(true);
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("caps the semantic retry by the remaining total budget", async () => {
    vi.useFakeTimers();
    const firstAttemptMs = 140_000;
    resolveAfter(firstAttemptMs, sparseBalancedPlan());
    hangUntilAborted();
    const { state, result } = track(generatePlannerPlan(sampleDraft()));

    await vi.advanceTimersByTimeAsync(firstAttemptMs);
    expect(generateObject).toHaveBeenCalledTimes(2);

    const remainingMs = PLANNER_GENERATE_TOTAL_BUDGET_MS - firstAttemptMs;
    expect(remainingMs).toBeLessThan(PLANNER_ATTEMPT_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(remainingMs - 1);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({ code: "timeout", failureCategory: "provider_failed" });
    expect(abortSignalOf(1).aborted).toBe(true);
  });

  it("does not transient-retry after the attempt was aborted", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateObject.mockImplementationOnce(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((_, reject) => {
          abortSignal.addEventListener("abort", () => reject(new Error("fetch failed")));
        }),
    );
    const { result } = track(generatePlannerPlan(sampleDraft()));
    await vi.advanceTimersByTimeAsync(PLANNER_ATTEMPT_TIMEOUT_MS + 5_000);
    await expect(result).resolves.toMatchObject({ code: "timeout" });
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalledWith("[planner/generate/provider-retry]", expect.anything());
    warn.mockRestore();
  });

  it("applies the attempt timeout and abort signal to edit generation", async () => {
    vi.useFakeTimers();
    hangUntilAborted();
    const { result } = track(
      generateEditedPlannerPlan({
        draft: sampleDraft(),
        currentPlan: validPlan(),
        instruction: "맛집을 더 넣어줘",
      }),
    );
    await vi.advanceTimersByTimeAsync(PLANNER_ATTEMPT_TIMEOUT_MS);
    await expect(result).resolves.toMatchObject({ code: "timeout" });
    expect(abortSignalOf(0).aborted).toBe(true);
  });
});
