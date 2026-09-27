/**
 * Naver Blog Copy Writer — second surgical fix regressions (A–J).
 * Keeps first-fix authority/lexical-boundary coverage via G.
 */

import { describe, expect, it } from "vitest";

import { NAVER_BLOG_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";

describe("naver blog copy writer second surgical fix", () => {
  it("A. targetDepth does not authorize new facts", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /targetDepth` controls explanatory depth, not factual expansion/i,
    );
  });

  it("B. unsupported material comparison is not added", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /material comparisons not stated in Canonical/i,
    );
  });

  it("C. unsupported environmental-adaptation inference is not added", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/environmental adaptation claims/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Do not infer why the housing exists, why a material was chosen, how residents adapted/i,
    );
  });

  it("D. unsupported popularity claim is not added", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/popularity\/frequency claims/i);
  });

  it("E. concrete paragraph may end without significance synthesis", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /you do not need to add a sentence explaining what it symbolizes, proves, expands, changes, or becomes a criterion for/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Do not manufacture editorial significance merely to complete a paragraph/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /A Blog paragraph may end on the concrete information it just established/i,
    );
  });

  it("F. limitation may remain final paragraph", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /concrete observation, documented difference, limitation, or open question is sufficient/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/## Paragraph endings/);
  });

  it("G. previous authority/lexical-boundary rules remain", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /openingIntent` and `conclusionIntent` are semantic planning guidance, not wording templates/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Do not paste or lightly paraphrase `openingIntent`/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /beat\.message` are semantic progression sources, not surface phrasing/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /You = final Korean surface wording/i,
    );
  });

  it("H. headings unchanged", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Structure headings define the section subject\/order and should normally be preserved/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /markdown headings matching the structure plan order/i,
    );
  });

  it("I. evidence boundary unchanged", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/Canonical = factual\/evidence/);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/남부 프레임/);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Descriptive adjectives and explanatory clauses must remain within the Canonical-supported claim boundary/i,
    );
  });

  it("J. no blacklist", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/not a banned-word list/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/Do not apply deterministic substitutions/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).not.toMatch(/blacklist:/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(
      /Avoid abstract subject → abstract conclusion chains/i,
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/reader-transformation endings/i);
  });
});
