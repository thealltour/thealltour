/**
 * Marketing Planner Vocabulary Boundary — critical prompt invariants.
 * Narrative / Carousel planners: internal planning vocab ≠ consumer surface wording.
 */
import { describe, expect, it } from "vitest";

import {
  PLANNER_VOCABULARY_BOUNDARY_INVARIANTS,
  PLANNER_VOCABULARY_BOUNDARY_SEMANTIC_NOTES,
} from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";
import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import {
  EDITORIAL_NARRATIVE_PLANNER_SOUL,
  INSTAGRAM_CARD_COPY_WRITER_SOUL,
  INSTAGRAM_CAROUSEL_PLANNER_SOUL,
} from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";

const V = PLANNER_VOCABULARY_BOUNDARY_INVARIANTS;

describe("Planner Vocabulary Boundary", () => {
  it("A: Narrative SOUL embeds all critical vocabulary-boundary invariants", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toContain(V.title);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toContain(V.notSurfaceCopy);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toContain(V.downstreamMustRewrite);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toContain(V.doNotPretendConsumer);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toContain(V.noBlacklist);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toContain(V.highRiskFields);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/narrativePromise/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/NOT the final consumer copywriter/i);
  });

  it("B: Carousel SOUL embeds all critical vocabulary-boundary invariants", () => {
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toContain(V.title);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toContain(V.notSurfaceCopy);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toContain(V.downstreamMustRewrite);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toContain(V.doNotPretendConsumer);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toContain(V.noBlacklist);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toContain(V.highRiskFields);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(/communicationGoal/);
    expect(INSTAGRAM_CAROUSEL_PLANNER_SOUL).toMatch(
      /not draft a headline\/body for Card Copy to keep word-for-word/i,
    );
  });

  it("C: high-risk fields named as non-lexical-anchors (promise / message / goal)", () => {
    for (const soul of [EDITORIAL_NARRATIVE_PLANNER_SOUL, INSTAGRAM_CAROUSEL_PLANNER_SOUL]) {
      expect(soul).toMatch(/narrativePromise/);
      expect(soul).toMatch(/beat\.message|payoff\/closing/);
      expect(soul).toMatch(/communicationGoal/);
      expect(soul).toMatch(/lexical seed|lexical-anchor/i);
      expect(soul).toMatch(/NOT consumer-facing copy/i);
    }
  });

  it("D: semantic registry notes document boundary for Narrative + Carousel + Card Copy reader", () => {
    const narrative = requireMarketingAgentSemanticContract("editorial-narrative-planner");
    const carousel = requireMarketingAgentSemanticContract("instagram-carousel-planner");
    const cardCopy = requireMarketingAgentSemanticContract("instagram-card-copy-writer");

    for (const note of PLANNER_VOCABULARY_BOUNDARY_SEMANTIC_NOTES) {
      expect(narrative.docs?.notes).toContain(note);
      expect(carousel.docs?.notes).toContain(note);
    }
    expect(carousel.docs?.notes?.some((n) => n.includes("communicationGoal"))).toBe(true);
    expect(cardCopy.docs?.notes?.some((n) => /lexical copy seed|semantic instructions/i.test(n))).toBe(
      true,
    );
  });

  it("E: not a blacklist — frame/rhythm/payoff remain allowed; no banned-word list language", () => {
    expect(V.noBlacklist).toMatch(/not a banned-word list/i);
    expect(V.noBlacklist).toMatch(/frame/);
    expect(V.noBlacklist).toMatch(/rhythm/);
    expect(V.noBlacklist).toMatch(/payoff/);
    for (const soul of [EDITORIAL_NARRATIVE_PLANNER_SOUL, INSTAGRAM_CAROUSEL_PLANNER_SOUL]) {
      expect(soul).toContain(V.noBlacklist);
      expect(soul).not.toMatch(/banned words?:/i);
      expect(soul).not.toMatch(/replace\s+.+\s+with/i);
    }
  });

  it("F: Card Copy SOUL unchanged by this boundary PR (no SOUL rewrite here)", () => {
    // Boundary is enforced on planner side + registry note; Card Copy SOUL is out of scope.
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).not.toContain(V.title);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/SNS carousel copy specialist/i);
  });
});
