/**
 * Naver Band Copy Writer surgical fix regressions (A–N).
 */

import { describe, expect, it } from "vitest";

import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import {
  NAVER_BAND_COPY_CONTRACT,
  NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/naverBandCopy/contracts";
import { NAVER_BAND_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBandCopy/hermesIdentity";

describe("naver band copy writer surgical fix", () => {
  it("A. discovery does not require perspective expansion", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).not.toMatch(
      /discovery: curiosity \/ concrete cultural detail \/ perspective expansion/i,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /curiosity \/ concrete cultural detail \/ documented contrast/i,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/A perspective shift is not required/i);
  });

  it("B. recommended shape no longer requires perspective-expanding takeaway", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).not.toMatch(
      /One perspective-expanding takeaway/i,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /C\. Concrete observation \/ documented difference \/ limitation/,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /does not need a lesson, insight, diversity takeaway, perspective shift/i,
    );
  });

  it("C. endingIntent=observation can end as observation", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/## Closing/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /If `endingIntent` = observation, the surface ending should remain an observation/i,
    );
  });

  it("D. concrete documented difference is valid ending", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /may end on a concrete documented difference, person, place, building, or limitation/i,
    );
  });

  it("E. limitation is valid ending", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /documented difference \/ limitation/,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/or limitation/i);
  });

  it("F. no diversity lesson required", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/diversity takeaway/i);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /Do not re-invent abstract reader outcomes[\s\S]*diversity lessons/i,
    );
  });

  it('G. no "good starting point" style reader transformation required', () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /rather than being upgraded into a lesson, takeaway, perspective shift, or "good starting point"/i,
    );
  });

  it("H. Narrative fields are semantic, not lexical templates", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/## Narrative lexical boundary/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /semantic sources, not wording templates/i,
    );
  });

  it("I. concrete-before-abstract Band Korean encouraged", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/## Natural Korean/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /Prefer concrete nouns and verbs before abstract editorial interpretation/i,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).not.toMatch(/건축적 맥락/);
  });

  it("J. title behavior unchanged", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /Title: reuse Canonical title or lightly shorten/i,
    );
  });

  it("K. no forced CTA behavior unchanged", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /mechanical comment\/save\/share CTA forbidden/i,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /informational commercialIntent: no sales CTA/i,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /engagementIntent \(metadata only/i,
    );
  });

  it("L. geo/evidence safety unchanged", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/남부/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /Use ONLY facts|never invent facts/i,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /Prefer concrete Canonical-supported factual subjects/i,
    );
  });

  it("M. no deterministic blacklist", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/not a banned-word list/i);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(
      /Do not apply deterministic substitutions/i,
    );
    expect(NAVER_BAND_COPY_WRITER_SOUL).not.toMatch(/blacklist:/i);
  });

  it("N. artifact schema unchanged + registry parity", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/"endingIntent": "observation"/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/"engagementIntent": null/);
    expect(NAVER_BAND_COPY_CONTRACT).toBe("naver-band-copy-v1");
    expect(NAVER_BAND_COPY_WRITER_HERMES_PROFILE).toBe("naver-band-copy-writer");

    const entry = requireMarketingAgentSemanticContract("naver-band-copy-writer");
    expect(entry.inputs.required).toEqual(
      expect.arrayContaining([
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ]),
    );
    const notes = entry.docs?.notes?.join("\n") ?? "";
    expect(notes).not.toMatch(/Phase 3D: lifecycle wired\. OWNS channel-native wording/);
    expect(notes).toMatch(/Concrete observation closing is valid/i);
    expect(notes).toMatch(/No mandatory perspective expansion/i);
    expect(notes).toMatch(/semantic progression/i);
  });
});
