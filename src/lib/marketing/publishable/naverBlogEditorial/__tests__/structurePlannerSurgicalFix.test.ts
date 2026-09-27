/**
 * Naver Blog Structure Planner surgical fix regressions (A–M).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import {
  NAVER_BLOG_SECTION_PURPOSES,
  NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { NAVER_BLOG_STRUCTURE_PLANNER_SOUL } from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";
import {
  NAVER_BLOG_SECTION_PURPOSE_ENUM_LINE,
  NAVER_BLOG_STRUCTURE_PURPOSE_REPAIR_MAX,
} from "@/lib/marketing/publishable/naverBlogEditorial/purposeRepair";

describe("naver blog structure planner surgical fix", () => {
  it("A. discovery does not require perspective expansion", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).not.toMatch(/perspective expansion/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /prefer curiosity \/ concrete context \/ concrete detail \/ documented contrast/i,
    );
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/A perspective shift is not required/i);
  });

  it("B. headings may be concrete topic labels", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /name the concrete subject of the section: place, people, architecture, record, contrast, limitation, or question/i,
    );
  });

  it("C. abstract editorial synthesis is not required in headings", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /Do not turn headings into editorial synthesis about perspective, awareness, meaning, insight, diversity, or criteria/i,
    );
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /not what the reader is supposed to realize/i,
    );
  });

  it("D. closing may be concrete recap", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /Use `closing` for concrete resolution or wrap-up/i,
    );
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).not.toMatch(
      /wrap-up \/ takeaway sections/i,
    );
  });

  it("E. limitation / open-question closing allowed", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /documented difference[\s\S]*person\/place\/building[\s\S]*limitation[\s\S]*open question/i,
    );
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /does not need to manufacture a takeaway about perspective, awareness, criteria, insight, or planning value/i,
    );
  });

  it("F. conclusionIntent may be short concrete semantic guidance", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /conclusionIntent` is semantic planning guidance, not final reader-facing prose/i,
    );
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/Keep it short and concrete/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /Do not write `conclusionIntent` as a reader-transformation sentence/i,
    );
  });

  it('G. Narrative "비교 기준/관점/다양성" need not surface in headings/intents', () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /semantic sources, not wording templates for headings/i,
    );
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /do not paste or compress abstract Narrative wording directly into Blog structure fields/i,
    );
  });

  it("H. Narrative meaning preserved", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/Preserve intended meaning/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /Narrative Plan = story progression/i,
    );
  });

  it("I. geo hard rule unchanged", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/남부 베트남/);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/남부 프레임/);
  });

  it("J. purpose repair unchanged", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toContain(NAVER_BLOG_SECTION_PURPOSE_ENUM_LINE);
    expect(NAVER_BLOG_SECTION_PURPOSES).toEqual([
      "opening",
      "context",
      "evidence",
      "detail",
      "contrast",
      "limitation",
      "closing",
      "faq_support",
    ]);
    expect(NAVER_BLOG_STRUCTURE_PURPOSE_REPAIR_MAX).toBe(2);
    const purposeSrc = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/naverBlogEditorial/purposeRepair.ts"),
      "utf8",
    );
    expect(purposeSrc).toMatch(/NO alias table/i);
    expect(purposeSrc).not.toMatch(/PURPOSE_ALIAS|purposeAliasMap|aliasMap/);
  });

  it("K. ctaIntent=null discovery behavior unchanged", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /ctaIntent \(null when non-commercial discovery\)/,
    );
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/Do NOT force checklist/);
  });

  it("L. no deterministic blacklist", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/not a banned-word list/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).not.toMatch(/blacklist:/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).not.toMatch(/banned words?:/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).not.toMatch(/건축적 맥락/);
  });

  it("M. evidence authority unchanged + registry parity", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/Do NOT write the full article body/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/Canonical = factual\/evidence/);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(
      /Prefer concrete Canonical-supported factual subjects/i,
    );
    expect(NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE).toBe("naver-blog-structure-planner");

    const entry = requireMarketingAgentSemanticContract("naver-blog-structure-planner");
    expect(entry.inputs.required).toEqual(
      expect.arrayContaining([
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ]),
    );
    expect(entry.inputs.optional ?? []).not.toContain("canonical.factualBoundary");
    const notes = entry.docs?.notes?.join("\n") ?? "";
    expect(notes).not.toMatch(/Phase 3A metadata only/);
    expect(notes).toMatch(/concrete structural labels/i);
    expect(notes).toMatch(/semantic planning, not final/i);
    expect(notes).toMatch(/concrete resolution\/recap/i);
  });
});
