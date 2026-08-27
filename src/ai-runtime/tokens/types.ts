import type { ModelDefinition } from "@/ai-runtime/domain/model";

export type TokenEstimateConfidence = "low" | "medium" | "high";

export type TokenEstimateMethod = "heuristic" | "provider_tokenizer" | "historical_adjusted";

export interface TokenEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  safetyMultiplier: number;
  rawEstimatedInputTokens?: number;
  rawEstimatedOutputTokens?: number;
  confidence: TokenEstimateConfidence;
  method: TokenEstimateMethod;
  modelId?: string;
  providerId?: string;
}

export interface TokenBudgetCheck {
  fitsContext: boolean;
  estimatedTotalTokens: number;
  contextLimit?: number;
  remainingContextTokens?: number;
  outputExceedsModelLimit: boolean;
  maxOutputTokens?: number;
}

export interface TokenEstimateCalibration {
  estimatedInputTokens: number;
  actualInputTokens?: number;
  estimatedOutputTokens: number;
  actualOutputTokens?: number;
  inputErrorRatio?: number;
  outputErrorRatio?: number;
  totalErrorRatio?: number;
}

/** Placeholder for future historical calibration — not used in 2-5.2B. */
export interface TokenEstimationAdjustment {
  multiplier: number;
  source: "static" | "historical";
}

export interface CharacterBreakdown {
  asciiCharacters: number;
  nonAsciiCharacters: number;
}

export interface TokenEstimator {
  estimate(request: import("@/ai-runtime/domain/request").RuntimeRequest, model?: ModelDefinition): TokenEstimate;
}
