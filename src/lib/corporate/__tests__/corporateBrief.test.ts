import { describe, expect, it } from "vitest";
import { buildCorporateQuoteHref } from "@/lib/corporate/buildCorporateQuoteHref";
import {
  orgTypeFromQuoteCategory,
  resolveInitialProgramId,
  validateCorporateBrief,
} from "@/lib/corporate/corporateBrief";

describe("corporateBrief validation", () => {
  it("maps quote categories to org types and ignores foreign programs", () => {
    expect(orgTypeFromQuoteCategory("corporate")).toBeNull();
    expect(orgTypeFromQuoteCategory("corporate-business")).toBe("business");
    expect(resolveInitialProgramId("business", "corporate-golf")).toBe("corporate-golf");
    expect(resolveInitialProgramId("business", "energy-environment")).toBeNull();
    expect(resolveInitialProgramId(null, "corporate-golf")).toBeNull();
  });

  it("requires org fields and rejects mismatched programs", () => {
    expect(
      validateCorporateBrief({
        org_type: "business",
        org_name: "더올",
        purpose: "포상",
        program_id: "energy-environment",
      }).ok,
    ).toBe(false);

    const ok = validateCorporateBrief({
      org_type: "business",
      org_name: "더올",
      purpose: "포상",
      program_id: "corporate-golf",
      golf_rounds: "3라운드",
      job_topic: "should-drop",
      headcount_flexible: true,
      timing_flexible: true,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.brief.program_label).toBe("기업 골프");
      expect(ok.brief.golf_rounds).toBe("3라운드");
      expect(ok.brief.job_topic).toBeUndefined();
      expect(ok.brief.headcount).toBeNull();
      expect(ok.brief.headcount_flexible).toBe(true);
    }
  });

  it("appends program to quote href", () => {
    expect(
      buildCorporateQuoteHref({
        sourcePath: "/corporate/business",
        quoteCategory: "corporate-business",
        program: "corporate-golf",
      }),
    ).toContain("program=corporate-golf");
  });
});
