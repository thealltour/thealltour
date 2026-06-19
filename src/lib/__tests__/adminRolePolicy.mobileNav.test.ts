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
  it("includes sms instead of reviews for inquiries.manage", () => {
    const keys = getMobileNavKeysForSession(
      session({
        permissions: [
          "dashboard.view",
          "inquiries.manage",
          "notifications.view",
        ],
      }),
    );
    expect(keys).toContain("sms");
    expect(keys).not.toContain("reviews");
  });

  it("does not include sms without inquiries.manage", () => {
    const keys = getMobileNavKeysForSession(
      session({
        permissions: ["dashboard.view", "reviews.ops", "notifications.view"],
      }),
    );
    expect(keys).not.toContain("sms");
    expect(keys).not.toContain("reviews");
  });
});
