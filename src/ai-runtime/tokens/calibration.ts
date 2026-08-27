import type { TokenUsage } from "@/ai-runtime/domain/usage";
import type { TokenEstimate, TokenEstimateCalibration } from "@/ai-runtime/tokens/types";

function errorRatio(estimated: number, actual: number): number | undefined {
  if (actual <= 0) return estimated > 0 ? 1 : 0;
  return (estimated - actual) / actual;
}

/**
 * Compares a pre-call estimate to post-call usage for future calibration.
 * Returns undefined when usage is missing — never fabricate error ratios.
 */
export function compareEstimateToUsage(
  estimate: TokenEstimate,
  usage: TokenUsage,
  usageMissing: boolean,
): TokenEstimateCalibration | undefined {
  if (usageMissing) return undefined;

  const actualInputTokens = usage.inputTokens;
  const actualOutputTokens = usage.outputTokens;
  const actualTotal = usage.totalTokens ?? actualInputTokens + actualOutputTokens;

  const inputErrorRatio = errorRatio(estimate.estimatedInputTokens, actualInputTokens);
  const outputErrorRatio = errorRatio(estimate.estimatedOutputTokens, actualOutputTokens);
  const totalErrorRatio = errorRatio(estimate.estimatedTotalTokens, actualTotal);

  return {
    estimatedInputTokens: estimate.estimatedInputTokens,
    actualInputTokens,
    estimatedOutputTokens: estimate.estimatedOutputTokens,
    actualOutputTokens,
    inputErrorRatio,
    outputErrorRatio,
    totalErrorRatio,
  };
}
