export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
}

export interface CostUsage {
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
  currency?: "USD";
}
