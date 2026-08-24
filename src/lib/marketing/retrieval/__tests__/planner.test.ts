import { describe, expect, it } from "vitest";
import { buildRetrievalPlan, defaultSourcesForPurpose } from "@/lib/marketing/retrieval/planner";

describe("buildRetrievalPlan", () => {
  it("selects create_content sources", () => {
    const plan = buildRetrievalPlan({ purpose: "create_content" });
    expect(plan.sources).toEqual([
      "product",
      "customerInsights",
      "contentHistory",
      "publications",
      "memory",
    ]);
    expect(plan.sources).not.toContain("performance");
    expect(plan.sources).not.toContain("bookings");
  });

  it("maps create_content alias to create_content sources", () => {
    expect(defaultSourcesForPurpose("create_content")).toEqual(defaultSourcesForPurpose("create_content"));
    expect(buildRetrievalPlan({ purpose: "create_content" }).sources).toEqual(
      buildRetrievalPlan({ purpose: "create_content" }).sources,
    );
  });

  it("selects analyze_performance sources", () => {
    const plan = buildRetrievalPlan({ purpose: "analyze_performance" });
    expect(plan.sources).toEqual([
      "customerInsights",
      "bookings",
      "reviews",
      "publications",
      "performance",
    ]);
    expect(plan.sources).not.toContain("product");
    expect(plan.sources).not.toContain("memory");
  });

  it("selects governance_check sources", () => {
    const plan = buildRetrievalPlan({ purpose: "governance_check" });
    expect(plan.sources).toEqual(["contentHistory", "publications", "memory", "agendas"]);
    expect(plan.sources).not.toContain("bookings");
    expect(plan.sources).not.toContain("performance");
  });

  it("selects trend_analysis sources", () => {
    const plan = buildRetrievalPlan({ purpose: "trend_analysis" });
    expect(plan.sources).toEqual(["customerInsights", "performance", "memory"]);
    expect(plan.sources).not.toContain("publications");
  });

  it("does not fetch every source for an unknown purpose", () => {
    const plan = buildRetrievalPlan({ purpose: "custom_agent" });
    expect(plan.sources).toEqual([]);
  });

  it("honors include flags over purpose defaults", () => {
    const plan = buildRetrievalPlan({
      purpose: "create_content",
      includePerformance: true,
      includeMemory: false,
    });
    expect(plan.sources).toContain("performance");
    expect(plan.sources).not.toContain("memory");
  });
});
