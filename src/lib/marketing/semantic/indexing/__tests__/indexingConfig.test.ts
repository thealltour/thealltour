import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH,
  resolveMarketingSemanticIndexingConfig,
} from "@/lib/marketing/semantic/indexing/indexingConfig";

/**
 * Regression: Number("") === 0 is finite and previously collapsed unset/blank
 * MARKETING_SEMANTIC_INDEX_MAX_BATCH to maxBatchSize=1.
 */
describe("resolveMarketingSemanticIndexingConfig maxBatchSize", () => {
  it("1. unset => DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH (8)", () => {
    const config = resolveMarketingSemanticIndexingConfig({});
    expect(DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH).toBe(8);
    expect(config.maxBatchSize).toBe(8);
    expect(config.maxBatchSize).toBe(DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH);
  });

  it('2. empty string "" => default 8', () => {
    expect(
      resolveMarketingSemanticIndexingConfig({
        MARKETING_SEMANTIC_INDEX_MAX_BATCH: "",
      }).maxBatchSize,
    ).toBe(8);
  });

  it('3. "4" => 4', () => {
    expect(
      resolveMarketingSemanticIndexingConfig({
        MARKETING_SEMANTIC_INDEX_MAX_BATCH: "4",
      }).maxBatchSize,
    ).toBe(4);
  });

  it('4. "999" => clamped to default maximum 8', () => {
    expect(
      resolveMarketingSemanticIndexingConfig({
        MARKETING_SEMANTIC_INDEX_MAX_BATCH: "999",
      }).maxBatchSize,
    ).toBe(8);
  });

  it('5. "0" => default 8', () => {
    expect(
      resolveMarketingSemanticIndexingConfig({
        MARKETING_SEMANTIC_INDEX_MAX_BATCH: "0",
      }).maxBatchSize,
    ).toBe(8);
  });

  it('6. "-1" => default 8', () => {
    expect(
      resolveMarketingSemanticIndexingConfig({
        MARKETING_SEMANTIC_INDEX_MAX_BATCH: "-1",
      }).maxBatchSize,
    ).toBe(8);
  });

  it('7. "abc" => default 8', () => {
    expect(
      resolveMarketingSemanticIndexingConfig({
        MARKETING_SEMANTIC_INDEX_MAX_BATCH: "abc",
      }).maxBatchSize,
    ).toBe(8);
  });

  it("also treats whitespace-only as unset (does not collapse to 1)", () => {
    expect(
      resolveMarketingSemanticIndexingConfig({
        MARKETING_SEMANTIC_INDEX_MAX_BATCH: "   ",
      }).maxBatchSize,
    ).toBe(8);
  });
});
