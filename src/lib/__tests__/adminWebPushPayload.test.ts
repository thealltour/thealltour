import { describe, expect, it } from "vitest";
import {
  buildAdminWebPushPayload,
  isExpiredPushSubscriptionStatus,
} from "@/lib/adminWebPushPayload";

describe("buildAdminWebPushPayload", () => {
  it("builds service worker compatible payload with defaults", () => {
    expect(
      buildAdminWebPushPayload({
        title: "신규 상담 신청",
        body: "홍길동님 문의",
        targetUrl: "/theall_manager_only/inquiries?id=1",
        type: "new_inquiry",
        unreadCount: 3,
      }),
    ).toEqual({
      title: "신규 상담 신청",
      body: "홍길동님 문의",
      url: "/theall_manager_only/inquiries?id=1",
      type: "new_inquiry",
      unreadCount: 3,
    });
  });

  it("falls back when fields are empty", () => {
    expect(
      buildAdminWebPushPayload({
        title: "  ",
        body: "",
        unreadCount: -1,
      }),
    ).toEqual({
      title: "더올투어 관리",
      body: "",
      url: "/theall_manager_only/notifications",
      type: "admin-notification",
      unreadCount: 0,
    });
  });
});

describe("isExpiredPushSubscriptionStatus", () => {
  it("detects expired push subscription HTTP codes", () => {
    expect(isExpiredPushSubscriptionStatus(410)).toBe(true);
    expect(isExpiredPushSubscriptionStatus(404)).toBe(true);
    expect(isExpiredPushSubscriptionStatus(429)).toBe(false);
  });
});
