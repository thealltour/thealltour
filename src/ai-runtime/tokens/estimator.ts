import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { TokenEstimate, TokenEstimator } from "@/ai-runtime/tokens/types";
import {
  DEFAULT_SAFETY_MULTIPLIER,
  resolveModelSafetyMultiplier,
  resolveProviderSafetyMultiplier,
} from "@/ai-runtime/tokens/constants";
import {
  applySafetyMultiplier,
  estimateInputTokensFromMessages,
  resolveRawOutputTokens,
} from "@/ai-runtime/tokens/heuristic-estimator";

export type HeuristicTokenEstimatorOptions = {
  safetyMultiplier?: number;
};

export class HeuristicTokenEstimator implements TokenEstimator {
  private readonly safetyMultiplier: number;

  constructor(options: HeuristicTokenEstimatorOptions = {}) {
    this.safetyMultiplier = options.safetyMultiplier ?? DEFAULT_SAFETY_MULTIPLIER;
  }

  estimate(request: RuntimeRequest, model?: ModelDefinition): TokenEstimate {
    const rawEstimatedInputTokens = estimateInputTokensFromMessages(request.messages ?? []);
    const rawEstimatedOutputTokens = resolveRawOutputTokens(
      request.workload,
      request.expectedOutputTokens,
    );

    const providerMultiplier = resolveProviderSafetyMultiplier(model?.providerId);
    const modelMultiplier = resolveModelSafetyMultiplier(model?.id);
    const combinedMultiplier = this.safetyMultiplier * providerMultiplier * modelMultiplier;

    const estimatedInputTokens = applySafetyMultiplier(rawEstimatedInputTokens, combinedMultiplier);
    const estimatedOutputTokens = applySafetyMultiplier(rawEstimatedOutputTokens, combinedMultiplier);

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
      safetyMultiplier: combinedMultiplier,
      rawEstimatedInputTokens,
      rawEstimatedOutputTokens,
      confidence: "medium",
      method: "heuristic",
      modelId: model?.id,
      providerId: model?.providerId,
    };
  }
}

export function createHeuristicTokenEstimator(
  options?: HeuristicTokenEstimatorOptions,
): HeuristicTokenEstimator {
  return new HeuristicTokenEstimator(options);
}

/** Default process-wide heuristic estimator (stateless, pure). */
let defaultEstimator: HeuristicTokenEstimator | null = null;

export function getDefaultTokenEstimator(): HeuristicTokenEstimator {
  if (!defaultEstimator) {
    defaultEstimator = createHeuristicTokenEstimator();
  }
  return defaultEstimator;
}

export function resetDefaultTokenEstimatorForTests(): void {
  defaultEstimator = null;
}

export function estimateRequestTokens(
  request: RuntimeRequest,
  model?: ModelDefinition,
): TokenEstimate {
  return getDefaultTokenEstimator().estimate(request, model);
}
