import { describe, expect, it } from "vitest";

import {
  isSessionAllowedForApiPath,
  isSessionAllowedForConsolePath,
} from "@/lib/adminRolePolicy";
import type { AdminSessionPermissions } from "@/lib/adminPermissions";

function sessionWith(permissions: AdminSessionPermissions["permissions"]): AdminSessionPermissions {
  return {
    isBootstrapAdmin: false,
    role: "admin",
    permissions,
  };
}

describe("adminRolePolicy ai-runtime", () => {
  it("requires settings.manage for ai-runtime API and console paths", () => {
    const allowed = sessionWith(["settings.manage"]);
    const denied = sessionWith(["tools.view"]);

    expect(isSessionAllowedForApiPath(allowed, "/api/admin/ai-runtime/status")).toBe(true);
    expect(isSessionAllowedForApiPath(denied, "/api/admin/ai-runtime/status")).toBe(false);
    expect(isSessionAllowedForConsolePath(allowed, "/ai-runtime")).toBe(true);
    expect(isSessionAllowedForConsolePath(denied, "/ai-runtime")).toBe(false);
  });
});
