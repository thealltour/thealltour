import { describe, expect, it } from "vitest";
import { getMobileNavKeysForSession } from "@/lib/adminRolePolicy";
import type { AdminSessionPermissions } from "@/lib/adminPermissions";

function session(partial: Partial<AdminSessionPermissions>): AdminSessionPermissions {
  return {
    role: "admin",
    permissions: [],
    isBootstrapAdmin: false,
    ...partial,
  };
}

describe("getMobileNavKeysForSession", () => {
  it("includes trend and agenda for settings.manage, not members/sms", () => {
    const keys = getMobileNavKeysForSession(
      session({
        permissions: [
          "dashboard.view",
          "settings.manage",
          "inquiries.manage",
          "notifications.view",
          "members.manage",
        ],
      }),
    );
    expect(keys).toEqual([
      "dashboard",
      "trend_inbox",
      "marketing_review",
      "inquiries",
      "notifications",
    ]);
    expect(keys).not.toContain("sms");
    expect(keys).not.toContain("members");
  });

  it("omits trend/agenda without settings.manage", () => {
    const keys = getMobileNavKeysForSession(
      session({
        permissions: ["dashboard.view", "inquiries.manage", "notifications.view"],
      }),
    );
    expect(keys).toEqual(["dashboard", "inquiries", "notifications"]);
    expect(keys).not.toContain("trend_inbox");
    expect(keys).not.toContain("marketing_review");
    expect(keys).not.toContain("sms");
  });
});
