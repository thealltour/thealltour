/**
 * Instagram Carousel Planner surgical fix regressions (A–K).
 */

import { describe, expect, it } from "vitest";

import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import { buildInstagramCardCopyWriterPayload } from "@/lib/marketing/publishable/instagramEditorial/cardCopyPrompt";
import { INSTAGRAM_CAROUSEL_ROLES } from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { INSTAGRAM_CAROUSEL_PLANNER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type { InstagramCarouselPlan } from "@/lib/marketing/publishable/instagramEditorial/contracts";

describe("carousel planner surgical fix regressions", () => {
  it("A. no new-perspective requirement", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).not.toMatch(
      /new info, new specificity, or new perspective/,
    );
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /A new abstract perspective is not required/i,
    );
  });

  it("B. evidence/contrast can advance story", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /new information[\s\S]*new specificity, evidence, or contrast/i,
    );
  });

  it("C. closing may be concrete recap", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /closing may simply return to a person, place, building/i,
    );
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(/concrete resolution/i);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).not.toMatch(/memorable payoff/i);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).not.toMatch(
      /Closing is story payoff \(meaning\)/i,
    );
  });

  it("D. no criterion/insight payoff required", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /does not need to manufacture a new meaning, perspective[\s\S]*criterion, insight/i,
    );
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /A concrete recap[\s\S]*is sufficient/i,
    );
  });

  it('E. Narrative "비교 기준" need not surface in communicationGoal', () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /Do not paste or compress Narrative payoff\/takeaway wording directly/i,
    );
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /semantic sources, not wording templates/i,
    );
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /use as a criterion/i,
    );
  });

  it("F. Narrative meaning preserved (semantic sources still used)", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /Narrative beat\.message \/ audienceTakeaway \/ narrativePromise are[\s\S]*semantic sources/i,
    );
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(/semantic intent/i);
  });

  it("G. Korean communicationGoal still valid (not English-only)", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).not.toMatch(/English-only|must write communicationGoal in English/i);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(/communicationGoal/);
  });

  it("H. Card Copy payload shape unchanged (communicationGoal still supplied)", () => {
    const narrative = {
      contract: "editorial-narrative-plan-v1",
      assetId: "cma",
      assetVersion: 1,
      editorialArchetype: "discovery",
      narrativePromise: "비교하는 기준을 제공한다",
      audienceTakeaway: "비교 관점",
      beats: [{ beatId: "beat_01", purpose: "hook", message: "해변" }],
      sourceCanonicalFingerprint: "fp",
      provenance: {
        sourceAssetId: "cma",
        sourceVersion: 1,
        modelProfile: "x",
        generatedAt: "2026-09-26T00:00:00.000Z",
      },
    } as EditorialNarrativePlan;
    const carousel = {
      contract: "instagram-carousel-plan-v1",
      assetId: "cma",
      assetVersion: 1,
      cards: [
        {
          cardId: "card-01",
          role: "hook_cover",
          beatIds: ["beat_01"],
          communicationGoal: "익숙한 해변 환기",
          visualPriority: "hero",
        },
      ],
      sourceNarrativeFingerprint: "fpn",
      provenance: {
        sourceAssetId: "cma",
        sourceVersion: 1,
        modelProfile: "instagram-carousel-planner",
        generatedAt: "2026-09-26T00:00:00.000Z",
      },
    } as InstagramCarouselPlan;
    const payload = buildInstagramCardCopyWriterPayload({
      narrative,
      carousel,
      canonicalAsset: {
        assetId: "cma",
        titleKo: "t",
        openingHookKo: null,
        bodyKo: null,
        keyTakeawaysKo: null,
        supportedClaimBoundaryKo: null,
        forbiddenClaimsKo: null,
      },
    });
    const cards = payload.cards as Array<{
      communicationGoal: string;
      communicationGoalAuthority: string;
    }>;
    expect(cards[0]?.communicationGoal).toBe("익숙한 해변 환기");
    expect(cards[0]?.communicationGoalAuthority).toBe("semantic_intent_only");
    expect(payload).toHaveProperty("instagramCarouselPlan");
  });

  it("I. roles/count/beatIds unchanged", () => {
    expect(INSTAGRAM_CAROUSEL_ROLES).toEqual(
      expect.arrayContaining([
        "hook_cover",
        "reframe",
        "context",
        "evidence",
        "closing",
        "cta",
      ]),
    );
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(/card-01, card-02/);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(/which beatIds map to each card/);
  });

  it("J. no blacklist", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(/not a banned-word list/i);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).not.toMatch(/banned words?:/i);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).not.toMatch(/blacklist:/i);
  });

  it("K. evidence authority unchanged + registry notes", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(/You do NOT write headline\/body/i);
    const entry = requireMarketingAgentSemanticContract("instagram-carousel-planner");
    expect(entry.docs?.notes?.join("\n") ?? "").toMatch(/short concrete semantic job/i);
    expect(entry.docs?.notes?.join("\n") ?? "").toMatch(/concrete resolution\/recap/i);
    expect(entry.docs?.notes?.join("\n") ?? "").toMatch(
      /Do not paste Narrative payoff\/takeaway\/promise/i,
    );
  });
});
