import { describe, expect, it } from "vitest";
import { normalizeInquiryRow } from "@/lib/inquiries/normalizeInquiryRow";

describe("normalizeInquiryRow corporate_brief", () => {
  it("keeps validated corporate_brief in quote_snapshot", () => {
    const inquiry = normalizeInquiryRow({
      id: "1",
      name: "홍길동",
      phone: "010-1111-2222",
      content: "기업 견적",
      quote_snapshot: {
        corporate_brief: {
          org_type: "business",
          org_name: "더올",
          purpose: "포상여행",
          program_id: "corporate-golf",
          program_label: "기업 골프",
          golf_rounds: "2라운드",
          extra_ignored: "nope",
        },
      },
    });
    expect(inquiry.quote_snapshot?.corporate_brief).toMatchObject({
      org_type: "business",
      org_name: "더올",
      purpose: "포상여행",
      program_id: "corporate-golf",
      program_label: "기업 골프",
      golf_rounds: "2라운드",
    });
    expect(
      (inquiry.quote_snapshot?.corporate_brief as Record<string, unknown> | undefined)
        ?.extra_ignored,
    ).toBeUndefined();
  });

  it("drops invalid corporate_brief", () => {
    const inquiry = normalizeInquiryRow({
      id: "2",
      name: "홍길동",
      phone: "010",
      content: "",
      quote_snapshot: {
        corporate_brief: { org_type: "business" },
      },
    });
    expect(inquiry.quote_snapshot).toBeUndefined();
  });
});
