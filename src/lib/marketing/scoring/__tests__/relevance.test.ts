import { describe, expect, it } from "vitest";
import { scoreRelevance } from "@/lib/marketing/scoring/scoreRelevance";
import {
  CAMPAIGN_ID,
  OTHER_PRODUCT_ID,
  PRODUCT_ID,
  candidate,
  contentItem,
  createContentRequest,
  product,
  publication,
} from "./fixtures";

describe("relevance scoring", () => {
  it("scores an exact product match higher than a mismatch", () => {
    const matched = scoreRelevance(candidate("product", product({ id: PRODUCT_ID })), createContentRequest);
    const mismatched = scoreRelevance(candidate("product", product({ id: OTHER_PRODUCT_ID })), createContentRequest);
    expect(matched).toBeGreaterThan(mismatched);
  });

  it("scores an exact channel match higher than a mismatch", () => {
    const matched = scoreRelevance(
      candidate("publications", publication({ channel: "threads" })),
      createContentRequest,
    );
    const mismatched = scoreRelevance(
      candidate("publications", publication({ channel: "kakao" })),
      createContentRequest,
    );
    expect(matched).toBeGreaterThan(mismatched);
  });

  it("scores a campaign match higher than a miss", () => {
    const matched = scoreRelevance(
      candidate("contentHistory", contentItem({ metadata: { campaignId: CAMPAIGN_ID } })),
      createContentRequest,
    );
    const mismatched = scoreRelevance(
      candidate("contentHistory", contentItem({ metadata: { campaignId: OTHER_PRODUCT_ID } })),
      createContentRequest,
    );
    expect(matched).toBeGreaterThan(mismatched);
  });

  it("does not penalize a missing productId when the request has no product filter", () => {
    const withProduct = scoreRelevance(candidate("publications", publication()), {
      purpose: "create_content",
    });
    const withOther = scoreRelevance(
      candidate("contentHistory", contentItem({ productId: OTHER_PRODUCT_ID })),
      { purpose: "create_content" },
    );
    expect(withProduct).toBeGreaterThan(0.4);
    expect(withOther).toBeGreaterThan(0.4);
  });

  it("prefers product over memory for create_content", () => {
    const productScore = scoreRelevance(candidate("product", product()), { purpose: "create_content" });
    const memoryScore = scoreRelevance(
      candidate("memory", {
        id: "m1",
        memoryType: "note",
        title: null,
        content: "x",
        sourceType: null,
        sourceId: null,
        importance: null,
        confidence: null,
        embeddingModel: null,
        createdAt: null,
        updatedAt: null,
        expiresAt: null,
      }),
      { purpose: "create_content" },
    );
    expect(productScore).toBeGreaterThan(memoryScore);
  });
});
