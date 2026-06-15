import { describe, expect, it } from "vitest";
import { normalizeInboundSenderPhone } from "@/lib/sms/normalizeInboundPhone";

describe("linkInboundSmsToMemberByPhone phone matching", () => {
  it("normalizes phone numbers consistently for matching", () => {
    const sender = normalizeInboundSenderPhone("010-2222-7453");
    const member = normalizeInboundSenderPhone("01022227453");
    expect(sender).toBe(member);
    expect(sender.length).toBeGreaterThanOrEqual(10);
  });
});

describe("sms conversation link type", () => {
  function resolveLinkType(inquiryId: string | null, memberId: string | null) {
    if (inquiryId && memberId) return "both";
    if (inquiryId) return "inquiry";
    if (memberId) return "member";
    return "none";
  }

  it("treats member-only as connected", () => {
    expect(resolveLinkType(null, "member-1")).toBe("member");
    expect(resolveLinkType(null, "member-1")).not.toBe("none");
  });

  it("unmatched when neither linked", () => {
    expect(resolveLinkType(null, null)).toBe("none");
  });
});
