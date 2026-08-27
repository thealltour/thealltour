import { afterEach, describe, expect, it } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import { WORKLOAD_CLASSES } from "@/ai-runtime/domain/workload";
import { AI_MODEL_IDS, AI_PROVIDER_IDS, createDefaultAiRuntimeRegistry } from "@/ai-runtime/registry";
import {
  WORKLOAD_DEFAULT_OUTPUT_TOKENS,
  applySafetyMultiplier,
  checkContextFit,
  checkOutputLimit,
  compareEstimateToUsage,
  countCharacters,
  createHeuristicTokenEstimator,
  estimateInputTokensFromMessages,
  estimateMessageTokens,
  estimateRequestTokens,
  estimateTextTokens,
  resetDefaultTokenEstimatorForTests,
} from "@/ai-runtime/tokens";

function sampleRequest(overrides: Partial<RuntimeRequest> = {}): RuntimeRequest {
  return {
    id: "req-estimate-1",
    createdAt: "2026-08-27T03:00:00.000Z",
    agentId: "marketing-manager",
    source: "desktop",
    workload: "content_draft",
    priority: "normal",
    messages: [{ role: "user", content: "Create a short marketing summary." }],
    ...overrides,
  };
}

describe("token estimator", () => {
  afterEach(() => {
    resetDefaultTokenEstimatorForTests();
  });

  const estimator = createHeuristicTokenEstimator();
  const registry = createDefaultAiRuntimeRegistry();
  const nvidiaModel = registry.getModelById(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B)!;

  it("returns non-negative input/output/total where total equals sum", () => {
    const estimate = estimator.estimate(sampleRequest());
    expect(estimate.estimatedInputTokens).toBeGreaterThanOrEqual(0);
    expect(estimate.estimatedOutputTokens).toBeGreaterThanOrEqual(0);
    expect(estimate.estimatedTotalTokens).toBe(
      estimate.estimatedInputTokens + estimate.estimatedOutputTokens,
    );
    expect(estimate.method).toBe("heuristic");
    expect(estimate.confidence).toBe("medium");
  });

  it("prefers expectedOutputTokens over workload default", () => {
    const withExpected = estimator.estimate(sampleRequest({ expectedOutputTokens: 900 }));
    const withDefault = estimator.estimate(sampleRequest());

    expect(withExpected.rawEstimatedOutputTokens).toBe(900);
    expect(withDefault.rawEstimatedOutputTokens).toBe(
      WORKLOAD_DEFAULT_OUTPUT_TOKENS.content_draft,
    );
    expect(withExpected.rawEstimatedOutputTokens).toBeLessThan(
      withDefault.rawEstimatedOutputTokens!,
    );
  });

  it("defines workload output defaults for every workload class", () => {
    for (const workload of WORKLOAD_CLASSES) {
      const estimate = estimator.estimate(sampleRequest({ workload, messages: [] }));
      expect(estimate.rawEstimatedOutputTokens).toBe(WORKLOAD_DEFAULT_OUTPUT_TOKENS[workload]);
    }
  });

  it("estimates Korean/non-ASCII text more conservatively than ASCII-only text", () => {
    const english = "Create a short marketing summary.";
    const korean = "이번 주 베트남 여행상품 마케팅 방향을 분석하고 콘텐츠 전략을 제안해줘.";

    expect(english.length).toBeGreaterThan(20);
    expect(Math.abs(english.length - korean.length)).toBeLessThanOrEqual(20);

    const englishEstimate = estimateTextTokens(english);
    const koreanEstimate = estimateTextTokens(korean);

    expect(countCharacters(korean).nonAsciiCharacters).toBeGreaterThan(0);
    expect(countCharacters(english).asciiCharacters).toBe(english.length);
    expect(koreanEstimate).toBeGreaterThanOrEqual(englishEstimate);
  });

  it("increases input estimate as message count grows", () => {
    const single = estimateInputTokensFromMessages([{ role: "user", content: "hello" }]);
    const multi = estimateInputTokensFromMessages([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "hello" },
      { role: "assistant", content: "Hi" },
    ]);
    expect(multi).toBeGreaterThan(single);
  });

  it("applies safety multiplier so adjusted >= raw", () => {
    const estimate = estimator.estimate(sampleRequest());
    expect(estimate.rawEstimatedInputTokens).toBeDefined();
    expect(estimate.rawEstimatedOutputTokens).toBeDefined();
    expect(estimate.estimatedInputTokens).toBeGreaterThanOrEqual(
      estimate.rawEstimatedInputTokens ?? 0,
    );
    expect(estimate.estimatedOutputTokens).toBeGreaterThanOrEqual(
      estimate.rawEstimatedOutputTokens ?? 0,
    );
    expect(applySafetyMultiplier(100, 1.2)).toBe(120);
  });

  it("includes model/provider ids when model is provided", () => {
    const estimate = estimator.estimate(sampleRequest(), nvidiaModel);
    expect(estimate.modelId).toBe(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B);
    expect(estimate.providerId).toBe(AI_PROVIDER_IDS.NVIDIA_MAIN);
  });

  it("checks context fit against registry contextTokens", () => {
    const small = estimator.estimate(
      sampleRequest({ messages: [{ role: "user", content: "hi" }] }),
      nvidiaModel,
    );
    const smallBudget = checkContextFit(small, nvidiaModel);
    expect(smallBudget.fitsContext).toBe(true);
    expect(smallBudget.contextLimit).toBe(131072);

    const hugeContent = "가".repeat(400_000);
    const huge = estimator.estimate(
      sampleRequest({ messages: [{ role: "user", content: hugeContent }] }),
      nvidiaModel,
    );
    const hugeBudget = checkContextFit(huge, nvidiaModel);
    expect(hugeBudget.fitsContext).toBe(false);
    expect(hugeBudget.remainingContextTokens).toBe(0);
  });

  it("treats unknown context window as fitsContext=true", () => {
    const geminiModel = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)!;
    const estimate = estimator.estimate(sampleRequest(), geminiModel);
    const budget = checkContextFit(estimate, geminiModel);
    expect(geminiModel.limits.contextTokens).toBeUndefined();
    expect(budget.fitsContext).toBe(true);
    expect(budget.contextLimit).toBeUndefined();
  });

  it("flags output exceeding known maxOutputTokens without clamping", () => {
    const modelWithCap = {
      ...nvidiaModel,
      limits: { ...nvidiaModel.limits, maxOutputTokens: 100 },
    };
    const estimate = estimator.estimate(sampleRequest(), modelWithCap);
    const output = checkOutputLimit(estimate, modelWithCap);
    expect(output.outputExceedsModelLimit).toBe(true);
    expect(output.maxOutputTokens).toBe(100);
    expect(estimate.estimatedOutputTokens).toBeGreaterThan(100);
  });

  it("returns unknown output limit when maxOutputTokens is undefined", () => {
    const estimate = estimator.estimate(sampleRequest(), nvidiaModel);
    const output = checkOutputLimit(estimate, nvidiaModel);
    expect(output.outputExceedsModelLimit).toBe(false);
    expect(output.maxOutputTokens).toBeUndefined();
  });

  it("calibrates estimate vs actual usage and skips when usageMissing", () => {
    const estimate = estimator.estimate(sampleRequest());
    const calibration = compareEstimateToUsage(
      estimate,
      { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
      false,
    );
    expect(calibration?.actualInputTokens).toBe(12);
    expect(calibration?.inputErrorRatio).toBeTypeOf("number");

    expect(
      compareEstimateToUsage(
        estimate,
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        true,
      ),
    ).toBeUndefined();
  });

  it("is deterministic for the same request and model", () => {
    const request = sampleRequest({
      messages: [
        { role: "system", content: "system prompt" },
        { role: "user", content: "deterministic check" },
      ],
    });
    const a = estimator.estimate(request, nvidiaModel);
    const b = estimator.estimate(request, nvidiaModel);
    expect(a).toEqual(b);
    expect(estimateRequestTokens(request, nvidiaModel)).toEqual(a);
  });

  it("handles edge cases safely", () => {
    expect(estimator.estimate(sampleRequest({ messages: [] })).estimatedInputTokens).toBe(0);

    const emptyContent = estimator.estimate(
      sampleRequest({ messages: [{ role: "user", content: "" }] }),
    );
    expect(emptyContent.estimatedInputTokens).toBeGreaterThanOrEqual(0);

    const systemOnly = estimator.estimate(
      sampleRequest({ messages: [{ role: "system", content: "rules" }] }),
    );
    expect(systemOnly.estimatedInputTokens).toBeGreaterThan(0);

    const toolMessage = estimator.estimate(
      sampleRequest({
        messages: [{ role: "tool", content: '{"result":"ok"}' }],
      }),
    );
    expect(toolMessage.estimatedInputTokens).toBeGreaterThan(
      estimateMessageTokens({ role: "user", content: '{"result":"ok"}' }),
    );

    const zeroOutput = estimator.estimate(sampleRequest({ expectedOutputTokens: 0 }));
    expect(zeroOutput.rawEstimatedOutputTokens).toBe(0);
    expect(zeroOutput.estimatedOutputTokens).toBe(0);

    const negativeOutput = estimator.estimate(sampleRequest({ expectedOutputTokens: -50 }));
    expect(negativeOutput.rawEstimatedOutputTokens).toBe(
      WORKLOAD_DEFAULT_OUTPUT_TOKENS.content_draft,
    );
  });
});
