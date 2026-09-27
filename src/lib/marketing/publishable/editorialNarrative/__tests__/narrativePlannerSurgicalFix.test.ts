/**
 * Editorial Narrative Planner surgical fix regressions (A–O).
 */

import { describe, expect, it } from "vitest";

import { PLANNER_VOCABULARY_BOUNDARY_INVARIANTS } from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";
import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import {
  EDITORIAL_NARRATIVE_PLAN_CONTRACT,
  EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { EDITORIAL_NARRATIVE_PLANNER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";

describe("editorial narrative planner surgical fix", () => {
  it("A. Narrative remains channel-agnostic", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/channel-agnostic/i);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /NOT writing for any single channel/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE).toBe("editorial-narrative-planner");
  });

  it("B. Canonical remains factual authority", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Use ONLY facts present in Canonical \/ evidence context/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/No new facts/);
    const entry = requireMarketingAgentSemanticContract("editorial-narrative-planner");
    expect(entry.inputs.required).toContain("canonical.factualBoundary");
  });

  it("C. narrativePromise need not state reader benefit", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/## narrativePromise/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Do not phrase `narrativePromise` as a benefit the reader gains/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).not.toMatch(
      /must describe \*what the reader should understand\*/i,
    );
  });

  it("D. audienceTakeaway need not state awareness/perspective gain", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/## audienceTakeaway/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /not a required reader-transformation sentence/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Do not invent abstract outcomes such as:[\s\S]*awareness gain[\s\S]*diversity recognition/i,
    );
  });

  it("E. payoff may be documented contrast", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /a concrete documented difference/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /a contrast already demonstrated by the beats/i,
    );
  });

  it("F. payoff may be limitation/open curiosity", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/an evidence limitation/i);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/unresolved curiosity/i);
  });

  it("G. contrast archetype may end on concrete contrast", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /For contrast archetypes especially: concrete contrast itself can be the resolution/i,
    );
  });

  it("H. beat.message may be short semantic label", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/## beat\.message/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /beat\.message` should be short semantic planning language/i,
    );
  });

  it("I. no polished consumer-copy requirement", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Do not write `beat\.message` as polished reader-facing Korean/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Do not turn these fields into polished consumer-facing conclusions/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /NOT the final consumer copywriter/i,
    );
  });

  it("J. Canonical concrete fact is not automatically abstracted", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /## Canonical → Narrative abstraction guard/,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /must not automatically convert these into diversity awareness/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Preserve the concrete semantic distinction instead/i,
    );
  });

  it("K. no deterministic blacklist", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toContain(
      PLANNER_VOCABULARY_BOUNDARY_INVARIANTS.noBlacklist,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/not a lexical blacklist/i);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /not a deterministic phrase filter/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).not.toMatch(/blacklist:/i);
  });

  it("L. internal structural terms still allowed", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toContain(
      PLANNER_VOCABULARY_BOUNDARY_INVARIANTS.noBlacklist,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /frame\/reframe\/payoff\/context may remain as structural labels/i,
    );
  });

  it("M. downstream artifact shape unchanged", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/"narrativePromise": "string"/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/"audienceTakeaway": "string"/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/"beatId": "beat_01"/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/"purpose": "hook"/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/"message": "string"/);
    expect(EDITORIAL_NARRATIVE_PLAN_CONTRACT).toBe("editorial-narrative-plan-v1");
  });

  it("N. story progression remains intact", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /hook → familiar_frame → reframe → context → evidence\/detail → payoff\/closing/,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/Progression remains flexible/i);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Beat IDs must be stable and unique: beat_01, beat_02/i,
    );
  });

  it("O. evidence safety unchanged + registry notes", () => {
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(/No new facts/);
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Do not invent tourism hype/i,
    );
    expect(EDITORIAL_NARRATIVE_PLANNER_SOUL).toMatch(
      /Downstream rewriting is not a substitute for good upstream semantic representation/i,
    );
    const entry = requireMarketingAgentSemanticContract("editorial-narrative-planner");
    const notes = entry.docs?.notes?.join("\n") ?? "";
    expect(notes).toMatch(/semantic planning fields/i);
    expect(notes).toMatch(/concrete resolution/i);
    expect(notes).toMatch(/No mandatory perspective\/criterion\/awareness/i);
    expect(notes).toMatch(/Canonical-only facts required/i);
    expect(notes).toMatch(
      /VOCABULARY BOUNDARY: planner fields \(narrativePromise, beat\.message, communicationGoal\)/i,
    );
  });
});
