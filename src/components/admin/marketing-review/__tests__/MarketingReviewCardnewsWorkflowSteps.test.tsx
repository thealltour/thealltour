import { describe, expect, it } from "vitest";

import { deriveCardnewsWorkflowSteps } from "@/components/admin/marketing-review/MarketingReviewCardnewsWorkflowSteps";

type Astra = Parameters<typeof deriveCardnewsWorkflowSteps>[0]["astra"];

function astra(overrides: {
  plan?: "not_generated" | "fresh" | "stale";
  cardCopyOnly?: boolean;
  handoff?: "missing_handoff" | "ready";
  handoffStale?: boolean;
  uploadsComplete?: boolean;
}): Astra {
  return {
    plan: { status: overrides.plan ?? "not_generated" },
    planStaleFromCardCopyOnly: overrides.cardCopyOnly ?? false,
    cardCopyBlockReason: null,
    handoff: {
      status: overrides.handoff ?? "missing_handoff",
      handoffStale: overrides.handoffStale ?? false,
      uploadStatus: overrides.uploadsComplete === undefined ? null : { complete: overrides.uploadsComplete },
    },
  };
}

function states(input: Parameters<typeof deriveCardnewsWorkflowSteps>[0]): string[] {
  return deriveCardnewsWorkflowSteps(input).map((s) => s.state);
}

describe("deriveCardnewsWorkflowSteps", () => {
  it("points at the Canonical first and keeps research optional", () => {
    expect(states({ canonicalApproved: false, cardCopy: null, astra: null })).toEqual([
      "current",
      "optional",
      "todo",
      "todo",
      "todo",
      "todo",
      "todo",
      "todo",
    ]);
  });

  it("asks for the Instagram cardnews JSON once the Canonical is approved", () => {
    const steps = deriveCardnewsWorkflowSteps({
      canonicalApproved: true,
      cardCopy: { applicable: false, gateState: "not_applicable" },
      astra: astra({}),
    });
    expect(steps[2]).toMatchObject({ state: "current" });
    expect(steps[2]!.label).toContain("Instagram 카드뉴스 JSON");
  });

  it("moves to the card copy review, then SVP, after import and approval", () => {
    expect(
      states({ canonicalApproved: true, cardCopy: { applicable: true, gateState: "pending" }, astra: astra({}) })[3],
    ).toBe("current");
    expect(
      states({ canonicalApproved: true, cardCopy: { applicable: true, gateState: "approved" }, astra: astra({}) })[4],
    ).toBe("current");
  });

  it("treats a plan stale only from card copy text as usable and walks through handoff, upload, render", () => {
    const approved = { applicable: true, gateState: "approved" as const };
    expect(
      states({ canonicalApproved: true, cardCopy: approved, astra: astra({ plan: "stale", cardCopyOnly: true }) })[5],
    ).toBe("current");
    expect(
      states({
        canonicalApproved: true,
        cardCopy: approved,
        astra: astra({ plan: "fresh", handoff: "ready", uploadsComplete: false }),
      })[6],
    ).toBe("current");
    expect(
      states({
        canonicalApproved: true,
        cardCopy: approved,
        astra: astra({ plan: "fresh", handoff: "ready", uploadsComplete: true }),
      }),
    ).toEqual(["done", "optional", "done", "done", "done", "done", "done", "current"]);
  });

  it("does not count a stale handoff as done", () => {
    expect(
      states({
        canonicalApproved: true,
        cardCopy: { applicable: true, gateState: "approved" },
        astra: astra({ plan: "fresh", handoff: "ready", handoffStale: true }),
      })[5],
    ).toBe("current");
  });
});
