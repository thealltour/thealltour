import { describe, expect, it } from "vitest";
import {
  buildDirectKey,
  isValidAdminUserKey,
  parseAdminUserKey,
  toAdminUserKey,
} from "@/lib/adminChat/keys";

describe("adminChat keys", () => {
  it("builds bootstrap admin user key", () => {
    expect(
      toAdminUserKey({
        isBootstrapAdmin: true,
        username: "admin",
        adminUserId: undefined,
        role: "admin",
        permissions: ["*"],
      }),
    ).toBe("bootstrap:admin");
  });

  it("builds sub-admin user key", () => {
    expect(
      toAdminUserKey({
        isBootstrapAdmin: false,
        adminUserId: "abc-123",
        username: "manager1",
        role: "manager",
        permissions: [],
      }),
    ).toBe("user:abc-123");
  });

  it("creates stable direct key regardless of order", () => {
    const a = buildDirectKey("user:1", "bootstrap:admin");
    const b = buildDirectKey("bootstrap:admin", "user:1");
    expect(a).toBe(b);
    expect(a).toBe("bootstrap:admin:user:1");
  });

  it("parses admin user keys", () => {
    expect(parseAdminUserKey("bootstrap:admin")).toEqual({
      kind: "bootstrap",
      username: "admin",
      key: "bootstrap:admin",
    });
    expect(parseAdminUserKey("user:uuid")).toEqual({
      kind: "user",
      userId: "uuid",
      key: "user:uuid",
    });
    expect(parseAdminUserKey("invalid")).toBeNull();
  });

  it("validates admin user keys", () => {
    expect(isValidAdminUserKey("user:abc")).toBe(true);
    expect(isValidAdminUserKey("bootstrap:x")).toBe(true);
    expect(isValidAdminUserKey("")).toBe(false);
  });
});
