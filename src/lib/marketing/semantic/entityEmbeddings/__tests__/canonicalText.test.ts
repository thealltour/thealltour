import { describe, expect, it } from "vitest";

import {
  buildAgendaCandidateCanonicalText,
  buildAgendaCandidateContentHash,
  buildCompletedMarketingCandidateContentHash,
  buildResearchBriefCanonicalText,
  buildResearchBriefContentHash,
  hashMarketingSemanticSourceText,
} from "@/lib/marketing/semantic/entityEmbeddings/canonicalText";
import { MARKETING_SEMANTIC_SOURCE_TEXT_VERSION } from "@/lib/marketing/semantic/entityEmbeddings/types";

describe("marketing semantic canonical text / hash", () => {
  it("is deterministic for research_brief inputs", () => {
    const input = {
      title: "  Indonesia visa  update ",
      summary: "Entry requirements changed.\nCheck before travel.",
      destinations: ["Bali", "indonesia", "Bali"],
      topics: ["visa", "Travel"],
      claims: ["Visa page updated", "Check FCDO"],
      practicalImplications: ["Verify entry rules"],
    };
    const a = buildResearchBriefContentHash(input);
    const b = buildResearchBriefContentHash({
      ...input,
      destinations: ["indonesia", "Bali"],
      topics: ["Travel", "visa"],
    });
    expect(a.canonicalText).toBe(b.canonicalText);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.sourceTextVersion).toBe(MARKETING_SEMANTIC_SOURCE_TEXT_VERSION);
    expect(a.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ignores irrelevant ordering noise for agenda_candidate", () => {
    const base = {
      title: "Taiwan health advisory",
      summary: "Health page updated",
      whyNow: "Current season",
      koreanTravelerRelevance: "Popular short-haul",
      practicalValue: "Pack meds",
      theAllTourRelevance: "Outbound FIT",
      destinations: ["taiwan", "Taipei"],
      topics: ["health", "travel"],
    };
    const a = buildAgendaCandidateContentHash(base);
    const b = buildAgendaCandidateContentHash({
      ...base,
      destinations: ["Taipei", "taiwan"],
      topics: ["travel", "health"],
    });
    expect(a.canonicalText).toBe(b.canonicalText);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("changes hash when meaningful text changes", () => {
    const a = buildResearchBriefContentHash({
      title: "Indonesia visa",
      summary: "Entry requirements changed",
    });
    const b = buildResearchBriefContentHash({
      title: "Indonesia visa",
      summary: "Entry requirements unchanged",
    });
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it("keeps hash stable when only excluded diagnostics would change", () => {
    const text = buildAgendaCandidateCanonicalText({
      title: "Grand Canyon reopen",
      summary: "Limited access",
      whyNow: "After floods",
      practicalValue: "Check closures",
    });
    const hashA = hashMarketingSemanticSourceText(text);
    const hashB = hashMarketingSemanticSourceText(text, MARKETING_SEMANTIC_SOURCE_TEXT_VERSION);
    expect(hashA).toBe(hashB);
    // Same semantic fields → same hash even if callers attach ids elsewhere
    const again = buildAgendaCandidateContentHash({
      title: "Grand Canyon reopen",
      summary: "Limited access",
      whyNow: "After floods",
      practicalValue: "Check closures",
    });
    expect(again.contentHash).toBe(hashA);
  });

  it("hashes completed marketing candidate draft body deterministically", () => {
    const a = buildCompletedMarketingCandidateContentHash({
      title: "인도네시아 비자 안내",
      topic: "indonesia",
      channel: "threads",
      contentType: "threads_text",
      body: "  출국 전 비자 요건을 확인하세요.  ",
      keyClaims: ["비자 요건 업데이트", "공식 채널 확인"],
    });
    const b = buildCompletedMarketingCandidateContentHash({
      title: "인도네시아 비자 안내",
      topic: "indonesia",
      channel: "threads",
      contentType: "threads_text",
      body: "출국 전 비자 요건을 확인하세요.",
      keyClaims: ["공식 채널 확인", "비자 요건 업데이트"],
    });
    expect(a.contentHash).toBe(b.contentHash);
    expect(buildResearchBriefCanonicalText({ title: "x", summary: "y" })).toContain("title:");
  });
});
