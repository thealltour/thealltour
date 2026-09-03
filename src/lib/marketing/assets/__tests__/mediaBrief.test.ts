import { describe, expect, it } from "vitest";

import { buildMediaBriefFromCandidate, parseMediaBrief } from "@/lib/marketing/assets";
import { MEDIA_BRIEF_CONTRACT } from "@/lib/marketing/assets/contracts";
import { buildAssignment, buildContentPlan, buildDraft, buildTestCandidate, officialEvidence } from "@/lib/marketing/assets/__tests__/fixtures";

function containsKey(value: unknown, key: string): boolean {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsKey(item, key));
  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, key)) return true;
  return Object.values(record).some((nested) => containsKey(nested, key));
}

describe("MediaBrief v1", () => {
  it("14. validates the media-brief-v1 contract", () => {
    const brief = buildMediaBriefFromCandidate(buildTestCandidate());
    expect(brief.contract).toBe(MEDIA_BRIEF_CONTRACT);
    expect(parseMediaBrief(brief).candidateId).toBe(brief.candidateId);
    expect(() => parseMediaBrief({ ...brief, contract: "media-brief-v0" })).toThrow(/media-brief-v1/);
  });

  it("15. maps a candidate to MediaBrief deterministically", () => {
    const candidate = buildTestCandidate();
    expect(buildMediaBriefFromCandidate(candidate)).toEqual(buildMediaBriefFromCandidate(candidate));
  });

  it("16. handles absent optional candidate context conservatively", () => {
    const brief = buildMediaBriefFromCandidate(
      buildTestCandidate({
        contentPlan: null,
        governanceDecision: null,
        contentAssignment: buildAssignment({
          audience: null,
          facts: [],
          evidenceRefs: [],
          formatHints: [],
        }),
        draft: buildDraft({ title: null, sourceReferences: [] }),
        provenance: {
          routineId: "daily-marketing-plan",
          correlationId: "corr_test",
          researchStatus: null,
          governanceReviewId: null,
        },
      }),
    );
    expect(brief.audience).toBeNull();
    expect(brief.factualClaims).toEqual([]);
    expect(brief.evidenceRefs).toEqual([]);
    expect(brief.cta).toBeNull();
    expect(brief.formats.cardnews.enabled).toBe(false);
    expect(brief.formats.cardnews.cards).toEqual([]);
    expect(brief.formats.shortform.enabled).toBe(false);
    expect(brief.formats.shortform.narrationSegments).toEqual([]);
    expect(brief.formats.text.enabled).toBe(true);
  });

  it("17. preserves factual evidence linkage from assignment facts", () => {
    const brief = buildMediaBriefFromCandidate(buildTestCandidate());
    expect(brief.factualClaims[0]?.evidenceRefs).toEqual(["ev-official"]);
    expect(brief.evidenceRefs.map((ref) => ref.evidenceId)).toEqual(["ev-official"]);
    expect(brief.evidenceRefs[0]?.url).toBe(officialEvidence.url);
    expect(brief.provenance.evidenceRefIds).toEqual(["ev-official"]);
  });

  it("18. does not fabricate evidence linkage", () => {
    const brief = buildMediaBriefFromCandidate(
      buildTestCandidate({
        contentAssignment: buildAssignment({
          facts: [
            {
              factId: "summary",
              statement: "Official guidance changed for autumn travelers.",
              evidenceRefs: ["ev-official", "ev-invented"],
              confidence: "high",
            },
          ],
        }),
        contentPlan: buildContentPlan({ evidenceRefs: [] }),
      }),
    );
    expect(brief.factualClaims[0]?.evidenceRefs).toEqual(["ev-official"]);
    expect(brief.evidenceRefs.some((ref) => ref.evidenceId === "ev-invented")).toBe(false);
    expect(brief.formats.cardnews.cards.every((card) => card.evidenceRefs.length === 0)).toBe(true);
    expect(brief.formats.shortform.narrationSegments.every((segment) => segment.evidenceRefs.length === 0)).toBe(
      true,
    );
  });

  it("19. CardNews brief has no rendered asset dependency", () => {
    const brief = buildMediaBriefFromCandidate(buildTestCandidate());
    expect(brief.formats.cardnews.enabled).toBe(true);
    expect(brief.formats.cardnews.aspectRatio).toBe("4:5");
    expect(brief.formats.cardnews.cards.some((card) => card.role === "cover")).toBe(true);
    expect(brief.formats.cardnews.cards.some((card) => card.role === "information")).toBe(true);
    expect(brief.formats.cardnews.cards.some((card) => card.role === "cta")).toBe(true);
    const serialized = JSON.stringify(brief.formats.cardnews);
    expect(serialized).not.toMatch(/\.png|\.jpg|\.webp|image\/png|rendered/i);
  });

  it("20. Shortform brief has narration segments but no final timeline", () => {
    const brief = buildMediaBriefFromCandidate(buildTestCandidate());
    expect(brief.formats.shortform.enabled).toBe(true);
    expect(brief.formats.shortform.orientation).toBe("vertical");
    expect(brief.formats.shortform.narrationSegments.length).toBeGreaterThan(0);
    expect(brief.formats.shortform.targetDurationRange).toBeNull();
    expect(containsKey(brief.formats.shortform, "startMs")).toBe(false);
    expect(containsKey(brief.formats.shortform, "endMs")).toBe(false);
  });

  it("21. TTS final timing is absent before TTS generation", () => {
    const brief = buildMediaBriefFromCandidate(buildTestCandidate());
    expect(containsKey(brief, "startMs")).toBe(false);
    expect(containsKey(brief, "endMs")).toBe(false);
    expect(() =>
      parseMediaBrief({
        ...brief,
        formats: {
          ...brief.formats,
          shortform: {
            ...brief.formats.shortform,
            narrationSegments: [
              {
                ...brief.formats.shortform.narrationSegments[0],
                startMs: 0,
                endMs: 1200,
              },
            ],
          },
        },
      }),
    ).toThrow(/media-brief-v1/);
  });
});
