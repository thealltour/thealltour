import { describe, expect, it } from "vitest";
import {
  applyQuickFilter,
  getInquiryPriorityScore,
  isUnresponded,
} from "@/components/admin/inquiries/inquiryQueue.utils";
import type { Inquiry } from "@/types/inquiry";

function makeInquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: "inq-1",
    name: "테스트",
    phone: "01012345678",
    consultation_status: "new",
    booking_status: "none",
    lead_priority: "medium",
    follow_up_at: null,
    assignee_name: null,
    unread_inbound_sms_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Inquiry;
}

describe("inquiryQueue.utils", () => {
  it("flags unresponded inquiries", () => {
    expect(isUnresponded(makeInquiry({ consultation_status: "new" }))).toBe(true);
    expect(isUnresponded(makeInquiry({ consultation_status: "contacted" }))).toBe(false);
  });

  it("filters unresponded quick filter", () => {
    const rows = [
      makeInquiry({ id: "a", consultation_status: "new" }),
      makeInquiry({ id: "b", consultation_status: "contacted" }),
    ];
    expect(applyQuickFilter(rows, "unresponded").map((r) => r.id)).toEqual(["a"]);
  });

  it("scores overdue higher than hot lead", () => {
    const overdue = makeInquiry({
      follow_up_at: new Date(Date.now() - 86400000).toISOString(),
      lead_priority: "low",
    });
    const hot = makeInquiry({ lead_priority: "high", consultation_status: "contacted" });
    expect(getInquiryPriorityScore(overdue)).toBeGreaterThan(getInquiryPriorityScore(hot));
  });
});
