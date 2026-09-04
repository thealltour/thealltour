vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { buildAssignmentFacts, normalizeFactStatement } from "@/lib/marketing/content/evidence";
import type { AssignmentEvidenceRef } from "@/lib/marketing/content/types";

function ref(id: string, excerpt: string): AssignmentEvidenceRef {
  return {
    evidenceId: id,
    sourceId: `src-${id}`,
    sourceType: "news",
    sourceName: "Press",
    isOfficial: false,
    evidenceType: "article",
    url: `https://example.com/${id}`,
    reference: null,
    excerpt,
    publishedAt: "2026-09-01T00:00:00.000Z",
    observedAt: "2026-09-04T00:00:00.000Z",
    credibilityHint: 0.7,
  };
}

describe("buildAssignmentFacts deduplication", () => {
  it("normalizes surrounding and internal whitespace", () => {
    expect(normalizeFactStatement("  Gleneagles   remains   open  ")).toBe("Gleneagles remains open");
  });

  it("Gleneagles regression: summary == repeated excerpts → one factual statement", () => {
    const statement =
      "Gleneagles remains a top Scotland golf destination for overseas travelers.";
    const evidence = [
      ref("ev-1", statement),
      ref("ev-2", `  ${statement}  `),
      ref("ev-3", statement.replace("  ", " ")),
    ];
    const facts = buildAssignmentFacts(evidence, statement);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.statement).toBe(statement);
    expect(facts[0]?.evidenceRefs.sort()).toEqual(["ev-1", "ev-2", "ev-3"].sort());
    expect(facts[0]?.factId).toBe("summary");
  });

  it("keeps distinct factual claims that share one evidence source", () => {
    const shared = ref("ev-shared", "Course renovations finished in spring.");
    const facts = buildAssignmentFacts(
      [shared],
      "Gleneagles stays open year-round for visitors.",
    );
    expect(facts).toHaveLength(2);
    expect(facts.map((f) => f.statement).sort()).toEqual(
      [
        "Course renovations finished in spring.",
        "Gleneagles stays open year-round for visitors.",
      ].sort(),
    );
    expect(facts.find((f) => f.factId === "summary")?.evidenceRefs).toContain("ev-shared");
  });

  it("does not drop valid multi-evidence associations when merging duplicates", () => {
    const a = ref("ev-a", "Same claim text.");
    const b = ref("ev-b", "Same claim text.");
    const facts = buildAssignmentFacts([a, b], "Different summary claim.");
    expect(facts).toHaveLength(2);
    const merged = facts.find((f) => f.statement === "Same claim text.");
    expect(merged?.evidenceRefs.sort()).toEqual(["ev-a", "ev-b"]);
  });
});
