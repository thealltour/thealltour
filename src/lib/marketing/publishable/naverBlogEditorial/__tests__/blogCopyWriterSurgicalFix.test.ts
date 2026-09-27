/**
 * Naver Blog Copy Writer surgical fix regressions (A–M).
 */

import { describe, expect, it } from "vitest";

import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import { NAVER_BLOG_COPY_WRITER_HERMES_PROFILE } from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { NAVER_BLOG_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";

describe("naver blog copy writer surgical fix", () => {
  it("A. openingIntent is not copied verbatim", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /openingIntent` and `conclusionIntent` are semantic planning guidance, not wording templates/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Do not paste or lightly paraphrase `openingIntent`/i,
    );
  });

  it("B. conclusionIntent is not copied verbatim", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Do not paste or lightly paraphrase[\s\S]*`conclusionIntent`/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /not wording templates/i,
    );
  });

  it("C. Narrative beat.message is not treated as surface phrase", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /beat\.message` are semantic progression sources, not surface phrasing/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Do not paste or lightly paraphrase[\s\S]*`beat\.message`/i,
    );
  });

  it("D. concrete section content may stand without abstract synthesis", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Do not add abstract editorial synthesis when the section's concrete content already lands/i,
    );
  });

  it("E. limitation may be the actual ending", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /concrete observation, documented difference, limitation, or open question is sufficient/i,
    );
  });

  it("F. no perspective/criterion payoff required", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).not.toMatch(/perspective \/ limitation ok/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Do not manufacture a perspective shift, awareness gain, insight, criterion, or planning value/i,
    );
  });

  it("G. natural Korean direct clauses preferred", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/## Natural Korean/);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Prefer direct clauses and concrete nouns\/verbs/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /not translated editorial English/i,
    );
  });

  it("H. long nominalized/translationese patterns discouraged", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/## Anti-translationese/);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/long nominalized subjects/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/abstract noun chains/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /repeated meta-verbs about showing, revealing, expanding, recognizing/i,
    );
  });

  it("I. headings preserved", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Structure headings define the section subject\/order and should normally be preserved/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /markdown headings matching the structure plan order/i,
    );
  });

  it("J. targetDepth behavior preserved", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /enough depth for its targetDepth \(brief\/standard\/deep\)/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /compress\/expand prose within each planned section/i,
    );
  });

  it("K. evidence/geo safety unchanged", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/남부 프레임/);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/Canonical = factual\/evidence/);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/no unsupported cultural claims/i);
  });

  it("L. ctaIntent behavior unchanged", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/follow structure ctaIntent/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/informational discovery → non-sales closing/i);
  });

  it("M. no blacklist/deterministic replacement + registry parity", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/not a banned-word list/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/Do not apply deterministic substitutions/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).not.toMatch(/blacklist:/i);
    expect(NAVER_BLOG_COPY_WRITER_HERMES_PROFILE).toBe("naver-blog-copy-writer");

    const entry = requireMarketingAgentSemanticContract("naver-blog-copy-writer");
    expect(entry.inputs.required).toEqual(
      expect.arrayContaining([
        "naverBlog.structure",
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ]),
    );
    const notes = entry.docs?.notes?.join("\n") ?? "";
    expect(notes).not.toMatch(/Phase 3D: lifecycle wired; Structure order authority preserved/);
    expect(notes).toMatch(/final Blog Markdown surface Korean/i);
    expect(notes).toMatch(/semantic planning guidance, not wording templates/i);
    expect(notes).toMatch(/Concrete closing valid/i);
  });
});
